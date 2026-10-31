const { getModelPath, getModelTier } = require('../ai-models/models');
const { getLlamaMtmdBinaryPath } = require('../service-utils/binaryPaths');
const { runStoppable, createKillHandle } = require('../service-utils/process');

const runningJobs = new Map();

const dynamicAnalysisParams = {
    basic:    { '-n': '16', '-c': '4096' },
    standard: { '-n': '16', '-c': '8192' },
    advanced: { '-n': '16', '-c': '8192' },
};

/**
 * Scores a single face image using the local vision LLM.
 *
 * Each face is evaluated independently in its own LLM call so the model
 * only ever sees one --image at a time — no positional referencing needed.
 *
 * @param {string} imagePath
 * @param {string} modelPath
 * @param {string} projPath
 * @param {string} llamaMtmdBinaryPath
 * @param {object} paramsByTier
 * @returns {Promise<number>} Score 1–10, or 0 on parse failure.
 */
const scoreFace = async (imagePath, modelPath, projPath, llamaMtmdBinaryPath, paramsByTier, onSpawn) => {
    const prompt = [
        'You are a face thumbnail quality expert.',
        'First, check if this image contains a usable face:',
        '  - If no eyes are visible (e.g. side profile showing only an ear, back of head, or fully turned away), reply with 0.',
        '  - If both eyes are fully or mostly occluded (e.g. covered, looking straight down), reply with 0.',
        'Otherwise, rate the face on a scale from 1 to 10:',
        'Score higher for: facing the camera, open eyes, good lighting, sharp focus, natural expression, clear face coverage.',
        'Score lower for: blurry, dark, extreme angle, closed eyes, partial face.',
        'Reply with ONLY a single integer between 0 and 10. No explanation.',
    ].join('\n');

    const args = [
        '-m', modelPath,
        '--mmproj', projPath,
        '--image', imagePath,
        '-p', prompt,
        '--temp', '0.1',
        '--top-p', '0.9',
        '--repeat-penalty', '1.2',
        '-n', paramsByTier['-n'],
        '-c', paramsByTier['-c'],
    ];

    const { stdout } = await runStoppable(llamaMtmdBinaryPath, args, { stdin: '' });
    const raw = stdout.replace(/\n?>?\s*EOF by user\s*$/i, '').trim();
    const score = parseInt(raw, 10);
    return Number.isNaN(score) ? 0 : Math.min(10, Math.max(0, score));
};

/**
 * Uses a local vision LLM to score every face in the list and return the
 * best one — regardless of group size. Single-face groups are scored too,
 * so unusable solo faces (side profile, no visible eyes, etc.) are caught
 * and discarded by the caller.
 *
 * Returns null when every face in the group scores 0 (all unusable or all
 * LLM calls failed with no extractor quality fallback possible).
 *
 * @param {Array<{id: string, imagePath: string, quality: number, confidence: number, identityIndex: number}>} faceList
 * @param {string} [processId] - Optional ID for cancellation support.
 * @returns {Promise<{id: string, imagePath: string, quality: number, confidence: number, identityIndex: number} | null>}
 */
const getBestFace = async (faceList, processId) => {
    if (!faceList || faceList.length === 0) {
        throw new Error('getBestFace: faceList is empty');
    }

    try {
        const llamaMtmdBinaryPath = getLlamaMtmdBinaryPath();
        const modelPath = getModelPath('slmModel');
        const projPath = getModelPath('slmProjector');
        const modelTier = getModelTier();
        const paramsByTier = dynamicAnalysisParams[modelTier];

        // Score every face sequentially — one LLM call at a time.
        // Running in parallel would cause multiple vision model processes
        // to compete for CPU/GPU and memory, which is a bottleneck.
        // Single-face groups are scored too — a solo unusable face must be
        // caught here rather than silently passed through.
        const scores = [];

        for (const face of faceList) {
            let score = 0;
            try {
                score = await scoreFace(
                    face.imagePath,
                    modelPath,
                    projPath,
                    llamaMtmdBinaryPath,
                    paramsByTier,
                    processId
                        ? (child) => runningJobs.set(processId, createKillHandle(child))
                        : undefined
                );
            } catch {
                score = 0;
            }

            scores.push(score);
        }

        if (processId) runningJobs.delete(processId);

        // Pick the face with the highest LLM score.
        let bestIndex = 0;
        for (let i = 1; i < scores.length; i++) {
            if (scores[i] > scores[bestIndex]) {
                bestIndex = i;
            }
        }

        // All scores are 0 — every face was unusable (side profile, no eyes,
        // etc.) or every LLM call failed. Return null so the caller can
        // discard the entire identity group rather than keeping a bad face.
        if (scores[bestIndex] === 0) {
            return null;
        }

        return faceList[bestIndex];
    } catch (error) {
        throw new Error(`getBestFace failed: ${error.message}`);
    }
};

const stopGettingBestFace = async (processId) => {
    const job = runningJobs.get(processId);

    if (!job) return true;

    try {
        await job.kill();
    } finally {
        runningJobs.delete(processId);
    }

    return true;
};

module.exports = {
    getBestFace,
    stopGettingBestFace,
};
