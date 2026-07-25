import React, { useEffect, useContext, useCallback } from 'react';

const AppNotificationContext = React.createContext();
export const appNotificationRef = { current: null };

export default function AppNotificationProvider({ children }) {
    const [notification, setNotification] = React.useState('');

    const showNotification = useCallback((type, message, cancelable = false) => {
        if (type === 'info' || type === 'error' || type === 'progress') {
            setNotification({ type, message, cancelable });
        }
    }, []);

    //    const contextValue = useMemo(() => ({ notification, showNotification }), [notification]);

    useEffect(() => {
        appNotificationRef.current = { showNotification };
        return () => {
            appNotificationRef.current = null;
        };
    }, [showNotification]);

    return <AppNotificationContext.Provider value={{ notification }}>{children}</AppNotificationContext.Provider>;
}

export const useAppNotificationContext = () => useContext(AppNotificationContext);

// exposed global function
export const showGlobalNotification = (message, cancelable = false) => {
    const ref = appNotificationRef.current;
    if (ref && typeof ref.showNotification === 'function') {
        ref.showNotification('info', message, cancelable);
    } else {
        console.warn('AppNotificationProvider not mounted yet:', message);
    }
};

export const showGlobalError = (message, cancelable = true) => {
    const ref = appNotificationRef.current;
    if (ref && typeof ref.showNotification === 'function') {
        ref.showNotification('error', message, cancelable);
    } else {
        console.error('AppNotificationProvider not mounted yet:', message);
    }
};
