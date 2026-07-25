/**
 * sleeper function to gap executions
 * @param ms
 * @returns {Promise<unknown>}
 */
const timeout = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports = timeout;
