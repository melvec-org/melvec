var { createCollectionName } = require('./createCollectionName');

const tests = [
    { path: 'video.mp4', expected: 'Untitled' },
    { path: 'DCIM/100APPLE/video.mp4', expected: 'Untitled' },
    { path: 'videos/test.mp4', expected: 'videos' }, // include videos as this is immidiate parent
    { path: 'WhatsApp Video/Exports/beach trip 2025.mp4', expected: 'WhatsApp Video-Exports' }, // export is not included
    { path: 'Exports/whatsapp/beach trip 2025.mp4', expected: 'Exports-whatsapp' }, // exports and whatsapp both to be incldued
    { path: 'math/Exports/whatsapp/beach trip 2025.mp4', expected: 'math-Exports-whatsapp' }, // exports and whatsapp both to be incldued
    { path: 'Exports/whatsapp/math/beach trip 2025.mp4', expected: 'math' }, // exports and whatsapp both to be incldued

    { path: 'Rental/Exports/beach trip 2025.mp4', expected: 'Rental-Exports' },
    { path: 'Exports/rental/beach trip 2025.mp4', expected: 'rental' }, // export is disregarded, because rental is already there.
    { path: 'Downloads/Temp/Hawaii Vacation 2025/vid.mp4', expected: 'Hawaii Vacation 2025' },
    { path: 'Camera/Backups/Untitled Folder/party.mp4', expected: 'Camera-Backups-Untitled Folder' },
    { path: 'Camera/Backups/rest/party.mp4', expected: 'rest' },
    { path: 'Family/Vacation/Jan/beach.mp4', expected: 'Family-Vacation-Jan' },
    { path: 'Work/Projects/2025/Jan/demo.mp4', expected: 'Work-Projects-2025-Jan' },
    { path: 'lux/Projects/2025/Jan/demo.mp4', expected: 'lux-Projects-2025-Jan' },
    { path: '2024/2024-demo.mp4', expected: '2024' },
];

// write test case for each test
tests.forEach(({ path, expected }) => {
    test(`creates a clean collection name from "${path}"`, () => {
        expect(createCollectionName(path)).toBe(expected);
    });
    test(`very long folder names to be trimmed`, () => {
        const longPath =
            'long/folder/name/that/is/very/long/and/does/not/make/sense/for/a/folder/name/anyways/and/i/am/testing/this/function/with/a/very/long/name/for/testing/purposes/this/should/not/cause/any/issues/with/the/function/as/long/as/it/is/not/more.mp4';
        expect(createCollectionName(longPath).length).toBeLessThanOrEqual(100);
    });
});
