const { createDescFromFileName, sanitizeFileName } = require('./stringUtils');

describe('stringUtils', () => {
    describe('createDescFromFileName', () => {
        test('returns empty string for short names or vid-prefixed names', () => {
            expect(createDescFromFileName('short_name.mp4')).toBe('');
            expect(createDescFromFileName('vid_long_enough_file_name_example.mp4')).toBe('');
        });

        test('converts underscores and mp4 extension into spaces for long names', () => {
            expect(createDescFromFileName('holiday_trip_to_paris_2025_memory.mp4')).toBe('holiday trip to paris 2025 memory ');
        });
    });

    describe('sanitizeFileName', () => {
        test('removes supported editor html fragments', () => {
            expect(sanitizeFileName('<div>hello<br>world&nbsp;</div>')).toBe('helloworld');
        });

        test('leaves plain text unchanged', () => {
            expect(sanitizeFileName('plain file name')).toBe('plain file name');
        });
    });
});
