const { startOfYear, endOfYear, startOfDay, endOfDay, startOfMonth, endOfMonth } = require('./relativeTimeHelper');

function analyseYearRange(query) {
    let match = query.match(/\bbetween\s+(\d{4})\s+and\s+(\d{4})\b/);
    let usedWords = ['between'];

    if (!match) {
        match = query.match(/\bfrom\s+(\d{4})\s+to\s+(\d{4})\b/);
        usedWords = ['from'];
    }

    if (!match) return null;

    return {
        time: {
            from: startOfYear(Number(match[1])),
            to: endOfYear(Number(match[2])),
        },
        usedWords: [...usedWords, match[1], usedWords[0] === 'between' ? 'and' : 'to', match[2]],
    };
}

function analyseYearOperator(query) {
    let match;

    // in 2025
    match = query.match(/\bin\s+(\d{4})\b/);

    if (match) {
        const year = Number(match[1]);

        return {
            time: {
                from: startOfYear(year),
                to: endOfYear(year),
            },
            usedWords: ['in', String(year)],
        };
    }

    // since 2020
    match = query.match(/\bsince\s+(\d{4})\b/);

    if (match) {
        const year = Number(match[1]);

        return {
            time: {
                from: startOfYear(year),
                to: null,
            },
            usedWords: ['since', String(year)],
        };
    }

    // before 2023
    match = query.match(/\bbefore\s+(\d{4})\b/);

    if (match) {
        const year = Number(match[1]);

        return {
            time: {
                from: null,
                to: endOfYear(year - 1),
            },
            usedWords: ['before', String(year)],
        };
    }

    // after 2020
    match = query.match(/\bafter\s+(\d{4})\b/);

    if (match) {
        const year = Number(match[1]);

        return {
            time: {
                from: startOfYear(year + 1),
                to: null,
            },
            usedWords: ['after', String(year)],
        };
    }

    return null;
}

function analyseStandaloneYear(query) {
    const match = query.match(/\b(\d{4})\b/);

    if (!match) return null;

    const year = Number(match[1]);

    if (year < 1900 || year > 2100) return null;

    return {
        time: {
            from: startOfYear(year),
            to: endOfYear(year),
        },
        usedWords: [String(year)],
    };
}

function analyseRelativePeriod(query) {
    const now = new Date();

    if (query.includes('today')) {
        return {
            time: {
                from: startOfDay(now),
                to: endOfDay(now),
            },
            usedWords: ['today'],
        };
    }

    if (query.includes('yesterday')) {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);

        return {
            time: {
                from: startOfDay(d),
                to: endOfDay(d),
            },
            usedWords: ['yesterday'],
        };
    }

    if (query.includes('last week')) {
        const from = new Date(now);
        from.setDate(now.getDate() - 7);

        return {
            time: {
                from: from.getTime(),
                to: now.getTime(),
            },
            usedWords: ['last', 'week'],
        };
    }

    if (query.includes('last month')) {
        const d = new Date(now);

        return {
            time: {
                from: startOfMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
                to: endOfMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
            },
            usedWords: ['last', 'month'],
        };
    }

    if (query.includes('last year')) {
        const year = now.getFullYear() - 1;

        return {
            time: {
                from: startOfYear(year),
                to: endOfYear(year),
            },
            usedWords: ['last', 'year'],
        };
    }

    if (query.includes('this year')) {
        const year = now.getFullYear();

        return {
            time: {
                from: startOfYear(year),
                to: endOfYear(year),
            },
            usedWords: ['this', 'year'],
        };
    }

    return null;
}

function tokenize(query = '') {
    return query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, index) => ({
            original: word,
            word: word.toLowerCase(),
            index,
        }));
}

function getUsedWords(tokens, words) {
    const used = [];
    const seen = new Set();

    for (const word of words) {
        const token = tokens.find((t) => t.word === word);

        if (token && !seen.has(token.index)) {
            seen.add(token.index);
            used.push(token.original);
        }
    }

    return used;
}

function getRemainingWords(query, usedWords) {
    const normalizedUsedWords = usedWords.map((word) => word.toLowerCase());
    const remainingWords = [];

    for (const word of query.trim().split(/\s+/).filter(Boolean)) {
        const matchedIndex = normalizedUsedWords.findIndex((usedWord) => usedWord === word.toLowerCase());

        if (matchedIndex === -1) {
            remainingWords.push(word);
            continue;
        }

        normalizedUsedWords.splice(matchedIndex, 1);
    }

    return remainingWords.join(' ');
}

/**
 * tell the start and end time
 * @param {*} query
 * @param {*} constraints
 */
const analyseTime = (query = '') => {
    const text = query.toLowerCase();
    const tokens = tokenize(query);

    const result = analyseYearRange(text) || analyseYearOperator(text) || analyseStandaloneYear(text) || analyseRelativePeriod(text);

    if (!result) {
        return {
            time: null,
            usedWords: [],
            remainingWords: query.trim(),
        };
    }

    const usedWords = getUsedWords(tokens, result.usedWords);

    return {
        ...result,
        usedWords,
        remainingWords: getRemainingWords(query, usedWords),
    };
};

module.exports = {
    analyseTime,
};
