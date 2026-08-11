const serviceMethods = require('../../constants/serviceMethods');

const locationApi = (ipcRenderer) => ({
    getLocationDetailsByMedia: (mediaType, mediaId) => ipcRenderer.invoke(serviceMethods.LOCATION_GET_DETAILS_BY_MEDIA, mediaType, mediaId),
    nameUnnamedMediaLocation: (locationId, locationName, radius) =>
        ipcRenderer.invoke(serviceMethods.LOCATION_IDENTIFY_CLUSTER, locationId, locationName, radius),
    createCustomMediaLocation: (mediaType, mediaId, location, radius, alias) =>
        ipcRenderer.invoke(serviceMethods.LOCATION_CREATE_CUSTOM_CLUSTER, mediaType, mediaId, location, radius),
    updateLocationAliases: (locationId, aliases) => ipcRenderer.invoke(serviceMethods.LOCATION_UPDATE_ALIAS, locationId, aliases),
    updateCustomLocation: (locationId, locationName, radius) =>
        ipcRenderer.invoke(serviceMethods.LOCATION_UPDATE_CUSTOM, locationId, locationName, radius),
});
module.exports = { locationApi };
