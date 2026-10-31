import React, { useState } from 'react';
import style from './Subjects.css';
import IconButton from '__components/core-components/icon-button/IconButton';

const Subject = ({ subject, onSubjectNameChange, onSubjectDelete }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const subjectName = subject.name !== '' ? subject.name : 'Name this face';

    const startNameEdit = () => {
        setNameValue(subjectName);
        setIsEditingName(true);
    };

    const saveName = () => {
        const trimmedName = nameValue.trim();

        if (trimmedName && trimmedName !== subjectName && typeof onSubjectNameChange === 'function') {
            onSubjectNameChange(subject, trimmedName);
        }

        setIsEditingName(false);
        setNameValue('');
    };

    const cancelNameEdit = () => {
        setIsEditingName(false);
        setNameValue('');
    };

    const onNameInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        }

        if (event.key === 'Escape') {
            cancelNameEdit();
        }
    };

    const deleteSubject = () => {
        if (!window.confirm('Are you sure you want to delete this subject?')) {
            return;
        }

        if (typeof onSubjectDelete === 'function') {
            onSubjectDelete(subject, subject.face.id);
        }
    };

    return (
        <div className={style.subjectFace}>
            <div className={style.subjectFaceImageWrapper}>
                <img
                    src={subject.face.imagePath}
                    alt={subject.id}
                    title={`${subject.id} - ${subject.status || 'unknown'}`}
                    className={style.subjectFaceImage}
                />
                <div className={style.subjectFaceDeleteControl}>
                    <IconButton
                        icon="close"
                        _classes={style.subjectFaceDeleteButton}
                        onClick={deleteSubject}
                        title="Delete subject"
                        aria-label="Delete subject"
                    />
                </div>
            </div>

            {isEditingName ? (
                <div className={style.subjectFaceNameEditor}>
                    <input
                        type="text"
                        value={nameValue}
                        placeholder="Name this face"
                        className={style.subjectFaceNameInput}
                        onChange={(event) => setNameValue(event.target.value)}
                        onKeyDown={onNameInputKeyDown}
                        autoFocus={true}
                    />
                    <div className={style.subjectFaceNameActions}>
                        <IconButton
                            icon="check"
                            _classes={style.subjectFaceNameActionButton}
                            onClick={saveName}
                            title="Save name"
                            aria-label="Save name"
                        />
                        <IconButton
                            icon="close"
                            _classes={style.subjectFaceNameActionButton}
                            onClick={cancelNameEdit}
                            title="Cancel name edit"
                            aria-label="Cancel name edit"
                        />
                    </div>
                </div>
            ) : (
                <button type="button" className={style.subjectFaceName} onClick={startNameEdit} title="Click to edit name">
                    {subjectName !== '' ? subjectName : 'Name this face'}
                </button>
            )}
        </div>
    );
};

export default Subject;
