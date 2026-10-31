#pragma once

#include <opencv2/core.hpp>

#include <cstdio>
#include <stdexcept>
#include <string>

class NoVideoStreamError : public std::runtime_error {
public:
    explicit NoVideoStreamError(
        const std::string& message
    )
        : std::runtime_error(message)
    {}
};

class FFmpegVideoReader {
public:
    /**
     * Probes the input video with ffprobe and stores basic metadata used
     * for sparse frame extraction.
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
    FFmpegVideoReader(
        const std::string& ffmpegPath,
        const std::string& ffprobePath,
        const std::string& videoPath
    );

    /**
     * Closes the ffmpeg pipe if it is still open.
     */
    ~FFmpegVideoReader();

    FFmpegVideoReader(const FFmpegVideoReader&) = delete;
    FFmpegVideoReader& operator=(const FFmpegVideoReader&) = delete;

    /**
     * Starts a persistent ffmpeg process that streams decoded BGR frames
     * sequentially from the beginning of the video.
     *
     * @throws std::runtime_error If the ffmpeg process cannot be started.
     */
    void startSequentialRead();

    /**
     * Reads the next decoded frame from a sequential pipe when available.
     *
     * @param frame Destination matrix populated with a single BGR frame.
     * The matrix is resized to `height() x width()` with type `CV_8UC3`.
     *
     * @return `true` when a full frame was read successfully, otherwise
     * `false` when no sequential pipe is active, on end-of-stream, or on
     * incomplete frame data.
     */
    bool read(cv::Mat& frame);

    /**
     * Reads a single frame near the requested timestamp.
     *
     * This is still used for the final representative-image reread step
     * after identity selection.
     */
    bool readFrameAtTime(
        double timestampSeconds,
        cv::Mat& frame
    ) const;

    /** Returns the probed video frame rate. */
    double fps() const;

    /** Returns the probed video width in pixels. */
    int width() const;

    /** Returns the probed video height in pixels. */
    int height() const;

    /**
     * Returns the best known total frame count.
     *
     * This prefers `nb_frames` from ffprobe when available and otherwise
     * falls back to a duration-derived estimate.
     */
    int frameCount() const;

    /** Returns the probed video duration in seconds when available. */
    double duration() const;

private:
    std::string ffmpegPath;
    std::string ffprobePath;
    std::string videoPath;

    FILE* pipe = nullptr;

    double videoFps = 0.0;
    double videoDuration = 0.0;
    int videoWidth = 0;
    int videoHeight = 0;
    int videoFrameCount = 0;

    size_t frameSize = 0;
};
