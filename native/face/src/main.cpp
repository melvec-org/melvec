#include "face_extractor.h"

#include <exception>
#include <iomanip>
#include <iostream>
#include <string>
#include <stdexcept>


/**
 * Writes a JSON-escaped string value directly to stdout.
 *
 * This helper escapes the subset of characters currently needed by the
 * extractor response format before surrounding the output with quotes.
 */
static void printJsonString(
    const std::string& value
) {
    std::cout << "\"";

    for (char c : value) {

        switch (c) {

            case '\\':
                std::cout << "\\\\";
                break;

            case '"':
                std::cout << "\\\"";
                break;

            case '\n':
                std::cout << "\\n";
                break;

            case '\r':
                std::cout << "\\r";
                break;

            case '\t':
                std::cout << "\\t";
                break;

            default:
                std::cout << c;
                break;
        }
    }

    std::cout << "\"";
}


/**
 * Writes the standardized JSON failure response and returns a non-zero
 * process exit code.
 *
 * @param sourceURL Original input path or URL when available.
 * @param code Stable machine-readable error code.
 * @param message Human-readable error message.
 * @return Always returns `1` so callers can directly `return` it.
 */
static int printFailureResponse(
    const std::string& sourceURL,
    const std::string& code,
    const std::string& message
) {
    std::cout
        << "{";

    std::cout
        << "\"status\":\"failure\",";

    std::cout
        << "\"data\":{";

    std::cout
        << "\"sourceURL\":";

    printJsonString(
        sourceURL
    );

    std::cout
        << ",\"error\":{";

    std::cout
        << "\"code\":";

    printJsonString(
        code
    );

    std::cout
        << ",\"message\":";

    printJsonString(
        message
    );

    std::cout
        << "}}}"
        << std::endl;

    return 1;
}


/**
 * CLI entry point for the native face extraction executable.
 *
 * Expected arguments:
 *   1. input path (video or image)
 *   2. ffmpeg path
 *   3. ffprobe path
 *   4. YuNet model path
 *   5. SFace model path
 *   6. output directory
 *
 * On success, writes a single JSON object with `status: "success"`.
 * On failure, writes a single JSON object with `status: "failure"`.
 *
 * @return `0` on success, otherwise a non-zero exit code.
 */
int main(int argc, char** argv) {

    const std::string videoPath = argc > 1
        ? argv[1]
        : "";

    if (argc < 7 || argc > 9) {
        return printFailureResponse(
            videoPath,
            "INVALID_ARGUMENTS",
            "Usage: melvec-face <input> <ffmpeg> <ffprobe> <yunet.onnx> <sface.onnx> <output-directory> [--debug] [--relaxed]"
        );
    }


    const std::string ffmpegPath = argv[2];
    const std::string ffprobePath = argv[3];
    const std::string yunetPath = argv[4];
    const std::string sfacePath = argv[5];
    const std::string outputDirectory = argv[6];
    bool debug = false;
    bool relaxed = false;

    for (int argIndex = 7; argIndex < argc; ++argIndex) {
        const std::string option = argv[argIndex];

        if (option == "--debug") {
            debug = true;
        } else if (option == "--relaxed") {
            relaxed = true;
        } else {
            return printFailureResponse(
                videoPath,
                "INVALID_ARGUMENTS",
                "Unknown option: " + option
            );
        }
    }

    try {

        FaceExtractor extractor(
            ffmpegPath,
            ffprobePath,
            yunetPath,
            sfacePath
        );


        FaceExtractionResult result =
            extractor.extract(
                videoPath,
                outputDirectory,
                1.0,
                debug,
                relaxed
            );


        std::cout
            << "{";

        std::cout
            << "\"status\":\"success\",";

        std::cout
            << "\"data\":{";

        std::cout
            << "\"sourceURL\":";

        printJsonString(
            videoPath
        );

        std::cout
            << ",\"summary\":{";

        std::cout
            << "\"detectedFaces\":"
            << result.summary.detectedFaces;

        std::cout
            << ",\"qualifiedFaces\":"
            << result.summary.qualifiedFaces;

        std::cout
            << ",\"outputFaces\":"
            << result.summary.outputFaces;

        std::cout
            << "}";

        std::cout
            << ",\"faces\":[";

        for (
            size_t i = 0;
            i < result.faces.size();
            i++
        ) {

            if (i > 0) {
                std::cout << ",";
            }

            const auto& face =
                result.faces[i];

            std::cout
                << "{";

            std::cout
                << "\"id\":";

            printJsonString(
                face.id
            );

            std::cout
                << ",\"imagePath\":";

            printJsonString(
                face.imagePath
            );

            std::cout
                << ",\"confidence\":"
                << face.confidence;

            std::cout
                << ",\"quality\":"
                << face.quality;

            std::cout
                << ",\"identityIndex\":"
                << face.identityIndex;

            std::cout
                << ",\"embedding\":[";

            for (
                size_t j = 0;
                j < face.embedding.size();
                j++
            ) {

                if (j > 0) {
                    std::cout << ",";
                }

                std::cout
                    << std::setprecision(8)
                    << face.embedding[j];
            }

            std::cout
                << "]";

            std::cout
                << "}";
        }

        std::cout
            << "]}}"
            << std::endl;

        return 0;

    } catch (
        const std::invalid_argument& error
    ) {
        return printFailureResponse(
            videoPath,
            "INVALID_ARGUMENTS",
            error.what()
        );

    } catch (
        const std::runtime_error& error
    ) {
        return printFailureResponse(
            videoPath,
            "FACE_EXTRACTION_FAILED",
            error.what()
        );

    } catch (
        const std::exception& error
    ) {
        return printFailureResponse(
            videoPath,
            "UNEXPECTED_ERROR",
            error.what()
        );

    } catch (...) {
        return printFailureResponse(
            videoPath,
            "UNKNOWN_ERROR",
            "An unknown error occurred during face extraction"
        );
    }
}