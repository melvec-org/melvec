import {
    BLACKLISTED_COLLECTION_LABELS,
    COLLECTION_LABEL_MAX_LENGTH,
    COLLECTION_LABEL_MIN_LENGTH,
    COLLECTION_LABEL_REGX,
} from '../configs/constraints';

const validateNewCollectionName = (collectionName = '', collections = [], options = {}) => {
    const { selectedYear = null, excludeCollectionId = null } = options;

    const trimmedCollectionName = collectionName.trim();
    const normalizedCollectionName = trimmedCollectionName.toLowerCase();

    if (trimmedCollectionName === '') {
        return {
            isValid: false,
            error: 'Collection name is required.',
        };
    }

    if (trimmedCollectionName.length < COLLECTION_LABEL_MIN_LENGTH || trimmedCollectionName.length > COLLECTION_LABEL_MAX_LENGTH) {
        return {
            isValid: false,
            error: `Collection name should be between ${COLLECTION_LABEL_MIN_LENGTH} and ${COLLECTION_LABEL_MAX_LENGTH} characters long`,
        };
    }

    if (trimmedCollectionName.startsWith('-') || trimmedCollectionName.endsWith('-')) {
        return {
            isValid: false,
            error: 'Collection name cannot start or end with a hyphen.',
        };
    }

    if (!COLLECTION_LABEL_REGX.test(trimmedCollectionName)) {
        return {
            isValid: false,
            error: 'Collection name should only contain alphanumeric characters, space, hyphens, underscores and dots',
        };
    }

    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]|\.|\.\.)$/i;

    if (reservedNames.test(trimmedCollectionName)) {
        return {
            isValid: false,
            error: `Invalid folder name: ${trimmedCollectionName} is a reserved name.`,
        };
    }

    if (trimmedCollectionName.startsWith('.')) {
        return {
            isValid: false,
            error: 'Folder names starting with a dot are reserved for system use.',
        };
    }

    if (BLACKLISTED_COLLECTION_LABELS.has(normalizedCollectionName)) {
        return {
            isValid: false,
            error: 'This collection name is reserved. Please choose a different name.',
        };
    }

    const filteredCollections = collections.filter((item) => item.id !== excludeCollectionId);

    if (selectedYear !== null) {
        const formedPath = `${selectedYear}/${trimmedCollectionName}`;

        const duplicatePathExists = filteredCollections.some((item) => item.path === formedPath);

        if (duplicatePathExists) {
            return {
                isValid: false,
                error: 'Duplicate path exist',
            };
        }
    } else {
        const duplicateLabelExists = filteredCollections.some((item) => item.label?.trim().toLowerCase() === normalizedCollectionName);

        if (duplicateLabelExists) {
            return {
                isValid: false,
                error: 'Collection with same name already exists',
            };
        }
    }

    return {
        isValid: true,
        error: '',
    };
};

export default validateNewCollectionName;
