
#include "ffmpeg_video_reader.h"

#include <array>
#include <cstdlib>
#include <sstream>
#include <stdexcept>


/**
 * Safely quotes a shell argument for use in the ffmpeg and ffprobe
 * command strings launched through `popen()`.
 */
static std::string shellQuote(
    const std::string& value
) {
    std::string result = "'";

    for (char c : value) {
        if (c == '\'') {
            result += "'\\''";
        } else {
            result += c;
        }
    }

    result += "'";

    return result;
}


/**
 * Probes the input video with ffprobe and stores basic metadata used
 * for hybrid frame extraction.
 */
FFmpegVideoReader::FFmpegVideoReader(
    const std::string& ffmpegPath,
    const std::string& ffprobePath,
    const std::string& videoPath
)
    : ffmpegPath(ffmpegPath),
      ffprobePath(ffprobePath),
      videoPath(videoPath)
{
    const std::string probeCommand =
        shellQuote(ffprobePath) +
        " -v error"
        " -select_streams v:0"
        " -show_entries stream=width,height,r_frame_rate,nb_frames,duration:format=duration"
        " -of default=nokey=0:noprint_wrappers=0"
        " " +
        shellQuote(videoPath);

    FILE* probe =
        popen(
            probeCommand.c_str(),
            "r"
        );

    if (!probe) {
        throw std::runtime_error(
            "Could not start ffprobe"
        );
    }

    std::string output;
    std::array<char, 4096> buffer{};

    while (
        std::fgets(
            buffer.data(),
            static_cast<int>(buffer.size()),
            probe
        )
    ) {
        output += buffer.data();
    }

    const int probeStatus =
        pclose(probe);

    if (probeStatus != 0) {
        throw std::runtime_error(
            "ffprobe failed for video: " +
            videoPath +
            " | ffprobePath: " +
            ffprobePath +
            " | command: " +
            probeCommand +
            " | exitCode: " +
            std::to_string(probeStatus) +
            " | output: " +
            output
        );
    }

    std::istringstream stream(
        output
    );

    std::string line;
    double streamDuration = 0.0;
    double formatDuration = 0.0;
    bool inStreamSection = false;
    bool inFormatSection = false;

    while (
        std::getline(
            stream,
            line
        )
    ) {
        if (line == "[STREAM]") {
            inStreamSection = true;
            inFormatSection = false;
            continue;
        }

        if (line == "[/STREAM]") {
            inStreamSection = false;
            continue;
        }

        if (line == "[FORMAT]") {
            inFormatSection = true;
            inStreamSection = false;
            continue;
        }

        if (line == "[/FORMAT]") {
            inFormatSection = false;
            continue;
        }

        const std::size_t equals =
            line.find('=');

        if (equals == std::string::npos) {
            continue;
        }

        const std::string key =
            line.substr(
                0,
                equals
            );

        const std::string value =
            line.substr(
                equals + 1
            );

        if (key == "width") {
            videoWidth = std::stoi(value);
        } else if (key == "height") {
            videoHeight = std::stoi(value);
        } else if (key == "r_frame_rate") {
            const std::size_t slashPos =
                value.find('/');

            if (slashPos != std::string::npos) {
                const double numerator =
                    std::stod(
                        value.substr(
                            0,
                            slashPos
                        )
                    );

                const double denominator =
                    std::stod(
                        value.substr(
                            slashPos + 1
                        )
                    );

                if (denominator > 0) {
                    videoFps = numerator / denominator;
                }
            }
        } else if (key == "nb_frames") {
            if (!value.empty() && value != "N/A") {
                videoFrameCount = std::stoi(value);
            }
        } else if (
            key == "duration" &&
            inStreamSection &&
            !value.empty()
        ) {
            streamDuration = std::stod(value);
        } else if (
            key == "duration" &&
            inFormatSection &&
            !value.empty()
        ) {
            formatDuration = std::stod(value);
        }
    }

    videoDuration =
        formatDuration > 0.0
            ? formatDuration
            : streamDuration;

    if (
        videoFrameCount <= 0 &&
        videoDuration > 0.0 &&
        videoFps > 0.0
    ) {
        videoFrameCount =
            std::max(
                1,
                static_cast<int>(
                    std::llround(
                        videoDuration * videoFps
                    )
                )
            );
    }

    if (
        videoWidth <= 0 ||
        videoHeight <= 0 ||
        videoFps <= 0
    ) {
        throw NoVideoStreamError(
            "No visual stream found"
        );
    }

    frameSize =
        static_cast<size_t>(videoWidth) *
        static_cast<size_t>(videoHeight) *
        3;
}


