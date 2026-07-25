const getRelativeComplement = (sourceList = [], tobeExcludedList = []) => {
    return sourceList.filter((item) => tobeExcludedList.every((item2) => !item2.id.includes(item.id)));
};

export default getRelativeComplement;
