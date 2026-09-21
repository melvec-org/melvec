
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
 * Probes the input video with ffprobe, stores basic metadata, and then
 * starts an ffmpeg process that streams raw `bgr24` frames through a
 * pipe.
 */
FFmpegVideoReader::FFmpegVideoReader(
    const std::string& ffmpegPath,
    const std::string& ffprobePath,
    const std::string& videoPath
) {
    /*
     * Get video information using the explicitly provided ffprobe path.
     */


    const std::string probeCommand =
        shellQuote(ffprobePath) +
        " -v error"
        " -select_streams v:0"
        " -show_entries stream=width,height,r_frame_rate,nb_frames"
        " -of default=noprint_wrappers=1"
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
            videoPath
        );
    }


    std::istringstream stream(
        output
    );

    std::string line;


    while (
        std::getline(
            stream,
            line
        )
    ) {

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

            videoWidth =
                std::stoi(value);

        } else if (key == "height") {

            videoHeight =
                std::stoi(value);

        } else if (key == "r_frame_rate") {

            const std::size_t slashPos =
                value.find('/');

            if (
                slashPos !=
                std::string::npos
            ) {

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
                    videoFps =
                        numerator /
                        denominator;
                }
            }
        } else if (key == "nb_frames") {

            if (!value.empty()) {
                videoFrameCount =
                    std::stoi(value);
            }
        }
    }


    if (
        videoWidth <= 0 ||
        videoHeight <= 0
    ) {
        throw std::runtime_error(
            "Invalid video dimensions"
        );
    }


    if (videoFps <= 0) {
        throw std::runtime_error(
            "Invalid video FPS"
        );
    }


    frameSize =
        static_cast<size_t>(
            videoWidth
        ) *
        static_cast<size_t>(
            videoHeight
        ) *
        3;


    /*
     * Decode frames directly to stdout.
     *
     * bgr24 means:
     *   3 bytes per pixel
     *   B, G, R
     *
     * which can be wrapped directly by cv::Mat.
     */

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
            "Could not start ffmpeg"
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
