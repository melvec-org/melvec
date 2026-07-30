const userPreferenceStore = require('../../main/userPreferenceStore');

/**
 * Determines if AI features are currently active for the user.
 *
 * This function checks two conditions:
 * 1. If the AI feature is explicitly enabled in user preferences.
 * 2. If the necessary AI model is downloaded and available.
 *
 * Both conditions must be met for AI to be considered active.
 *
 * @returns {boolean} True if AI is enabled and the model is downloaded; otherwise, false.
 */
const isAIActive = () => {
    const isAIEnabled = userPreferenceStore.get('isAIEnabled');
    const isModelAvailable = userPreferenceStore.get('ai').isDownloaded;
    return Boolean(isAIEnabled) && Boolean(isModelAvailable);
};

module.exports = {
    isAIActive,
};
