const { spawn } = require('child_process');
const { logSystemError } = require('../logs/logService');
const { getFfmpegPath, getFfprobePath } = require('./binaryPaths');

/**
 * Shared child-process utilities used across services.
 *
 * Purpose:
 * - Run short-lived commands and capture stdout/stderr.
 * - Run long-lived/stoppable commands with access to the spawned child process.
 * - Provide reusable kill handles for graceful process termination.
 * - Support ffmpeg progress-based execution helpers.
 *
 * Use this module when:
 * - you need to execute a command and collect stdout/stderr
 * - you want consistent child-process handling
 * - you need cancellable long-running commands
 * - you need a standard kill/stop mechanism for active jobs
 *
 * Main helpers:
 *
 * - run(command, args, options)
 *   Use for simple commands that should run to completion.
 *   Resolves with collected stdout/stderr and rejects on failure.
 *
 * - runStoppable(command, args, options)
 *   Use for commands that may need cancellation or direct access to the spawned child.
 *   Supports an onSpawn(child) callback so callers can register stop handlers.
 *
 * - createKillHandle(child, killTimeout = 500)
 *   Wraps a spawned child process with a standardized async kill() method.
 *   First sends SIGTERM, then SIGKILL after the timeout if still running.
 *
 * - runFfmpegWithProgress(args, onProgress, onSpawn)
 *   Runs ffmpeg and parses machine-readable progress output.
 */

function runCmd(cmd, args) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';

        p.stderr.on('data', (d) => {
            stderr += d.toString();
        });

        p.on('error', (err) => {
            reject(new Error(`Failed to start "${cmd}". Is it installed and on PATH?\n${err.message}`));
        });

        p.on('close', (code) => {
            if (code === 0) return resolve();
            reject(new Error(`"${cmd}" exited with code ${code}\n${stderr}`));
        });
    });
}

/**
 * Executes a command as a child process, captures its standard output and standard error,
 * and optionally writes input to the process standard input.
 *
 * @param {string} cmd - The command or executable to run.
 * @param {string[]} args - An array of arguments to pass to the command.
 * @param {Object} [opts={}] - Optional settings for the command execution.
 * @param {string|Buffer} [opts.input] - Data to write to the child process standard input before closing it.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runCmdCapture(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';

        p.stdout.on('data', (d) => {
            stdout += d.toString();
        });
        p.stderr.on('data', (d) => {
            stderr += d.toString();
        });

        p.on('error', (err) => {
            reject(new Error(`Failed to start "${cmd}". Is it installed and on PATH?\n${err.message}`));
        });

        if (opts.input) {
            p.stdin.write(opts.input);
        }
        p.stdin.end();

        p.on('close', (code) => {
            if (code === 0) return resolve({ stdout, stderr });
            reject(new Error(`"${cmd}" exited with code ${code}\n${stderr || stdout}`));
        });
    });
}

const runFfmpegWithProgress = (args, onProgress, onSpawn) => {
    const THROTTLE_MS = 500;
    const ffmpegPath = getFfmpegPath();

    return new Promise((resolve, reject) => {
        const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        if (typeof onSpawn === 'function') {
            onSpawn(child);
        }

        let stderrBuf = '';
        let lastEmitAt = 0;
        let block = {};

        child.stdout.on('data', (chunk) => {
            const lines = chunk.toString().split(/\r?\n/).filter(Boolean);

            for (const line of lines) {
                const idx = line.indexOf('=');
                if (idx === -1) continue;

                const key = line.slice(0, idx).trim();
                const value = line.slice(idx + 1).trim();
                block[key] = value;

                if (key === 'progress') {
                    const now = Date.now();
                    if (typeof onProgress === 'function' && now - lastEmitAt >= THROTTLE_MS) {
                        lastEmitAt = now;
                        onProgress({
                            outTimeMs: Number(block.out_time_ms || 0),
                            speed: block.speed || null,
                            progress: block.progress,
                        });
                    }

                    // reset for next block
                    block = {};
                }
            }
        });
        child.stderr.on('data', (chunk) => {
            stderrBuf += chunk.toString();
        });

        child.on('error', (err) => reject(err));

        child.on('close', (code) => {
            if (code === 0) {
                if (typeof onProgress === 'function') {
                    onProgress({ outTimeMs: null, speed: null, progress: 'end' });
                }
                return resolve({ code: 0, stderr: stderrBuf });
            }

            reject(new Error(`ffmpeg exited with code ${code}\n${stderrBuf}`));
        });
    });
};

/**
 * Executes a command and waits for completion.
 *
 * Best for short-lived commands where cancellation is not required.
 *
 * @param {string} command
 * @param {string[]} [args=[]]
 * @param {Object} [options={}]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
const run = (cmd, args, { stdin } = {}) =>
    new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

        let stdout = '';
        let stderr = '';

        p.stdout.on('data', (d) => (stdout += d.toString()));
        p.stderr.on('data', (d) => (stderr += d.toString()));

        p.on('error', reject);
        p.on('close', (code) => {
            if (code === 0) return resolve({ stdout, stderr });
            reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}\n${stderr}`));
        });

        if (stdin != null) p.stdin.write(stdin);
        p.stdin.end();
    });

/**
 * Creates a standard async kill handle for a spawned child process.
 *
 * The returned kill() method attempts graceful termination first,
 * then force-kills after the provided timeout.
 *
 * @param {import('child_process').ChildProcess} child
 * @param {number} [killTimeout=500]
 * @returns {{ kill: () => Promise<void> }}
 */
