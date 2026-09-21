
#include "face_grouping.h"

#include <limits>
#include <vector>


namespace {

/**
 * Minimum complete-link similarity required to merge two clusters.
 *
 * Because complete-link uses the lowest cross-cluster pairwise
 * similarity, this value is intentionally lower than similarities often
 * seen between especially similar individual frames.
 */
constexpr float GROUP_SIMILARITY_THRESHOLD = 0.30f;


/**
 * Calculates complete-link similarity between two candidate clusters.
 *
 * Complete-link similarity is defined as the lowest pairwise similarity
 * between any observation in `clusterA` and any observation in
 * `clusterB`, which prevents loose chain-like merges.
 */
float calculateCompleteLinkSimilarity(
    const std::vector<int>& clusterA,
    const std::vector<int>& clusterB,
    const std::vector<std::vector<float>>& similarityMatrix
) {
    float minimumSimilarity =
        std::numeric_limits<float>::max();


    for (int observationA : clusterA) {

        for (int observationB : clusterB) {

            float similarity =
                similarityMatrix[
                    observationA
                ][
                    observationB
                ];


            if (similarity < minimumSimilarity) {

                minimumSimilarity =
                    similarity;
            }
        }
    }


    return minimumSimilarity;
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
 * hierarchical complete-link clustering over the full pairwise SFace
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
     * Hierarchical complete-link clustering.
     *
     * At every iteration we find the pair of clusters with
     * the highest minimum pairwise similarity.
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
                    calculateCompleteLinkSimilarity(
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
                GROUP_SIMILARITY_THRESHOLD
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
 * Selects the highest-quality observation from each completed identity
 * group.
 *
 * Returned values are indexes into the original `observations` vector.
 * This function does not delete thumbnails or move files.
 */
std::vector<int> FaceGrouping::selectBest(
    const std::vector<std::vector<int>>& groups,
    const std::vector<ExtractedFace>& observations
) {
    std::vector<int> representatives;


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


        int bestObservation =
            group.front();


        float bestQuality =
            observations[bestObservation].quality;


        for (int observationIndex : group) {

            const ExtractedFace& observation =
                observations[observationIndex];


            if (observation.quality > bestQuality) {

                bestQuality =
                    observation.quality;

                bestObservation =
                    observationIndex;
            }
        }


        representatives.push_back(
            bestObservation
        );
    }


    return representatives;
}
