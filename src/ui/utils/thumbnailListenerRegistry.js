import mainThreadEvents from '__events/mainThreadEvents';
import ipcChannels from '__constants/ipcChannels';

const registry = new Map();

export function registerThumbnailListener(url, callback) {
    registry.set(url, callback);
}

export function unregisterThumbnailListener(url) {
    registry.delete(url);
}

function onFromMainEvent(response) {
    if (response.event === mainThreadEvents.ON_THUMBNAIL_UPDATE) {
        const { path } = response.payload;
        const cb = registry.get(path);
        if (cb) {
            cb();
            registry.delete(path); // remove after firing
        }
    }
}

// Register only once for the entire renderer
window.api.receive(ipcChannels.NOTIFY_RENDERER_PROCESS, onFromMainEvent);
