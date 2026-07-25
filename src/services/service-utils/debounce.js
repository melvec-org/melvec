/**
 * Creates a debounced wrapper that delays invocation until calls stop for the given delay.
 *
 * @param {Function} func - Function to debounce.
 * @param {number} delay - Delay in milliseconds before invocation.
 * @returns {Function} Debounced function.
 */
const debounce = (func, delay) => {
  let debounceTimer;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
};
module.exports = debounce;