const express = require('express');
const controller = require('./controllers/controller');

const router = express.Router();

router.get('/locations', controller.getAllLocations);
router.get('/locations/export', controller.exportLocations);
router.get('/locations/nearest', controller.getNearestLocation);
router.post('/locations', controller.addLocation);
router.post('/locations/bycoords', controller.addLocationByCoords);
router.post('/locations/byname', controller.addLocationByName);
router.delete('/locations/:id', controller.deleteLocation);

router.get('/cities/labels', controller.getLabels);
router.get('/cities/nearest', controller.getNearestCity);

module.exports = router;
