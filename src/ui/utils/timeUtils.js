// formatTime function converts to hh:mm:ss format given time given in seconds
// fineally return a string. where as input timeInSeconds may be in decimal numbers
// if decimal present in input then use floor to make it a round figure

export const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || timeInSeconds === 0) return '--';

    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} hours`;
    } else if (minutes > 0) {
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} mins`;
    } else {
        return `${seconds.toString().padStart(2, '0')} secs`;
    }
};
