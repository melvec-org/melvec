const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');

const http = require('http');
const https = require('https');
const { allowInsecureHttpsDownloads } = require('./env');
const { logSystemError } = require('../logs/logService');

/**
 * Selects the appropriate HTTP client based on the URL protocol.
 *
 * @param {string} url - Download URL.
 * @returns {typeof http|typeof https} Matching Node.js client module.
 */
const pickClient = (url) => {
    if (typeof url !== 'string') throw new TypeError(`Invalid download url: ${url}`);
    return url.startsWith('https:') ? https : http;
};

/**
 * Builds request options for a download request, including host and TLS settings.
 *
 * @param {string} url - Request URL.
 * @param {Object} headers - Request headers.
 * @returns {Object} Node.js request options.
 */
const getRequestOptions = (url, headers) => {
    const u = new URL(url);

    const opts = {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        headers: {
            ...headers,
            // Ensure Host matches the signed URL domain (important with CloudFront/HF redirects)
            Host: u.host,
        },
    };

    // Ensure SNI is correct for HTTPS
    if (u.protocol === 'https:') {
        opts.servername = u.hostname;
    }

    // Dev-only escape hatch for corporate SSL interception / local CA issues.
    if (allowInsecureHttpsDownloads() && u.protocol === 'https:') {
        opts.agent = new https.Agent({ rejectUnauthorized: false, servername: u.hostname });
    }

    return opts;
};

/**
 * Deletes a file path if it exists and ignores any removal errors.
 *
 * @param {string} p - File path to remove.
 */
const safeUnlink = (p) => {
    try {
        fs.unlinkSync(p);
    } catch (_) {
        logSystemError('failed to remove file: ', p);
    }
};

/**
 * Handles a single resumable file download using Node.js HTTP clients.
 */
class DownloadTask {
    /**
     * @param {{url: string, destinationPath: string, headers?: Object}} param0 - Download configuration.
     */
    constructor({ url, destinationPath, headers = {} }) {
        this.url = url;
        this.destinationPath = destinationPath;
        this.tempPath = `${destinationPath}.part`;
        this.headers = headers;

        this.request = null;
        this.fileStream = null;

        this.status = 'idle'; // idle | downloading | paused | completed | canceled | error

        this.downloadedBytes = 0;
        this.totalBytes = null;

        this._resolve = null;
        this._reject = null;

        this.onProgress = null; // ({downloadedBytes,totalBytes,percent,status,url,destinationPath}) => void
        this.onStatus = null; // (status) => void
    }

    _emitProgress() {
        if (typeof this.onProgress === 'function') {
            const percent =
                this.totalBytes && this.totalBytes > 0 ? Math.min(100, Math.floor((this.downloadedBytes / this.totalBytes) * 100)) : null;

            this.onProgress({
                url: this.url,
                destinationPath: this.destinationPath,
                downloadedBytes: this.downloadedBytes,
                totalBytes: this.totalBytes,
                percent,
                status: this.status,
            });
        }
    }

    _setStatus(status) {
        this.status = status;
        if (typeof this.onStatus === 'function') this.onStatus(status);
        this._emitProgress();
    }

    _stripSensitiveHeadersForRedirect(headers) {
        const next = { ...headers };

        // Remove headers that should not be forwarded across domains.
        // NOTE: getRequestOptions() will always set the correct Host header for the target URL.
        delete next.Authorization;
        delete next.authorization;
        delete next.Cookie;
        delete next.cookie;
        delete next.Host;
        delete next.host;

        return next;
    }

    _attachRequestDebug(req) {
        req.on('socket', (socket) => {
            socket.setTimeout(120000);

            socket.on('lookup', (err, address, family, host) => {});

            socket.on('connect', () => {});

            socket.on('secureConnect', () => {});

            socket.on('timeout', () => {
                try {
                    req.destroy(new Error(`Socket timeout for ${this.url}`));
                } catch (_) {
                    this._setStatus('error');
                    req.destroy(err);
                }
            });

            socket.on('error', (err) => {
                logSystemError(`[DownloadTask] socket error for ${this.url}: ${err.code || ''} ${err.message}`);
            });
        });

        req.setTimeout(30000, () => {
            console.error(`[DownloadTask] Request timeout after 30s for ${this.url}`);
            const err = new Error(`Download request timed out for ${this.url}`);
            this._setStatus('error');
            try {
                req.destroy(err);
            } catch (_) {
                this._reject?.(err);
            }
        });

        req.on('error', (err) => {
            this._setStatus('error');
            // Provide a clearer message for TLS issues

            const isCertError =
                err.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
                err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                (err.message && err.message.toLowerCase().includes('certificate'));

            if (isCertError) {
                err.message =
                    `${err.message}\n` +
                    `TLS verification failed while downloading.\n` +
                    `If you're in a corporate network/proxy, install the corporate root CA`; // , or (DEV ONLY) set Melvec_INSECURE_HTTPS_DOWNLOADS=1.
            }

            this._reject?.(err);
        });
    }

