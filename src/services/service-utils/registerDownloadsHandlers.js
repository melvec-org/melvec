const { session, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let pendingChromiumDownload = null; // { url, destinationPath, resolve, reject, onProgress }
let activeDownloadItem = null; // DownloadItem

/**
 * Attempts to cancel the active Chromium/Electron-managed download.
 *
 * @returns {boolean} Returns `true` if an active download item was found and cancellation was successfully
 * requested; otherwise returns `false`.
 */
function cancelChromiumDownload() {
    if (!activeDownloadItem) return false;

    try {
        activeDownloadItem.cancel();
        return true;
    } catch (_) {
        return false;
    }
}

function getFileNameFromUrl(url = '') {
    try {
        const u = new URL(url);
        return path.basename(u.pathname);
    } catch (_) {
        return path.basename(String(url));
    }
}

function setPendingDownloadDestination(url, destinationPath) {
    if (!pendingChromiumDownload) {
        pendingChromiumDownload = {
            url,
            destinationPath,
            resolve: null,
            reject: null,
            onProgress: null,
        };
        return;
    }

    pendingChromiumDownload.destinationPath = destinationPath;
    if (url) pendingChromiumDownload.url = url;
}

function downloadViaChromium(url, destinationPath, webContents, onProgress) {
    return new Promise((resolve, reject) => {
        if (!url) return reject(new Error('Unable to derive download url'));
        if (!webContents) return reject(new Error('webContents is required for chromium download'));
        if (pendingChromiumDownload || activeDownloadItem) {
            return reject(new Error('Another Chromium download is already in progress'));
        }

        pendingChromiumDownload = {
            url,
            destinationPath,
            resolve,
            reject,
            onProgress: typeof onProgress === 'function' ? onProgress : null,
        };

        try {
            webContents.downloadURL(url);
        } catch (e) {
            pendingChromiumDownload = null;
            reject(e);
        }
    });
}

// note that this is specific to electron renderer download behavior
function registerDownloadsHandlers() {
    session.defaultSession.setDownloadPath(app.getPath('downloads'));

    session.defaultSession.on('will-download', (event, item) => {
        const request = pendingChromiumDownload;
        const url = item.getURL();
        const fallbackFileName = getFileNameFromUrl(request?.url || url);

        activeDownloadItem = item;
        pendingChromiumDownload = null;

        const finalDestinationPath =
            request?.destinationPath || path.join(app.getPath('downloads'), fallbackFileName || item.getFilename());

        // Ensure overwrite behavior:
        // Electron/Chromium will auto-unique names (add " 1", " 2", ...) if the target exists.
        // Deleting first ensures the exact path is available and the download uses it.
        try {
            if (fs.existsSync(finalDestinationPath)) {
                fs.rmSync(finalDestinationPath, { force: true });
            }
        } catch (_) {
            // If we can't remove it (permissions/locked), Chromium will fall back to a unique name.
            // We'll let it proceed; caller will still get the actual saved path via 'done'.
        }

        item.setSavePath(finalDestinationPath);

        const emitProgress = () => {
            const cb = request?.onProgress;
            if (typeof cb !== 'function') return;

            const receivedBytes = item.getReceivedBytes();
            const totalBytes = item.getTotalBytes();
            const percent = totalBytes > 0 ? Math.min(100, Math.floor((receivedBytes / totalBytes) * 100)) : null;

            cb({
                url: request?.url || url,
                destinationPath: finalDestinationPath,
                downloadedBytes: receivedBytes,
                totalBytes: totalBytes > 0 ? totalBytes : null,
                percent,
                status: 'downloading',
            });
        };

        item.on('updated', (event, state) => {
            if (state === 'progressing') emitProgress();
        });

        emitProgress();

        item.once('done', (event, state) => {
            const receivedBytes = item.getReceivedBytes();
            const totalBytes = item.getTotalBytes();
            const percent = totalBytes > 0 ? Math.min(100, Math.floor((receivedBytes / totalBytes) * 100)) : null;
            const mimeType = typeof item.getMimeType === 'function' ? item.getMimeType() : null;
            const finalUrl = typeof item.getURL === 'function' ? item.getURL() : url;
            const finalFileName = typeof item.getFilename === 'function' ? item.getFilename() : path.basename(finalDestinationPath);

            const resolver = request?.resolve;
            const rejecter = request?.reject;
            const progressCb = request?.onProgress;

            activeDownloadItem = null;

            if (typeof progressCb === 'function') {
                progressCb({
                    url: request?.url || url,
                    destinationPath: finalDestinationPath,
                    downloadedBytes: receivedBytes,
                    totalBytes: totalBytes > 0 ? totalBytes : null,
                    percent,
                    status: state === 'completed' ? 'completed' : 'error',
                });
            }

            if (typeof resolver !== 'function' || typeof rejecter !== 'function') return;

            if (state === 'completed') {
                const looksLikeHtml =
                    (typeof mimeType === 'string' && mimeType.toLowerCase().includes('text/html')) ||
                    (typeof finalFileName === 'string' && finalFileName.toLowerCase().endsWith('.html'));

                if (looksLikeHtml) {
                    rejecter(
                        new Error(
                            `Chromium download completed but returned HTML instead of the expected model file. url=${finalUrl} file=${finalFileName} mimeType=${mimeType || 'unknown'}`,
                        ),
                    );
                    return;
                }

                resolver({
                    url: request?.url || url,
                    destinationPath: finalDestinationPath,
                });
            } else if (state === 'cancelled') {
                rejecter(Object.assign(new Error('Chromium download cancelled'), { code: 'DOWNLOAD_CANCELLED' }));
            } else {
                rejecter(
                    new Error(
                        `Chromium download ${state}. url=${finalUrl} file=${finalFileName} mimeType=${mimeType || 'unknown'} receivedBytes=${receivedBytes} totalBytes=${totalBytes}`,
                    ),
                );
            }
        });
    });
}

function getDefaultDownloadWebContents() {
    const win = BrowserWindow.getAllWindows()?.[0];
    if (!win || win.isDestroyed()) return null;
    return win.webContents;
}

module.exports = {
    setPendingDownloadDestination,
    downloadViaChromium,
    registerDownloadsHandlers,
    getDefaultDownloadWebContents,
    cancelChromiumDownload,
};
