import React, { useState, useEffect } from 'react';
import TagChip from './TagChip';
import Button from '../core-components/button/Button';
import Modal from '../core-components/modal/Modal';
import EditableTagListStyle from './EditableTagList.css';
import TagEditForm from './TagEditForm';
import { registerAccKeyListener, unregisterAccKeyListener } from '__utils/acceleratorKeysListenerRegistry';
import applicationMenuEvents from '__events/applicationMenuEvents';
import mediaTypes from '__constants/mediaTypes';

const EditableTagList = ({ preselectedTaglists = [], mediaId = '', mediaTitle = '', mediaType = mediaTypes.VIDEO, onEditComplete }) => {
    const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
    const [closeTagEditForm, setCloseTagEditForm] = useState(false);

    const onTagsEditDone = () => {
        onEditComplete();
        setIsTagEditorOpen(false);
    };

    const onApplicationMenuCommand = () => {
        if (!isTagEditorOpen) {
            if (preselectedTaglists.length === 0 || preselectedTaglists.length > 0) {
                setCloseTagEditForm(false);
                setIsTagEditorOpen(true);
            }
        }
    };

    useEffect(() => {
        registerAccKeyListener(applicationMenuEvents.MANGAGE_TAGS, onApplicationMenuCommand);

        return () => {
            unregisterAccKeyListener(applicationMenuEvents.MANGAGE_TAGS, onApplicationMenuCommand);
        };
    }, []);

    return (
        <>
            <div className={EditableTagListStyle.readableTagList}>
                {preselectedTaglists.length > 0 &&
                    preselectedTaglists.map((item) => {
                        return <TagChip key={item.id} label={item.label} id={item.id} />;
                    })}

                {(preselectedTaglists.length === 0 || preselectedTaglists.length > 0) && (
                    <Button
                        type="transparentBtn"
                        onClick={() => {
                            setCloseTagEditForm(false);
                            setIsTagEditorOpen(true);
                        }}
                        title="Click to manage tags(Cmd+T)"
                    >
                        Manage tags
                    </Button>
                )}
            </div>

            {isTagEditorOpen && (
                <Modal
                    isOpen={isTagEditorOpen}
                    onClose={() => {
                        setCloseTagEditForm(true);
                    }}
                    modifierClasses={EditableTagListStyle.tagsEditModal}
                >
                    <TagEditForm
                        mediaTitle={mediaTitle}
                        mediaId={mediaId}
                        onTagsEditDone={onTagsEditDone}
                        existingTags={preselectedTaglists}
                        closeTagEditForm={closeTagEditForm}
                        mediaType={mediaType}
                    />
                </Modal>
            )}
        </>
    );
};

export default EditableTagList;
