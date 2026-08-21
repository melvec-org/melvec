const { initializeDb, getLocationDetailsByMediaId } = require('../database/locationDbService');
const { respondSuccess, respondError } = require('../service-utils/sendToUI');
const { identifyLocationCluster, addCustomMediaLocation, updateCustomLocationCluster } = require('./location');

const getLocationDetailsByMediaService = (mediaType, mediaId) => {
    try {
        const locationDetails = getLocationDetailsByMediaId(mediaType, mediaId);
        return respondSuccess('locationDetails', locationDetails);
    } catch (error) {
        return respondError(`system error while getting location details. ${error.message}`);
    }
};

const identifyLocationClusterService = (locationId, locationName, radius) => {
    try {
        const updatedClusterDetails = identifyLocationCluster(locationId, locationName, radius);
        return respondSuccess('', updatedClusterDetails);
    } catch (e) {
        return respondError(e);
    }
};

const createCustomLocationClusterService = (mediaType, mediaId, locationName, radius) => {
    try {
        const updatedClusterDetails = addCustomMediaLocation(mediaType, mediaId, locationName, radius);
        return respondSuccess('', updatedClusterDetails);
    } catch (e) {
        return respondError(e);
    }
};
const updateLocationAliasesService = (locationId, aliases) => {
    // TODO - this would come later phase
};

const updateCustomLocationClusterService = (locationId, locationName, radius) => {
    try {
        const updatedClusterDetails = updateCustomLocationCluster(locationId, locationName, radius);
        return respondSuccess('Updated location details.', updatedClusterDetails);
    } catch (e) {
        return respondError(e);
    }
};

const initLocationService = () => {
    initializeDb();
};

module.exports = {
    initLocationService,
    getLocationDetailsByMediaService,
    identifyLocationClusterService,
    updateLocationAliasesService,
    createCustomLocationClusterService,
    updateCustomLocationClusterService,
};
