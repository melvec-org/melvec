#include "face_quality.h"

#include <opencv2/calib3d.hpp>
#include <opencv2/objdetect/face.hpp>

#include <algorithm>
#include <cmath>
#include <vector>


namespace {

/**
 * Simplified 3D facial landmark model used for approximate head-pose
 * estimation from YuNet's five 2D landmark points.
 */
const std::vector<cv::Point3f> FACE_3D_POINTS = {
    cv::Point3f(-30.0f,  0.0f,  0.0f),
    cv::Point3f( 30.0f,  0.0f,  0.0f),
    cv::Point3f(  0.0f, 25.0f, -5.0f),
    cv::Point3f(-22.0f, 50.0f,  0.0f),
    cv::Point3f( 22.0f, 50.0f,  0.0f)
};

}


/**
 * Converts an input face image to grayscale while preserving single-
 * channel inputs.
 */
static cv::Mat toGray(const cv::Mat& face) {
    if (face.empty()) {
        return cv::Mat();
    }

    if (face.channels() == 1) {
        return face;
    }

    cv::Mat gray;
    cv::cvtColor(face, gray, cv::COLOR_BGR2GRAY);
    return gray;
}


/**
 * Calculates image sharpness using variance of the Laplacian.
 *
 * Empty images are treated as unusable and return `0.0f`.
 */
float FaceQuality::calculateSharpness(
    const cv::Mat& face
) {
    cv::Mat gray = toGray(face);

    if (gray.empty()) {
        return 0.0f;
    }

    cv::Mat laplacian;

    cv::Laplacian(
        gray,
        laplacian,
        CV_64F
    );

    cv::Scalar mean;
    cv::Scalar stddev;

    cv::meanStdDev(
        laplacian,
        mean,
        stddev
    );

    return static_cast<float>(
        stddev[0] * stddev[0]
    );
}


float FaceQuality::calculateBrightness(
    const cv::Mat& face
) {
    cv::Mat gray = toGray(face);

    if (gray.empty()) {
        return 0.0f;
    }

    return static_cast<float>(
        cv::mean(gray)[0]
    );
}


float FaceQuality::calculateContrast(
    const cv::Mat& face
) {
    cv::Mat gray = toGray(face);

    if (gray.empty()) {
        return 0.0f;
    }

    cv::Scalar mean;
    cv::Scalar stddev;

    cv::meanStdDev(
        gray,
        mean,
        stddev
    );

    return static_cast<float>(
        stddev[0]
    );
}


/**
 * Estimates approximate head yaw from YuNet landmark coordinates.
 *
 * This uses a simplified 3D face model together with `cv::solvePnP()`
 * and extracts the yaw component from the resulting rotation matrix.
 * The result is used as a quality signal, not as ground-truth pose.
 */
double FaceQuality::calculateYaw(
    const cv::Mat& detection,
    const cv::Size& detectorInputSize
) {
    if (detection.cols < 15) {
        return 0.0;
    }

    std::vector<cv::Point2f> imagePoints = {
        cv::Point2f(
            detection.at<float>(0, 5),
            detection.at<float>(0, 6)
        ),

        cv::Point2f(
            detection.at<float>(0, 7),
            detection.at<float>(0, 8)
        ),

        cv::Point2f(
            detection.at<float>(0, 9),
            detection.at<float>(0, 10)
        ),

        cv::Point2f(
            detection.at<float>(0, 11),
            detection.at<float>(0, 12)
        ),

        cv::Point2f(
            detection.at<float>(0, 13),
            detection.at<float>(0, 14)
        )
    };


    double focalLength =
        std::max(
            detectorInputSize.width,
            detectorInputSize.height
        );

    cv::Point2d center(
        detectorInputSize.width / 2.0,
        detectorInputSize.height / 2.0
    );


    cv::Mat cameraMatrix = cv::Mat::eye(
        3,
        3,
        CV_64F
    );

    cameraMatrix.at<double>(0, 0) = focalLength;
    cameraMatrix.at<double>(1, 1) = focalLength;
    cameraMatrix.at<double>(0, 2) = center.x;
    cameraMatrix.at<double>(1, 2) = center.y;


    cv::Mat rotationVector;
    cv::Mat translationVector;


    bool solved =
        cv::solvePnP(
            FACE_3D_POINTS,
            imagePoints,
            cameraMatrix,
            cv::Mat(),
            rotationVector,
            translationVector,
            false,
            cv::SOLVEPNP_EPNP
        );


    if (!solved) {
        return 0.0;
    }


    cv::Mat rotationMatrix;

    cv::Rodrigues(
        rotationVector,
        rotationMatrix
    );


    cv::Mat mtxR;
    cv::Mat mtxQ;

    cv::Vec3d eulerAngles =
        cv::RQDecomp3x3(
            rotationMatrix,
            mtxR,
            mtxQ
        );


    return eulerAngles[1];
}


/**
 * Combines multiple normalized quality signals into a single weighted
 * score for representative selection.
 *
 * The current weighting favors confidence, sharpness, and frontal pose
 * while also rewarding reasonable exposure and visible contrast.
 */
float FaceQuality::calculateQuality(
    float confidence,
    int faceWidth,
    int faceHeight,
    double sharpness,
    double yaw,
    double brightness,
    double contrast
) {
    double confidenceScore =
        std::clamp(
            static_cast<double>(confidence),
            0.0,
            1.0
        );

    double size =
        static_cast<double>(
            std::min(faceWidth, faceHeight)
        );

    double sizeScore =
        std::clamp(
            (size - 80.0) / 80.0,
            0.0,
            1.0
        );

    double sharpnessScore =
        std::clamp(
            (sharpness - MIN_SHARPNESS) / 400.0,
            0.0,
            1.0
        );

    double yawScore =
        1.0 -
        std::clamp(
            std::abs(yaw) / MAX_YAW_DEGREES,
            0.0,
            1.0
        );

    /*
     * Favor faces near a mid-range brightness target so extremely dark
     * and washed-out crops are both penalized.
     */
    constexpr double TARGET_BRIGHTNESS = 135.0;
    constexpr double BRIGHTNESS_TOLERANCE = 70.0;

    double brightnessScore =
        1.0 -
        std::clamp(
            std::abs(brightness - TARGET_BRIGHTNESS) /
                BRIGHTNESS_TOLERANCE,
            0.0,
            1.0
        );

    double contrastScore =
        std::clamp(
            contrast / 55.0,
            0.0,
            1.0
        );

    return static_cast<float>(
        confidenceScore * 0.22 +
        sizeScore       * 0.15 +
        sharpnessScore  * 0.22 +
        yawScore        * 0.18 +
        brightnessScore * 0.13 +
        contrastScore   * 0.10
    );
}