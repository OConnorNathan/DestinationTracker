const collector = require('../services/collector');
const distributor = require('../services/distributor');

exports.getAllLocations = async (req, res, next) => {
    try {
        const locations = await collector.getAll();
        res.json(locations);
    } catch (error) {
        next(error);
    }
};

exports.addLocation = async (req, res, next) => {
    try {
        const location = await collector.add(req.body);
        res.status(201).json(location);
    } catch (error) {
        next(error);
    }
};

exports.deleteLocation = async (req, res, next) => {
    try {
        await collector.remove(req.params.id);
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