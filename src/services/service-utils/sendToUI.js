const responseStatus = require('../../constants/responseStatus');
const ipcChannels = require('../../constants/ipcChannels');

const emitToUI = (event, payload) => {
    webContents.send(ipcChannels.NOTIFY_RENDERER_PROCESS, {
        event: event,
        payload: payload,
    });
};

const streamToUI = (event, data) => {
    webContents.send(ipcChannels.EVENT_STREAM, {
        event: event,
        data: data,
    });
};

/**
 *  success for all operations
 *  failure for handled the error
 *  error if can not handle the error
 */
// Unified response structure
const respond = (status, message, data) => {
    const VALID_STATUSES = new Set(['success', 'failure', 'error']);

    if (!VALID_STATUSES.has(status)) {
        throw new Error(`Invalid status: ${status}`);
    }

    if (status === responseStatus.SUCCESS) {
        return { status: status, message: message, data: data };
    }

    return { status: status, message: message };
};

const respondSuccess = (message = '', data = null) => respond('success', message, data);
const respondFailure = (message) => respond('failure', message);
const respondError = (message) => respond('error', message);

module.exports = {
    emitToUI,
    streamToUI,
    respond,
    respondSuccess,
    respondFailure,
    respondError,
};
