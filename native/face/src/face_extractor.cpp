
#include "face_extractor.h"
#include "face_quality.h"
#include "ffmpeg_video_reader.h"
#include "face_grouping.h"

#include <opencv2/objdetect/face.hpp>

#include <algorithm>
#include <cmath>
#include <exception>
#include <filesystem>


FaceExtractor::FaceExtractor(
    const std::string& ffmpegPath,
    const std::string& ffprobePath,
    const std::string& detectorModel,
    const std::string& recognizerModel
)
    : ffmpegPath(ffmpegPath),
      ffprobePath(ffprobePath),
      detectorModel(detectorModel),
      recognizerModel(recognizerModel)
{
}


std::string FaceExtractor::generateFaceId(
    int frameIndex,
    int faceIndex
) {
    return std::to_string(frameIndex)
        + "_"
        + std::to_string(faceIndex);
}


std::vector<ExtractedFace> FaceExtractor::extract(
    const std::string& videoPath,
    const std::string& outputDirectory,
    double sampleIntervalSeconds
) {
    std::vector<ExtractedFace> observations;

    try {
        std::error_code createDirectoriesError;

        std::filesystem::create_directories(
            outputDirectory,
            createDirectoriesError
        );

        if (createDirectoriesError) {
            throw std::runtime_error(
                "Failed to create output directory: " +
                outputDirectory +
                " (" +
                createDirectoriesError.message() +
                ")"
            );
        }


        FFmpegVideoReader reader(
            ffmpegPath,
            ffprobePath,
            videoPath
        );


        const double fps = reader.fps();
        const int width = reader.width();
        const int height = reader.height();
        const int frameCount = reader.frameCount();


        if (
            fps <= 0.0 ||
            width <= 0 ||
            height <= 0
        ) {
            throw std::runtime_error(
                "Invalid video metadata for extraction"
            );
        }


        /*
         * Create YuNet using the actual video dimensions.
         *
         * This keeps detector coordinates consistent
         * with the decoded video frames.
         */
        detector =
            cv::FaceDetectorYN::create(
                detectorModel,
                "",
                cv::Size(width, height),
                FaceQuality::MIN_CONFIDENCE
            );


        if (detector.empty()) {
            throw std::runtime_error(
                "Failed to initialize YuNet detector"
            );
        }


        recognizer =
            cv::FaceRecognizerSF::create(
                recognizerModel,
                ""
            );


        if (recognizer.empty()) {
            throw std::runtime_error(
                "Failed to initialize SFace recognizer"
            );
        }


        const int sampleIntervalFrames =
            std::max(
                1,
                static_cast<int>(
                    std::round(
                        fps * sampleIntervalSeconds
                    )
                )
            );


        cv::Mat frame;

        int frameIndex = 0;


        while (reader.read(frame)) {

            if (
                frameIndex % sampleIntervalFrames != 0
            ) {
                ++frameIndex;
                continue;
            }


            try {
                detector->setInputSize(
                    frame.size()
                );


                cv::Mat detections;

                detector->detect(
                    frame,
                    detections
                );


                if (detections.empty()) {
                    ++frameIndex;
                    continue;
                }


                for (
                    int detectionIndex = 0;
                    detectionIndex < detections.rows;
                    ++detectionIndex
                ) {
                    try {
                        cv::Mat detection =
                            detections.row(
                                detectionIndex
                            );


                        float confidence =
                            detection.at<float>(
                                0,
                                14
                            );


                        if (
                            confidence <
                            FaceQuality::MIN_CONFIDENCE
                        ) {
                            continue;
                        }


                        /*
                         * YuNet bounding box.
                         */
                        int x =
                            static_cast<int>(
                                detection.at<float>(0, 0)
                            );

                        int y =
                            static_cast<int>(
                                detection.at<float>(0, 1)
                            );

                        int faceWidth =
                            static_cast<int>(
                                detection.at<float>(0, 2)
                            );

                        int faceHeight =
                            static_cast<int>(
                                detection.at<float>(0, 3)
                            );


                        /*
                         * Clamp the bounding box to the frame.
                         */
                        x = std::max(
                            0,
                            std::min(
                                x,
                                frame.cols - 1
                            )
                        );

                        y = std::max(
                            0,
                            std::min(
                                y,
                                frame.rows - 1
                            )
                        );


                        faceWidth =
                            std::min(
                                faceWidth,
                                frame.cols - x
                            );

                        faceHeight =
                            std::min(
                                faceHeight,
                                frame.rows - y
                            );


                        if (
                            faceWidth <
                            FaceQuality::MIN_FACE_WIDTH ||
                            faceHeight <
                            FaceQuality::MIN_FACE_HEIGHT
                        ) {
                            continue;
                        }


                        /*
                         * Align the detected face using SFace.
                         */
                        cv::Mat alignedFace;

                        recognizer->alignCrop(
                            frame,
                            detection,
                            alignedFace
                        );


                        if (alignedFace.empty()) {
                            continue;
                        }


                        /*
                         * Calculate sharpness on the aligned face.
                         */
                        float sharpness =
                            FaceQuality::calculateSharpness(
                                alignedFace
                            );


                        if (
                            sharpness <
                            FaceQuality::MIN_SHARPNESS
                        ) {
                            continue;
                        }


                        /*
                         * Estimate head yaw.
                         */
                        double yaw =
                            FaceQuality::calculateYaw(
                                detection,
                                detector->getInputSize()
                            );


                        if (
                            std::abs(yaw) >
                            FaceQuality::MAX_YAW_DEGREES
                        ) {
                            continue;
                        }


                        float quality =
                            FaceQuality::calculateQuality(
                                confidence,
                                faceWidth,
                                faceHeight,
                                sharpness,
                                yaw
                            );


                        /*
                         * Extract SFace embedding.
                         */
                        cv::Mat feature;

                        recognizer->feature(
                            alignedFace,
                            feature
                        );


                        if (feature.empty()) {
                            continue;
                        }


                        std::vector<float> embedding(
                            feature.ptr<float>(),
                            feature.ptr<float>() +
                                feature.total()
                        );


                        /*
                         * Create an observation.
                         *
                         * At this stage we deliberately do NOT try to determine
                         * whether this face belongs to another observation.
                         *
                         * Every valid observation is retained. Clustering and
                         * representative selection happen after extraction.
                         */
                        ExtractedFace extractedFace;

                        extractedFace.id =
                            generateFaceId(
                                frameIndex,
                                detectionIndex
                            );

                        extractedFace.confidence =
                            confidence;

                        extractedFace.quality =
                            quality;

                        extractedFace.frameIndex =
                            frameIndex;

                        extractedFace.timestamp =
                            static_cast<double>(
                                frameIndex
                            ) / fps;

                        /*
                        * Keep the original SFace feature matrix for grouping.
                        */
                        extractedFace.feature =
                            feature.clone();


                        extractedFace.embedding =
                            std::move(
                                embedding
                            );


                        /*
                         * Save the aligned face temporarily.
                         *
                         * These thumbnails are useful while developing and
                         * validating the clustering algorithm. Once clustering
                         * is working, only the selected representative faces
                         * need to become permanent.
                         */
                        extractedFace.imagePath =
                            outputDirectory +
                            "/" +
                            extractedFace.id +
                            ".jpg";


                        if (!cv::imwrite(
                            extractedFace.imagePath,
                            alignedFace
                        )) {
                            continue;
                        }


                        observations.push_back(
                            std::move(
                                extractedFace
                            )
                        );
                    } catch (const cv::Exception&) {
                        continue;
                    } catch (const std::exception&) {
                        continue;
                    }
                }
            } catch (const cv::Exception&) {
                ++frameIndex;
                continue;
            } catch (const std::exception&) {
                ++frameIndex;
                continue;
            }


            ++frameIndex;
        }


        /*
         * Group all accepted observations by identity.
         *
         * At this point observations still contain every valid face
         * detected throughout the video.
         */
        std::vector<std::vector<int>> groups =
            FaceGrouping::group(
                observations,
                recognizer
            );


        /*
         * Select exactly one representative observation
         * from each identity group.
         *
         * The representative is currently the observation
         * with the highest quality score.
         */
        std::vector<int> representatives =
            FaceGrouping::selectBest(
                groups,
                observations
            );


        /*
         * Mark the selected observations so that all other
         * temporary face thumbnails can be removed.
         */
        std::vector<bool> keep(
            observations.size(),
            false
        );


        for (int observationIndex : representatives) {

            if (
                observationIndex >= 0 &&
                observationIndex <
                    static_cast<int>(
                        observations.size()
                    )
            ) {
                keep[observationIndex] = true;
            }
        }


        /*
         * Remove every temporary face image that was not selected
         * as the representative of an identity group.
         *
         * We intentionally keep the representative's existing
         * imagePath for the next persistence stage.
         */
        for (
            size_t observationIndex = 0;
            observationIndex < observations.size();
            ++observationIndex
        ) {

            if (keep[observationIndex]) {
                continue;
            }


            const std::string& imagePath =
                observations[observationIndex].imagePath;


            if (imagePath.empty()) {
                continue;
            }


            std::error_code error;


            std::filesystem::remove(
                imagePath,
                error
            );
        }


        /*
         * Return only the selected representatives.
         *
         * This is important because callers should no longer see
         * duplicate observations for the same person.
         */
        std::vector<ExtractedFace> selectedFaces;


        selectedFaces.reserve(
            representatives.size()
        );


        for (int observationIndex : representatives) {

            if (
                observationIndex < 0 ||
                observationIndex >=
                    static_cast<int>(
                        observations.size()
                    )
            ) {
                continue;
            }


            selectedFaces.push_back(
                std::move(
                    observations[observationIndex]
                )
            );
        }


        return selectedFaces;
    } catch (const cv::Exception& error) {
        throw std::runtime_error(
            std::string("OpenCV face extraction failure: ") +
            error.what()
        );
    } catch (const std::exception&) {
        throw;
    }
}
