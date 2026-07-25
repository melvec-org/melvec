/**
 * Useful for continuous user interactions like mousemove or resize.
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time window in ms
 * @returns {Function} - Throttled function
 */
const throttle = (func, limit = 50) => {
    let inThrottle = false;
    let lastArgs = null;

    return function throttled(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastArgs) {
                    func.apply(this, lastArgs);
                    lastArgs = null;
                }
            }, limit);
        } else {
            lastArgs = args;
        }
    };
};

export default throttle;
