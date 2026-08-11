const {
    addLocationToDb,
    addMediaToLocation,
    removeMediaLocation,
    getLocationDetailsByMediaId,
    updateLocationClusterById,
    getLocationClusterDetailsById,
    getAllLocationClusterNames,
    getMediaIdsByClusterId,
} = require('../database/locationDbService');
const { getImageDetailsById } = require('../database/imageLibraryDbService');
const { getVideoDetailsById } = require('../database/videoLibraryDbService');
const { formatLocation } = require('./locationFormater');
const { findLocation } = require('./locationReference');
const mediaTypes = require('../../constants/mediaTypes');

/**
 * Returns the resolved location name for a media item.
 *
 * Uses the location association stored in `locationDbService` and returns the cluster name.
 * Returns `null` when the media has no associated location, and an empty string when the
 * location cluster exists but does not have a name.
 *
 * @param {string} mediaType Media type constant from `mediaTypes`.
 * @param {string|number} mediaId Media identifier.
 * @returns {string|null} Resolved location name, empty string for unnamed clusters, or `null`
 * if no location is associated with the media.
 */
const getLocationNameByMediaId = (mediaType, mediaId) => {
    const locationDetails = getLocationDetailsByMediaId(mediaType, mediaId);

    if (locationDetails === null) {
        return null;
    } else {
        return locationDetails?.name || '';
    }
};

/** Placeholder for future manual cluster creation flow. */
const createCluster = ({ label, aliases, centerLat, centerLon, radius }) => {
    const clusterId = '';

    return clusterId;
};

/** Placeholder for future cluster rename support. */
const renameCluster = (clusterId, label) => {};

/** Placeholder for future cluster alias update support. */
const updateAliases = (clusterId, aliases) => {};

/** Placeholder for future cluster radius update support. */
const udpateRadius = (clusterId, radius) => {};

/** Placeholder for future cluster center update support. */
const updateCenter = (clusterId, latitude, longitude) => {};

/** Placeholder for future cluster deletion support. */
const deleteCluster = (clusterId) => {};

/** Placeholder for future cluster rebuild support. */
const rebuildCluster = (clusterId) => {};

/** Placeholder for future bulk media assignment support. */
const assignMediaBulk = (mediaIds, clusterId) => {};
/** Placeholder for future bulk media removal support. */
const removeMediaBulk = (mediaIds, clusterId) => {};
/** Placeholder for future single media removal from a cluster. */
const removeMedia = (mediaId, clusterId) => {};

/**
 * Associates a media item with a location cluster derived from GPS coordinates.
 *
 * The function first attempts to resolve the coordinates through `findLocation()`. If no
 * matching system location is found, it creates a fallback custom cluster with an empty name.
 * If an existing cluster is returned by the lookup, the media is linked to that cluster.
 * Otherwise, a new cluster is created from the resolved location reference and assigned.
 *
 * @param {string} mediaType Media type constant from `mediaTypes`.
 * @param {string|number} mediaId Media identifier.
 * @param {number} lat Latitude of the media.
 * @param {number} lan Longitude of the media.
 * @returns {Object} The existing or newly created location cluster associated with the media.
 */
const addMediaLocation = (mediaType, mediaId, lat, lan) => {
    const locationDetails = findLocation(lat, lan);

    // if this is a completely new location, then just store it unnamed
    if (!locationDetails) {
        const fallbackLocationCluster = addLocationToDb({
            center_lat: lat,
            center_lon: lan,
            referenceId: null,
            radius: 1000,
            name: '',
        });

        addMediaToLocation(mediaType, mediaId, fallbackLocationCluster.id);

        return fallbackLocationCluster;
    }

    if (typeof locationDetails.center_lat === 'number' && typeof locationDetails.center_lon === 'number') {
        addMediaToLocation(mediaType, mediaId, locationDetails.id);
        return locationDetails;
    }

    locationDetails.name = formatLocation(locationDetails);

    const locationCluster = addLocationToDb({
        center_lat: locationDetails.centerLat,
        center_lon: locationDetails.centerLng,
        referenceId: locationDetails.referenceId,
        radius: locationDetails.radius,
        name: locationDetails.name,
    });

    addMediaToLocation(mediaType, mediaId, locationCluster.id);

    return locationCluster;
};

