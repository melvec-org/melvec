/**
 * Central registry for application menu / accelerator key callbacks in the renderer.
 *
 * Why this exists:
 * - Application menu actions are emitted from the Electron main process and delivered
 *   to the renderer through a shared IPC channel.
 * - If individual UI components attach their own `window.api.receive(...)` listeners,
 *   multiple listeners can accumulate over time as components mount, unmount, and re-render.
 * - That pattern can lead to duplicated callback execution, stale closures, hard-to-track
 *   side effects, and cleanup inconsistencies.
 *
 * Why centralized management is better:
 * - Only one IPC listener is attached for the entire renderer process.
 * - UI modules register and unregister callbacks through this registry instead of
 *   subscribing directly to the IPC channel.
 * - This keeps listener lifecycle predictable and avoids duplicate subscriptions.
 * - It also makes accelerator/menu command routing easier to reason about because
 *   all command dispatching flows through one place.
 *
 * Typical problem with direct per-instance listening:
 * - A component mounts and subscribes to `APPLICATION_MENU_ACTION`.
 * - The component re-renders or another instance mounts and subscribes again.
 * - One or more listeners are not removed correctly.
 * - A single menu action now triggers multiple handlers, including outdated ones.
 *
 * Registry behavior:
 * - Each command/event key maps to a single callback.
 * - Registering the same event again replaces the previous callback for that event.
 * - The shared IPC listener receives the command and dispatches it to the registered callback.
 */
const registry = new Map();
const ipcChannels = require('../../constants/ipcChannels');

/**
 * Register a callback for a specific accelerator/menu command.
 *
 * @param {string} event - Command/event identifier sent from the application menu.
 * @param {Function} callback - Function to execute when the command is received.
 */
export function registerAccKeyListener(event, callback) {
    registry.set(event, callback);
}

/**
 * Remove the callback associated with a specific accelerator/menu command.
 *
 * @param {string} event - Command/event identifier to unregister.
 */
export function unregisterAccKeyListener(event) {
    registry.delete(event);
}

/**
 * Dispatch a received application menu command to the registered callback.
 *
 * This function is intentionally kept private so all routing remains centralized.
 *
 * @param {string} command - Command/event identifier received over IPC.
 */
function onApplicationMenuCommand(command) {
    const cb = registry.get(command);
    if (cb) {
        cb();
    }
}

// Register only once for the entire renderer.
// This prevents multiple component-level IPC subscriptions from stacking up.
window.api.stop(ipcChannels.APPLICATION_MENU_ACTION, onApplicationMenuCommand);
window.api.receive(ipcChannels.APPLICATION_MENU_ACTION, onApplicationMenuCommand);
