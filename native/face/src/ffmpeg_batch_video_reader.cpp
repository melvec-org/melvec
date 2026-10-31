#include "ffmpeg_batch_video_reader.h"

#include <array>
#include <cstdio>
#include <sstream>
#include <stdexcept>

namespace {
static std::string shellQuote(const std::string& value) {
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
}

FFmpegBatchVideoReader::FFmpegBatchVideoReader(
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
        throw std::runtime_error("Could not start ffprobe");
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

    const int probeStatus = pclose(probe);

    if (probeStatus != 0) {
        throw std::runtime_error(
            "ffprobe failed for video: " +
            videoPath +
            " | command: " +
            probeCommand +
            " | output: " +
            output
        );
    }

    std::istringstream stream(output);
    std::string line;
    double streamDuration = 0.0;
    double formatDuration = 0.0;
    bool inStreamSection = false;
    bool inFormatSection = false;

    while (std::getline(stream, line)) {
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

        const std::size_t equals = line.find('=');
        if (equals == std::string::npos) {
            continue;
        }

        const std::string key = line.substr(0, equals);
        const std::string value = line.substr(equals + 1);

        if (key == "width") {
            videoWidth = std::stoi(value);
        } else if (key == "height") {
            videoHeight = std::stoi(value);
        } else if (key == "r_frame_rate") {
            const std::size_t slashPos = value.find('/');
            if (slashPos != std::string::npos) {
                const double numerator =
                    std::stod(value.substr(0, slashPos));
                const double denominator =
                    std::stod(value.substr(slashPos + 1));

                if (denominator > 0.0) {
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
                    std::llround(videoDuration * videoFps)
                )
            );
    }

    if (videoWidth <= 0 || videoHeight <= 0) {
        throw std::runtime_error("Invalid video dimensions");
    }

    if (videoFps <= 0.0) {
        throw std::runtime_error("Invalid video FPS");
    }

    frameSize =
        static_cast<size_t>(videoWidth) *
        static_cast<size_t>(videoHeight) *
        3;
}

bool FFmpegBatchVideoReader::batchReader(
    double startTimestampSeconds,
    double gapSeconds,
    size_t frameCount,
    std::vector<cv::Mat>& frames
) const {
    frames.clear();

    if (frameCount == 0) {
        return true;
    }

    const double clampedStartTimestamp =
        std::max(0.0, startTimestampSeconds);

    const double clampedGapSeconds =
        std::max(0.0, gapSeconds);

    std::ostringstream fpsFilter;
    fpsFilter << "fps=1/" << clampedGapSeconds;

    const std::string decodeCommand =
        shellQuote(ffmpegPath) +
        " -v error"
        " -ss " +
        std::to_string(clampedStartTimestamp) +
        " -i " +
        shellQuote(videoPath) +
        " -vf " +
        shellQuote(fpsFilter.str()) +
        " -frames:v " +
        std::to_string(frameCount) +
        " -f rawvideo"
        " -pix_fmt bgr24"
        " -";

    FILE* pipe = popen(decodeCommand.c_str(), "r");
    if (!pipe) {
        return false;
    }

    for (size_t i = 0; i < frameCount; ++i) {
        cv::Mat frame(
            videoHeight,
            videoWidth,
            CV_8UC3
        );

        unsigned char* data = frame.ptr<unsigned char>();
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
            pclose(pipe);
            frames.clear();
            return false;
        }

        frames.push_back(frame);
    }

    const int status = pclose(pipe);
    if (status != 0) {
        frames.clear();
        return false;
    }

    return true;
}

double FFmpegBatchVideoReader::fps() const {
    return videoFps;
}

int FFmpegBatchVideoReader::width() const {
    return videoWidth;
}

int FFmpegBatchVideoReader::height() const {
    return videoHeight;
}

int FFmpegBatchVideoReader::frameCount() const {
    return videoFrameCount;
}

double FFmpegBatchVideoReader::duration() const {
    return videoDuration;
}
