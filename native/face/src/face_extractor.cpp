
#include "face_extractor.h"
#include "face_quality.h"
#include "ffmpeg_video_reader.h"
#include "ffmpeg_batch_video_reader.h"
#include "face_grouping.h"

#include <opencv2/objdetect/face.hpp>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <exception>
#include <filesystem>
#include <iostream>
#include <limits>


namespace {
constexpr float EARLY_DEDUP_SIMILARITY_THRESHOLD = 0.55f;

/**
 * Maximum sample-index distance for early dedup in the sequential path
 * (<60 s). Frames are real consecutive video frames so comparing by
 * raw frame index is meaningful; 60 frames ≈ 2 s at 30 fps, covering
 * one adjacent sample point.
 */
constexpr int EARLY_DEDUP_MAX_SAMPLE_GAP_SEQUENTIAL = 2;

/**
 * Maximum sample-index distance for early dedup in the sparse batch
 * path (≥60 s). Each unit here is one entry in the sparse sample list,
 * so 3 covers the immediate neighbours on both sides of any sample
 * point without reaching far-apart timestamps.
 */
constexpr int EARLY_DEDUP_MAX_SAMPLE_GAP_BATCH = 3;
constexpr int CHUNKED_READ_SAMPLE_THRESHOLD = 120;
constexpr size_t CHUNKED_READ_TARGETS_PER_CHUNK = 20;
constexpr double SAMPLE_CURVE_LOG_DENOMINATOR_SCALE = 0.16;
constexpr double SAMPLE_CURVE_TIME_DIVISOR = 45.0;


int calculateSampleCount(double durationSeconds)
{
    constexpr int MAX_SAMPLES = 4000;

    if (durationSeconds <= 0.0) {
        return 1;
    }

    /*
     * Smooth duration-based sampling curve.
     *
     * We stay close to roughly one sample per second for short videos,
     * then gradually slow the sampling rate as duration grows using a
     * logarithmic denominator. This avoids sharp segment boundaries while
     * still preventing long videos from exploding in processing cost.
     */
    const double denominator =
        1.0 +
        SAMPLE_CURVE_LOG_DENOMINATOR_SCALE *
        std::log(
            1.0 +
            durationSeconds /
                SAMPLE_CURVE_TIME_DIVISOR
        );

    const double scaled =
        durationSeconds /
        denominator;

    return std::clamp(
        static_cast<int>(
            std::ceil(scaled)
        ),
        1,
        MAX_SAMPLES
    );
}


float calculateDetectionDistance(
    const cv::Mat& a,
    const cv::Mat& b
) {
    if (
        a.empty() ||
        b.empty() ||
        a.cols < 15 ||
        b.cols < 15
    ) {
        return std::numeric_limits<float>::max();
    }

    float distance = 0.0f;

    for (int column = 0; column < 14; ++column) {
        const float delta =
            a.at<float>(0, column) -
            b.at<float>(0, column);

        distance += delta * delta;
    }

    return distance;
}


bool shouldReplaceObservation(
    const ExtractedFace& candidate,
    const ExtractedFace& existing,
    int maxSampleGap,
    const cv::Ptr<cv::FaceRecognizerSF>& recognizer
) {
    /*
     * Compare proximity in sample-index space, not raw frame space.
     *
     * Sequential path: sampleIndex increments by 1 per sampled frame,
     * so maxSampleGap=2 means within 2 adjacent sample points (~2s).
     *
     * Batch path: sampleIndex is the position in the sparse timestamp
     * list, so maxSampleGap=3 covers the immediate temporal neighbours
     * regardless of how many raw frames separate them.
     */
    if (
        std::abs(
            candidate.sampleIndex -
            existing.sampleIndex
        ) > maxSampleGap
    ) {
        return false;
    }

    const float similarity =
        FaceGrouping::cosineSimilarity(
            candidate.feature,
            existing.feature,
            recognizer
        );

    if (similarity < EARLY_DEDUP_SIMILARITY_THRESHOLD) {
        return false;
    }

    return candidate.quality > existing.quality;
}


void addObservationWithEarlyDedup(
    ExtractedFace&& candidate,
    std::vector<ExtractedFace>& observations,
    int maxSampleGap,
    const cv::Ptr<cv::FaceRecognizerSF>& recognizer
) {
    for (ExtractedFace& existing : observations) {
        if (!shouldReplaceObservation(
            candidate,
            existing,
            maxSampleGap,
            recognizer
        )) {
            continue;
        }

        existing = std::move(candidate);
        return;
    }

    observations.push_back(
        std::move(candidate)
    );
}


bool writeRepresentativeImage(
    const cv::Mat& frame,
    const ExtractedFace& representative,
    const cv::Ptr<cv::FaceDetectorYN>& detector,
    const cv::Ptr<cv::FaceRecognizerSF>& recognizer,
    const std::string& outputDirectory,
    std::string& imagePath
) {
    detector->setInputSize(
        frame.size()
    );

    cv::Mat detections;

    detector->detect(
        frame,
        detections
    );

    if (detections.empty()) {
        return false;
    }

    int bestDetectionIndex = -1;
    float bestDistance =
        std::numeric_limits<float>::max();

    for (
        int detectionIndex = 0;
        detectionIndex < detections.rows;
        ++detectionIndex
    ) {
        const cv::Mat detection =
            detections.row(
                detectionIndex
            );

        const float distance =
            calculateDetectionDistance(
                representative.detection,
                detection
            );

        if (distance < bestDistance) {
            bestDistance = distance;
            bestDetectionIndex = detectionIndex;
        }
    }

    if (bestDetectionIndex < 0) {
        return false;
    }

    cv::Mat alignedFace;

    recognizer->alignCrop(
        frame,
        detections.row(bestDetectionIndex),
        alignedFace
    );

    if (alignedFace.empty()) {
        return false;
    }

    imagePath =
        outputDirectory +
        "/" +
        representative.id +
        ".jpg";

    return cv::imwrite(
        imagePath,
        alignedFace
    );
}
}


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


