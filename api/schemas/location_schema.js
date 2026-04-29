const validateLocation = (data) => {
    const errors = [];

    if (!data.name || typeof data.name !== 'string') {
        errors.push('Name is required and must be a string');
    }

    if (typeof data.lat !== 'number' || data.lat < -90 || data.lat > 90) {
        errors.push('Latitude must be a number between -90 and 90');
    }

    if (typeof data.lng !== 'number' || data.lng < -180 || data.lng > 180) {
        errors.push('Longitude must be a number between -180 and 180');
    }

    if (!data.type || !['visited', 'wishlist'].includes(data.type)) {
        errors.push('Type must be either "visited" or "wishlist"');
    }

    if (errors.length > 0) {
        throw new Error(errors.join(', '));
    }

    return true;
};

module.exports = { validateLocation };