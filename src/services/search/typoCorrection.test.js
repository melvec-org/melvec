const {
    normalizeTerm,
    tokenizeText,
    getTrigrams,
    buildTrigramIndex,
    initializeTypoCorrection,
    invalidateTypoCorrectionIndex,
    isTypoCorrectionInitialized,
    getCandidateTermIds,
    getCorrectionForToken,
} = require('./typoCorrection');

describe('typoCorrection', () => {
    afterEach(() => {
        invalidateTypoCorrectionIndex();
    });

    describe('normalizeTerm', () => {
        test('should lowercase, trim, and normalize punctuation to spaces', () => {
            expect(normalizeTerm('  The_QUICK, Brown!  ')).toBe('the quick brown');
        });

        test('should collapse repeated spaces', () => {
            expect(normalizeTerm('one     two   three')).toBe('one two three');
        });

        test('should return empty string for empty input', () => {
            expect(normalizeTerm('')).toBe('');
            expect(normalizeTerm(null)).toBe('');
            expect(normalizeTerm(undefined)).toBe('');
        });
    });

    // tokenize text testsa
    describe('tokenizeText', () => {
        test('should tokenize normalized text and remove stop words', () => {
            expect(tokenizeText('The quick brown fox jumps in the room')).toEqual(['quick', 'brown', 'jumps', 'room']);
        });

        test('should remove duplicate tokens while preserving first occurrence order', () => {
            const expected = ['birds', 'fish'];
            expect(tokenizeText('cat dog cat birds dog fish')).toEqual(expected);
        });

        test('should remove numeric-only tokens', () => {
            expect(tokenizeText('constantine 2024 movie 123')).toEqual(['constantine', 'movie']);
        });

        test('should respect minVocabularyTokenLength', () => {
            expect(
                tokenizeText('an ox cat lion', {
                    minVocabularyTokenLength: 4,
                    maxTokenLength: 40,
                }),
            ).toEqual(['lion']);
        });

        test('should respect maxTokenLength', () => {
            expect(
                tokenizeText('short extraordinarilylongtoken okay', {
                    minVocabularyTokenLength: 3,
                    maxTokenLength: 10,
                }),
            ).toEqual(['short', 'okay']);
        });
    });

    describe('getTrigrams', () => {
        test('should generate unique padded trigrams for a term', () => {
            expect(getTrigrams('cat')).toEqual(['  c', ' ca', 'cat', 'at ', 't  ']);
        });

        test('should normalize the term before generating trigrams', () => {
            expect(getTrigrams('  Cat!  ')).toEqual(['  c', ' ca', 'cat', 'at ', 't  ']);
        });

        test('should return empty array for empty input', () => {
            expect(getTrigrams('')).toEqual([]);
        });
    });

    describe('buildTrigramIndex', () => {
        test('should build trigram to termId postings', () => {
            const trigramIndex = buildTrigramIndex(['cat', 'car']);

            expect(trigramIndex.get('cat')).toEqual([0]);
            expect(trigramIndex.get('car')).toEqual([1]);
            expect(trigramIndex.get(' ca')).toEqual([0, 1]);
        });

        test('should not duplicate termId within the same trigram postings for repeated trigram in one term', () => {
            const trigramIndex = buildTrigramIndex(['banana']);

            expect(trigramIndex.get('ana')).toEqual([0]);
        });
    });

    describe('initializeTypoCorrection', () => {
        test('should initialize state from raw terms', () => {
            const result = initializeTypoCorrection(['Constantine', 'Mathematics for kids', 'The Room']);

            expect(result.totalTerms).toBe(3);
            expect(result.totalTrigrams).toBeGreaterThan(0);
            expect(isTypoCorrectionInitialized()).toBe(true);
        });

        test('should deduplicate normalized tokens across raw terms', () => {
            const result = initializeTypoCorrection(['Constantine', 'constantine', 'CONSTANTINE!']);

            expect(result.totalTerms).toBe(1);
            expect(isTypoCorrectionInitialized()).toBe(true);
        });

        test('should ignore non-string raw terms', () => {
            const result = initializeTypoCorrection(['Constantine', null, undefined, 123, { title: 'Mathematics' }]);

            expect(result.totalTerms).toBe(1);
        });

        test('should apply custom options during initialization', () => {
            const result = initializeTypoCorrection(['cat', 'lion', 'tiger'], { minVocabularyTokenLength: 4 });
            expect(result.totalTerms).toBe(2);
        });
    });

    describe('lifecycle', () => {
        test('should reset initialized state on invalidate', () => {
            initializeTypoCorrection(['constantine']);

            expect(isTypoCorrectionInitialized()).toBe(true);

            invalidateTypoCorrectionIndex();

            expect(isTypoCorrectionInitialized()).toBe(false);
        });
    });

    describe('candidate retrieval', () => {
        test('should return empty array when typo correction is not initialized', () => {
            expect(getCandidateTermIds('constantine')).toEqual([]);
        });

        test('should return candidate term ids ordered by trigram overlap', () => {
            initializeTypoCorrection(['constantine', 'mathematics', 'constellation']);

            const candidateTermIds = getCandidateTermIds('contsenine');

            expect(candidateTermIds.length).toBeGreaterThan(0);
            expect(candidateTermIds[0]).toBe(0);
        });

        test('should return empty array for empty token', () => {
            initializeTypoCorrection(['constantine']);

            expect(getCandidateTermIds('')).toEqual([]);
        });

        test('should normalize token before candidate lookup', () => {
            initializeTypoCorrection(['constantine']);

            const candidateTermIds = getCandidateTermIds('  CONSTANTINE!  ');

            expect(candidateTermIds).toEqual([0]);
        });
    });

    describe('getCorrectionForToken', () => {
        test('should return null when typo correction is not initialized', () => {
            expect(getCorrectionForToken('contsenine')).toBeNull();
        });

        test('should return null for empty token', () => {
            initializeTypoCorrection(['constantine']);

            expect(getCorrectionForToken('')).toBeNull();
        });

        test('should return null for token shorter than minTokenLength', () => {
            initializeTypoCorrection(['lion']);

            expect(getCorrectionForToken('lio')).toBeNull();
        });

        test('should return the same token when it already exists in the vocabulary', () => {
            initializeTypoCorrection(['constantine']);

            expect(getCorrectionForToken('constantine')).toBe('constantine');
        });

        test('should return the best correction for a misspelled token', () => {
            initializeTypoCorrection(['constantine', 'constellation', 'mathematics']);

            expect(getCorrectionForToken('contsenine')).toBe('constantine');
        });

        test('should return null when no candidate is similar enough', () => {
            initializeTypoCorrection(['constantine', 'mathematics', 'elephant']);

            expect(getCorrectionForToken('xyzqplm')).toBeNull();
        });

        test('should normalize token before correction lookup', () => {
            initializeTypoCorrection(['constantine']);

            expect(getCorrectionForToken('  CONSTANTINE! ')).toBe('constantine');
        });
    });
});
