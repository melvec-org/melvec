const userPreferenceStore = require('./userPreferenceStore');
const devConfig = require('../configs/devConfig');
const serviceGateway = require('../services/serviceGateway');
const servicePathConfig = require('../services/servicePathConfig');
const mainThreadEvents = require('../events/mainThreadEvents');
const { MAX_RECENTLY_USED_LIBRARY_PATH_COUNT } = require('../configs/systemConfig');
const { doesFileExist } = require('../services/service-utils/fileUtils');
const { scanMediaFilesToImport } = require('../services/bootstrap-services/scanMediaFilesToImport');
const { importMedia, cleanupImportSourceFolders } = require('../services/bootstrap-services/importMedia');
const { createInitialTestBed, resetTagsData } = require('../services/createTestBed');
const { requestForApplicationClosing } = require('./activityController');
const { emitToUI } = require('../services/service-utils/sendToUI');
const { isDev } = require('../services/service-utils/env');
const { selectLibraryRootPath } = require('./fileSystemHandlers');
const { isAbsoluteExistingDirectory } = require('../services/service-utils/ipcValidation');

/**
 * This scans for initial system configuration and validate it.
 */
const validateSystemConfiguration = () => {
    // Disable AI services on Intel Macs.

    const isIntelMac = process.platform === 'darwin' && process.arch === 'x64';
    userPreferenceStore.set('isAISupported', !isIntelMac);
};

// ... inside bootstrap()
// this scans for any video files that's pending for import. There can be any existing video file as well,
// it should be merged after seeing the files to import.
//
const libraryImportStatus = {
    COMPLETE: 'complete',
    PARTIAL_COMPLETE: 'partial_complete',
    IMPORT_ERROR: 'import_error',
};

// keep the last used path at the 0th position and return only x amount of items as per MAX_RECENTLY_USED_LIBRARY_PATH_COUNT
const saveLastUsedLibraryPath = async (libraryPath) => {
    const lastUsedLibraryPaths = userPreferenceStore.get('lastUsedLibraryPaths') || [];
    if (lastUsedLibraryPaths.indexOf(libraryPath) !== -1) {
        lastUsedLibraryPaths.splice(lastUsedLibraryPaths.indexOf(libraryPath), 1);
        lastUsedLibraryPaths.unshift(libraryPath);
    } else {
        lastUsedLibraryPaths.unshift(libraryPath);
    }
    userPreferenceStore.set('lastUsedLibraryPaths', lastUsedLibraryPaths.slice(0, MAX_RECENTLY_USED_LIBRARY_PATH_COUNT));
};

/**
 * Scans for pending media files and imports them into the active library.
 * Cleanup of temporary import-source folders always runs after the import attempt.
 * Returns a status object and never emits UI events directly.
 *
 * @param {Electron.WebContents} webContents - Renderer target used by import services for progress updates.
 * @returns {Promise<{importStatus: string, errorDetails: string}>}
 */
const validateLibraryData = async (webContents) => {
    const importStatus = {
        FAILURE: 'failure',
        PARTIAL_SUCCESS: 'import partially successful',
    };
    const filesToImport = scanMediaFilesToImport();

    if (filesToImport.length === 0) {
        return { importStatus: libraryImportStatus.COMPLETE, errorDetails: '' };
    }

    try {
        const importResult = await importMedia(filesToImport, servicePathConfig.getLibDir(), webContents);

        if (importResult.status === importStatus.FAILURE) {
            return { importStatus: libraryImportStatus.IMPORT_ERROR, errorDetails: importResult.message };
        }

        if (importResult.status === importStatus.PARTIAL_SUCCESS) {
            return { importStatus: libraryImportStatus.PARTIAL_COMPLETE, errorDetails: importResult.message };
        }

        return { importStatus: libraryImportStatus.COMPLETE, errorDetails: '' };
    } finally {
        cleanupImportSourceFolders();
    }
};

const onNewLibraryFolderSelection = async (path = '', webContents) => {
    await initializeLibrary({
        libraryRootPath: path,
        webContents,
        isNewSelection: true,
    });
};

const buildInitialLibraryPayload = ({ importWarning = null }) => {
    const initialLibraryState = serviceGateway.getInitialLibraryState();

    return {
        ...initialLibraryState,
        importWarning,
    };
};

