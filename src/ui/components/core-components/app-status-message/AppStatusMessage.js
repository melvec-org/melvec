import React, { useEffect, useState } from 'react';
import style from './AppStatusMessage.css';
import { useApplicationContext } from '__contexts/app.context';
/**
 * component that shows message when there is a message to display
 * This component makes use of context api to read the message.
 * If there is no message, it does not display anything.
 */

const AppStatusMessage = () => {
    const [stateContext] = useApplicationContext();

    const [showMessage, setShowMessage] = useState(false);

    useEffect(() => {
        if (stateContext.appStatus.message && stateContext.appStatus.messageAutoHide === false) {
            setShowMessage(true);
        } else if (stateContext.appStatus.message && stateContext.appStatus.messageAutoHide === true) {
            setShowMessage(true);
            setTimeout(() => setShowMessage(false), 3000); // Example: Hide the message after 3 seconds.  // You can customize the timeout duration as needed.  // You can also add a condition to hide the message after a specific event, like clicking a button.  // This will depend on how your application handles message display and disappearance.  // You can also add a condition to hide the message only when the app status is frozen.  // This will depend on
        }

        return () => setShowMessage(false);
    }, [stateContext.appStatus.messageAutoHide, stateContext.appStatus.message]);

    if (showMessage) {
        return <div className={style.appStatusMessage}>{stateContext.appStatus.message}</div>;
    } else {
        return null; // Don't render the component if there is no message.  // This is an example. You can customize the behavior as needed.  // You can also add a condition to show the component only when there is a specific message type.  // For example, only show the component if the message type is 'error'.  // This will depend on how your application handles different types of messages.  // You can also add a button to clear the message, if needed.  // You can also add a timeout mechanism to automatically hide the message after a certain amount of time.  // This will depend on how your application handles message display and disappearance.  // You can also add a condition to show the component only when the app status is frozen.  // This will depend on how your application handles app freezing.  // You can also add a condition to show the component only when the app status is in a specific state.  // This will depend on how
    }
};

export default AppStatusMessage;
