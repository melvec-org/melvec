const { getAllVideos, getAllVideoIds, getVideoDetailsById } = require('../video-library/videoLibrary');
const { generateTitleSimilarityIndexes } = require('./generateTitleSimilarityIndexes');

const { getAllTagLabelsByVideoId } = require('../database/tagsDbService');
const { getVideosByCollection } = require('../collections/collections');

const { getAllPlaylistLabelsByVideoId } = require('../database/playlistsDbService');
const { generateSimilarityIndexes } = require('./generateSimilarityIndexes');
const { initializeDb, getRelatedVideos, setRelatedVideos } = require('./relatedVideosDbServices');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { MAX_RELATED_VIDEOS_PER_VIDEO } = require('../../configs/appConfig');
const { addPendingProcessing, removePendingProcessing } = require('../../main/activityController');
const { generateDescriptionSimilarityIndexesFromDbAsync } = require('./generateDescriptionSimilarityIndexes');
const userPreferenceStore = require('../../main/userPreferenceStore');
const { generateDescVectorSimilarityMap } = require('./deriveRelatedVideosByEmbedding');
const { getVideosByCategoryId } = require('../database/videoLibraryDbService');
const indexingEvents = require('../../events/indexingEvents');

let lastRelatedVideosMap = null;

// TODO: we should have the collection id. ( video library need to implement collection id functionality)
const getVideosByCollectionSimilarity = (collectionId, videoId) => {
    const relatedVideos = getVideosByCollection(collectionId);
    if (!relatedVideos.length) return [];

    return relatedVideos.map((item) => ({ videoId: item, score: 1 })).filter((item) => item.videoId !== videoId);
};

const getVideosByCategorySimilarity = (videoId) => {
    const categoryId = getVideoDetailsById(videoId).category_id;
    if (categoryId === null) return [];

    const relatedVideos = getVideosByCategoryId(categoryId);
    if (!relatedVideos.length) return [];

    return relatedVideos.map((item) => ({ videoId: item, score: 1 })).filter((item) => item.videoId !== videoId);
};

const getRelatedVideosById = (videoId) => getRelatedVideos(videoId);

// Normalize scores within a factor

const normalizeScores = (factorScores) => {
    if (!factorScores.length) return factorScores;
    const maxScore = Math.max(...factorScores.map(({ score }) => score));
    if (maxScore === 0) return factorScores;
    return factorScores.map(({ videoId, score }) => ({
        videoId,
        score: score / maxScore,
    }));
};

const compareRelatedVideos = (obj1, obj2) => {
    if (obj1 === null) return Object.keys(obj2);
    const differences = [];
    for (const videoId of Object.keys(obj2)) {
        const videos1 = obj1[videoId];
        const videos2 = obj2[videoId];
        if (!videos1 || !arraysEqual(videos1, videos2)) {
            differences.push(videoId);
        }
    }
    return differences;
};

/** */
const arraysEqual = (arr1, arr2) => {
    if (!arr1 || arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
};

/**
 * getOverallScore would calculate overal similarity score taking individual scores
 * This would implement cosine similarity framework
 * we will consider views as well as for collection
 */
const getOverallScore = (scoreFactors, limit) => {
    const isAIEnabled = userPreferenceStore.get('isAIEnabled');
    const weightsForAI = {
        description: 0.4,
        tags: 0.25,
        playlists: 0.05,
        title: 0.15,
        category: 0.1,
        collection: 0.05,
    };

    const factorWeights = isAIEnabled
        ? weightsForAI
        : {
              description: 0.2,
              tags: 0.3,
              playlists: 0.2,
              title: 0.15,
              category: 0.1,
              collection: 0.05,
          };

    // Collect all related video IDs and their scores from each factor
    const factors = ['description', 'tags', 'playlists', 'title', 'category', 'collection'];

    const scoreMap = factors.reduce((acc, factor) => {
        const factorScores = scoreFactors[factor] || [];
        const scores = normalizeScores(factorScores);

        scores.forEach(({ videoId, score }) => {
            if (!acc[videoId]) {
                acc[videoId] = {
                    videoId,
                    combinedScore: 0,
                    factorScores: { description: 0, tags: 0, playlist: 0, title: 0, category: 0, collection: 0 },
                };
            }
            acc[videoId].combinedScore += score * factorWeights[factor] || 0;
            acc[videoId].factorScores[factor] = score * factorWeights[factor];
        });
        return acc;
    }, {});

    return Object.values(scoreMap)
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, limit)
        .map(({ videoId }) => videoId);
};

/**
 *  Starting point fo the calculation of related videos.
 *  This function will be called when a video is deleted, added, or updated.
 *  This function will calculate the related videos and store them in the relatedVideosData.
 **/
