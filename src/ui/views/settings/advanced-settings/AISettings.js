import React from 'react';
import Button from '__components/core-components/button/Button';
import formStyles from '__styles/forms.css';
import useAISettingsActions, { downloadStates } from './useAISettingsActions';
import batchProcessStates from '__constants/batchProcessStates';

const AISettings = () => {
    const {
        isAISupported,
        isAIEnabled,
        selectedModelTier,
        toggleAIFeature,
        downloadAIModels,
        setAIModelTier,
        AIModelsStatus,
        downloadStatus,
        cancelDownload,
        pauseDownload,
        resumeDownload,
        deleteAIModels,
        startBatchMediaMetaDataGeneration,
        stopBatchMediaMetaDataGeneration,
        batchDescGenProcessStatus,
        importModelsFromLocalPath,
    } = useAISettingsActions();

    if (!isAISupported) {
        return null;
    }

    return (
        <div className={formStyles.formSection}>
            <h3>AI Tools</h3>

            <div className={formStyles.formInputWrapper}>
                <div className={formStyles.formSwitch}>
                    <input type="checkbox" id="aiFeature" checked={isAIEnabled} onChange={() => toggleAIFeature(!isAIEnabled)} />
                    <label htmlFor="aiFeature" className={formStyles.formSwitchToggle}></label>
                    <label htmlFor="aiFeature">Enable AI features.</label>
                </div>

                <p className="secondaryInfo">
                    <strong>Note:</strong> This would enable advanced searching based on the videos content. This is an experiemental
                    feature.
                </p>
            </div>

            {isAIEnabled && (
                <div className={formStyles.formInputWrapper}>
                    <h4>Select AI quality</h4>
                    <div className={formStyles.tabbedRadioGroup}>
                        <input
                            id="basicModel"
                            type="radio"
                            checked={selectedModelTier === 'basic'}
                            name="aiModelSelector"
                            onChange={() => setAIModelTier('basic')}
                            disabled={downloadStatus.currentState === downloadStates.DOWNLOADING}
                        ></input>
                        <label htmlFor={'basicModel'}>Basic</label>

                        <input
                            id="standardModel"
                            name="aiModelSelector"
                            type="radio"
                            checked={selectedModelTier === 'standard'}
                            onChange={() => setAIModelTier('standard')}
                            disabled={downloadStatus.currentState === downloadStates.DOWNLOADING}
                        ></input>
                        <label htmlFor="standardModel">Standard</label>

                        <input
                            id="advancedModel"
                            name="aiModelSelector"
                            type="radio"
                            checked={selectedModelTier === 'advanced'}
                            onChange={() => setAIModelTier('advanced')}
                            disabled={downloadStatus.currentState === downloadStates.DOWNLOADING}
                        ></input>
                        <label htmlFor="advancedModel">Advanced</label>
                    </div>
                    {AIModelsStatus === 'UNAVAILABLE' && (
                        <div>
                            <p>AI models are not shipped with this application. You need to download them to use them.</p>
                            {downloadStatus.progressMessage && (
                                <p>
                                    <strong>{downloadStatus.progressMessage}</strong>
                                </p>
                            )}
                            {downloadStatus.currentState === downloadStates.IDLE && (
                                <Button onClick={() => downloadAIModels()}>Download {selectedModelTier} models</Button>
                            )}

                            {downloadStatus.currentState === downloadStates.DOWNLOADING && !downloadStatus.isDownloadingViaChrome && (
                                <Button onClick={() => pauseDownload()}>Pause downloading</Button>
                            )}
                            {downloadStatus.currentState === downloadStates.PAUSED && (
                                <Button onClick={() => resumeDownload()}>Resume downloading</Button>
                            )}
                            {downloadStatus.currentState === downloadStates.DOWNLOADING && (
                                <Button onClick={() => cancelDownload()}>Cancel download</Button>
                            )}
                            {downloadStatus.currentState === downloadStates.ERROR && (
                                <>
                                    <p className="selectableText">
                                        <strong>Error:</strong> {downloadStatus.note || downloadStatus.errorMessage}
                                    </p>
                                    <Button onClick={() => importModelsFromLocalPath()}>Import models</Button>
                                </>
                            )}
                        </div>
                    )}

                    <p className="secondaryInfo mt15">
                        <strong>Notes: </strong>
                        1. Basic and standard models are suitable for most users. Check system requirements and capabilities on help docs.
                        {downloadStatus.currentState === downloadStates.DOWNLOADING && downloadStatus.isDownloadingViaChrome && (
                            <>
                                <br />
                                2. Downloaing via chromium engine. Pause button will not be available in this mode of downloading.
                            </>
                        )}
                    </p>

                    {AIModelsStatus === 'AVAILABLE' && (
                        <>
                            <div className={formStyles.formControlWrapper}>
                                <Button onClick={() => deleteAIModels()}>Delete AI models</Button>
                            </div>

                            <div className={formStyles.formSection}>
                                <h3>Batch process all media for AI metadata generation</h3>

                                {batchDescGenProcessStatus.currentState !== batchProcessStates.IDLE && (
                                    <p>
                                        <strong>{batchDescGenProcessStatus.progressMessage}</strong>
                                    </p>
                                )}

                                {batchDescGenProcessStatus.currentState !== batchProcessStates.STOPPING && (
                                    <div className={formStyles.formInputWrapper}>
                                        {(batchDescGenProcessStatus.currentState === batchProcessStates.IDLE ||
                                            batchDescGenProcessStatus.currentState === batchProcessStates.STOPPED ||
                                            batchDescGenProcessStatus.currentState === batchProcessStates.COMPLETE ||
                                            batchDescGenProcessStatus.currentState === batchProcessStates.ERROR) && (
                                            <Button onClick={() => startBatchMediaMetaDataGeneration()}>Start</Button>
                                        )}

                                        {batchDescGenProcessStatus.currentState === batchProcessStates.PROCESSING && (
                                            <Button onClick={() => stopBatchMediaMetaDataGeneration()}>Stop</Button>
                                        )}
                                    </div>
                                )}
                                <p className="secondaryInfo mt15">
                                    <strong>Notes: </strong>This process may take few seconds/minutes for each video depending on media size
                                    and your system configuration. Be patient and avoid closing this application in between.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AISettings;
