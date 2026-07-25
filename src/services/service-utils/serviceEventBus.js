const EventEmitter = require('node:events');

/**
 * Shared in-process event bus used by services to publish and subscribe to internal events.
 */
const eventEmitter = new EventEmitter();

// There are currently 11 subscribers to DATABASE_INITIALIZED alone (one per db-service).
// Set the limit on this instance — not globally — to avoid the MaxListenersExceededWarning.
eventEmitter.setMaxListeners(20);

const serviceEventBus = eventEmitter;
serviceEventBus.publish = eventEmitter.emit;
serviceEventBus.subscribe = eventEmitter.on;
serviceEventBus.unsubscribe = eventEmitter.off;

/**
 * Removes ALL listeners from the event bus.
 * Call this before re-initializing services on a UI refresh so that stale
 * duplicate listeners are not accumulated across re-inits.
 *
 * Note: BEFORE_APP_QUIT and CLOSE_APP_REQUEST listeners (registered once at
 * startup, not per-refresh) must be re-subscribed after calling this.
 */
serviceEventBus.reset = () => {
    eventEmitter.removeAllListeners();
};

module.exports = serviceEventBus;
