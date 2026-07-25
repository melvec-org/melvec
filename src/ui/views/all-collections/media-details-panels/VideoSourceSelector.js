import Button from '__components/core-components/button/Button';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';
import React, { useState, useEffect } from 'react';

const SourceEditForm = ({ currentSource, onSourceEditDone, onCancel }) => {
    let sourceList = ['Local', 'Camera', 'YouTube', 'Downloaded', 'External'];

    const [source, setSource] = useState(currentSource);

    const onSourceChange = (newValue) => {
        setSource(newValue);
    };

    const onKeyDown = (event) => {
        if (event.key === 'Enter') {
            onSourceEditDone(source);
        }
    };

    useEffect(() => {
        // check if currentSource is in the sourceList, if not, add the currentSource to the list
        if (!sourceList.includes(currentSource)) {
            sourceList.push(currentSource);
        }
    }, [currentSource]);

    return (
        <div>
            <h3>Change the video source</h3>
            <div className={'mt15'}>
                <input
                    type="text"
                    value={source}
                    minLength={2}
                    maxLength={100}
                    required={true}
                    list="source-options"
                    pattern="^[a-zA-Z0-9\s_]*$"
                    onChange={(e) => {
                        onSourceChange(e.target.value);
                    }}
                    onKeyDown={onKeyDown}
                />
                <datalist id="source-options">
                    {sourceList.map((key) => (
                        <option key={key}>{key}</option>
                    ))}
                </datalist>
            </div>
            <ModalActionFooter>
                <Button onClick={() => onCancel(null)}>Cancel</Button>
                <Button type="primaryBtn" onClick={() => onSourceEditDone(source)}>
                    Save
                </Button>
            </ModalActionFooter>
        </div>
    );
};

const VideoSourceSelector = ({ videoId, currentSource, onSourceChange }) => {
    const [isSourceEditorOpen, setIsSourceEditorOpen] = useState(false);
    const [source, setSource] = useState(currentSource);

    const openSourceEditor = () => {
        setIsSourceEditorOpen(true);
    };

    useEffect(() => {
        if (videoId || currentSource) {
            setSource(currentSource || 'Local');
        }
    }, [videoId, currentSource]);
    return (
        <>
            <div title="Click to edit the source" onClick={() => openSourceEditor()}>
                {source}
            </div>

            {isSourceEditorOpen && (
                <Modal isOpen={isSourceEditorOpen} source={source} onClose={() => setIsSourceEditorOpen(false)}>
                    <SourceEditForm
                        videoId={videoId}
                        currentSource={source}
                        onSourceEditDone={(source) => {
                            setSource(source);
                            onSourceChange(videoId, source);
                            setIsSourceEditorOpen(false);
                        }}
                        onCancel={() => setIsSourceEditorOpen(false)}
                    />
                </Modal>
            )}
        </>
    );
};

export default VideoSourceSelector;
