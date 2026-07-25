import Button from '__components/core-components/button/Button';
import React, { useState } from 'react';
import useTagAction from '__actions/useTagActions';
import formStyles from '__styles/forms.css';
import getUniqueID from '../../../services/service-utils/getUniqueID.js';
import { ModalActionFooter } from '__components/core-components/modal/Modal';
import ErrorMessage from '__components/core-components/inline-message/ErrorMessage';
import validateNewTagName from '../../utils/validateNewTagName';

const AddTagForm = ({ onTagAdd, tags = [], onCancel }) => {
    const [inputValue, setInputValue] = useState('');
    const { addTag } = useTagAction();
    const [validationError, setValidationError] = useState('');

    const onAddButtonClick = () => {
        const validationStatus = validateNewTagName(inputValue, tags);

        if (validationStatus.isValid) {
            addTag({ label: inputValue.trim(), id: getUniqueID() });
            setInputValue('');
            onCancel();
        } else {
            setValidationError(validationStatus.error);
        }
    };

    const onTagInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            onAddButtonClick();
        }
    };

    return (
        <>
            <h3>Add a new tag</h3>
            <div className={formStyles.formControlWrapper}>
                <input
                    type="text"
                    className={formStyles.formTextInputLarge}
                    maxLength={80}
                    minLength={2}
                    placeholder={'Tag name'}
                    value={inputValue}
                    onKeyDown={(e) => onTagInputKeyDown(e)}
                    onChange={(e) => setInputValue(e.target.value)}
                />

                {validationError && <ErrorMessage msg={validationError} />}
                <ModalActionFooter>
                    <Button onClick={() => onCancel(null)}>Cancel</Button>
                    <Button type="primaryBtn" onClick={() => onAddButtonClick()}>
                        Add tag
                    </Button>
                </ModalActionFooter>
            </div>
        </>
    );
};

export default AddTagForm;
