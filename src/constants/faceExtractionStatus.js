/**
 * Database status values for media face extraction.
 *
 * These values describe the media-level extraction result, not whether a
 * subject candidate was ultimately persisted. For example,
 * `COMPLETED_FACE_DETECTED` means the extractor found at least one face
 * candidate, but downstream filtering may still produce zero saved subject
 * candidates.
 *
 * DB values intentionally use compact four-character codes:
 * - `proc`: processing
 * - `cfdt`: completed, face detected
 * - `cnfd`: completed, no face detected
 * - `fail`: failed
 *
 * Batch processing should only pick `NOT_STARTED` or recoverable
 * `PROCESSING` rows. Manual retry can be offered for
 * `COMPLETED_FACE_DETECTED` rows when the user wants to rerun extraction
 * with relaxed thresholds.
 */
const faceExtractionStatus = Object.freeze({
    /** Face extraction has never been attempted for this media. */
    NOT_STARTED: null,

    /** Face extraction is currently running or was interrupted mid-run. */
    PROCESSING: 'proc',

    /** Extraction completed and at least one native face candidate was detected. */
    COMPLETED_FACE_DETECTED: 'cfdt',

    /** Extraction completed successfully, but no native face candidates were detected. */
    COMPLETED_NO_FACE_DETECTED: 'cnfd',

    /** Extraction failed due to a technical/runtime error. */
    FAILED: 'fail',
});

const faceExtractionRetryEligibleStatuses = new Set([
    faceExtractionStatus.COMPLETED_FACE_DETECTED,
    faceExtractionStatus.FAILED,
]);

const isFaceExtractionRetryEligible = (status) => faceExtractionRetryEligibleStatuses.has(status);

module.exports = Object.freeze({
    ...faceExtractionStatus,
    isFaceExtractionRetryEligible,
});
