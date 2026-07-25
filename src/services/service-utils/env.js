const { app } = require('electron');

/**
 * Indicates whether the Electron app is running as a packaged production build.
 *
 * @returns {boolean} True when packaged.
 */
const isProd = () => app.isPackaged;

/**
 * Indicates whether the Electron app is running in development mode.
 *
 * @returns {boolean} True when not packaged.
 */
const isDev = () => !app.isPackaged;

/**
 * Allows HTTPS downloads with disabled certificate verification during development.
 *
 * @returns {boolean} True when insecure HTTPS downloads are permitted.
 */
const allowInsecureHttpsDownloads = () => {
    // Default ON in dev to avoid corporate/proxy cert issues.
    // You can disable explicitly with: Melvec_INSECURE_HTTPS_DOWNLOADS=0
    if (!isDev()) return false;
    if (process.env.MELVEC_INSECURE_HTTPS_DOWNLOADS === '0') return false;
    return true;
};

module.exports = {
    isDev,
    isProd,
    allowInsecureHttpsDownloads,
};
