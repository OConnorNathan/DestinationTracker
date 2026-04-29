const express = require('express');
const controller = require('./controllers/locationController');

const router = express.Router();

router.get('/', controller.getAllLocations);
router.post('/', controller.addLocation);
router.delete('/:id', controller.deleteLocation);
router.get('/export', controller.exportLocations);

module.exports = router;