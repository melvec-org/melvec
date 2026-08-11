const { analyseMediaTypes } = require('./analyseMediaTypes');
const { analyseSubjects } = require('./analyseSubjects');
const { analyseTime } = require('./analyseTime');
const { analyseLocations } = require('./analyseLocations');
const { analyseContentType } = require('./analyseContentTypes');

/**
 * Search planner
 * @param {*} query
 */
const analyseQuery = (query) => {
    const queryPlanner = {
        query,

        constraints: {
            mediaTypes: [],
            subjects: [],
            time: null,
            locations: [],
            contentTypes: [],
        },

        remainingWords: query,
    };
    // first do the time analyzer and strip down the orginal query
    const mediaTypeResponse = analyseMediaTypes(queryPlanner.remainingWords);
    queryPlanner.constraints.mediaTypes = mediaTypeResponse.mediaTypes;
    queryPlanner.remainingWords = mediaTypeResponse.remainingWords;

    // if content type is found - again strip it down further
    const contentTypeResponse = analyseContentType(queryPlanner.remainingWords);
    queryPlanner.constraints.contentTypes = contentTypeResponse.contentTypes;
    queryPlanner.remainingWords = contentTypeResponse.remainingWords;

    // time is also a obvious factor so strip down the query further
    const timeResponse = analyseTime(queryPlanner.remainingWords);
    queryPlanner.constraints.time = timeResponse.time;
    queryPlanner.remainingWords = timeResponse.remainingWords;

    // location can be another stripper
    const locationResponse = analyseLocations(queryPlanner.remainingWords);
    queryPlanner.constraints.locations = locationResponse.locations;
    queryPlanner.remainingWords = locationResponse.remainingWords;

    // finally figure out people name
    const subjectResponse = analyseSubjects(queryPlanner.remainingWords);
    queryPlanner.constraints.subjects = subjectResponse.subjects;
    queryPlanner.remainingWords = subjectResponse.remainingWords;

    return queryPlanner;
};

module.exports = {
    analyseQuery,
};
