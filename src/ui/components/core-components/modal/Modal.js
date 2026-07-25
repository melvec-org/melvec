import React, { Children, useEffect } from 'react';
import { useRef, useState } from 'react';
import ModalStyles from './Modal.css';

export const ModalActionFooter = ({ children }) => {
    return <div className={ModalStyles.modalActionFooter}>{children}</div>;
};

const Modal = ({ isOpen, onClose, children, modifierClasses = '', keyboardClose = true }) => {
    const [isModalOpen, setModalOpen] = useState(isOpen);
    const modalRef = useRef(null);

    useEffect(() => {
        setModalOpen(isOpen);
    }, [isOpen]);

    useEffect(() => {
        const modalElement = modalRef.current;
        if (modalElement) {
            if (isModalOpen) {
                modalElement.showModal();
            } else {
                modalElement.close();
            }
        }
    }, [isModalOpen]);

    const handleCloseModal = () => {
        if (onClose) {
            onClose();
        }
        setModalOpen(false);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape' && keyboardClose) {
            handleCloseModal();
        }
    };

    return (
        <dialog
            ref={modalRef}
            className={`${modifierClasses}`}
            onKeyDown={handleKeyDown}
            onClose={() => handleCloseModal()}
        >
            {children}
        </dialog>
    );
};

export default Modal;
