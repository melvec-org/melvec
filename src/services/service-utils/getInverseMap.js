/**
 * Converts an object of array values into a reverse lookup map.
 *
 * Example: { a: ['x'], b: ['x', 'y'] } => Map { 'x' => ['a', 'b'], 'y' => ['b'] }
 *
 * @param {Object<string, Array<*>>} [sourceObj=null] - Source object keyed by group.
 * @returns {Map<*, string[]>} Reverse lookup map.
 */
const getInverseMap = (sourceObj = null) => {
    const inverseMap = new Map();
    const entries = Object.entries(sourceObj);

    for (let item = 0; item < entries.length; item++) {
        const key = entries[item][0];
        const value = entries[item][1];

        for (let i = 0; i < value.length; i++) {
            const mapValues = value[i];
            const inverseMapItem = inverseMap.get(mapValues);
            if (inverseMapItem) {
                inverseMapItem.push(key);
            } else {
                inverseMap.set(mapValues, [key]);
            }
        }
    }

    return inverseMap;
};

module.exports = getInverseMap;
