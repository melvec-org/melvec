const { TAG_LABEL_MAX_LENGTH, TAG_LABEL_MIN_LENGTH } = require('../configs/constraints');
const validateNewTagName = (tagName = '', tags = []) => {
    const tagNameInLowerCase = tagName.trim().toLowerCase();

    const isDuplicate = tags.some((item) => item.label.toLowerCase() === tagNameInLowerCase);
    if (isDuplicate) {
        return {
            error: 'Tag name already exists.',
            isValid: false,
        };
    }
    if (tagNameInLowerCase.length < TAG_LABEL_MIN_LENGTH || tagNameInLowerCase.length > TAG_LABEL_MAX_LENGTH) {
        return {
            error: 'Tag name should be between 2 and 80 characters long',
            isValid: false,
        };
    }
    if (!/^[\sa-zA-Z0-9_.-]{2,80}$/.test(tagNameInLowerCase)) {
        return {
            error: 'Tag name should only contain alphanumeric characters, space, hyphens and underscores.',
            isValid: false,
        };
    }
    return {
        error: '',
        isValid: true,
    };
};

export default validateNewTagName;
