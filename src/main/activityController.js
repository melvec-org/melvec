const serviceEventBus = require('../services/service-utils/serviceEventBus');
const interServiceEvents = require('../events/interServiceEvents');

let pendingProcessesMap = new Map();

// this function will wait till all pending processes are completed before proceeding.

const waitTillPendingProcesses = async () => {
    return new Promise((resolve) => {
        const checkPending = () => {
            if (pendingProcessesMap.size === 0) {
                resolve();
            } else {
                setTimeout(checkPending, 100); // Poll every 100ms
            }
        };
        checkPending();
    });
};

const requestForApplicationClosing = async () => {
    serviceEventBus.publish(interServiceEvents.CLOSE_APP_REQUEST);
    await waitTillPendingProcesses();
    serviceEventBus.publish(interServiceEvents.BEFORE_APP_QUIT);
    return true;
};

const addPendingProcessing = (task) => {
    if (pendingProcessesMap.has(task)) {
        return;
    } else {
        pendingProcessesMap.set(task, true);
    }
};

const removePendingProcessing = (task) => {
    pendingProcessesMap.delete(task);
};

module.exports = {
    requestForApplicationClosing,
    addPendingProcessing,
    removePendingProcessing,
};
