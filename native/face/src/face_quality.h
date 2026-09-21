#pragma once

#include <opencv2/opencv.hpp>

/**
 * Utility functions and thresholds for deciding whether a detected face
 * is usable and how strong of a representative it is.
 *
 * This class evaluates observation quality only. It does not determine
 * identity and does not perform grouping.
 */
class FaceQuality {
public:

    /** Minimum YuNet confidence required to keep a detection. */
    static constexpr float MIN_CONFIDENCE = 0.80f;

    /** Minimum accepted face width in pixels. */
    static constexpr int MIN_FACE_WIDTH = 80;

    /** Minimum accepted face height in pixels. */
    static constexpr int MIN_FACE_HEIGHT = 80;

    /** Minimum Laplacian-variance sharpness score for accepted faces. */
    static constexpr double MIN_SHARPNESS = 300.0;

    /** Maximum absolute estimated yaw angle for accepted faces. */
    static constexpr double MAX_YAW_DEGREES = 65.0;


    /**
     * Estimates image sharpness using variance of the Laplacian.
     *
     * @param face Input face image, typically already aligned.
     * @return Larger values indicate sharper images.
     */
    static float calculateSharpness(
        const cv::Mat& face
    );


    /**
     * Estimates approximate head yaw from YuNet's five facial landmarks.
     *
     * @param detection A single YuNet detection row containing bounding
     * box, landmarks, and confidence.
     * @param detectorInputSize Detector input size used to interpret the
     * landmark coordinates.
     * @return Estimated yaw angle in degrees. Returns `0.0` when pose
     * estimation cannot be solved.
     */
    static double calculateYaw(
        const cv::Mat& detection,
        const cv::Size& detectorInputSize
    );


    /**
     * Combines confidence, size, sharpness, and yaw into a normalized
     * observation quality score.
     *
     * @return Weighted quality score in the range `[0, 1]` after
     * internal clamping of the component terms.
     */
    static float calculateQuality(
        float confidence,
        int faceWidth,
        int faceHeight,
        double sharpness,
        double yaw
    );
};