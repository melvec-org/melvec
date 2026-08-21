const sortByOccurenceAndIndex = (arr = []) => {
    if (arr.length === 0) return [];

    const indexingData = arr.map((item, index) => ({ time: index + 1, keyword: item }));

    // create a new array out of indexing data where keywords are unique and store number of occurance, and max of their time attribute
    let uniqueSearchHistory = [...new Map(indexingData.map((item) => [item.keyword, item])).values()];

    uniqueSearchHistory = uniqueSearchHistory.map((item) => ({
        keyword: item.keyword,
        count: indexingData.filter((i) => i.keyword === item.keyword).length,
        maxTime: Math.max(...indexingData.filter((i) => i.keyword === item.keyword).map((i) => i.time)),
    }));

    uniqueSearchHistory = uniqueSearchHistory.sort((a, b) => b.count - a.count || b.maxTime - a.maxTime);

    // make it a flat array with only keywords
    uniqueSearchHistory = uniqueSearchHistory.map((item) => item.keyword);

    return uniqueSearchHistory;
};

module.exports = sortByOccurenceAndIndex;
