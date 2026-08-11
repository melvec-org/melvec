function startOfYear(year) {
    return new Date(year, 0, 1, 0, 0, 0, 0).getTime();
}

function endOfYear(year) {
    return new Date(year, 11, 31, 23, 59, 59, 999).getTime();
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
}

function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
}

module.exports = {
    startOfYear,
    endOfYear,
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
};
