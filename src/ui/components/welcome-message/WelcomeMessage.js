import React from 'react';
import style from './WelcomeMessage.css';
import Button from '__components/core-components/button/Button';
import Modal from '__components/core-components/modal/Modal';
import formStyles from '__styles/forms.css';
import rendererEvents from '__events/rendererEvents';
import ipcChannels from '__constants/ipcChannels';

const WelcomeMessage = () => {
    const openLibraryRoot = () => {
        window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, { event: rendererEvents.OPEN_ROOT_LIBRARY_SELECTOR });
    };

    return (
        <Modal isOpen={true}>
            <div className={style.welcomeMessage}>
                <div className="logo">
                    <span className={style.splashlogo}></span>
                </div>
                <h1>Welcome to Melvec</h1>
                <div className={style.message}>
                    <p className="mt15">
                        To get started you need to open a folder which you want to set as the library root. Melvec will scan all the mp4
                        files within it to setup your library.
                    </p>
                </div>
                <div className={formStyles.formActionFooter}>
                    <Button type="primaryBtn" onClick={() => openLibraryRoot()}>
                        Click to select library root
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default WelcomeMessage;