void FFmpegVideoReader::startSequentialRead() {
    if (pipe) {
        pclose(pipe);
        pipe = nullptr;
    }

    const std::string decodeCommand =
        shellQuote(ffmpegPath) +
        " -v error"
        " -i " +
        shellQuote(videoPath) +
        " -f rawvideo"
        " -pix_fmt bgr24"
        " -";

    pipe =
        popen(
            decodeCommand.c_str(),
            "r"
        );

    if (!pipe) {
        throw std::runtime_error(
            "Could not start ffmpeg sequential decoder"
        );
    }
}


/**
 * Closes the running ffmpeg pipe if it is still open.
 */
FFmpegVideoReader::~FFmpegVideoReader() {
    if (pipe) {
        pclose(pipe);
        pipe = nullptr;
    }
}


/**
 * Reads one full raw frame from the ffmpeg pipe into a `CV_8UC3`
 * OpenCV matrix.
 *
 * Returns `false` when the stream ends or a partial frame is received.
 */
bool FFmpegVideoReader::read(
    cv::Mat& frame
) {
    if (!pipe) {
        return false;
    }

    frame.create(
        videoHeight,
        videoWidth,
        CV_8UC3
    );

    unsigned char* data =
        frame.ptr<unsigned char>();

    size_t totalRead = 0;

    while (totalRead < frameSize) {
        const size_t bytesRead =
            std::fread(
                data + totalRead,
                1,
                frameSize - totalRead,
                pipe
            );

        if (bytesRead == 0) {
            break;
        }

        totalRead += bytesRead;
    }

    if (totalRead != frameSize) {
        frame.release();
        return false;
    }

    return true;
}


bool FFmpegVideoReader::readFrameAtTime(
    double timestampSeconds,
    cv::Mat& frame
) const {
    const double clampedTimestamp =
        std::max(
            0.0,
            timestampSeconds
        );

    const std::string decodeCommand =
        shellQuote(ffmpegPath) +
        " -v error"
        " -ss " +
        std::to_string(clampedTimestamp) +
        " -i " +
        shellQuote(videoPath) +
        " -frames:v 1"
        " -f rawvideo"
        " -pix_fmt bgr24"
        " -";

    FILE* singleFramePipe =
        popen(
            decodeCommand.c_str(),
            "r"
        );

    if (!singleFramePipe) {
        return false;
    }

    frame.create(
        videoHeight,
        videoWidth,
        CV_8UC3
    );

    unsigned char* data =
        frame.ptr<unsigned char>();

    size_t totalRead = 0;

    while (totalRead < frameSize) {
        const size_t bytesRead =
            std::fread(
                data + totalRead,
                1,
                frameSize - totalRead,
                singleFramePipe
            );

        if (bytesRead == 0) {
            break;
        }

        totalRead += bytesRead;
    }

    const int decodeStatus =
        pclose(singleFramePipe);

    if (
        totalRead != frameSize ||
        decodeStatus != 0
    ) {
        frame.release();
        return false;
    }

    return true;
}


double FFmpegVideoReader::fps() const {
    return videoFps;
}


int FFmpegVideoReader::width() const {
    return videoWidth;
}


int FFmpegVideoReader::height() const {
    return videoHeight;
}


int FFmpegVideoReader::frameCount() const {
    return videoFrameCount;
}


double FFmpegVideoReader::duration() const {
    return videoDuration;
}