const indexRelatedVideos = async () => {
    const allVideoIds = getAllVideoIds();
    const isAIEnabled = userPreferenceStore.get('isAIEnabled');

    // Bulk fetch all tag and playlist mappings in 2 queries instead of 2 per video
    const allTagLabelsByVideoId = getAllTagLabelsByVideoId();
    const allPlaylistLabelsByVideoId = getAllPlaylistLabelsByVideoId();

    const listOfVideos = getAllVideos().map((item) => ({
        videoId: item.id,
        tags: allTagLabelsByVideoId[item.id] || [],
        playlists: allPlaylistLabelsByVideoId[item.id] || [],
        title: item.title,
        collection_id: item.collection_id,
    }));

    let relatedVideosMap = {};

    const titleSimilarityMap = generateTitleSimilarityIndexes(listOfVideos);
    const tagsSimilarityMap = generateSimilarityIndexes(listOfVideos, 'tags');
    const playlistSimilarityMap = generateSimilarityIndexes(listOfVideos, 'playlists');

    let descriptionSimilarityMap = {};
    if (isAIEnabled) {
        descriptionSimilarityMap = generateDescVectorSimilarityMap(allVideoIds);
    } else {
        descriptionSimilarityMap = await generateDescriptionSimilarityIndexesFromDbAsync(allVideoIds);
    }

    const YIELD_EVERY = 1000;

    for (let i = 0; i < listOfVideos.length; i++) {
        const videoItem = listOfVideos[i];
        const videoId = videoItem.videoId;

        const similarByTags = tagsSimilarityMap[videoId] || [];
        const similarByPlaylists = playlistSimilarityMap[videoId] || [];
        const similarByTitles = titleSimilarityMap[videoId] || [];
        const similarByCollections = getVideosByCollectionSimilarity(videoItem.collection_id, videoId);
        const similarByCategory = getVideosByCategorySimilarity(videoId);
        const similarByDescription = descriptionSimilarityMap[videoId] || [];

        let overalScoresOfRelatedVideos = getOverallScore(
            {
                description: similarByDescription,
                tags: similarByTags,
                playlists: similarByPlaylists,
                title: similarByTitles,
                collection: similarByCollections,
                category: similarByCategory,
            },
            MAX_RELATED_VIDEOS_PER_VIDEO,
        );

        relatedVideosMap[videoId] = overalScoresOfRelatedVideos;

        // Yield to the event loop periodically to keep the UI responsive
        if (i > 0 && i % YIELD_EVERY === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    saveRelatedVideosToDb(lastRelatedVideosMap, relatedVideosMap);
};

const saveRelatedVideosToDb = (previousRelatedVideosData, updatedRelatedVideosData) => {
    const videosIdsToUpdate = compareRelatedVideos(previousRelatedVideosData, updatedRelatedVideosData);

    if (videosIdsToUpdate.length > 0) {
        videosIdsToUpdate.forEach((videoId) => {
            setRelatedVideos(videoId, updatedRelatedVideosData[videoId]);
        });
    }

    lastRelatedVideosMap = updatedRelatedVideosData;
};

let relatedVideoIndexingStatus = 'done';
const INDEXING_INTERVAL = 1000 * 5; // wait for a 5 secs from last update to start indexing
let indexingIntervalRef = null;
const delayedIndexRelatedVideos = async (data) => {
    // check the valid data atributes before indexing ( exclude all image changes)
    const validChanges = new Set([
        indexingEvents.COLLECTION_UPDATE,
        indexingEvents.COLLECTION_REMOVE,
        indexingEvents.TAG_UPDATE,
        indexingEvents.TAG_REMOVE,
        indexingEvents.PLAYLIST_UPDATE,

        // video events
        indexingEvents.VIDEO_DELETE,
        indexingEvents.VIDEO_COLLECTION_CHANGE,
        indexingEvents.VIDEO_CATEGORY_CHANGE,
        indexingEvents.VIDEO_TITLE_CHANGE,
        indexingEvents.VIDEO_PLAYLIST_CHANGE,
        indexingEvents.VIDEO_META_DATA_CHANGE,
    ]);
    if (!validChanges.has(data.change)) return;

    relatedVideoIndexingStatus = 'WIP';
    if (indexingIntervalRef) clearTimeout(indexingIntervalRef);
    indexingIntervalRef = setTimeout(
        async () => {
            await indexRelatedVideos();
            relatedVideoIndexingStatus = 'done';
            indexingIntervalRef = null;
        },
        INDEXING_INTERVAL, // delay by 1 minute
    );
};

// if relatedVideoIndexing is in progress, clear the interval and re-index instantly
const ensureNoPendingIndexing = async () => {
    if (relatedVideoIndexingStatus === 'WIP') {
        addPendingProcessing('relatedVideos indexing');
        clearTimeout(indexingIntervalRef);
        await indexRelatedVideos();
        relatedVideoIndexingStatus = 'done';
        removePendingProcessing('relatedVideos indexing');
    }
};

// initialize related videos service
const initRelatedVideosService = () => {
    initializeDb();

    serviceEventBus.subscribe(interServiceEvents.INDEX_DATA_CHANGED, (data) => delayedIndexRelatedVideos(data));
    serviceEventBus.subscribe(interServiceEvents.CLOSE_APP_REQUEST, () => ensureNoPendingIndexing());
};

// save related videos to the disk periodically

module.exports = {
    initRelatedVideosService,
    indexRelatedVideos,
    getRelatedVideosById,
};
