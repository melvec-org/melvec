import { DEFAULT_COLLECTION_YEAR } from '__configs/systemConfig';

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

        if (excludeCollectionIds.includes(item.id)) {
            return false;
        }

        if (!isDefaultCollection) {
            if (item.year === DEFAULT_COLLECTION_YEAR) {
                return true;
            }
            if (item.year !== year) {
                return false;
            }
        } else {
            if (item.year !== year) {
                return false;
            }
        }
        return true;
    });
    return filteredCollections;
};

export default getEligibleCollections;