/**
 * Creates a user-defined custom location cluster for a media item and assigns the media to it.
 *
 * The media's stored GPS coordinates are used as the cluster center. Any existing location
 * association for the media is removed before the new custom cluster is created and linked.
 *
 * @param {string} mediaType Media type constant from `mediaTypes`.
 * @param {string|number} mediaId Media identifier.
 * @param {string} locationName User-provided custom location name.
 * @param {number} [radius=1000] Radius for the custom location cluster.
 * @returns {Object} The newly created custom location cluster.
 * @throws {Error} If `locationName` is empty, `mediaType` is unsupported, the media cannot be
 * found, or the media does not contain valid GPS coordinates.
 */
const addCustomMediaLocation = (mediaType, mediaId, locationName, radius = 1000) => {
    const trimmedLocationName = typeof locationName === 'string' ? locationName.trim() : '';

    if (!trimmedLocationName) {
        throw new Error('locationName must be a non-empty string');
    }

    let mediaDetails = null;

    if (mediaType === mediaTypes.IMAGE) {
        mediaDetails = getImageDetailsById(mediaId, true);
    } else if (mediaType === mediaTypes.VIDEO) {
        mediaDetails = getVideoDetailsById(mediaId, true);
    } else {
        throw new Error(`Unsupported mediaType: ${mediaType}`);
    }

    if (!mediaDetails) {
        throw new Error(`Media not found: ${mediaId}`);
    }

    if (typeof mediaDetails.latitude !== 'number' || typeof mediaDetails.longitude !== 'number') {
        throw new Error(`Media does not have valid GPS coordinates: ${mediaId}`);
    }

    removeMediaLocation(mediaType, mediaId);

    const locationCluster = addLocationToDb({
        center_lat: mediaDetails.latitude,
        center_lon: mediaDetails.longitude,
        referenceId: null,
        radius,
        name: trimmedLocationName,
    });

    addMediaToLocation(mediaType, mediaId, locationCluster.id);

    return locationCluster;
};

/**
 * Updates the name and radius of an existing custom location cluster.
 *
 * This only updates cluster metadata in `locationDbService`. It does not reassign media or
 * rebuild nearby cluster relationships.
 *
 * @param {number} locationId Location cluster identifier.
 * @param {string} locationName Updated cluster name.
 * @param {number} radius Updated cluster radius.
 * @returns {Object|null} The refreshed location cluster details after the update.
 */
const updateCustomLocationCluster = (locationId, locationName, radius) => {
    let locationDetails = getLocationClusterDetailsById(locationId);

    locationDetails.radius = radius;
    locationDetails.name = locationName;
    updateLocationClusterById(locationId, locationDetails);

    return getLocationClusterDetailsById(locationId);
};

/**
 * Updates a custom cluster and acts as the entry point for future cluster re-identification.
 *
 * At present this only delegates to `updateCustomLocationCluster()`. The intended future
 * behavior, as noted in the inline comments, is to reconcile nearby clusters when the radius
 * changes.
 *
 * @param {number} locationId Location cluster identifier.
 * @param {string} locationName Updated cluster name.
 * @param {number} radius Updated cluster radius.
 * @returns {void}
 */
const identifyLocationCluster = (locationId, locationName, radius) => {
    // step-01: update the locationCluster
    updateCustomLocationCluster(locationId, locationName, radius);

    // step-02: find all clusters with center lat lan that within this clusters radius - this is valid when user
    // has increased the default radius
    // tobe done later. also discard if the radius is smaller.
};

/**
 * This is to be done when there is change in source - this is for future.
 * Keeping signature for reference in future implementation.
 */
const rebuildAllSystemClusters = () => {};

/** Placeholder for future cluster lookup by reference id. */
const findClusterByReferenceId = (referenceId) => {};

module.exports = {
    addMediaLocation,
    addCustomMediaLocation,
    getLocationNameByMediaId,
    identifyLocationCluster,
    updateCustomLocationCluster,
    getAllLocationNames: getAllLocationClusterNames,
    getMediaListByLocationId: getMediaIdsByClusterId,
};