/**
 * Initializes the active library and emits the resulting bootstrap state to the UI.
 *
 * Step 1: Configure the library root path
 * Step 2: Initialize core services
 * Step 3: Validate/import library data
 * Step 4: Initialize secondary services only on success
 * Step 5: Persist derived preferences
 * Step 6: Emit the result to the UI
 *
 * @param {Object} options
 * @param {string} options.libraryRootPath - Absolute path to the selected library root.
 * @param {Electron.WebContents} options.webContents - Renderer target for bootstrap-related UI events.
 * @param {boolean} [options.isNewSelection=false] - Whether this init came from switching/selecting a new library.
 */
const initializeLibrary = async ({ libraryRootPath, webContents, isNewSelection = false }) => {
    // Step 01: Configure library root path
    if (isNewSelection) {
        userPreferenceStore.set('libraryRootPath', libraryRootPath);
    }

    // Step 02: Initialize core services
    serviceGateway.init({ libraryRootPath: libraryRootPath, userPreferenceStore });

    // Step 03: Validate/import library data
    const { importStatus, errorDetails } = await validateLibraryData(webContents);

    const canBootstrap = importStatus === libraryImportStatus.COMPLETE || importStatus === libraryImportStatus.PARTIAL_COMPLETE;

    if (!canBootstrap) {
        emitToUI(mainThreadEvents.ON_IMPORT_FAILURE, {
            errorDetails: errorDetails || 'Library import failed. Please check the error log.',
        });
        return;
    }

    // Step 04: Initialize secondary services only on success
    serviceGateway.initSecondaryServices();

    // Step 05: Persist derived preferences
    userPreferenceStore.set('libraryPath', servicePathConfig.getLibDir());

    if (isNewSelection) {
        saveLastUsedLibraryPath(libraryRootPath);
    }

    // Step 06: Emitting result to UI
    emitToUI(
        isNewSelection ? mainThreadEvents.ON_NEW_LIBRARY_SELECTION_COMPLETE : mainThreadEvents.ON_SUCCESSFUL_INIT,
        buildInitialLibraryPayload({
            importWarning: importStatus === libraryImportStatus.PARTIAL_COMPLETE ? errorDetails : null,
        }),
    );
};

/**
 * Main entry point for application bootstrapping.
 * Validates environment and stored library configuration, then initializes the active library.
 *
 * @param {Electron.WebContents} webContents - Renderer target for bootstrap lifecycle events.
 */
const bootstrap = async (webContents) => {
    try {
        // step - 01 validate system configuration
        validateSystemConfiguration();

        // step - 02 check if library root path does exist
        const libraryRootPath = userPreferenceStore.get('libraryRootPath');

        if (isDev) {
            devConfig.cleanupAndResetSampleLibrary && createInitialTestBed();
            devConfig.cleanupTagsData && resetTagsData(libraryRootPath);
        }

        // step - 03 check if library root path do exist
        if (!doesFileExist(libraryRootPath)) {
            emitToUI(mainThreadEvents.ON_LIBRARY_PATH_NOT_FOUND, null);
            return;
        }

        // step - 03 Initialize the library with basic set of configurations
        await initializeLibrary({ libraryRootPath, webContents, isNewSelection: false });
    } catch (err) {
        console.error('bootstrap failed:', err);
        emitToUI(mainThreadEvents.ON_IMPORT_FAILURE, {
            errorDetails: err?.message || String(err),
        });
    }
};

const beforeAppQuit = async () => {
    const shouldQuit = await requestForApplicationClosing();

    if (shouldQuit) {
        return true;
    }
};

const openLibrarySelection = async (webContents) => {
    const selectedLibraryPath = await selectLibraryRootPath(webContents);

    if (!selectedLibraryPath) {
        return;
    }

    const currentLibraryRootPath = userPreferenceStore.get('libraryRootPath');
    if (currentLibraryRootPath === selectedLibraryPath) {
        return;
    }

    await onNewLibraryFolderSelection(selectedLibraryPath, webContents);
};

const switchLibrary = async (selectedPath, webContents) => {
    if (!isAbsoluteExistingDirectory(selectedPath)) {
        console.error('Rejected invalid library path from renderer');
        return;
    }

    await onNewLibraryFolderSelection(selectedPath, webContents);
};

module.exports = {
    bootstrap,
    openLibrarySelection,
    beforeAppQuit,
    switchLibrary,
};
