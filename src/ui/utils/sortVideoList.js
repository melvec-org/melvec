/**
 * Generate documentation
 *
 */
const sortingDict = {
    relevance: (a, b) => a.relevance - b.relevance,
    views: (a, b) => b.views - a.views,
    fileSizeDesc: (a, b) => b.size - a.size,
    fileSizeAsc: (a, b) => a.size - b.size,
    A_Z: (a, b) => a.name.localeCompare(b.name),
    Z_A: (a, b) => b.name.localeCompare(a.name),
    durationDesc: (a, b) => b.duration - a.duration,
    durationAsc: (a, b) => a.duration - b.duration,
    dateAddedAsc: (a, b) => new Date(a.birthtimeMs) - new Date(b.birthtimeMs),
    dateAddedDesc: (a, b) => new Date(b.birthtimeMs) - new Date(a.birthtimeMs),
    rating: (a, b) => b.rating - a.rating,
    quality: (a, b) => b.quality - a.quality,
};
const sortVideoList = (list, sortBy) => {
    const sorter = sortingDict[sortBy];
    if (typeof sorter !== 'function') {
        return list; // keep original order if sort option is invalid/unknown
    }
    return list.sort(sorter);
};

export default sortVideoList;
