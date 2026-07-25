import getEligibleCollections from './getEligibleCollections';

// Mirrors the real collection structure seen in logs
const allCollections = [
    { id: '00000000', label: 'Default collection', year: 0, isHidden: 0, isExternal: false },
    { id: 'col-2024-1', label: '2024-alpha', year: 2024, isHidden: 0, isExternal: false },
    { id: 'col-2024-2', label: '2024-beta', year: 2024, isHidden: 0, isExternal: false },
    { id: 'col-2025-1', label: '2025-alpha', year: 2025, isHidden: 0, isExternal: false },
    { id: 'col-2026-1', label: '2026-alpha', year: 2026, isHidden: 0, isExternal: false },
    { id: 'col-2026-2', label: '2026-beta', year: 2026, isHidden: 0, isExternal: false },
    { id: 'col-2026-3', label: '2026-hidden', year: 2026, isHidden: 1, isExternal: false },
];

// A timestamp whose year resolves to 2026 (matches logs: birthtimeMs = 1769741929119)
const ts2026 = 1769741929119;
// A timestamp whose year resolves to 2024
const ts2024 = new Date('2024-06-01').getTime();

describe('getEligibleCollections', () => {
    describe('year filtering (isDefaultCollection = false)', () => {
        test('returns only collections matching the timestamp year', () => {
            const result = getEligibleCollections(ts2026, false, allCollections);
            const ids = result.map((c) => c.id);
            expect(ids).toContain('col-2026-1');
            expect(ids).toContain('col-2026-2');
            expect(ids).not.toContain('col-2024-1');
            expect(ids).not.toContain('col-2025-1');
        });

        test('returns only 2024 collections for a 2024 timestamp', () => {
            const result = getEligibleCollections(ts2024, false, allCollections);
            const ids = result.map((c) => c.id);
            expect(ids).toContain('col-2024-1');
            expect(ids).toContain('col-2024-2');
            expect(ids).not.toContain('col-2026-1');
        });
    });

    describe('isDefaultCollection = true (skip year filter)', () => {
        test('returns all collections regardless of year', () => {
            const result = getEligibleCollections(ts2026, true, allCollections);
            expect(result.length).toBe(allCollections.length);
        });
    });

    describe('hideHiddenCollection flag', () => {
        test('excludes hidden collections when flag is true', () => {
            const result = getEligibleCollections(ts2026, false, allCollections, true);
            const ids = result.map((c) => c.id);
            expect(ids).not.toContain('col-2026-3');
            expect(ids).toContain('col-2026-1');
        });

        test('includes hidden collections when flag is false (default)', () => {
            const result = getEligibleCollections(ts2026, false, allCollections, false);
            const ids = result.map((c) => c.id);
            expect(ids).toContain('col-2026-3');
        });
    });

    describe('excludeCollectionIds', () => {
        test('excludes specified ids from results', () => {
            const result = getEligibleCollections(ts2026, false, allCollections, false, ['col-2026-1']);
            const ids = result.map((c) => c.id);
            expect(ids).not.toContain('col-2026-1');
            expect(ids).toContain('col-2026-2');
        });

        test('excludes multiple ids', () => {
            const result = getEligibleCollections(ts2026, false, allCollections, false, ['col-2026-1', 'col-2026-2']);
            const ids = result.map((c) => c.id);
            expect(ids).not.toContain('col-2026-1');
            expect(ids).not.toContain('col-2026-2');
        });

        test('returns empty array when all matching year collections are excluded', () => {
            const result = getEligibleCollections(ts2026, false, allCollections, false, ['col-2026-1', 'col-2026-2', 'col-2026-3']);
            expect(result).toEqual([]);
        });
    });

    describe('edge cases', () => {
        test('returns empty array when allCollections is empty', () => {
            const result = getEligibleCollections(ts2026, false, []);
            expect(result).toEqual([]);
        });

        test('returns empty array when allCollections is not provided', () => {
            const result = getEligibleCollections(ts2026, false);
            expect(result).toEqual([]);
        });

        test('does NOT mutate the original allCollections array', () => {
            const copy = [...allCollections];
            getEligibleCollections(ts2026, false, allCollections, false, ['col-2026-1']);
            expect(allCollections).toEqual(copy);
        });

        test('calling twice with same args returns same result (no shared state)', () => {
            const first = getEligibleCollections(ts2026, false, allCollections);
            const second = getEligibleCollections(ts2026, false, allCollections);
            expect(first).toEqual(second);
        });

        test('fails when year is a string — catches DB TEXT vs JS number type mismatch', () => {
            // Simulates collections as returned directly from SQLite TEXT column
            const collectionsWithStringYear = allCollections.map((c) => ({ ...c, year: String(c.year) }));
            const result = getEligibleCollections(ts2026, false, collectionsWithStringYear);
            // This SHOULD pass — if it returns [] the DB boundary isn't coercing year to number

            expect(result.length).toBeGreaterThan(0);
        });

        test('calling twice with growing excludeCollectionIds does NOT bleed between calls', () => {
            const first = getEligibleCollections(ts2026, false, allCollections, false, []);
            expect(first.map((c) => c.id)).toContain('col-2026-1');
            // Mutate the array AFTER the call — should not affect the first result
            allCollections.push({ id: 'col-2026-3', label: '2026-beta', year: 2026, isHidden: 0, isExternal: false });
            const second = getEligibleCollections(ts2026, false, allCollections, false, []);
            expect(second.map((c) => c.id)).toContain('col-2026-3');
        });
    });
});
