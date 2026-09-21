
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
     * Selects the highest-quality observation from each group.
     *
     * The returned indexes refer back to the original `observations`
     * vector, not to positions inside each group.
     *
     * @param groups Identity groups returned by `FaceGrouping::group(...)`.
     * @param observations Original observations that contain quality
     * scores.
     * @return One observation index per group.
     */
    static std::vector<int> selectBest(
        const std::vector<std::vector<int>>& groups,
        const std::vector<ExtractedFace>& observations
    );


private:

    /**
     * Computes cosine similarity between two SFace feature matrices using
     * OpenCV's `cv::FaceRecognizerSF::match()` implementation.
     *
     * @return Similarity score, or `-1.0f` when inputs are invalid.
     */
    static float cosineSimilarity(
        const cv::Mat& a,
        const cv::Mat& b,
        const cv::Ptr<cv::FaceRecognizerSF>& recognizer
    );
};
