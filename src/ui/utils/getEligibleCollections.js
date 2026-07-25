const getEligibleCollections = (
    timeStamp,
    isDefaultCollection,
    allCollections,
    hideHiddenCollection = false,
    excludeCollectionIds = [],
) => {
    const year = new Date(timeStamp).getFullYear();

    var filteredCollections = allCollections.filter((item) => {
        if (hideHiddenCollection && item.isHidden !== 0) {
            return false;
        }

        if (!isDefaultCollection && item.year !== year) {
            return false;
        }

        if (excludeCollectionIds.includes(item.id)) {
            return false;
        }
        return true;
    });
    return filteredCollections;
};

export default getEligibleCollections;