    _requestWithRedirects(url, headers, redirectCount = 0) {
        const MAX_REDIRECTS = 10;

        if (redirectCount > MAX_REDIRECTS) {
            this._setStatus('error');
            this._reject?.(new Error(`Too many redirects while downloading ${url}`));
            return;
        }

        this.url = url;

        const client = pickClient(url);
        //const showLog = false;

        const req = client.get(getRequestOptions(url, headers), (res) => {
            // redirect
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const nextUrl = new URL(res.headers.location, url).toString();

                const prevHost = new URL(url).host;
                const nextHost = new URL(nextUrl).host;

                // Avoid forwarding sensitive headers across host boundaries.
                const nextHeaders = prevHost !== nextHost ? this._stripSensitiveHeadersForRedirect(headers) : headers;

                res.resume();
                this.request = null;

                return this._requestWithRedirects(nextUrl, nextHeaders, redirectCount + 1);
            }

            // 200 = full download, 206 = partial content (resume)
            if (![200, 206].includes(res.statusCode)) {
                const bodyChunks = [];
                res.on('data', (c) => bodyChunks.push(c));
                res.on('end', () => {
                    const preview = Buffer.concat(bodyChunks).toString('utf8').slice(0, 500);
                });

                this._setStatus('error');
                return this._reject?.(new Error(`Failed to download ${url}. Status: ${res.statusCode}`));
            }

            const existing = this.downloadedBytes;

            // If server ignored Range and returned 200 for a resumed download -> overwrite temp file
            const isResumeResponse = res.statusCode === 206;
            if (existing > 0 && !isResumeResponse) {
                safeUnlink(this.tempPath);
                this.downloadedBytes = 0;
            }

            const contentLength = Number(res.headers['content-length'] || 0);
            if (res.statusCode === 206) {
                const cr = res.headers['content-range']; // e.g. bytes 100-999/1000
                const total = cr && cr.includes('/') ? Number(cr.split('/').pop()) : null;
                this.totalBytes = Number.isFinite(total) ? total : existing + contentLength;
            } else {
                this.totalBytes = contentLength || null;
            }

            // Emit once right after we know totalBytes so UI doesn't stay at 0/?
            this._emitProgress();

            const stream = fs.createWriteStream(this.tempPath, { flags: this.downloadedBytes > 0 ? 'a' : 'w' });
            this.fileStream = stream;

            const finalize = () => {
                if (this.status !== 'downloading') return;

                try {
                    fs.renameSync(this.tempPath, this.destinationPath);
                } catch (e) {
                    this._setStatus('error');
                    return this._reject?.(e);
                }

                this._setStatus('completed');
                this._resolve?.({ status: 'completed', destinationPath: this.destinationPath });
            };

            let lastLogAt = 0;

            res.on('data', (chunk) => {
                this.downloadedBytes += chunk.length;
                this._emitProgress();

                const now = Date.now();
                if (now - lastLogAt > 1000) {
                    lastLogAt = now;
                }
            });

            res.on('end', () => {});

            res.on('error', (err) => {
                this._setStatus('error');
                try {
                    stream.destroy();
                } catch (e) {
                    logSystemError(`Failed to destroy. Error details: ${e.message}`);
                }
                this._reject?.(err);
            });

            stream.on('error', (err) => {
                this._setStatus('error');
                try {
                    res.destroy();
                } catch (e) {
                    logSystemError(`Failed to destroy. Error details: ${e.message}`);
                }
                this._reject?.(err);
            });

            stream.on('close', finalize);

            res.pipe(stream);
        });

        this._attachRequestDebug(req);

        this.request = req;
    }

    /**
     * Starts or resumes the download.
     *
     * @returns {Promise<{status: string, destinationPath: string}>} Promise resolved when the download completes.
     */
    async start() {
        if (this.status === 'downloading') return this._promise;
        if (this.status === 'completed') return Promise.resolve({ status: 'completed', destinationPath: this.destinationPath });

        if (typeof this.destinationPath !== 'string' || this.destinationPath.trim() === '') {
            this._setStatus('error');
            return Promise.reject(new Error(`DownloadTask requires a valid destinationPath. Got: ${this.destinationPath}`));
        }

        fse.ensureDirSync(path.dirname(this.destinationPath));

        const existing = fs.existsSync(this.tempPath) ? fs.statSync(this.tempPath).size : 0;
        this.downloadedBytes = existing;

        this._setStatus('downloading');

        // Create a single promise per start() call; redirect following must NOT replace resolve/reject.
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        const headers = {
            'User-Agent': 'melvec-electron-downloader/1.0',
            Accept: '*/*',
            Connection: 'keep-alive',
            ...this.headers,
        };
        if (existing > 0) {
            headers.Range = `bytes=${existing}-`;
        }

        this._requestWithRedirects(this.url, headers, 0);

        return this._promise;
    }

    /**
     * Pauses an active download and leaves the partial file in place for later resume.
     */
    pause() {
        if (this.status !== 'downloading') return;
        this._setStatus('paused');

        try {
            this.request?.destroy();
        } catch (e) {
            logSystemError(`Failed to destroy request. Error details: ${e.message}`);
        }

        try {
            this.fileStream?.close(() => {});
        } catch (e) {
            logSystemError(`Failed to destroy request. Error details: ${e.message}`);
        }

        this.request = null;
        this.fileStream = null;
    }

    /**
     * Cancels the download and removes any partial file.
     */
    cancel() {
        if (this.status === 'completed' || this.status === 'canceled') return;
        this._setStatus('canceled');

        try {
            this.request?.destroy();
        } catch (e) {
            logSystemError(`Failed to destroy request. Error details: ${e.message}`);
        }

        try {
            this.fileStream?.close(() => {});
        } catch (e) {
            logSystemError(`Failed to destroy request. Error details: ${e.message}`);
        }

        this.request = null;
        this.fileStream = null;

        safeUnlink(this.tempPath);

        if (this._reject) {
            this._reject(new Error('Download canceled'));
        }
    }
}

