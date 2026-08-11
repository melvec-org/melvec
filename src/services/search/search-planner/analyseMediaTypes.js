const mediaTypes = require('../../../constants/mediaTypes');

function tokenize(query = '') {
    return query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, index) => ({
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
            used.push(token.word);
        }
    }

    return used;
}

function getRemainingWords(query, usedWords) {
    const normalizedUsedWords = [...usedWords];
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
 * Search for mediatype - return media types requested and used token indexes
 * @param {*} query
 * @param {*} constraints
 */
const analyseMediaTypes = (query = '', constraints) => {
    const q = query.toLowerCase();
    const tokens = tokenize(query);
    const resultantMediaType = [];
    const usedWords = [];

    if (q.includes('video') || q.includes('videos')) {
        resultantMediaType.push(mediaTypes.VIDEO);
        usedWords.push('video', 'videos');
    }

    if (q.includes('image') || q.includes('images') || q.includes('photo') || q.includes('photos')) {
        resultantMediaType.push(mediaTypes.IMAGE);
        usedWords.push('image', 'images', 'photo', 'photos');
    }

    if (q.includes('audio') || q.includes('audios')) {
        resultantMediaType.push(mediaTypes.AUDIO);
        usedWords.push('audio', 'audios');
    }

    const matchedWords = getUsedWords(tokens, usedWords);

    return {
        mediaTypes: resultantMediaType,
        usedWords: matchedWords,
        remainingWords: getRemainingWords(query, matchedWords),
    };
};

module.exports = { analyseMediaTypes };
