let tagsDict = {};

const prepareTagsDict = (tags) => {
    for (var i = 0; i < tags.length; i++) {
        let tagLabel = tags[i].label;
        let firstLetter = tagLabel.charAt[0];
        if (tagsDict[firstLetter] === undefined) {
            tagsDict[firstLetter] = [];
        } else {
            tagsDict[firstLetter].push(tags[i]);
        }
    }
};

const getTagsByFirstLetter = (firstLetter) => {
    return tagsDict[firstLetter] || [];
};

export default {
    prepareTagsDict,
    getTagsByFirstLetter,
};
