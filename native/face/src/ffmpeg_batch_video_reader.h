#pragma once

#include <opencv2/core.hpp>

#include <string>
#include <vector>

class FFmpegBatchVideoReader {
public:
    /**
     * Probes the input video with ffprobe and stores metadata used for
     * batched frame extraction.
     *
     * @param ffmpegPath Absolute or resolvable path to the `ffmpeg`
     * executable.
     * @param ffprobePath Absolute or resolvable path to the `ffprobe`
     * executable.
     * @param videoPath Path to the source video file to decode.
     *
     * @throws std::runtime_error If ffprobe cannot be started, probing
     * fails, or required metadata is invalid.
     */
    FFmpegBatchVideoReader(
        const std::string& ffmpegPath,
        const std::string& ffprobePath,
        const std::string& videoPath
    );

    /**
     * Reads a uniformly spaced batch of frames starting at the first
     * requested timestamp and appends the decoded frames to `frames` in
     * order.
     *
     * @param startTimestampSeconds Timestamp of the first requested frame.
     * @param gapSeconds Fixed time gap between consecutive requested
     * frames.
     * @param frameCount Number of frames to decode.
     * @param frames Output vector populated with one `cv::Mat` per
     * returned frame.
     * @return `true` when all requested frames were read successfully,
     * otherwise `false`.
     */
    bool batchReader(
        double startTimestampSeconds,
        double gapSeconds,
        size_t frameCount,
        std::vector<cv::Mat>& frames
    ) const;

    /** Returns the probed video frame rate. */
    double fps() const;

    /** Returns the probed video width in pixels. */
    int width() const;

    /** Returns the probed video height in pixels. */
    int height() const;

    /** Returns the best known total frame count. */
    int frameCount() const;

    /** Returns the probed video duration in seconds when available. */
    double duration() const;

private:
    std::string ffmpegPath;
    std::string ffprobePath;
    std::string videoPath;

    double videoFps = 0.0;
    double videoDuration = 0.0;
    int videoWidth = 0;
    int videoHeight = 0;
    int videoFrameCount = 0;

    size_t frameSize = 0;
};
