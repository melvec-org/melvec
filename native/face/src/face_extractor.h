
#pragma once

#include <opencv2/opencv.hpp>

#include <chrono>
#include <string>
#include <vector>

struct FaceExtractionSummary {
    int detectedFaces = 0;
    int qualifiedFaces = 0;
    int outputFaces = 0;
};

struct FaceExtractionTiming {
    std::chrono::steady_clock::duration frameReadTime{};
    std::chrono::steady_clock::duration processFrameTime{};
    std::chrono::steady_clock::duration groupingTime{};
    std::chrono::steady_clock::duration finalWriteTime{};
    FaceExtractionSummary summary;
};


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

    /** Path to the final saved aligned face thumbnail image. */
    std::string imagePath;

    /** YuNet detection confidence for this observation. */
    float confidence;

    /** Computed observation quality score used for representative selection. */
    float quality;

    /**
     * Approximate zero-based source video frame index for the sampled
     * timestamp where the face was observed.
     */
    int frameIndex;

    /**
     * Zero-based index into the ordered sample list for this extraction
     * run. Used by early deduplication to compare proximity in sampling
     * space rather than raw frame space, which is meaningful for both
     * sequential (frame-accurate) and sparse batch sampling paths.
     */
    int sampleIndex = 0;

    /**
     * Requested sample timestamp in seconds for the extracted frame.
     */
    double timestamp;

    /**
     * Original YuNet detection row retained so the representative face
     * can be recovered from the source frame during the final image-write
     * pass.
     */
    cv::Mat detection;

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

    /**
     * Zero-based identity group index assigned during clustering.
     *
     * All representatives that belong to the same person share the same
     * `identityIndex`. The index is stable within a single extraction
     * run and is ordered by the first observation of each identity.
     */
    int identityIndex = -1;
};


struct FaceExtractionResult {
    std::vector<ExtractedFace> faces;
    FaceExtractionSummary summary;
};


class FaceExtractor {
public:

    /**
     * Creates a face extraction pipeline bound to specific model and
     * ffmpeg/ffprobe executable paths.
     *
     * ffmpeg/ffprobe are used for video inputs, while still images are
     * loaded directly through OpenCV.
     *
     * @param ffmpegPath Path to the ffmpeg executable used for video
     * frame extraction.
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
     * Runs the full extraction pipeline for a video or image.
     *
     * For videos, stages include sparse frame sampling, YuNet detection,
     * quality filtering, SFace alignment and feature extraction,
     * identity grouping, representative selection, and final image write
     * only for the selected representatives.
     *
     * For images, the same face-processing pipeline is applied to the
     * single loaded frame.
     *
     * @param videoPath Path to the input video or image.
     * @param outputDirectory Directory where aligned face thumbnails are
     * written.
     * @param sampleIntervalSeconds Legacy sampling interval fallback.
     *
     * @return One `ExtractedFace` per selected identity representative.
     *
     * @throws std::runtime_error If extraction cannot be completed.
     */
    FaceExtractionResult extract(
        const std::string& videoPath,
        const std::string& outputDirectory,
        double sampleIntervalSeconds = 1.0,
        bool debug = false,
        bool relaxed = false
    );


private:

    std::string ffmpegPath;
    std::string ffprobePath;

    std::string detectorModel;
    std::string recognizerModel;


    cv::Ptr<cv::FaceDetectorYN> detector;

    cv::Ptr<cv::FaceRecognizerSF> recognizer;

    bool debug = false;
    bool relaxed = false;


    std::string generateFaceId(
        int frameIndex,
        int faceIndex
    );

    void processFrame(
        const cv::Mat& frame,
        int frameIndex,
        int sampleIndex,
        int maxSampleGap,
        double timestampSeconds,
        const std::string& outputDirectory,
        std::vector<ExtractedFace>& observations,
        double fps,
        FaceExtractionTiming* timing = nullptr
    );
};

