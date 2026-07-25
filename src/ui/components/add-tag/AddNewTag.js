import AddTagForm from '__components/add-tag/AddTagForm';
import Modal from '__components/core-components/modal/Modal';
import { useApplicationContext } from '__contexts/app.context';
import React, { useEffect, useState } from 'react';

const AddNewTag = ({ showEditor = true, onTagAdd, onCancel }) => {
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [stateContext] = useApplicationContext();

    useEffect(() => {
        setIsEditorOpen(showEditor);
    }, [showEditor]);

    const closeEditor = () => {
        setIsEditorOpen(false);
        onTagAdd(null);
        onCancel();
    };

    return (
        <div>
            {isEditorOpen && (
                <Modal isOpen={isEditorOpen} onClose={() => closeEditor()}>
                    <AddTagForm tags={stateContext.tags} onCancel={closeEditor}></AddTagForm>
                </Modal>
            )}
        </div>
    );
};

export default AddNewTag;
