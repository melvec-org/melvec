import { DEFAULT_COLLECTION_YEAR } from '__configs/systemConfig';
import getEligibleCollections from './getEligibleCollections';

const createCollections = () => [
    { id: '00000000', label: 'Default collection', year: DEFAULT_COLLECTION_YEAR, isHidden: 0, isExternal: false },
    { id: 'col-2024-1', label: '2024-alpha', year: 2024, isHidden: 0, isExternal: false },
    { id: 'col-2024-2', label: '2024-beta', year: 2024, isHidden: 0, isExternal: false },
    { id: 'col-2025-1', label: '2025-alpha', year: 2025, isHidden: 0, isExternal: false },
    { id: 'col-2026-1', label: '2026-alpha', year: 2026, isHidden: 0, isExternal: false },
    { id: 'col-2026-2', label: '2026-beta', year: 2026, isHidden: 0, isExternal: false },
    { id: 'col-2026-3', label: '2026-hidden', year: 2026, isHidden: 1, isExternal: false },
];

const ts2026 = 1769741929119;
const ts2024 = new Date('2024-06-01').getTime();

describe('getEligibleCollections', () => {
    describe('year filtering when isDefaultCollection = false', () => {
        test('returns collections for the timestamp year plus the default collection year', () => {
            const result = getEligibleCollections(ts2026, false, createCollections());
            const ids = result.map((c) => c.id);

            expect(ids).toContain('00000000');
            expect(ids).toContain('col-2026-1');
            expect(ids).toContain('col-2026-2');
            expect(ids).not.toContain('col-2024-1');
            expect(ids).not.toContain('col-2025-1');
        });

        test('returns 2024 collections plus the default collection for a 2024 timestamp', () => {
            const result = getEligibleCollections(ts2024, false, createCollections());
            const ids = result.map((c) => c.id);

            expect(ids).toContain('00000000');
            expect(ids).toContain('col-2024-1');
            expect(ids).toContain('col-2024-2');
            expect(ids).not.toContain('col-2026-1');
        });
    });

    describe('year filtering when isDefaultCollection = true', () => {
        test('returns only collections matching the timestamp year', () => {
            const result = getEligibleCollections(ts2026, true, createCollections());
            const ids = result.map((c) => c.id);

            expect(ids).toEqual(expect.arrayContaining(['col-2026-1', 'col-2026-2', 'col-2026-3']));
            expect(ids).not.toContain('00000000');
            expect(ids).not.toContain('col-2024-1');
        });
    });

    describe('hideHiddenCollection flag', () => {
        test('excludes hidden collections when flag is true', () => {
            const result = getEligibleCollections(ts2026, false, createCollections(), true);
            const ids = result.map((c) => c.id);

            expect(ids).toContain('00000000');
            expect(ids).toContain('col-2026-1');
            expect(ids).not.toContain('col-2026-3');
        });

        test('includes hidden collections when flag is false', () => {
            const result = getEligibleCollections(ts2026, false, createCollections(), false);
            const ids = result.map((c) => c.id);

            expect(ids).toContain('col-2026-3');
        });
    });

    describe('excludeCollectionIds', () => {
        test('excludes specified ids from results', () => {
            const result = getEligibleCollections(ts2026, false, createCollections(), false, ['col-2026-1']);
            const ids = result.map((c) => c.id);

            expect(ids).toContain('00000000');
            expect(ids).not.toContain('col-2026-1');
            expect(ids).toContain('col-2026-2');
        });

        test('can exclude the default collection year item', () => {
            const result = getEligibleCollections(ts2026, false, createCollections(), false, ['00000000']);
            const ids = result.map((c) => c.id);

            expect(ids).not.toContain('00000000');
            expect(ids).toContain('col-2026-1');
        });

        test('returns empty array when all eligible collections are excluded', () => {
            const result = getEligibleCollections(ts2026, false, createCollections(), false, [
                '00000000',
                'col-2026-1',
                'col-2026-2',
                'col-2026-3',
            ]);

            expect(result).toEqual([]);
        });
    });

    describe('edge cases', () => {
        test('returns empty array when allCollections is empty', () => {
            const result = getEligibleCollections(ts2026, false, []);
            expect(result).toEqual([]);
        });

        test('does not mutate the original allCollections array', () => {
            const allCollections = createCollections();
            const copy = [...allCollections];

            getEligibleCollections(ts2026, false, allCollections, false, ['col-2026-1']);

            expect(allCollections).toEqual(copy);
        });

        test('calling twice with the same args returns the same result', () => {
            const allCollections = createCollections();
            const first = getEligibleCollections(ts2026, false, allCollections);
            const second = getEligibleCollections(ts2026, false, allCollections);

            expect(first).toEqual(second);
        });
    });
});
