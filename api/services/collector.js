const { v4: uuid } = require('uuid');

const locations = [];

exports.getAll = async () => {
    return locations;
};

exports.add = async (location) => {
    const { name, lat, lng, type } = location;

    if (!name || !type) {
        throw new Error('Name and type are required.');
    }

    if (!['visited', 'wishlist'].includes(type)) {
        throw new Error('Type must be visited or wishlist.');
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
        throw new Error('Latitude and longitude must be numbers.');
    }

    const newLocation = {
        id: uuid(),
        name,
        lat,
        lng,
        type,
        createdAt: new Date().toISOString()
    };

    locations.push(newLocation);

    return newLocation;
};

exports.remove = async (id) => {
    const index = locations.findIndex(loc => loc.id === id);

    if (index === -1) {
        throw new Error('Location not found.');
    }

    locations.splice(index, 1);
};