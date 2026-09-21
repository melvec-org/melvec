#pragma once

#include <opencv2/core.hpp>

#include <cstdio>
#include <string>

class FFmpegVideoReader {
public:
    /**
     * Streams decoded video frames from FFmpeg as BGR OpenCV matrices.
     *
     * The constructor probes the input video with ffprobe to collect
     * dimensions, frame rate, and frame count, then starts an ffmpeg
     * process that writes raw `bgr24` frames to stdout.
     *
     * @param ffmpegPath Absolute or resolvable path to the `ffmpeg`
     * executable.
     * @param ffprobePath Absolute or resolvable path to the `ffprobe`
     * executable.
     * @param videoPath Path to the source video file to decode.
     *
     * @throws std::runtime_error If ffprobe cannot be started, probing
     * fails, metadata is invalid, or ffmpeg cannot be started.
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
     * Reads the next decoded frame.
     *
     * @param frame Destination matrix populated with a single BGR frame.
     * The matrix is resized to `height() x width()` with type `CV_8UC3`.
     *
     * @return `true` when a full frame was read successfully, otherwise
     * `false` on end-of-stream or incomplete frame data.
     */
    bool read(cv::Mat& frame);

    /** Returns the probed video frame rate. */
    double fps() const;

    /** Returns the probed video width in pixels. */
    int width() const;

    /** Returns the probed video height in pixels. */
    int height() const;

    /**
     * Returns the frame count reported by ffprobe.
     *
     * This value depends on container metadata and may be zero or absent
     * for some inputs even when decoding still succeeds.
     */
    int frameCount() const;

private:
    FILE* pipe = nullptr;

    double videoFps = 0.0;
    int videoWidth = 0;
    int videoHeight = 0;
    int videoFrameCount = 0;

    size_t frameSize = 0;
};
