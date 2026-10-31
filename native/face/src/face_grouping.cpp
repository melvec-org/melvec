
#include "face_grouping.h"

#include <limits>
#include <vector>


namespace {

// Threshold is defined as FaceGrouping::SIMILARITY_THRESHOLD in the header.


/**
 * Calculates average-link similarity between two candidate clusters.
 *
 * Average-link similarity is the mean pairwise cosine similarity across
 * all cross-cluster observation pairs. Unlike complete-link (which uses
 * the minimum and breaks on any one weak pair) or single-link (which
 * uses the maximum and can chain unrelated faces), average-link gives a
 * robust estimate of overall cluster affinity — the right trade-off for
 * face identity grouping where pose and lighting vary between frames.
 */
float calculateAverageLinkSimilarity(
    const std::vector<int>& clusterA,
    const std::vector<int>& clusterB,
    const std::vector<std::vector<float>>& similarityMatrix
) {
    float totalSimilarity = 0.0f;
    int pairCount = 0;

    for (int observationA : clusterA) {

        for (int observationB : clusterB) {

            totalSimilarity +=
                similarityMatrix[
                    observationA
                ][
                    observationB
                ];

            ++pairCount;
        }
    }

    if (pairCount == 0) {
        return 0.0f;
    }

    return totalSimilarity / static_cast<float>(pairCount);
}



}


/**
 * Computes cosine similarity between two SFace embeddings using
 * OpenCV's native matcher implementation.
 *
 * Invalid inputs return `-1.0f` so callers can treat them as unusable
 * comparisons.
 */
float FaceGrouping::cosineSimilarity(
    const cv::Mat& a,
    const cv::Mat& b,
    const cv::Ptr<cv::FaceRecognizerSF>& recognizer
) {
    if (
        a.empty() ||
        b.empty() ||
        recognizer.empty()
    ) {
        return -1.0f;
    }


    return recognizer->match(
        a,
        b,
        cv::FaceRecognizerSF::DisType::FR_COSINE
    );
}


/**
 * Groups extracted observations into identity clusters using
 * hierarchical average-link clustering over the full pairwise SFace
 * similarity matrix.
 *
 * Each returned group contains indexes into the original
 * `observations` vector. The method is intentionally limited to
 * grouping and does not delete files or select the final
 * representative.
 */
std::vector<std::vector<int>> FaceGrouping::group(
    const std::vector<ExtractedFace>& observations,
    const cv::Ptr<cv::FaceRecognizerSF>& recognizer
) {
    std::vector<std::vector<int>> groups;


    if (observations.empty()) {
        return groups;
    }


    if (recognizer.empty()) {
        return groups;
    }


    const int observationCount =
        static_cast<int>(
            observations.size()
        );


    /*
     * Build the complete pairwise similarity matrix.
     *
     * We calculate each pair only once because the matrix
     * is symmetrical.
     */
    std::vector<std::vector<float>> similarityMatrix(
        observationCount,
        std::vector<float>(
            observationCount,
            0.0f
        )
    );


    for (
        int i = 0;
        i < observationCount;
        ++i
    ) {

        similarityMatrix[i][i] =
            1.0f;


        for (
            int j = i + 1;
            j < observationCount;
            ++j
        ) {

            float similarity =
                cosineSimilarity(
                    observations[i].feature,
                    observations[j].feature,
                    recognizer
                );


            similarityMatrix[i][j] =
                similarity;

            similarityMatrix[j][i] =
                similarity;
        }
    }


    /*
     * Initially every observation is its own cluster.
     */
    for (
        int observationIndex = 0;
        observationIndex < observationCount;
        ++observationIndex
    ) {

        groups.push_back(
            { observationIndex }
        );
    }


    /*
     * Hierarchical average-link clustering.
     *
     * At every iteration we find the pair of clusters with
     * the highest mean pairwise similarity.
     */
    while (groups.size() > 1) {

        float bestSimilarity =
            -std::numeric_limits<float>::max();


        int bestGroupA = -1;
        int bestGroupB = -1;


        /*
         * Find the strongest valid cluster pair.
         */
        for (
            size_t groupA = 0;
            groupA < groups.size();
            ++groupA
        ) {

            for (
                size_t groupB = groupA + 1;
                groupB < groups.size();
                ++groupB
            ) {

                float similarity =
                    calculateAverageLinkSimilarity(
                        groups[groupA],
                        groups[groupB],
                        similarityMatrix
                    );


                if (similarity > bestSimilarity) {

                    bestSimilarity =
                        similarity;

                    bestGroupA =
                        static_cast<int>(
                            groupA
                        );

                    bestGroupB =
                        static_cast<int>(
                            groupB
                        );
                }
            }
        }


        /*
         * The best possible cluster pair is below the
         * threshold, so no additional identities can be
         * safely merged.
         */
        if (
            bestGroupA < 0 ||
            bestGroupB < 0 ||
            bestSimilarity <
                FaceGrouping::SIMILARITY_THRESHOLD
        ) {
            break;
        }


        /*
         * Merge group B into group A.
         */
        groups[bestGroupA].insert(
            groups[bestGroupA].end(),
            groups[bestGroupB].begin(),
            groups[bestGroupB].end()
        );


        /*
         * Remove the old group B.
         *
         * The actual observations remain untouched.
         * Only the temporary clustering structure changes.
         */
        groups.erase(
            groups.begin() + bestGroupB
        );
    }


    /*
     * Sort each group by observation index.
     *
     * This makes the output deterministic and easier to inspect.
     */
    for (std::vector<int>& group : groups) {

        std::sort(
            group.begin(),
            group.end()
        );
    }


    /*
     * Sort groups by their first observation.
     *
     * Again, this is only for deterministic diagnostic output.
     */
    std::sort(
        groups.begin(),
        groups.end(),
        [](
            const std::vector<int>& a,
            const std::vector<int>& b
        ) {
            return a.front() < b.front();
        }
    );


    /*
     * IMPORTANT:
     *
     * We are still only grouping observations.
     *
     * We are NOT selecting the best face yet.
     * We are NOT deleting lower-quality observations yet.
     * We are NOT writing anything to the database yet.
     *
     * That will be the next stage after we validate that
     * these groups are correct on the real video.
     */
    return groups;
}


