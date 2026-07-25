
import sortVideoList from './sortVideoList';

describe('sortVideoList / sortingDict', () => {
    let sampleVideos;

    beforeEach(() => {
        sampleVideos = [
            {
                name: 'Bravo',
                relevance: 2,
                views: 100,
                size: 200,
                duration: 50,
                birthtimeMs: new Date('2023-01-03').getTime(),
                rating: 3.5,
                quality: 720
            },
            {
                name: 'Alpha',
                relevance: 1,
                views: 300,
                size: 150,
                duration: 100,
                birthtimeMs: new Date('2023-01-01').getTime(),
                rating: 4.5,
                quality: 1080
            },
            {
                name: 'Charlie',
                relevance: 3,
                views: 200,
                size: 300,
                duration: 10,
                birthtimeMs: new Date('2023-01-02').getTime(),
                rating: 2.0,
                quality: 480
            }
        ];
    });

    test('sort by relevance (ascending)', () => {
        const sorted = sortVideoList([...sampleVideos], 'relevance');
        expect(sorted.map(v => v.relevance)).toEqual([1, 2, 3]);
    });

    test('sort by views (descending)', () => {
        const sorted = sortVideoList([...sampleVideos], 'views');
        expect(sorted.map(v => v.views)).toEqual([300, 200, 100]);
    });

    test('sort by fileSizeDesc (descending size)', () => {
        const sorted = sortVideoList([...sampleVideos], 'fileSizeDesc');
        expect(sorted.map(v => v.size)).toEqual([300, 200, 150]);
    });

    test('sort by fileSizeAsc (ascending size)', () => {
        const sorted = sortVideoList([...sampleVideos], 'fileSizeAsc');
        expect(sorted.map(v => v.size)).toEqual([150, 200, 300]);
    });

    test('sort by A_Z (alphabetical ascending)', () => {
        const sorted = sortVideoList([...sampleVideos], 'A_Z');
        expect(sorted.map(v => v.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    test('sort by Z_A (alphabetical descending)', () => {
        const sorted = sortVideoList([...sampleVideos], 'Z_A');
        expect(sorted.map(v => v.name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    });

    test('sort by durationDesc (descending)', () => {
        const sorted = sortVideoList([...sampleVideos], 'durationDesc');
        expect(sorted.map(v => v.duration)).toEqual([100, 50, 10]);
    });

    test('sort by durationAsc (ascending)', () => {
        const sorted = sortVideoList([...sampleVideos], 'durationAsc');
        expect(sorted.map(v => v.duration)).toEqual([10, 50, 100]);
    });

    test('sort by dateAddedAsc (oldest first)', () => {
        const sorted = sortVideoList([...sampleVideos], 'dateAddedAsc');
        expect(sorted.map(v => v.birthtimeMs)).toEqual([
            new Date('2023-01-01').getTime(),
            new Date('2023-01-02').getTime(),
            new Date('2023-01-03').getTime()
        ]);
    });

    test('sort by dateAddedDesc (newest first)', () => {
        const sorted = sortVideoList([...sampleVideos], 'dateAddedDesc');
        expect(sorted.map(v => v.birthtimeMs)).toEqual([
            new Date('2023-01-03').getTime(),
            new Date('2023-01-02').getTime(),
            new Date('2023-01-01').getTime()
        ]);
    });

    test('sort by rating (descending)', () => {
        const sorted = sortVideoList([...sampleVideos], 'rating');
        expect(sorted.map(v => v.rating)).toEqual([4.5, 3.5, 2.0]);
    });

    test('sort by quality (descending)', () => {
        const sorted = sortVideoList([...sampleVideos], 'quality');
        expect(sorted.map(v => v.quality)).toEqual([1080, 720, 480]);
    });
});
