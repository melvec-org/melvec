import React, { useState } from 'react';
import { HeaderControlBar, HeaderControlBarLeft } from '__components/core-components/header-control-bar/HeaderControlBar';
import AsyncButton from '__components/core-components/button/AsyncButton';
import Button from '__components/core-components/button/Button';
import formStyles from '__styles/forms.css';

import AISettings from './AISettings';
import responseStatus from '__constants/responseStatus';

const searchHistoyButtonStateLabels = {
    default: 'Clear search history',
    progress: 'Clearing search history...',
    success: 'Search history cleared',
    error: 'Error!!! Try again',
};

const reIndexingButtonStateLabels = {
    default: 'Reindex all data',
    progress: 'Reindexing all data...',
    success: 'Data reindexed',
    error: 'Error!!! Try again',
};

const clearActionHistoryLabels = {
    default: 'Clear all action history',
    progress: 'Clearing all action history...',
    success: 'Action history cleared',
    error: 'Error!!! Try again',
};

const clearAllLogsStateLabels = {
    default: 'Clear all logs',
    progress: 'Clearing all logs...',
    success: 'Logs cleared',
    error: 'Error!!! Try again',
};

const AdvancedSettings = () => {
    const [clearSearchHistoryStatus, setClearSearchHistoryStatus] = useState(false);
    const [searchHistoryActionState, setSearchHistoryActionState] = useState('default');

    const [reIndexingActionState, setReIndexingActionState] = useState('default');
    const [clearActionHistoryState, setClearActionHistoryState] = useState('default');

    const [clearAllLogsState, setClearAllLogsState] = useState('default');

    const [systemReport, setSystemReport] = useState(null);

    const reIndexAll = () => {
        if (
            window.confirm(
                'This would re-index all the videos, which could take a long time depending on the number of videos. This action can not be undone. Are you sure you want to proceed?',
            )
        ) {
            setReIndexingActionState('progress');
            window.api.reIndexAllData().then((response) => {
                if (response.status === 'sucesss') {
                    setReIndexingActionState(responseStatus.SUCCESS);
                }
            });
        }
    };

    const clearSearchHistory = () => {
        if (window.confirm('Are you sure? All of your search history will be deleted.')) {
            window.api.clearSearchHistory().then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    setClearSearchHistoryStatus(true);
                    setSearchHistoryActionState('default');
                }
            });
            setSearchHistoryActionState('progress');
        }
    };

    const clearActionHistory = () => {
        if (window.confirm('Are you sure? All of your action history will be deleted.')) {
            setClearActionHistoryState('progress');
            window.api.clearAllActionHistory().then((data) => {
                if (data.status === responseStatus.SUCCESS) {
                    setClearActionHistoryState(responseStatus.SUCCESS);
                }
            });
        }
    };

    const clearAllLogs = () => {
        if (window.confirm('Are you sure? All of your logs will be deleted.')) {
            setClearAllLogsState('progress');
            window.api.clearAllLogs().then((data) => {
                if (data.status === responseStatus.SUCCESS) {
                    setClearAllLogsState(responseStatus.SUCCESS);
                } else {
                    setClearAllLogsState('default');
                    alert(data.message);
                }
            });
        }
    };

    const generateSystemReport = () => {
        window.api.getSystemReport().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setSystemReport(response);
            } else {
                alert('Failed to generate system report.', response.message);
            }
        });
    };

    const resetPreferences = () => {
        if (window.confirm('Caution: This will reset all your preferences and settings. Are you sure you want to proceed?')) {
            window.api.resetPreferencesAndSetttings().then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    alert('Preferences and settings reset successful.');
                }
            });
        }
    };

    const setAIModelTier = (tier) => {
        window.api.getUserPreference('ai').then((aiConfig) => {
            if (aiConfig && aiConfig.modelTier !== tier) {
                aiConfig.modelTier = tier;
                window.api.setUserPreference('ai', aiConfig).then(() => {
                    alert('AI model tier updated successfully.');
                });
            }
        });
    };

    return (
        <div>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3>Indexing and search</h3>
                </HeaderControlBarLeft>
            </HeaderControlBar>
            <div>
                <div className={formStyles.formInputWrapper}>
                    <AsyncButton
                        state={reIndexingActionState}
                        labels={reIndexingButtonStateLabels}
                        onClick={() => reIndexAll()}
                        onReset={() => setReIndexingActionState('default')}
                    />
                    <p>
                        <strong>Note:</strong> Re Indexing all data can take a long time depending on the number of videos.
                    </p>
                </div>
                <div className={formStyles.formInputWrapper}>
                    <AsyncButton
                        state={searchHistoryActionState}
                        labels={searchHistoyButtonStateLabels}
                        onClick={() => clearSearchHistory()}
                        onReset={() => setSearchHistoryActionState('default')}
                    />
                    {clearSearchHistoryStatus && <div className="mt15"> Search history cleared successfully. </div>}
                    <p>
                        <strong>Note:</strong> Clearing search history will not delete your search history. It will only clear it from the
                        application's memory.
                    </p>
                </div>
            </div>
            <div className={formStyles.formSection}>
                <HeaderControlBar>
                    <HeaderControlBarLeft>
                        <h3>Action history</h3>
                    </HeaderControlBarLeft>
                </HeaderControlBar>
                <div>
                    <div className={formStyles.formInputWrapper}>
                        <AsyncButton
                            state={clearActionHistoryState}
                            labels={clearActionHistoryLabels}
                            onClick={() => clearActionHistory()}
                            onReset={() => setClearActionHistoryState('default')}
                        />
                        <p>
                            <strong>Note:</strong>Remove watch history, last used tags, playlists, searched videos
                        </p>
                    </div>
                    <div className={formStyles.formInputWrapper}>
                        <AsyncButton
                            state={clearAllLogsState}
                            labels={clearAllLogsStateLabels}
                            onClick={() => clearAllLogs()}
                            onReset={() => setClearAllLogsState('default')}
                        />
                        <p>
                            <strong>Note:</strong> Clearing logs will clear all logs which are logged during any errors.
                        </p>
                    </div>
                </div>
            </div>

            <AISettings />

            <div className={formStyles.formSection}>
                <h3>Preferences & application settings</h3>

                <div className={formStyles.formInputWrapper}>
                    <Button onClick={() => resetPreferences()}>Reset preferences and settings</Button>
                    <p className="secondaryInfo">
                        <strong>Note:</strong>This would reset all library level settings, and system level preferences.
                    </p>
                </div>
            </div>

            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3>Report</h3>
                </HeaderControlBarLeft>
            </HeaderControlBar>
            <div>
                {!systemReport && <Button onClick={() => generateSystemReport()}>View system report</Button>}
                {systemReport && (
                    <dl>
                        <dt>Total Videos</dt>
                        <dd>{systemReport.totalVideos}</dd>
                        <dt>Total Playlists</dt>
                        <dd>{systemReport.totalPlaylists}</dd>
                        <dt>Total Tags</dt>
                        <dd>{systemReport.totalTags}</dd>
                        <dt>Total Collections</dt>
                        <dd>{systemReport.totalCollections}</dd>
                        <dt>Total Memory</dt>
                        <dd>{systemReport.totalMemoryUsage}</dd>
                        <dt>Library Size</dt>
                        <dd>{systemReport.librarySize}</dd>
                    </dl>
                )}
            </div>
        </div>
    );
};

export default AdvancedSettings;
