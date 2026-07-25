// deep clone of an object

const cloneDeep = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    const clone = Array.isArray(obj) ? [] : {};

    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            clone[key] = cloneDeep(obj[key]);
        }
    }

    return clone;
};

export default cloneDeep;
