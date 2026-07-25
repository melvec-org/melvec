const { systemPreferences, nativeTheme } = require('electron');
const userPreferenceStore = require('./userPreferenceStore');

const VALID_THEMES = new Set(['light', 'dark', 'system']);

function getColor(color) {
    return systemPreferences.getColor(color);
}

var styles = `:root {
    --backgroundColor: ${getColor('separator')};
    --disabled-control-text: ${getColor('disabled-control-text')};
    --focus-border-color: ${getColor('keyboard-focus-indicator')};
    --default-text-color: ${getColor('text')};
    --window-background: ${getColor('window-background')};
}`;
// Allow css injection only once. With each reload it would inject, so, to avoid that use a key

let cssKey = null;

const injectSystemTheme = (webContents) => {
    if (cssKey === null) {
        webContents
            .insertCSS(styles, {
                cssOrigin: 'author',
            })
            .then((result) => {
                cssKey = result;
            });
    }
};
const _applyTheme = (theme) => {
    if (!VALID_THEMES.has(theme)) {
        return null;
    }
    nativeTheme.themeSource = theme; // 'light' | 'dark' | 'system'
    return userPreferenceStore.getAll();
};

const applyAndPersistTheme = async (theme) => {
    if (!VALID_THEMES.has(theme)) {
        return {
            status: 'error',
            message: `Invalid theme value: ${theme}`,
        };
    }
    userPreferenceStore.set('theme', theme);
    _applyTheme(theme);
    return userPreferenceStore.getAll();
};

module.exports = {
    injectSystemTheme,
    applyAndPersistTheme,
};
