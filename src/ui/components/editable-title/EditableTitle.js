import Button from '__components/core-components/button/Button';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';
import applicationMenuEvents from '__events/applicationMenuEvents';
import { registerAccKeyListener, unregisterAccKeyListener } from '__utils/acceleratorKeysListenerRegistry';
import React, { useEffect, useState } from 'react';
import formStyles from '__styles/forms.css';

const TitleEditForm = ({ mediaTitle, mediaId, onTitleEditDone, onCancel }) => {
    const [titleValue, setTitleValue] = useState(mediaTitle);

    const onTitleChange = (newValue) => {
        setTitleValue(newValue);
    };

    const saveTitle = () => {
        const trimmedTitle = titleValue.trim();
        if (trimmedTitle === '') {
            return;
        }

        onTitleEditDone && onTitleEditDone(trimmedTitle);
    };

    const onTitleEditCancel = () => {
        setTitleValue(mediaTitle);
        onCancel();
    };

    const onTitleInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            saveTitle();
        }
    };

    return (
        <div>
            <h3>Change the title from "{mediaTitle}"</h3>
            <div className={'mt15'}>
                <input
                    type="text"
                    value={titleValue}
                    placeholder="Type the title"
                    minLength={3}
                    maxLength={200}
                    spellCheck="true"
                    pattern="^[a-zA-Z0-9\s_]*$"
                    className={formStyles.formTextInputFullWidth}
                    required={true}
                    onChange={(e) => onTitleChange(e.target.value)}
                    onKeyDown={(e) => onTitleInputKeyDown(e)}
                />
            </div>
            <ModalActionFooter>
                <Button onClick={() => onTitleEditCancel()}>Cancel</Button>
                <span className={'ml10'}>
                    {titleValue !== mediaTitle && titleValue !== '' && titleValue !== 'Untitled' && (
                        <Button type="primaryBtn" onClick={() => saveTitle()}>
                            Change
                        </Button>
                    )}
                </span>
            </ModalActionFooter>
        </div>
    );
};

const EditableTitle = ({ mediaTitle = '', mediaId = null, onUpdate }) => {
    const [titleLabel, setTitleLabel] = useState('Untitled');
    const [isTitleEditorOpen, setIsTitleEditorOpen] = useState(false);

    useEffect(() => {
        if (mediaTitle) {
            setTitleLabel(mediaTitle || 'Untitled');
        } else {
            setTitleLabel('Untitled');
        }
    }, [mediaTitle, mediaId]);

    const onApplicationMenuCommand = () => {
        openTitleEditor();
    };

    useEffect(() => {
        registerAccKeyListener(applicationMenuEvents.EDIT_TITLE, onApplicationMenuCommand);
        return () => {
            unregisterAccKeyListener(applicationMenuEvents.EDIT_TITLE);
        };
    }, []);

    const openTitleEditor = () => {
        setIsTitleEditorOpen(true);
    };

    return (
        <>
            <div title="Click to edit this title(Cmd+D)" onClick={() => openTitleEditor()} tabIndex={0} className="textRight">
                {titleLabel}
            </div>
            {isTitleEditorOpen && (
                <Modal isOpen={isTitleEditorOpen} onClose={() => setIsTitleEditorOpen(false)} modifierClasses={'regModal'}>
                    <TitleEditForm
                        mediaTitle={titleLabel}
                        mediaId={mediaId}
                        onTitleEditDone={(title) => {
                            setTitleLabel(title);
                            onUpdate(mediaId, title);
                            setIsTitleEditorOpen(false);
                        }}
                        onCancel={() => setIsTitleEditorOpen(false)}
                    />
                </Modal>
            )}
        </>
    );
};

export default EditableTitle;