/**
 * Selects up to `maxPerGroup` representative observations from each
 * completed identity group, maximising both quality and visual diversity.
 *
 * Selection strategy:
 *   1. Always pick the highest-quality observation as the primary rep.
 *   2. For each additional slot, pick the remaining candidate that is
 *      most dissimilar (lowest cosine similarity) to all already-selected
 *      reps for this group. This ensures the two shots of the same person
 *      are complementary (e.g. different pose or lighting) rather than
 *      near-duplicates of the best frame.
 *
 * Each returned pair: (observationIndex, groupIndex).
 */
std::vector<std::pair<int,int>> FaceGrouping::selectTopCandidates(
    const std::vector<std::vector<int>>& groups,
    const std::vector<ExtractedFace>& observations,
    const cv::Ptr<cv::FaceRecognizerSF>& recognizer,
    size_t maxPerGroup
) {
    std::vector<std::pair<int,int>> representatives;

    for (
        size_t groupIndex = 0;
        groupIndex < groups.size();
        ++groupIndex
    ) {
        const std::vector<int>& group =
            groups[groupIndex];

        if (group.empty()) {
            continue;
        }

        /*
         * Step 1: sort all candidates by quality descending so the
         * primary representative is always the best-quality one.
         */
        std::vector<int> ranked = group;

        std::sort(
            ranked.begin(),
            ranked.end(),
            [&](int leftIndex, int rightIndex) {
                const ExtractedFace& left =
                    observations[leftIndex];

                const ExtractedFace& right =
                    observations[rightIndex];

                if (left.quality != right.quality) {
                    return left.quality > right.quality;
                }

                if (left.confidence != right.confidence) {
                    return left.confidence > right.confidence;
                }

                return left.frameIndex < right.frameIndex;
            }
        );

        /*
         * Step 2: greedily pick up to maxPerGroup candidates.
         *
         * The first pick is always ranked[0] (best quality).
         * Every subsequent pick is the remaining candidate with the
         * lowest maximum similarity to any already-selected candidate —
         * i.e. the one that looks most different from all selected so far.
         */
        std::vector<int> selected;
        selected.reserve(maxPerGroup);

        std::vector<bool> used(ranked.size(), false);

        for (
            size_t slot = 0;
            slot < maxPerGroup && slot < ranked.size();
            ++slot
        ) {
            if (slot == 0) {
                /*
                 * Primary: always the highest-quality candidate.
                 */
                selected.push_back(ranked[0]);
                used[0] = true;
                continue;
            }

            /*
             * Diversity pick: find the candidate least similar to
             * any already-selected rep for this group.
             *
             * We use min-max similarity: for each remaining candidate
             * compute its maximum similarity to any selected rep, then
             * pick the candidate with the lowest such maximum.
             * This is the standard max-min diversity criterion.
             */
            int bestCandidatePos = -1;
            float bestMaxSimilarity =
                std::numeric_limits<float>::max();

            for (
                size_t candidatePos = 0;
                candidatePos < ranked.size();
                ++candidatePos
            ) {
                if (used[candidatePos]) {
                    continue;
                }

                const ExtractedFace& candidate =
                    observations[ranked[candidatePos]];

                float maxSimilarityToSelected = -1.0f;

                for (int selectedIndex : selected) {
                    const float sim =
                        cosineSimilarity(
                            candidate.feature,
                            observations[selectedIndex].feature,
                            recognizer
                        );

                    if (sim > maxSimilarityToSelected) {
                        maxSimilarityToSelected = sim;
                    }
                }

                if (maxSimilarityToSelected < bestMaxSimilarity) {
                    bestMaxSimilarity = maxSimilarityToSelected;
                    bestCandidatePos =
                        static_cast<int>(candidatePos);
                }
            }

            if (bestCandidatePos >= 0) {
                selected.push_back(ranked[bestCandidatePos]);
                used[bestCandidatePos] = true;
            }
        }

        for (int observationIndex : selected) {
            representatives.emplace_back(
                observationIndex,
                static_cast<int>(groupIndex)
            );
        }
    }

    return representatives;
}
