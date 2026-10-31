import Button from '__components/core-components/button/Button';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';
import TagChip from '__components/editable-tag-list/TagChip';
import React, { useEffect, useState } from 'react';
import Subject from './Subject';
import style from './EditableSubjects.css';
import useEditableSubjects from './useEditableSubjects';

const SubjectsEditForm = ({ mediaId, mediaType, subjects = [], onCancel, onSubjectsChange }) => {
    const { deleteSubject, onSubjectNameChange, extractSubjects, isExtractingSubjects } = useEditableSubjects(
        subjects,
        mediaId,
        mediaType,
        onSubjectsChange,
    );

    return (
        <div>
            <h3>Subjects</h3>
            {subjects.length > 0 ? (
                <div className={style.subjectList}>
                    {subjects.map((subject) => (
                        <Subject
                            key={subject.id}
                            subject={subject}
                            onSubjectNameChange={onSubjectNameChange}
                            onSubjectDelete={deleteSubject}
                        />
                    ))}
                </div>
            ) : (
                <div>No subjects found.</div>
            )}
            <ModalActionFooter>
                <Button onClick={() => extractSubjects()} disabled={isExtractingSubjects}>
                    {isExtractingSubjects ? 'Finding faces / subjects...' : 'Find faces / subjects again'}
                </Button>
                <Button onClick={() => onCancel()}>Close</Button>
            </ModalActionFooter>
        </div>
    );
};

const EditableSubjects = ({ mediaId, subjects = [], onSubjectNameChange, mediaType, onEditComplete }) => {
    const [isSubjectsEditorOpen, setIsSubjectsEditorOpen] = useState(false);
    const [editableSubjects, setEditableSubjects] = useState(subjects);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setEditableSubjects(subjects);
        setHasChanges(false);
    }, [subjects, mediaId]);

    const openSubjectsEditor = () => {
        setIsSubjectsEditorOpen(true);
    };

    const closeSubjectsEditor = () => {
        setIsSubjectsEditorOpen(false);

        if (hasChanges && typeof onEditComplete === 'function') {
            onEditComplete();
        }

        setHasChanges(false);
    };

    const onSubjectsChange = (updatedSubjects) => {
        setEditableSubjects(updatedSubjects);
        setHasChanges(true);
    };

    return (
        <>
            <div className="" title="Click to view subjects" onClick={() => openSubjectsEditor()} tabIndex={0}>
                {editableSubjects
                    .filter((item) => item.name !== '')
                    .map((item) => {
                        return <TagChip key={item.id} label={item.name} />;
                    })}
                <Button type="transparentBtn" onClick={() => openSubjectsEditor()} title="Click to manage subjects">
                    Manage
                </Button>
            </div>
            {isSubjectsEditorOpen && (
                <Modal isOpen={isSubjectsEditorOpen} onClose={closeSubjectsEditor} modifierClasses={'regModal'}>
                    <SubjectsEditForm
                        mediaId={mediaId}
                        subjects={editableSubjects}
                        onSubjectsChange={onSubjectsChange}
                        mediaType={mediaType}
                        onCancel={closeSubjectsEditor}
                    />
                </Modal>
            )}
        </>
    );
};

export default EditableSubjects;