const createKillHandle = (child, killTimeout = 500) => ({
    kill: () => {
        return new Promise((resolve) => {
            try {
                child.kill('SIGTERM');
            } catch (_) {
                reject(new Error(`Failed to kill child process`));
            }

            setTimeout(() => {
                try {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                } catch (_) {
                    reject(new Error(`Failed to kill child process after ${killTimeout}ms`));
                }
                resolve();
            }, killTimeout);
        });
    },
});

/**
 * Executes a command and exposes the spawned child through onSpawn.
 *
 * Best for long-running or cancellable commands.
 *
 * @param {string} command
 * @param {string[]} [args=[]]
 * @param {Object} [options={}]
 * @param {(child: import('child_process').ChildProcess) => void} [options.onSpawn]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
const runStoppable = (cmd, args, { stdin, onSpawn } = {}) =>
    new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

        if (typeof onSpawn === 'function') onSpawn(p);

        let stdout = '';
        let stderr = '';

        p.stdout.on('data', (d) => (stdout += d.toString()));
        p.stderr.on('data', (d) => {
            const s = d.toString();
            const cleaned = s
                .split(/\r?\n/)
                .filter((line) => !/^>\s*EOF by user\s*$/i.test(line.trim()))
                .join('\n');

            if (cleaned.trim().length === 0) return;
            stderr += cleaned + '\n';
        });

        p.on('error', reject);
        p.on('close', (code, signal) => {
            if (signal) return reject(new Error(`Command killed (${signal}): ${cmd} ${args.join(' ')}`));
            if (code === 0) return resolve({ stdout, stderr });
            reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}\n${stderr}`));
        });

        if (stdin != null) p.stdin.write(stdin);
        p.stdin.end();
    });

async function isCommandAvailable(cmd) {
    try {
        await runCmdCapture(cmd, ['-version']);
        return true;
    } catch (e) {
        if (/ENOENT|Failed to start/i.test(String(e?.message || e))) return false;
        return true;
    }
}

async function checkFfmpegTools() {
    const ffmpegPath = getFfmpegPath();
    const ffmpegOk = await isCommandAvailable(ffmpegPath);

    if (!ffmpegOk) {
        logSystemError('Missing dependency: "ffmpeg" not found on PATH. Video features may not work.', ffmpegPath);
    }

    const ffprobePath = getFfprobePath();
    const ffprobeOk = await isCommandAvailable(ffprobePath);

    if (!ffprobeOk) {
        logSystemError('Missing dependency: "ffprobe" not found on PATH. Video metadata features may not work.', ffprobePath);
    }

    return {
        ffmpeg: { ok: ffmpegOk, path: ffmpegPath },
        ffprobe: { ok: ffprobeOk, path: ffprobePath },
    };
}

module.exports = {
    run,
    runStoppable,
    runFfmpegWithProgress,
    createKillHandle,
    checkFfmpegTools,
    runCmd,
    runCmdCapture,
};
