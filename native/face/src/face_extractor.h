
#pragma once

#include <opencv2/opencv.hpp>

#include <string>
#include <vector>


/**
 * Represents one accepted face observation or one selected
 * representative face returned by the extractor.
 *
 * During extraction, every valid observation is retained long enough for
 * grouping and representative selection. After grouping, only the chosen
 * representatives are returned to the caller.
 */
struct ExtractedFace {

    /** Stable per-run identifier derived from frame and detection index. */
    std::string id;

    /** Path to the saved aligned face thumbnail image. */
    std::string imagePath;

    /** YuNet detection confidence for this observation. */
    float confidence;

    /** Computed observation quality score used for representative selection. */
    float quality;

    /** Zero-based source video frame index where the face was observed. */
    int frameIndex;

    /** Timestamp in seconds derived from frame index and video FPS. */
    double timestamp;

    /**
     * SFace feature used during the current extraction and grouping run.
     *
     * The original OpenCV feature matrix is preserved so grouping can use
     * `cv::FaceRecognizerSF::match()` directly.
     */
    cv::Mat feature;

    /**
     * Serializable copy of the SFace feature for later JSON output or
     * persistence.
     */
    std::vector<float> embedding;
};


class FaceExtractor {
public:

    /**
     * Creates a face extraction pipeline bound to specific model and
     * ffmpeg/ffprobe executable paths.
     *
     * @param ffmpegPath Path to the ffmpeg executable used for video
     * decoding.
     * @param ffprobePath Path to the ffprobe executable used for video
     * probing.
     * @param detectorModel Path to the YuNet ONNX model.
     * @param recognizerModel Path to the SFace ONNX model.
     */
    FaceExtractor(
        const std::string& ffmpegPath,
        const std::string& ffprobePath,
        const std::string& detectorModel,
        const std::string& recognizerModel
    );


    /**
     * Runs the full extraction pipeline for a video.
     *
     * Stages include frame sampling, YuNet detection, quality filtering,
     * SFace alignment and feature extraction, identity grouping,
     * representative selection, and deletion of non-representative
     * temporary thumbnails.
     *
     * @param videoPath Path to the input video.
     * @param outputDirectory Directory where aligned face thumbnails are
     * written.
     * @param sampleIntervalSeconds Interval between sampled frames.
     *
     * @return One `ExtractedFace` per selected identity representative.
     *
     * @throws std::runtime_error If extraction cannot be completed.
     */
    std::vector<ExtractedFace> extract(
        const std::string& videoPath,
        const std::string& outputDirectory,
        double sampleIntervalSeconds = 1.0
    );


private:

    std::string ffmpegPath;
    std::string ffprobePath;

    std::string detectorModel;
    std::string recognizerModel;


    cv::Ptr<cv::FaceDetectorYN> detector;

    cv::Ptr<cv::FaceRecognizerSF> recognizer;


    std::string generateFaceId(
        int frameIndex,
        int faceIndex
    );
};