void FaceExtractor::processFrame(
    const cv::Mat& frame,
    int frameIndex,
    int sampleIndex,
    int maxSampleGap,
    double timestampSeconds,
    const std::string& outputDirectory,
    std::vector<ExtractedFace>& observations,
    double fps,
    FaceExtractionTiming* timing
) {
    const auto processStart =
        std::chrono::steady_clock::now();

    try {
        detector->setInputSize(
            frame.size()
        );

        cv::Mat detections;

        detector->detect(
            frame,
            detections
        );

        if (timing) {
            timing->summary.detectedFaces += detections.rows;
        }

        if (detections.empty()) {
            return;
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

                const float minConfidence = relaxed
                    ? FaceQuality::RELAXED_MIN_CONFIDENCE
                    : FaceQuality::MIN_CONFIDENCE;

                if (
                    confidence <
                    minConfidence
                ) {
                    continue;
                }

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

                cv::Mat alignedFace;

                recognizer->alignCrop(
                    frame,
                    detection,
                    alignedFace
                );

                if (alignedFace.empty()) {
                    continue;
                }

                float sharpness =
                    FaceQuality::calculateSharpness(
                        alignedFace
                    );

                const double minSharpness = relaxed
                    ? FaceQuality::RELAXED_MIN_SHARPNESS
                    : FaceQuality::MIN_SHARPNESS;

                if (
                    sharpness <
                    minSharpness
                ) {
                    continue;
                }

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

                float brightness =
                    FaceQuality::calculateBrightness(
                        alignedFace
                    );

                if (
                    brightness <
                    FaceQuality::MIN_BRIGHTNESS
                ) {
                    continue;
                }

                float contrast =
                    FaceQuality::calculateContrast(
                        alignedFace
                    );

                float quality =
                    FaceQuality::calculateQuality(
                        confidence,
                        faceWidth,
                        faceHeight,
                        sharpness,
                        yaw,
                        brightness,
                        contrast
                    );

                const float minQuality = relaxed
                    ? FaceQuality::RELAXED_MIN_QUALITY
                    : FaceQuality::MIN_QUALITY;

                if (
                    quality <
                    minQuality
                ) {
                    continue;
                }

                cv::Mat feature;

                recognizer->feature(
                    alignedFace,
                    feature
                );

                if (feature.empty()) {
                    continue;
                }

                if (timing) {
                    ++timing->summary.qualifiedFaces;
                }

                std::vector<float> embedding(
                    feature.ptr<float>(),
                    feature.ptr<float>() +
                        feature.total()
                );

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

                extractedFace.sampleIndex =
                    sampleIndex;

                extractedFace.timestamp =
                    timestampSeconds;

                extractedFace.detection =
                    detection.clone();

                extractedFace.feature =
                    feature.clone();

                extractedFace.embedding =
                    std::move(
                        embedding
                    );

                if (debug) {
                    /*
                     * Debug candidate dump.
                     *
                     * Saves every accepted candidate face thumbnail before
                     * grouping so quality gates can be inspected.
                     * Only active when --debug is passed.
                     */
                    cv::imwrite(
                        outputDirectory +
                            "/candidate_" +
                            extractedFace.id +
                            ".jpg",
                        alignedFace
                    );
                }

                /*
                 * Early deduplication:
                 *
                 * If a nearby observation is already present and the two
                 * SFace features are strongly similar, keep only the
                 * higher-quality observation. This reduces the number of
                 * near-duplicate observations that later reach
                 * `FaceGrouping::group(...)`, which otherwise builds a full
                 * pairwise similarity matrix.
                 */
                addObservationWithEarlyDedup(
                    std::move(
                        extractedFace
                    ),
                    observations,
                    maxSampleGap,
                    recognizer
                );
            } catch (const cv::Exception&) {
                continue;
            } catch (const std::exception&) {
                continue;
            }
        }
    } catch (const cv::Exception&) {
        if (timing) {
            timing->processFrameTime +=
                std::chrono::steady_clock::now() -
                processStart;
        }
        return;
    } catch (const std::exception&) {
        if (timing) {
            timing->processFrameTime +=
                std::chrono::steady_clock::now() -
                processStart;
        }
        return;
    }

    if (timing) {
        timing->processFrameTime +=
            std::chrono::steady_clock::now() -
            processStart;
    }
}


