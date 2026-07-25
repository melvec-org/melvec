import React, { useEffect, useState } from 'react';
import { useAppNotificationContext } from '__contexts/AppNotificationContext';
import notificationStyles from './AppNotification.css';
import IconButton from '../icon-button/IconButton';

const AppNotification = () => {
    const stateContext = useAppNotificationContext();
    const [showNotification, setShowNotification] = useState(false);

    const closeButtonRef = React.useRef(null);

    useEffect(() => {
        if (stateContext.notification.type == 'info') {
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), stateContext.notification.message.length * 75);
        } else if (stateContext.notification.type === 'error' || stateContext.notification.type === 'progress') {
            setShowNotification(true);
        } else {
            setShowNotification(false);
        }
    }, [stateContext]);

    // Focus the close button when it becomes visible
    useEffect(() => {
        if (showNotification && closeButtonRef.current) {
            const timer = setTimeout(() => {
                closeButtonRef.current?.focus();
            }, 10);

            return () => clearTimeout(timer);
        }
    }, [showNotification]);

    if (showNotification) {
        const { message, cancelable } = stateContext.notification;

        return (
            <div className={notificationStyles.notification}>
                <div className="selectableText">{message}</div>
                {cancelable && (
                    <IconButton
                        ref={closeButtonRef}
                        tabIndex={0}
                        icon="close"
                        aria-label="Close notification"
                        onClick={() => setShowNotification(false)}
                    />
                )}
            </div>
        );
    } else {
        return null;
    }
};

export default AppNotification;
