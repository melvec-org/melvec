import Button from '__components/core-components/button/Button';
import Modal from '__components/core-components/modal/Modal';
import React, { useEffect, useState } from 'react';
import EditableDescriptionForm from './EditableDescriptionForm';
import { registerAccKeyListener, unregisterAccKeyListener } from '__utils/acceleratorKeysListenerRegistry';
import applicationMenuEvents from '__events/applicationMenuEvents';
import mediaTypes from '__constants/mediaTypes';
import responseStatus from '__constants/responseStatus';

const EditableDescription = ({ mediaId, mediaTitle = '', onEditComplete, mediaType = mediaTypes.VIDEO, shortDesc = '' }) => {
    const [shortDescription, setShortDescription] = useState(shortDesc);
    const [formattedShortDescription, setFormattedShortDescription] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (mediaType === mediaTypes.VIDEO && mediaId && shortDesc == '') {
            // getMetaDataDetails will come with
            // 1. Audio transcript
            // 2. Desciption
            // Right now we will deal only with description which would be generated via
            // combining audio transcript and video description.
            // we will not show the audio transcript to the user.
            window.api.getShortDescription(mediaId).then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    const description = response.data || '';
                    const formattedDescription =
                        description && !description.trim().endsWith('.') ? `${description.trim()}...` : description;

                    setShortDescription(description);
                    setFormattedShortDescription(formattedDescription);
                } else {
                    setFormattedShortDescription('');
                }
            });
        } else if (mediaType === mediaTypes.IMAGE && mediaId && shortDesc !== '') {
            const formattedDescription = shortDesc && !shortDesc.trim().endsWith('.') ? `${shortDesc.trim()}...` : shortDesc;
            setShortDescription(shortDesc);

            setFormattedShortDescription(formattedDescription);
        }
    }, [mediaId, shortDesc]);

    const onApplicationMenuCommand = () => setIsModalOpen(true);

    useEffect(() => {
        registerAccKeyListener(applicationMenuEvents.EDIT_DESCRIPTION, onApplicationMenuCommand);
        return () => {
            unregisterAccKeyListener(applicationMenuEvents.EDIT_DESCRIPTION);
        };
    }, []);

    return (
        <>
            {shortDescription !== '' && (
                <>
                    <p className="ellipys">{formattedShortDescription}</p>
                    <Button type="transparentBtn" onClick={() => setIsModalOpen(true)}>
                        Edit
                    </Button>
                </>
            )}
            {shortDescription == '' && (
                <>
                    <div>
                        <Button type="transparentBtn" onClick={() => setIsModalOpen(true)}>
                            Manage description
                        </Button>
                    </div>
                </>
            )}
            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} modifierClasses="largeModal">
                    <EditableDescriptionForm
                        mediaTitle={mediaTitle}
                        mediaId={mediaId}
                        onDescriptionEditDone={(details) => {
                            onEditComplete();
                            setIsModalOpen(false);
                        }}
                        mediaType={mediaType}
                    ></EditableDescriptionForm>
                </Modal>
            )}
        </>
    );
};

export default EditableDescription;