/**
 * DownloadQueue: downloads a list of files sequentially (one-by-one).
 * Supports pause/resume/cancel for whole queue.
 */
class DownloadQueue {
    /**
     * @param {Array<{url: string, destinationPath: string, headers?: Object}>} [items=[]] - Queue items to download.
     * @param {{onItemProgress?: Function, onQueueStatus?: Function, onItemComplete?: Function, onError?: Function, fallbackDownload?: Function}} [options={}] - Queue callbacks and fallback behavior.
     */
    constructor(items = [], options = {}) {
        this.items = items; // [{url, destinationPath, headers?}]
        this.index = 0;

        this.activeTask = null;
        this.status = 'idle'; // idle | downloading | paused | completed | canceled | error

        this.onItemProgress = options.onItemProgress || null; // ({index,total,taskProgress}) => void
        this.onQueueStatus = options.onQueueStatus || null; // (status) => void
        this.onItemComplete = options.onItemComplete || null; // ({index,item}) => void
        this.onError = options.onError || null; // (error) => void

        this.fallbackDownload = typeof options.fallbackDownload === 'function' ? options.fallbackDownload : null; // async (item, error) => void
    }

    _setStatus(status) {
        this.status = status;
        if (typeof this.onQueueStatus === 'function') this.onQueueStatus(status);
    }

    _isCertLikeError(e) {
        const msg = (e?.message || '').toLowerCase();
        return (
            e?.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
            e?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
            e?.code === 'CERT_HAS_EXPIRED' ||
            e?.code === 'ERR_CERT_AUTHORITY_INVALID' ||
            msg.includes('certificate') ||
            msg.includes('tls verification failed')
        );
    }

    /**
     * Starts processing the queue from the current index.
     *
     * @returns {Promise<void>} Resolves when the queue completes or stops.
     */
    async start() {
        if (this.status === 'downloading') return;
        if (this.status === 'completed') return;

        this._setStatus('downloading');

        while (this.index < this.items.length) {
            if (this.status !== 'downloading') return;

            const item = this.items[this.index];
            const task = new DownloadTask(item);
            this.activeTask = task;

            let lastProgressLogAt = 0;

            task.onProgress = (p) => {
                const now = Date.now();
                if (now - lastProgressLogAt > 1000) {
                    lastProgressLogAt = now;
                    if (typeof this.onItemProgress === 'function') {
                        this.onItemProgress({
                            index: this.index,
                            total: this.items.length,
                            taskProgress: p,
                        });
                    }
                }
            };

            try {
                await task.start();

                if (typeof this.onItemComplete === 'function') {
                    this.onItemComplete({ index: this.index, item });
                }

                this.index += 1;
            } catch (e) {
                if (this.status === 'paused' || this.status === 'canceled') return;

                const canFallback = this.fallbackDownload && this._isCertLikeError(e);

                if (canFallback) {
                    try {
                        await this.fallbackDownload(item, e);

                        if (typeof this.onItemComplete === 'function') {
                            this.onItemComplete({ index: this.index, item });
                        }

                        this.index += 1;
                        continue;
                    } catch (fallbackErr) {
                        this._setStatus('error');
                        if (typeof this.onError === 'function') this.onError(fallbackErr);
                        throw fallbackErr;
                    }
                }

                this._setStatus('error');
                if (typeof this.onError === 'function') this.onError(e);
                throw e;
            } finally {
                this.activeTask = null;
            }
        }

        this._setStatus('completed');
    }

    /**
     * Pauses the queue and the currently active download, if any.
     */
    pause() {
        if (this.status !== 'downloading') return;
        this._setStatus('paused');
        this.activeTask?.pause();
    }

    /**
     * Resumes a paused queue.
     *
     * @returns {Promise<void>|undefined} Queue promise when resumed.
     */
    resume() {
        if (this.status !== 'paused') return;
        return this.start();
    }

    /**
     * Cancels the queue and the active download, if any.
     */
    cancel() {
        if (this.status === 'completed' || this.status === 'canceled') return;
        this._setStatus('canceled');
        this.activeTask?.cancel();
    }
}

module.exports = {
    DownloadTask,
    DownloadQueue,
};
