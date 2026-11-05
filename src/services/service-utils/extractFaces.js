const path = require('path');

const generateMediaId = require('./generateMediaId');
const { getFacesPath } = require('../servicePathConfig');
const {
    getFfmpegPath,
    getFfprobePath,
    getAiBinaryPath,
    getFaceDetectionModelPath,
    getFaceRecognitionModelPath,
} = require('./binaryPaths');
const { run } = require('./process');
const { getBestFace } = require('../subjects/getBestFace');
const { isAIActive } = require('./ai');
const { assertFilePath, removeFile, renameFile } = require('./fileUtils');

const FACE_IMAGE_EXTENSION = '.jpg';

const assertFaceFilePath = (faceImagePath) => assertFilePath(faceImagePath, getFacesPath(), FACE_IMAGE_EXTENSION);

const removeFaceFile = async (faceImagePath) => {
    const safeFacePath = await assertFaceFilePath(faceImagePath);
    const result = await removeFile(safeFacePath);

    if (result?.status !== 'success') {
        throw new Error(`Failed to remove face file ${safeFacePath}: ${result?.message || 'unknown error'}`);
    }
};

/**
 * Renames a face image to its stable mediaId-based filename and returns
 * a face object with the updated imagePath.
 *
 * The faces table stores `face.mediaId` as the face ID, and downstream
 * readers derive the image path from that ID instead of storing imagePath.
 * Because of that, every retained face must be moved to a filename based
 * on `face.mediaId`, even when AI selection is skipped.
 *
 * @param {Object} face - Mapped face object from melvec-face output.
 * @param {string} face.mediaId - Stable content-derived face ID used as the persisted face ID.
 * @param {string} face.imagePath - Current extracted image path from melvec-face.
 * @returns {Promise<Object>} Face object with stable imagePath.
 */
const renameFaceToStablePath = async (face) => {
    const safeFacePath = await assertFaceFilePath(face.imagePath);
    const stablePath = path.join(path.dirname(safeFacePath), `${face.mediaId}${FACE_IMAGE_EXTENSION}`);
    await renameFile(safeFacePath, stablePath);

    return {
        ...face,
        imagePath: stablePath,
    };
};

/**
 * Returns the retained face images for a media item and normalizes their
 * filenames to the stable `mediaId` convention used by face persistence.
 *
 * Behavior depends on AI availability:
 * - AI disabled/unavailable: no best-face selection is performed. Every
 *   extracted face is kept, renamed to its stable `mediaId` filename, and
 *   returned so the user can decide which faces to keep later.
 * - AI active: faces are grouped by `identityIndex`; each group is scored
 *   by the vision LLM, the best representative is kept and renamed, and
 *   all rejected images are deleted.
 *
 * Additional AI-active behavior:
 * - Every group is scored by the LLM, including single-face groups.
 *   A solo face may be unusable (side profile, no eyes) and must be
 *   discarded rather than passed through unchecked.
 * - `null` from `getBestFace` means the entire group is unusable — all
 *   images in that group are deleted and excluded from results.
 * - Falls back to highest extractor quality only on LLM infrastructure
 *   failures (binary missing, process crash), not on bad face quality.
 *
 * @param {Array<Object>} faces - Mapped face objects from melvec-face output.
 * @returns {Promise<Array<Object>>} Retained faces with stable imagePath values.
 */
const selectBestFacePerIdentity = async (faces) => {
    if (faces.length === 0) return [];

    if (!isAIActive()) {
        const renamedFaces = [];
        for (const face of faces) {
            renamedFaces.push(await renameFaceToStablePath(face));
        }
        return renamedFaces;
    }

    // Group by identityIndex.
    const groups = new Map();
    for (const face of faces) {
        const key = face.identityIndex ?? 0;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(face);
    }

    const bestFaces = [];

    for (const [, group] of groups) {
        let chosen;

        try {
            // Always score — even single-face groups. A solo face may be
            // unusable (side profile, no eyes) and must be discarded too.
            chosen = await getBestFace(group);
        } catch {
            // LLM completely unavailable — fall back to extractor quality
            // so we never silently drop an entire identity group on infra
            // failures unrelated to face quality.
            chosen = group.reduce((best, face) => (face.quality > best.quality ? face : best));
        }

        // null means every face in the group was unusable — discard all.
        if (chosen === null) {
            for (const face of group) {
                await removeFaceFile(face.imagePath);
            }
            continue;
        }

        // Permanently delete all rejected images for this identity.
        for (const face of group) {
            if (face !== chosen) {
                await removeFaceFile(face.imagePath);
            }
        }

        bestFaces.push(await renameFaceToStablePath(chosen));
    }

    return bestFaces;
};

/**
 * Extracts faces from a single video or image using the melvec-face
 * binary, generates stable IDs for the extracted face images, and returns
 * the retained faces after optional AI-based representative selection.
 *
 * When AI is active, the result contains one selected representative per
 * detected identity. When AI is disabled or unavailable, all extracted
 * faces are returned so the user can decide later. In both cases, retained
 * face image files are renamed to their stable `mediaId` filename because
 * downstream face lookups derive image paths from the persisted face ID.
 *
 * @param {string} mediaPath - Absolute path to the video or image.
 * @param {string} mediaType - Media type constant.
 * @param {string} mediaId   - Source media ID.
 * @param {{ relaxed?: boolean }} options - Optional extraction flags.
 * @returns {Promise<{mediaId, mediaPath, mediaType, faces, detectedFaceCount, selectedFaceCount}>}
 */
const extractFaces = async (mediaPath, mediaType, mediaId, options = {}) => {
    const outputDir = getFacesPath();
    const melvecFacePath = getAiBinaryPath('melvec-face');
    const yunetModelPath = getFaceDetectionModelPath();
    const sfaceModelPath = getFaceRecognitionModelPath();
    const ffmpegPath = getFfmpegPath();
    const ffprobePath = getFfprobePath();

    const args = [mediaPath, ffmpegPath, ffprobePath, yunetModelPath, sfaceModelPath, outputDir];

    if (options.relaxed === true) {
        args.push('--relaxed');
    }

    const { stdout, stderr } = await run(melvecFacePath, args);

    let response;
    try {
        response = JSON.parse(stdout);
    } catch (error) {
        throw new Error(`Failed to parse melvec-face output: ${error.message}`);
    }

    if (response?.status !== 'success') {
        const message = response?.data?.error?.message || 'melvec-face returned failure';
        throw new Error(message);
    }

    const rawFaces = [];
    for (const face of response?.data?.faces || []) {
        const safeFacePath = await assertFaceFilePath(face.imagePath);

        rawFaces.push({
            id: face.id,
            mediaId: await generateMediaId(safeFacePath),
            imagePath: safeFacePath,
            embedding: face.embedding,
            confidence: face.confidence,
            quality: face.quality,
            identityIndex: face.identityIndex,
        });
    }

    const faces = await selectBestFacePerIdentity(rawFaces);

    return {
        mediaId,
        mediaPath,
        mediaType,
        faces,
        detectedFaceCount: rawFaces.length,
        selectedFaceCount: faces.length,
    };
};

module.exports = {
    extractFaces,
};
