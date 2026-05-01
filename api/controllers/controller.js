const locationService = require('../services/locationService');
const cartographer = require('../services/cartographer');
const distributor = require('../services/distributor');

exports.getLabels = (req, res, next) => {
    try {
        res.json(cartographer.getLabels());
    } catch (error) {
        next(error);
    }
};

exports.getNearestCity = (req, res, next) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const city = cartographer.nearestCity(lat, lng);
        const name = city
            ? cartographer.formatCityName(city)
            : cartographer.buildCoordLabel(lat, lng);
        res.json({ name });
    } catch (error) {
        next(error);
    }
};

exports.getAllLocations = async (req, res, next) => {
    try {
        res.json(await locationService.getAll());
    } catch (error) {
        next(error);
    }
};

exports.addLocation = async (req, res, next) => {
    try {
        res.status(201).json(await locationService.add(req.body));
    } catch (error) {
        next(error);
    }
};

exports.addLocationByCoords = async (req, res, next) => {
    try {
        const { lat, lng, type } = req.body;
        const city = cartographer.nearestCity(lat, lng);
        const name = city ? cartographer.formatCityName(city) : cartographer.buildCoordLabel(lat, lng);
        res.status(201).json(await locationService.add({ name, lat, lng, type }));
    } catch (error) {
        next(error);
    }
};

exports.addLocationByName = async (req, res, next) => {
    try {
        const { name: cityName, type } = req.body;
        const city = cartographer.findCityByName(cityName);
        if (!city) return res.status(404).json({ error: `City "${cityName?.trim()}" not found.` });
        const name = cartographer.formatCityName(city);
        const coords = { lat: parseFloat(city.lat), lng: parseFloat(city.lon) };
        res.status(201).json(await locationService.add({ name, ...coords, type }));
    } catch (error) {
        next(error);
    }
};

exports.getNearestLocation = async (req, res, next) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const locations = await locationService.getAll();
        res.json(cartographer.nearestLocation(lat, lng, locations));
    } catch (error) {
        next(error);
    }
};

exports.deleteLocation = async (req, res, next) => {
    try {
        await locationService.remove(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

exports.exportLocations = async (req, res, next) => {
    try {
        const buffer = await distributor.exportMap();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="destinations-${Date.now()}.jpg"`);
        res.send(buffer);
    } catch (error) {
        next(error);
    }
};

