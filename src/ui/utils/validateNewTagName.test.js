
import validateNewTagName from './validateNewTagName';

// Mock constraints to avoid dependency on external config files
jest.mock('../configs/constraints', () => ({
    TAG_LABEL_MIN_LENGTH: 2,
    TAG_LABEL_MAX_LENGTH: 80
}));

describe('validateNewTagName', () => {
    test('should return error when tag name is a duplicate (case-insensitive)', () => {
        const tags = [{ label: 'MyTag' }];
        const result = validateNewTagName('mytag', tags);
        expect(result).toEqual({
            error: 'Tag name already exists.',
            isValid: false
        });
    });

    test('should return error when tag name is shorter than min length', () => {
        const result = validateNewTagName('a', []);
        expect(result).toEqual({
            error: 'Tag name should be between 2 and 80 characters long',
            isValid: false
        });
    });

    test('should return error when tag name is longer than max length', () => {
        const longName = 'a'.repeat(81);
        const result = validateNewTagName(longName, []);
        expect(result).toEqual({
            error: 'Tag name should be between 2 and 80 characters long',
            isValid: false
        });
    });

    test('should return error when tag name contains invalid characters', () => {
        const result = validateNewTagName('Invalid@Name', []);
        expect(result).toEqual({
            error: 'Tag name should only contain alphanumeric characters, space, hyphens and underscores.',
            isValid: false
        });
    });

    test('should return isValid true when tag name meets all requirements', () => {
        const result = validateNewTagName('Valid_Name-123', []);
        expect(result).toEqual({
            error: '',
            isValid: true
        });
    });

    test('should trim spaces before validation', () => {
        const result = validateNewTagName('   ValidTag   ', []);
        expect(result).toEqual({
            error: '',
            isValid: true
        });
    });

    test('should allow spaces inside the tag name', () => {
        const result = validateNewTagName('Valid Tag Name', []);
        expect(result.isValid).toBe(true);
        expect(result.error).toBe('');
    });
});
