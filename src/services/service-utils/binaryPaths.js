const path = require('path');
const { isProd } = require('./env');

/**
 * Centralized executable/binary path resolvers used across services.
 *
 * Purpose:
 * - Resolve bundled binary locations for packaged Electron builds.
 * - Resolve development-time binary locations from local dependencies or bin/ assets.
 * - Keep all executable path logic in one place.
 *
 * Use this module when:
 * - you need the path for ffmpeg / ffprobe
 * - you need the path for whisper-cli
 * - you need the path for llama-based AI binaries
 * - you want production vs development path resolution handled consistently
 *
 * Main helpers:
 *
 * - getBundledBinPath(name, checkForArch = false)
 *   Returns a binary path from Electron's packaged resources directory.
 *
 * - getFfmpegPath()
 *   Returns the ffmpeg executable path.
 *
 * - getFfprobePath()
 *   Returns the ffprobe executable path.
 *
 * - getWhisperCliPath()
 *   Returns the whisper-cli executable path.
 *
 * - getAiBinaryPath(binaryName, checkForArch = false)
 *   Returns a development or production path for app-bundled AI binaries.
 *
 * - getLlamaCompletionBinaryPath()
 *   Returns the llama completion binary path.
 *
 * - getLlamaMtmdBinaryPath()
 *   Returns the llama multimodal binary path.
 *
 * - getLlamaEmbeddingBinaryPath()
 *   Returns the llama embedding binary path.
 */

function safeRequire(moduleName) {
    try {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        return require(moduleName);
    } catch (_) {
        return null;
    }
}

function getBundledBinPath(name, checkForArch = false) {
    const exeName = process.platform !== 'win32' ? name : `${name}.exe`;
    const archDir = checkForArch ? process.arch : '';
    const platformDir = process.platform === 'darwin' ? 'mac' : process.platform;

    return path.join(process.resourcesPath, 'bin', platformDir, archDir, exeName);
}

function getFfmpegPath() {
    if (isProd()) return getBundledBinPath('ffmpeg');

    const ffmpegStatic = safeRequire('ffmpeg-static');

    return ffmpegStatic;
}

function getFfprobePath() {
    if (isProd()) return getBundledBinPath('ffprobe', true);

    const ffprobeStatic = safeRequire('ffprobe-static');
    return ffprobeStatic?.path || 'ffprobe';
}

function getWhisperCliPath() {
    const exeName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    const platformDir = process.platform === 'darwin' ? 'mac' : process.platform;

    if (isProd()) {
        return path.join(process.resourcesPath, 'bin', platformDir, exeName);
    }

    return path.join(__dirname, '../../../bin', platformDir, exeName);
}

function getAiBinaryPath(binaryName, checkForArch = false) {
    if (isProd()) {
        return getBundledBinPath(binaryName, checkForArch);
    }

    const exeName = process.platform === 'win32' ? `${binaryName}.exe` : binaryName;
    const archDir = checkForArch ? process.arch : '';
    const platformDir = process.platform === 'darwin' ? 'mac' : process.platform;

    return path.join(__dirname, '../../../bin', platformDir, archDir, exeName);
}

function getLlamaCompletionBinaryPath() {
    return getAiBinaryPath('llama-completion');
}

function getLlamaMtmdBinaryPath() {
    return getAiBinaryPath('llama-mtmd-cli');
}

function getLlamaEmbeddingBinaryPath() {
    return getAiBinaryPath('llama-embedding');
}

module.exports = {
    getBundledBinPath,
    getFfmpegPath,
    getFfprobePath,
    getWhisperCliPath,
    getAiBinaryPath,
    getLlamaCompletionBinaryPath,
    getLlamaMtmdBinaryPath,
    getLlamaEmbeddingBinaryPath,
};
