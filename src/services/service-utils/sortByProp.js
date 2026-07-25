/**
 * Returns a new array sorted by the provided object property.
 * Undefined values are pushed to the end.
 *
 * @param {Array<Object>} arr - Source array.
 * @param {string} prop - Property name to sort by.
 * @returns {Array<Object>} Sorted copy of the input array.
 */
function sortByProp(arr, prop) {
    return [...arr].sort((a, b) => {
        if (a[prop] === undefined) return 1;
        if (b[prop] === undefined) return -1;
        if (a[prop] < b[prop]) return -1;
        if (a[prop] > b[prop]) return 1;
        return 0;
    });
}

module.exports = sortByProp;
