import React, { useState, useEffect } from 'react';
import formStyles from '__styles/forms.css';
import { useApplicationContext } from '../../../contexts/app.context';
import applicationEvents from '__events/applicationEvents';
import { HeaderControlBar, HeaderControlBarLeft } from '__components/core-components/header-control-bar/HeaderControlBar';
import Button from '__components/core-components/button/Button';
import useVideoPreviewActions from './useVideoPreviewActions';
import batchProcessStates from '__constants/batchProcessStates';
import responseStatus from '__constants/responseStatus';

const DisplaySettings = () => {
    const [stateContext, dispatchContext] = useApplicationContext();

    const onVideoPreviewToggle = (checked) => {
        window.api.setUserPreference('showVideoPreviewOnHover', checked).then((updatedPreferences) => {
            dispatchContext({
                type: applicationEvents.USER_PREFERENCE_UPDATE,
                payload: {
                    userPreferences: updatedPreferences,
                },
            });
        });
    };

    const onNsfwToggle = (checked) => {
        window.api.setUserPreference('hideNsfwContent', checked).then((updatedPreferences) => {
            dispatchContext({
                type: applicationEvents.USER_PREFERENCE_UPDATE,
                payload: {
                    userPreferences: updatedPreferences,
                },
            });
        });
    };

    const onThemeChange = (selectedTheme) => {
        window.api.applyTheme(selectedTheme).then((updatedPreferences) => {
            dispatchContext({
                type: applicationEvents.USER_PREFERENCE_UPDATE,
                payload: { userPreferences: updatedPreferences },
            });
        });
    };

    const currentTheme = stateContext?.userPreferences?.theme ?? 'system';

    const { batchPreviewStatus, isProcessing, startBatchPreviewGeneration, stopBatchPreviewGeneration } = useVideoPreviewActions();
    const [pendingPreviewCount, setPendingPreviewCount] = useState(null);

    const showVideoPreviewOnHover = Boolean(stateContext?.userPreferences?.showVideoPreviewOnHover);

    useEffect(() => {
        if (!showVideoPreviewOnHover) {
            setPendingPreviewCount(null);
            return;
        }
        window.api.getPendingVideoPreviewCount().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setPendingPreviewCount(response.data.count);
            }
        });
    }, [showVideoPreviewOnHover]);

    const onClearPreviews = () => {
        if (!window.confirm('This will delete all generated previews and reset preview status. Continue?')) return;
        window.api.clearAllVideoPreviews().then((response) => {
            if (response.status !== responseStatus.SUCCESS) alert(response.message);
        });
    };

    return (
        <div>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3>Display Settings</h3>
                </HeaderControlBarLeft>
            </HeaderControlBar>
            <div className={formStyles.formInputWrapper}>
                <h4 className={formStyles.formInputLabel}>Theme</h4>
                <fieldset className={formStyles.formRadioGroup}>
                    <input
                        id="themeSelectSystem"
                        type="radio"
                        name="themeSelect"
                        value="system"
                        checked={currentTheme === 'system'}
                        onChange={() => onThemeChange('system')}
                    />
                    <label htmlFor="themeSelectSystem" className={formStyles.formRadioText}>
                        System
                    </label>

                    <input
                        id="themeSelectLight"
                        type="radio"
                        name="themeSelect"
                        value="light"
                        checked={currentTheme === 'light'}
                        onChange={() => onThemeChange('light')}
                    />
                    <label htmlFor="themeSelectLight" className={formStyles.formRadioText}>
                        Light
                    </label>

                    <input
                        id="themeSelectDark"
                        type="radio"
                        name="themeSelect"
                        value="dark"
                        checked={currentTheme === 'dark'}
                        onChange={() => onThemeChange('dark')}
                    />
                    <label htmlFor="themeSelectDark" className={formStyles.formRadioText}>
                        Dark
                    </label>
                </fieldset>
            </div>
            <div className={formStyles.formSection}>
                <h4 className="mt10">NSFW</h4>
                <div className={formStyles.formInputWrapper}>
                    <div className={formStyles.formSwitch}>
                        <input
                            type="checkbox"
                            checked={Boolean(stateContext?.userPreferences?.hideNsfwContent)}
                            onChange={(event) => {
                                onNsfwToggle(event.target.checked);
                            }}
                            id="hideNSFWCheckbox"
                        />
                        <label htmlFor="hideNSFWCheckbox" className={formStyles.formSwitchToggle}></label>
                        <label htmlFor="hideNSFWCheckbox" className={formStyles.formSwitchText}>
                            Hide NSFW content
                        </label>
                    </div>
                </div>
            </div>

            <hr />

            <h3 className="mt10">Video Previews</h3>

            <div className={formStyles.formInputWrapper}>
                <div className={formStyles.formSwitch}>
                    <input
                        type="checkbox"
                        checked={Boolean(stateContext?.userPreferences?.showVideoPreviewOnHover)}
                        onChange={(event) => {
                            onVideoPreviewToggle(event.target.checked);
                        }}
                        id="showVideoPreviewCheckbox"
                    />
                    <label htmlFor="showVideoPreviewCheckbox" className={formStyles.formSwitchToggle}></label>
                    <label htmlFor="showVideoPreviewCheckbox" className={formStyles.formSwitchText}>
                        Show video preview on thumbnail hover
                    </label>
                </div>
            </div>

            {pendingPreviewCount > 0 && (
                <div className={formStyles.formInputWrapper}>
                    <h4>Generate Previews</h4>
                    {pendingPreviewCount !== null && pendingPreviewCount > 0 && (
                        <p>
                            {pendingPreviewCount} video{pendingPreviewCount !== 1 ? 's' : ''} pending preview generation.
                        </p>
                    )}
                    <Button onClick={isProcessing ? stopBatchPreviewGeneration : startBatchPreviewGeneration}>
                        {isProcessing ? 'Stop generating previews' : 'Generate video previews'}
                    </Button>
                    <Button onClick={onClearPreviews} disabled={isProcessing}>
                        Clear all previews
                    </Button>
                    {batchPreviewStatus.currentState !== batchProcessStates.IDLE && <p>{batchPreviewStatus.progressMessage}</p>}
                </div>
            )}
        </div>
    );
};

export default DisplaySettings;
