import React, { useEffect, useState } from 'react';
import style from '../Settings.css';
import formStyles from '__styles/forms.css';
import Button from '__components/core-components/button/Button';
import {
    HeaderControlBar,
    HeaderControlBarRight,
    HeaderControlBarLeft,
} from '__components/core-components/header-control-bar/HeaderControlBar';

import { useApplicationContext } from '__contexts/app.context';
import MultiSelect from '__components/core-components/multi-select/MultiSelect';
import IconButton from '__components/core-components/icon-button/IconButton';
import useExportActions from './useExportActions';
import Modal from '__components/core-components/modal/Modal';
import ipcChannels from '__constants/ipcChannels';
import responseStatus from '__constants/responseStatus';

const VideoExportProgressIndicator = ({ currentState, onExportDone }) => {
    const [derivedState, setDerivedState] = useState({
        progress: 0,
        isBackupInProgress: false,
        progressDetails: '',
        backupErrorMessage: '',
        isPaused: false,
    });

    const togglePause = () => {
        if (derivedState.isPaused) {
            window.api.resumeExportingVideos(currentState?.trackingId);
            setDerivedState({ ...derivedState, isPaused: false });
        } else {
            window.api.pauseExportingVideos(currentState?.trackingId);
            setDerivedState({ ...derivedState, isPaused: true });
        }
    };

    const onExportStop = () => {
        if (window.confirm('Export operation in progress, do you really want to stop this? This will stop exporting remaining files.')) {
            window.api.stopExportingVideos(currentState?.trackingId);
        }
    };

    useEffect(() => {
        const { status, backedupVideos, totalVideos, statusMessage, isStopped } = currentState;

        const newState = {};
        const progressPercentage = Math.ceil(parseInt((backedupVideos / totalVideos) * 100));
        if (status === 'inProgress' || status === 'paused') {
            newState.progress = progressPercentage;
            newState.isBackupInProgress = true;
            newState.backupErrorMessage = '';
            newState.progressDetails = statusMessage;
            newState.isPaused = status === 'paused';
        }

        if (status === responseStatus.SUCCESS) {
            newState.progress = 100;
            newState.isBackupInProgress = false;
            newState.backupErrorMessage = '';
            newState.isPaused = false;
        }
        if (status === 'stopped') {
            newState.progress = 100;
            newState.isBackupInProgress = false;
            newState.backupErrorMessage = '';
            newState.progressDetails = statusMessage;
            newState.isPaused = false;
        }
        if (status === 'failure' || (status === 'partialSuccess' && isStopped === false)) {
            newState.progress = progressPercentage;
            newState.isBackupInProgress = false;
            newState.isPaused = false;
            newState.backupErrorMessage = `Some error occurred during backup. ${statusMessage}`;
        }

        setDerivedState(newState);
    }, [currentState]);

    return (
        <>
            {derivedState.isBackupInProgress && (
                <div>
                    <h3>Backup in progress...</h3>
                    <p>Do not close this window. Closing this window will cancel the current export process.</p>
                </div>
            )}
            {derivedState.progress === 100 && <p>Backup completed successfully.</p>}

            <div className={style.progressBar}>
                <div className={style.progressBarFill} style={{ width: `${derivedState.progress}%` }} />
            </div>
            {derivedState.progressDetails !== '' && <p>{derivedState.progressDetails}</p>}

            {derivedState.progress == 100 && (
                <div className={formStyles.formActionFooter}>
                    <Button type="primaryBtn" className="mt10" onClick={() => onExportDone()}>
                        Done
                    </Button>
                </div>
            )}
            {derivedState.backupErrorMessage && (
                <div className={formStyles.formActionFooter}>
                    <p>
                        <strong>{derivedState.backupErrorMessage}</strong>
                    </p>
                    <Button>Ok</Button>
                </div>
            )}
            {derivedState.isBackupInProgress && (
                <div className={formStyles.formActionFooter}>
                    <Button onClick={() => onExportStop()}>Stop</Button>

                    <Button onClick={() => togglePause()}>{derivedState.isPaused ? 'Resume' : 'Pause'}</Button>
                </div>
            )}
        </>
    );
};

const ExportVideos = () => {
    const [applicationState] = useApplicationContext();
    const [exportAllCollections, setExportAllCollection] = useState(false);

    const [selectedCollections, setSelectedCollections] = useState([]);

    const { startExporting, exportVideosState, showProgressIndicator, resetExportSettings, onExportVideoFolderSelect, exportFolderPath } =
        useExportActions();

    return (
        <div>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3>Export library videos</h3>
                </HeaderControlBarLeft>
                <HeaderControlBarRight>
                    <IconButton
                        icon="info"
                        onClick={() => window.api.send(ipcChannels.OPEN_HELP_WINDOW, 'how-to-use___backup-settings')}
                        title="Click learn more"
                    />
                </HeaderControlBarRight>
            </HeaderControlBar>
            <div>
                {(exportFolderPath === '' || exportVideosState.status == 'idle') && (
                    <div className={formStyles.formInputWrapper}>
                        <input
                            type="text"
                            className={style.formInputDisabledSelection}
                            placeholder="Select a backup destination"
                            value={exportFolderPath}
                            readOnly={true}
                            onClick={() => onExportVideoFolderSelect()}
                        />
                    </div>
                )}
                {exportFolderPath !== '' && (
                    <div className={formStyles.formInputWrapper}>
                        <h4 className={formStyles.formInputHeader}>Choose collections to export</h4>
                        <div className={formStyles.formInputWrapper}>
                            <input
                                type="checkbox"
                                className={formStyles.formInputCheckbox}
                                id="selectAllCollections"
                                checked={exportAllCollections}
                                onChange={() => setExportAllCollection(!exportAllCollections)}
                            ></input>
                            <label htmlFor="selectAllCollections">Select all collection</label>
                        </div>
                        {!exportAllCollections && (
                            <MultiSelect
                                options={applicationState.collections}
                                onChange={(selectedArr) => setSelectedCollections(selectedArr)}
                                defaultSelectedOptions={selectedCollections}
                            />
                        )}
                    </div>
                )}

                {!showProgressIndicator && exportFolderPath !== '' && (
                    <Button
                        onClick={() => {
                            startExporting(selectedCollections, exportFolderPath);
                        }}
                    >
                        Start exporting
                    </Button>
                )}
            </div>
            {showProgressIndicator && (
                <Modal isOpen={true} keyboardClose={false}>
                    <VideoExportProgressIndicator currentState={exportVideosState} onExportDone={() => resetExportSettings()} />
                </Modal>
            )}
        </div>
    );
};

export default ExportVideos;
