const formatLocation = (location = {}) => {
    const parts = [location.name, location.city, location.admin, location.state, location.country]
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim());

    return [...new Map(parts.map((value) => [value.toLowerCase(), value])).values()].join(', ');
};

module.exports = {
    formatLocation,
};
