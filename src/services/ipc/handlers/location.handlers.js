const serviceMethods = require('../../../constants/serviceMethods');
const { validateLocationName, validateLocationRadius } = require('../../service-utils/ipcValidation');
const {
    getLocationDetailsByMediaService,
    updateLocationAliasesService,
    createCustomLocationClusterService,
    identifyLocationClusterService,
    updateCustomLocationClusterService,
} = require('../../location/location.service');

const locationServiceHandlers = [
    [serviceMethods.LOCATION_GET_DETAILS_BY_MEDIA, async (mediaType, mediaId) => getLocationDetailsByMediaService(mediaType, mediaId)],
    [
        serviceMethods.LOCATION_IDENTIFY_CLUSTER,
        async (locationId, locationName, radius) => {
            return identifyLocationClusterService(locationId, locationName, radius);
        },
    ],
    [
        serviceMethods.LOCATION_CREATE_CUSTOM_CLUSTER,
        async (mediaType, mediaId, location, radius) => {
            const radiusValidation = validateLocationRadius(radius);

            if (radiusValidation) {
                return radiusValidation;
            }
            const locationValidationError = validateLocationName(location);

            if (locationValidationError) {
                return locationValidationError;
            }

            return createCustomLocationClusterService(mediaType, mediaId, location, radius);
        },
    ],
    [
        serviceMethods.LOCATION_UPDATE_ALIAS,
        async (locationId, aliases) => {
            return updateLocationAliasesService(locationId, aliases);
        },
    ],
    [
        serviceMethods.LOCATION_UPDATE_CUSTOM,
        async (locationId, locationName, radius) => {
            const radiusValidation = validateLocationRadius(radius);

            if (radiusValidation) {
                return radiusValidation;
            }
            const locationValidationError = validateLocationName(locationName);

            if (locationValidationError) {
                return locationValidationError;
            }

            return updateCustomLocationClusterService(locationId, locationName, radius);
        },
    ],
];

module.exports = {
    locationServiceHandlers,
};
