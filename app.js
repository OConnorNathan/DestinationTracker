const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const routes = require('./api/routes');
const cartographer = require('./api/services/cartographer');
const errorHandler = require('./api/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'artist/static')));
app.use('/models', express.static(path.join(__dirname, 'models')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'artist/templates/map.html'));
});

app.use('/api', routes);
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`Destination Tracker running on http://localhost:${config.port}`);
    cartographer.loadCities().catch(err =>
        console.warn('City dataset unavailable — name search and labels disabled:', err.message)
    );
});
