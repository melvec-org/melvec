const { runStoppable, createKillHandle } = require('./process');
const { getModelPath } = require('../ai-models/models');
const { getLlamaEmbeddingBinaryPath } = require('./binaryPaths');

const llamaEmbeddingBinaryPath = getLlamaEmbeddingBinaryPath();

const parseEmbeddingOutput = (stdout) => {
    const cleanedOutput = typeof stdout === 'string' ? stdout.trim() : '';

    if (!cleanedOutput) {
        throw new Error('No embedding output received from model');
    }

    try {
        const jsonStart = cleanedOutput.indexOf('[');
        const jsonEnd = cleanedOutput.lastIndexOf(']');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const vector = JSON.parse(cleanedOutput.slice(jsonStart, jsonEnd + 1));

            if (Array.isArray(vector) && vector.every((value) => Number.isFinite(Number(value)))) {
                return vector.map(Number);
            }
        }
    } catch (e) {
        throw new Error('Failed to parse embedding output');
    }

    const vector = cleanedOutput
        .replace(/\n/g, ' ')
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

    if (vector.length === 0) {
        throw new Error(`Failed to parse embedding output: ${cleanedOutput.slice(0, 300)}`);
    }

    return vector;
};

const generateEmbedding = async (input, options = {}) => {
    const { jobKey, runningJobs } = options;
    const modelPath = getModelPath('embeddingModel');

    if (!modelPath) {
        throw new Error('Embedding model path not found');
    }

    const normalizedInput = typeof input === 'string' ? input.trim() : '';

    if (normalizedInput.length === 0) {
        return [];
    }

    const args = ['-m', modelPath, '-p', normalizedInput];
    let stdout = '';

    try {
        ({ stdout } = await runStoppable(llamaEmbeddingBinaryPath, args, {
            stdin: '',
            onSpawn: (child) => {
                if (!jobKey || !runningJobs) return;
                runningJobs.set(jobKey, createKillHandle(child));
            },
        }));
    } finally {
        if (jobKey && runningJobs) {
            runningJobs.delete(jobKey);
        }
    }

    return parseEmbeddingOutput(stdout);
};

const generateEmbeddingFromKeywords = async (keywords, options = {}) => {
    return generateEmbedding(keywords, options);
};

module.exports = {
    generateEmbedding,
    generateEmbeddingFromKeywords,
    parseEmbeddingOutput,
};
