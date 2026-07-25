import Button from '__components/core-components/button/Button';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';
import React, { useEffect, useState } from 'react';
import formStyles from '__styles/forms.css';
import useCollectionActions from '../../actions/useCollectionActions';
import ErrorMessage from '__components/core-components/inline-message/ErrorMessage';
import validateNewCollectionName from '__utils/validateNewCollectionName';
import responseStatus from '__constants/responseStatus';

const generateYearsSelectionRange = () => {
    const currentYear = new Date().getFullYear();
    const lastIndexYear = currentYear - 50;
    const yearArr = [];
    for (let i = currentYear; i > lastIndexYear; i--) {
        yearArr.push(i);
    }
    return yearArr;
};

const yearsSelectionRange = generateYearsSelectionRange();

const AddNewCollectionForm = ({ onCollectionAdd, onCancel, existingCollections = [] }) => {
    const [collectionName, setCollectionName] = useState('');
    const [selectedYear, setSelectedYear] = useState(yearsSelectionRange[0]);
    const [validationError, setValidationError] = useState('');
    const [isHidden, setIsHidden] = useState(false);

    const { addNewCollection, addCollectionResponse } = useCollectionActions();

    const inputRef = React.useRef(null);

    const getValidationStatus = (value = collectionName, year = selectedYear) => {
        return validateNewCollectionName(value, existingCollections, {
            selectedYear: year,
        });
    };

    const saveCollection = () => {
        const validationStatus = getValidationStatus();

        if (!validationStatus.isValid) {
            setValidationError(validationStatus.error);
            return;
        }

        setValidationError('');
        addNewCollection(selectedYear, collectionName.trim(), isHidden);
    };

    const onCollectionInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            saveCollection();
        }
    };

    const onInputChange = (value) => {
        setCollectionName(value);

        const trimmedCollectionName = value.trim();

        if (trimmedCollectionName.length === 0) {
            setValidationError('');
            return;
        }

        const validationStatus = getValidationStatus(value, selectedYear);
        setValidationError(validationStatus.isValid ? '' : validationStatus.error);
    };

    const onYearChange = (value) => {
        setSelectedYear(parseInt(value, 10));

        if (collectionName.trim().length === 0) {
            return;
        }

        const validationStatus = getValidationStatus(collectionName, value);
        setValidationError(validationStatus.isValid ? '' : validationStatus.error);
    };

    const cancelSelection = () => {
        setCollectionName('');
        onCancel();
    };

    useEffect(() => {
        setTimeout(() => {
            inputRef.current?.focus();
        });
    }, []);

    useEffect(() => {
        if (addCollectionResponse?.status === responseStatus.SUCCESS) {
            setCollectionName('');
            onCollectionAdd();
        }
    }, [addCollectionResponse]);

    return (
        <>
            <h3>Add a new collection</h3>

            <div className="mt15">
                <p className={formStyles.formInfo}>
                    <b>Note:</b> All collections are organized by year. This helps in organizing in the filesystem.
                    <br /> System would pick current year by default.
                </p>
                <div className={formStyles.formInputWrapper}>
                    <select className={formStyles.formSelectBox} onChange={(e) => onYearChange(e.target.value)} defaultValue={selectedYear}>
                        {yearsSelectionRange.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={collectionName}
                        placeholder="Enter collection name"
                        minLength={1}
                        maxLength={50}
                        spellCheck={true}
                        ref={inputRef}
                        pattern="[a-zA-Z0-9]+"
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={(e) => onCollectionInputKeyDown(e)}
                        className={formStyles.formTextInputLarge}
                        required={true}
                    />

                    <div className={formStyles.formValidationMessage}>
                        {validationError ? <ErrorMessage msg={validationError} /> : null}
                    </div>
                </div>

                <div className={formStyles.formInputWrapper}>
                    <input
                        type="checkbox"
                        id="isHiddenNewCollection"
                        className={formStyles.formInputCheckBox}
                        checked={isHidden}
                        onChange={() => setIsHidden(!isHidden)}
                    />
                    <label htmlFor="isHiddenNewCollection">Mark this as hidden collection</label>
                </div>

                <ModalActionFooter>
                    <Button
                        onClick={() => {
                            cancelSelection();
                        }}
                    >
                        Cancel
                    </Button>
                    <Button type="primaryBtn" onClick={() => saveCollection()}>
                        Add new collection
                    </Button>
                </ModalActionFooter>
            </div>
        </>
    );
};

const AddNewCollection = ({ showEditor = true, onCollectionAdd }) => {
    const [isEditorOpen, setIsEditorOpen] = useState(showEditor);

    useEffect(() => {
        setIsEditorOpen(showEditor);
    }, [showEditor]);

    const closeEditor = () => {
        setIsEditorOpen(false);
        onCollectionAdd(null);
    };

    return (
        <>
            {isEditorOpen && (
                <Modal isOpen={isEditorOpen} onClose={() => closeEditor()} modifierClasses="regModal">
                    <AddNewCollectionForm onCollectionAdd={onCollectionAdd} onCancel={closeEditor}></AddNewCollectionForm>
                </Modal>
            )}
        </>
    );
};

export default AddNewCollection;
