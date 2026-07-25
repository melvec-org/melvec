import React, { useState } from 'react';
import Button from '__components/core-components/button/Button';
import style from '../Settings.css';
import formStyles from '__styles/forms.css';
import { useApplicationContext } from '../../../contexts/app.context';
import rendererEvents from '__events/rendererEvents';
import WatchFolders from './WatchFolders';
import { HeaderControlBar, HeaderControlBarLeft } from '__components/core-components/header-control-bar/HeaderControlBar';
import InputComboBox from '__components/core-components/input-combo-box/InputComboBox';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';

import ipcChannels from '__constants/ipcChannels';

const GeneralSettings = () => {
    const [stateContext] = useApplicationContext();
    const [pendingPath, setPendingPath] = useState(null);

    const onLibrarySelect = () => {
        window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, { event: rendererEvents.OPEN_ROOT_LIBRARY_SELECTOR });
    };

    const onRecentPathSelect = (path) => {
        setPendingPath(path);
    };

    const onConfirmSwitch = () => {
        window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, {
            event: rendererEvents.SELECT_LIBRARY_PATH,
            selectedPath: pendingPath,
        });
        setPendingPath(null);
    };

    const recentPathOptions = (stateContext?.userPreferences?.lastUsedLibraryPaths ?? []).map((p) => ({
        label: p,
        value: p,
    }));

    return (
        <div>
            <Modal isOpen={!!pendingPath} onClose={() => setPendingPath(null)}>
                <p>Switch library to:</p>
                <p>
                    <strong>{pendingPath}</strong>
                </p>
                <ModalActionFooter>
                    <Button onClick={() => setPendingPath(null)}>Cancel</Button>
                    <Button type="primaryBtn" onClick={onConfirmSwitch}>
                        Switch
                    </Button>
                </ModalActionFooter>
            </Modal>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3>General Settings</h3>
                </HeaderControlBarLeft>
            </HeaderControlBar>
            <div className={formStyles.formInputWrapper}>
                <label htmlFor="library-root-path" className={formStyles.formInputLabel}>
                    Select video library folder
                </label>
                <InputComboBox
                    id="library-root-path"
                    value={stateContext?.userPreferences?.libraryRootPath ?? ''}
                    options={recentPathOptions}
                    placeholder="Choose your library root folder"
                    emptyText="No recently used paths"
                    inputClassName={style.formInputDisabledSelection}
                    onSelect={onRecentPathSelect}
                />
                <Button onClick={onLibrarySelect}>Select library folder</Button>
            </div>
            <div className={formStyles.formInputWrapper}>
                <WatchFolders />
            </div>
            <div className={`${style.settingsFooterActions} ${style.settingsFooterActionsApart}`}>
                <p className="">
                    <strong>Note:</strong> Watch folders are not library folders. Choose these folders from which you would like to import
                    videos/images.
                </p>
            </div>
        </div>
    );
};
export default GeneralSettings;