FaceExtractionResult FaceExtractor::extract(
    const std::string& videoPath,
    const std::string& outputDirectory,
    double sampleIntervalSeconds,
    bool debugParam,
    bool relaxedParam
) {
    debug = debugParam;
    relaxed = relaxedParam;

    std::vector<ExtractedFace> observations;
    FaceExtractionTiming timing;
    std::vector<int> debugSampleFrameIndexes;

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

        cv::Mat image =
            cv::imread(
                videoPath,
                cv::IMREAD_COLOR
            );

        if (!image.empty()) {
            detector =
                cv::FaceDetectorYN::create(
                    detectorModel,
                    "",
                    image.size(),
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

            debugSampleFrameIndexes.push_back(0);

            processFrame(
                image,
                0,
                0,
                EARLY_DEDUP_MAX_SAMPLE_GAP_SEQUENTIAL,
                0.0,
                outputDirectory,
                observations,
                1.0,
                &timing
            );
        } else {
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
                return FaceExtractionResult{
                    std::move(observations),
                    timing.summary
                };
            }

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

            constexpr double SEQUENTIAL_SAMPLE_DENSITY_THRESHOLD = 0.10;

            std::vector<double> sampleTimestamps;
            std::vector<int> sampleFrameIndexes;

            const double durationSeconds =
                reader.duration() > 0.0
                    ? reader.duration()
                    : (
                        frameCount > 0
                            ? static_cast<double>(
                                frameCount
                            ) / fps
                            : 0.0
                    );

            if (durationSeconds > 0.0) {
                const int sampleCount =
                    calculateSampleCount(
                        durationSeconds
                    );

                sampleTimestamps.reserve(
                    sampleCount
                );

                sampleFrameIndexes.reserve(
                    sampleCount
                );

                for (
                    int sampleIndex = 0;
                    sampleIndex < sampleCount;
                    ++sampleIndex
                ) {
                    const double timestampSeconds =
                        std::clamp(
                            durationSeconds *
                                (
                                    static_cast<double>(sampleIndex) +
                                    0.5
                                ) /
                                static_cast<double>(sampleCount),
                            0.0,
                            durationSeconds
                        );

                    const int frameIndex =
                        std::max(
                            0,
                            static_cast<int>(
                                std::llround(
                                    timestampSeconds * fps
                                )
                            )
                        );

                    if (
                        sampleFrameIndexes.empty() ||
                        sampleFrameIndexes.back() != frameIndex
                    ) {
                        sampleTimestamps.push_back(
                            timestampSeconds
                        );

                        sampleFrameIndexes.push_back(
                            frameIndex
                        );
                    }
                }
            } else {
                sampleTimestamps.push_back(0.0);
                sampleFrameIndexes.push_back(0);
            }

            debugSampleFrameIndexes = sampleFrameIndexes;

            /*
             * Video inputs shorter than one minute always use sequential
             * decode. Longer videos use the batched frame reader.
             */
            if (durationSeconds < 60.0) {
                reader.startSequentialRead();

                size_t nextSampleIndex = 0;
                int currentFrameIndex = 0;
                cv::Mat frame;

                while (
                    nextSampleIndex < sampleFrameIndexes.size() &&
                    reader.read(frame)
                ) {
                    const int targetFrameIndex =
                        sampleFrameIndexes[nextSampleIndex];

                    if (currentFrameIndex < targetFrameIndex) {
                        ++currentFrameIndex;
                        continue;
                    }

                    const double timestampSeconds =
                        sampleTimestamps[nextSampleIndex];

                    processFrame(
                        frame,
                        currentFrameIndex,
                        static_cast<int>(nextSampleIndex),
                        EARLY_DEDUP_MAX_SAMPLE_GAP_SEQUENTIAL,
                        timestampSeconds,
                        outputDirectory,
                        observations,
                        fps,
                        &timing
                    );

                    ++nextSampleIndex;
                    ++currentFrameIndex;
                }
            } else {
                FFmpegBatchVideoReader batchReader(
                    ffmpegPath,
                    ffprobePath,
                    videoPath
                );

                size_t chunkStartIndex = 0;

                while (chunkStartIndex < sampleTimestamps.size()) {
                    const size_t chunkEndIndex =
                        std::min(
                            chunkStartIndex +
                                CHUNKED_READ_TARGETS_PER_CHUNK - 1,
                            sampleTimestamps.size() - 1
                        );

                    const double chunkStartTimestamp =
                        sampleTimestamps[chunkStartIndex];

                    const size_t chunkFrameCount =
                        chunkEndIndex -
                        chunkStartIndex +
                        1;

                    double chunkGapSeconds = 0.0;

                    if (chunkFrameCount > 1) {
                        chunkGapSeconds =
                            sampleTimestamps[chunkStartIndex + 1] -
                            sampleTimestamps[chunkStartIndex];
                    }

                    std::vector<cv::Mat> chunkFrames;

                    const auto chunkReadStart =
                        std::chrono::steady_clock::now();

                    if (!batchReader.batchReader(
                        chunkStartTimestamp,
                        chunkGapSeconds,
                        chunkFrameCount,
                        chunkFrames
                    )) {
                        timing.frameReadTime +=
                            std::chrono::steady_clock::now() -
                            chunkReadStart;

                        chunkStartIndex =
                            chunkEndIndex + 1;
                        continue;
                    }

                    timing.frameReadTime +=
                        std::chrono::steady_clock::now() -
                        chunkReadStart;

                    const size_t returnedCount =
                        std::min(
                            chunkFrames.size(),
                            chunkFrameCount
                        );

                    for (
                        size_t localIndex = 0;
                        localIndex < returnedCount;
                        ++localIndex
                    ) {
                        const size_t sampleIndex =
                            chunkStartIndex + localIndex;

                        processFrame(
                            chunkFrames[localIndex],
                            sampleFrameIndexes[sampleIndex],
                            static_cast<int>(sampleIndex),
                            EARLY_DEDUP_MAX_SAMPLE_GAP_BATCH,
                            sampleTimestamps[sampleIndex],
                            outputDirectory,
                            observations,
                            fps,
                            &timing
                        );
                    }

                    chunkStartIndex =
                        chunkEndIndex + 1;
                }
            }
        }

        /*
         * Group all accepted observations by identity.
         *
         * At this point observations still contain every valid face
         * detected throughout the video.
         */
        const auto groupingStart =
            std::chrono::steady_clock::now();

        std::vector<std::vector<int>> groups =
            FaceGrouping::group(
                observations,
                recognizer
            );

        timing.groupingTime +=
            std::chrono::steady_clock::now() -
            groupingStart;

        /*
         * Select up to three representative observations from each
         * identity group.
         *
         * Candidates are ordered best-first by quality and then
         * confidence so downstream code can treat the first item as the
         * fallback default while still retaining alternatives.
         */
        std::vector<std::pair<int,int>> representatives =
            FaceGrouping::selectTopCandidates(
                groups,
                observations,
                recognizer,
                2
            );

        /*
         * Re-read only the selected source frames and write aligned face
         * images for the final representatives.
         *
         * This avoids writing temporary thumbnails for every accepted
         * observation while still preserving the selected best-first
         * candidate ordering from `FaceGrouping::selectTopCandidates(...)`.
         */
        /*
         * Single merged loop: dedup check → image write → push.
         *
         * The dedup check runs BEFORE the image write so that rejected
         * candidates never produce files on disk. Previously the write
         * loop ran first, leaving orphaned image files for every face
         * that was subsequently dropped by dedup.
         *
         * Any face scoring at or above the final dedup similarity
         * threshold against any already-accepted face is considered a
         * near-duplicate and suppressed — both same-group (same scene, no
         * pose diversity) and cross-group (grouping false-split of the
         * same person).
         *
         * Relaxed extraction is used for manual retry, so it keeps a less
         * aggressive final dedup threshold to return more usable candidate
         * faces for user review.
         */
        const float finalDedupSimilarityThreshold = relaxed
            ? 0.80f
            : 0.65f;

        std::vector<ExtractedFace> selectedFaces;

        selectedFaces.reserve(
            representatives.size()
        );

        for (const auto& [observationIndex, groupIndex] : representatives) {
            if (
                observationIndex < 0 ||
                observationIndex >=
                    static_cast<int>(
                        observations.size()
                    )
            ) {
                continue;
            }

            const ExtractedFace& candidate =
                observations[observationIndex];

            /*
             * Step 1: similarity check against all already-accepted faces.
             * Reject before touching the filesystem.
             */
            bool isDuplicate = false;

            for (const ExtractedFace& accepted : selectedFaces) {
                const float similarity =
                    FaceGrouping::cosineSimilarity(
                        candidate.feature,
                        accepted.feature,
                        recognizer
                    );

                if (similarity >= finalDedupSimilarityThreshold) {
                    isDuplicate = true;
                    break;
                }
            }

            if (isDuplicate) {
                continue;
            }

            /*
             * Step 2: read source frame and write aligned face image.
             * Only reached if the face passed the similarity check.
             */
            cv::Mat sourceFrame;

            if (!image.empty()) {
                sourceFrame = image;
            } else {
                FFmpegVideoReader writerReader(
                    ffmpegPath,
                    ffprobePath,
                    videoPath
                );

                if (!writerReader.readFrameAtTime(
                    candidate.timestamp,
                    sourceFrame
                )) {
                    continue;
                }
            }

            std::string imagePath;

            const auto finalWriteStart =
                std::chrono::steady_clock::now();

            if (!writeRepresentativeImage(
                sourceFrame,
                candidate,
                detector,
                recognizer,
                outputDirectory,
                imagePath
            )) {
                timing.finalWriteTime +=
                    std::chrono::steady_clock::now() -
                    finalWriteStart;
                continue;
            }

            timing.finalWriteTime +=
                std::chrono::steady_clock::now() -
                finalWriteStart;

            /*
             * Step 3: stamp and collect.
             */
            observations[observationIndex].imagePath = imagePath;
            observations[observationIndex].identityIndex = groupIndex;

            selectedFaces.push_back(
                std::move(
                    observations[observationIndex]
                )
            );
        }

        timing.summary.outputFaces =
            static_cast<int>(
                selectedFaces.size()
            );

                if (debug) {

                    const auto toMilliseconds = [](

                        const std::chrono::steady_clock::duration duration

                    ) {

                        return std::chrono::duration_cast<

                            std::chrono::milliseconds

                        >(duration).count();

                    };

        

                    std::cerr

                        << "[melvec-face timing]"

                        << " detectedFaces="

                        << timing.summary.detectedFaces

                        << " qualifiedFaces="

                        << timing.summary.qualifiedFaces

                        << " outputFaces="

                        << timing.summary.outputFaces

                        << " frameReadMs="

                        << toMilliseconds(timing.frameReadTime)

                        << " processFrameMs="

                        << toMilliseconds(timing.processFrameTime)

                        << " groupingMs="

                        << toMilliseconds(timing.groupingTime)

                        << " finalWriteMs="

                        << toMilliseconds(timing.finalWriteTime)

                        << std::endl;

        

                    std::cerr

                        << "[melvec-face sampled-frame-indexes]";

        

                    for (size_t i = 0; i < debugSampleFrameIndexes.size(); ++i) {

                        std::cerr

                            << (i == 0 ? " " : ",")

                            << debugSampleFrameIndexes[i];

                    }

        

                    std::cerr << std::endl;

                }

        return FaceExtractionResult{
            std::move(selectedFaces),
            timing.summary
        };
    } catch (const NoVideoStreamError&) {
        return FaceExtractionResult{
            std::move(observations),
            timing.summary
        };
    } catch (const cv::Exception& error) {
        throw std::runtime_error(
            std::string("OpenCV face extraction failure: ") +
            error.what()
        );
    } catch (const std::exception&) {
        throw;
    }
}
