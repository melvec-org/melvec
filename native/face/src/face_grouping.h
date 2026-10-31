
#pragma once

#include "face_extractor.h"

#include <opencv2/objdetect/face.hpp>

#include <vector>


/**
 * Groups accepted face observations into identities and chooses a single
 * representative observation for each identity.
 *
 * This class is intentionally limited to grouping and representative
 * selection. It does not perform persistence, subject assignment, or
 * permanent file management.
 */
class FaceGrouping {
public:

    /**
     * Minimum average-link similarity required to merge two clusters,
     * and reused by the final identity reassignment pass in
     * `face_extractor.cpp` to unify survivors that grouping split.
     */
    static constexpr float SIMILARITY_THRESHOLD = 0.45f;

    /**
     * Groups accepted observations by identity using SFace similarity.
     *
     * The returned nested vectors contain indexes into the original
     * `observations` input.
     *
     * @param observations Accepted observations produced by
     * `FaceExtractor::extract(...)` before final selection.
     * @param recognizer OpenCV SFace recognizer used for feature
     * comparison.
     * @return Identity groups expressed as indexes into `observations`.
     */
    static std::vector<std::vector<int>> group(
        const std::vector<ExtractedFace>& observations,
        const cv::Ptr<cv::FaceRecognizerSF>& recognizer
    );


    /**
     * Selects up to `maxPerGroup` representative observations from each
     * group, ordered best-first by quality and then confidence.
     *
     * The returned indexes refer back to the original `observations`
     * vector, not to positions inside each group.
     *
     * @param groups Identity groups returned by `FaceGrouping::group(...)`.
     * @param observations Original observations that contain ranking
     * signals.
     * @param maxPerGroup Maximum number of representatives to keep for
     * each identity group.
     * @return Ordered observation indexes across all groups.
     */
    static std::vector<std::pair<int,int>> selectTopCandidates(
        const std::vector<std::vector<int>>& groups,
        const std::vector<ExtractedFace>& observations,
        const cv::Ptr<cv::FaceRecognizerSF>& recognizer,
        size_t maxPerGroup = 2
    );


    /**
     * Computes cosine similarity between two SFace feature matrices using
     * OpenCV's `cv::FaceRecognizerSF::match()` implementation.
     *
     * This is used both by the final identity grouping stage and by the
     * earlier near-duplicate suppression step in `face_extractor.cpp`.
     *
     * @return Similarity score, or `-1.0f` when inputs are invalid.
     */
    static float cosineSimilarity(
        const cv::Mat& a,
        const cv::Mat& b,
        const cv::Ptr<cv::FaceRecognizerSF>& recognizer
    );
};
