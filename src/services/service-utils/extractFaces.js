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
const { removeFile, renameFile } = require('./fileUtils');

/**
 * Groups faces by identityIndex, selects the best representative per
 * group using the vision LLM, renames the chosen image to its stable
 * mediaId filename, and deletes all rejected images.
 *
 * - Every group is scored by the LLM, including single-face groups.
 *   A solo face may be unusable (side profile, no eyes) and must be
 *   discarded rather than passed through unchecked.
 * - Returns null from getBestFace means the entire group is unusable —
 *   all images are deleted and the group is excluded from results.
 * - Falls back to highest extractor quality only on LLM infrastructure
 *   failures (binary missing, process crash), not on bad face quality.
 *
 * @param {Array} faces - Mapped face objects from melvec-face output.
 * @returns {Promise<Array>} One best face per identity with stable imagePath.
 */
const selectBestFacePerIdentity = async (faces) => {
    if (faces.length === 0) return [];

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
                await removeFile(face.imagePath);
            }
            continue;
        }

        // Permanently delete all rejected images for this identity.
        for (const face of group) {
            if (face !== chosen) {
                await removeFile(face.imagePath);
            }
        }

        // Rename chosen image to its stable mediaId-based filename.
        const ext = path.extname(chosen.imagePath);
        const stablePath = path.join(path.dirname(chosen.imagePath), `${chosen.mediaId}${ext}`);
        await renameFile(chosen.imagePath, stablePath);

        bestFaces.push({
            ...chosen,
            imagePath: stablePath,
        });
    }

    return bestFaces;
};

/**
 * Extracts faces from a single video or image using the melvec-face
 * binary, then selects the best representative per detected identity
 * using the local vision LLM.
 *
 * Returns one face per identity — the batch processor does not need to
 * know about identity grouping or LLM selection.
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
        throw new Error(`Failed to parse melvec-face output.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    }

    if (response?.status !== 'success') {
        const message = response?.data?.error?.message || 'melvec-face returned failure';
        throw new Error(message);
    }

    const rawFaces = [];
    for (const face of response?.data?.faces || []) {
        rawFaces.push({
            id: face.id,
            mediaId: await generateMediaId(face.imagePath),
            imagePath: face.imagePath,
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
