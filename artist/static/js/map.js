class Artist {
    #scene;
    #camera;
    #renderer;
    #globe;
    #cityLabels = [];
    #userLocations = [];
    #controller;
    #radius = 300;
    #theta = 0;
    #phi = Math.PI / 2;
    #isDragging = false;
    #lastX = 0;
    #lastY = 0;
    #dragStartX = 0;
    #dragStartY = 0;
    #labelScaleTimeout = null;

    constructor(container) {
        this.#scene = new THREE.Scene();
        this.#camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.#renderer = new THREE.WebGLRenderer({ antialias: true });
        this.#renderer.setPixelRatio(window.devicePixelRatio);
        this.#renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.#renderer.domElement);
        this.#renderer.domElement.focus();

        this.#setupGlobe();
        this.#setupLights();
        this.#updateCamera();
        this.#setupEventListeners();
        this.#startAnimation();
        this.#loadBorders();

        window.addEventListener('resize', () => {
            this.#renderer.setSize(container.clientWidth, container.clientHeight);
            this.#camera.aspect = container.clientWidth / container.clientHeight;
            this.#camera.updateProjectionMatrix();
        });
    }

    setController(controller) {
        this.#controller = controller;
    }

    setCityLabels(labels) {
        this.#cityLabels = labels;
        this.#updateGlobe();
    }

    refresh(locations) {
        this.#userLocations = locations.map(loc => new Location(loc.id, loc, loc.type));
        this.#updateGlobe();
    }

    generatePrintableMap() {
        window.location.href = '/api/locations/export';
    }

    #updateCamera() {
        this.#camera.position.x = this.#radius * Math.sin(this.#phi) * Math.cos(this.#theta);
        this.#camera.position.y = this.#radius * Math.cos(this.#phi);
        this.#camera.position.z = this.#radius * Math.sin(this.#phi) * Math.sin(this.#theta);
        this.#camera.lookAt(0, 0, 0);
    }

    #updateGlobe() {
        if (!this.#globe) return;
        this.#globe.pointsData(this.#userLocations);
        this.#globe.labelsData([...this.#cityLabels, ...this.#userLocations]);
    }

    #updateLabelScale() {
        clearTimeout(this.#labelScaleTimeout);
        this.#labelScaleTimeout = setTimeout(() => {
            const scale = Math.min(1, Math.pow(this.#radius / 300, 1.5));
            this.#globe
                .labelSize(d => (d.type ? 0.8 : 1.0) * scale)
                .labelDotRadius(d => d.type ? 0 : 0.5 * scale)
                .pointRadius(0.4 * scale);
        }, 150);
    }

    #raycastGlobe(clientX, clientY) {
        const rect = this.#renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.#camera);
        const globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS);
        const hitPoint = new THREE.Vector3();
        return raycaster.ray.intersectSphere(globeSphere, hitPoint) ? hitPoint : null;
    }

    #setupGlobe() {
        this.#globe = new ThreeGlobe({ camera: this.#camera, renderer: this.#renderer })
            .globeImageUrl('https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg')
            .bumpImageUrl('https://raw.githubusercontent.com/turban/webgl-earth/master/images/elev_bump_4k.jpg')
            .showAtmosphere(true)
            .pointLat('lat')
            .pointLng('lng')
            .pointColor('color')
            .pointAltitude(0.02)
            .pointRadius(0.4)
            .polygonGeoJsonGeometry(d => d.geometry)
            .polygonCapColor(() => 'rgba(0, 0, 0, 0)')
            .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
            .polygonStrokeColor(() => '#000000')
            .polygonAltitude(0.006)
            .labelsData([])
            .labelLat('lat')
            .labelLng('lng')
            .labelText('name')
            .labelSize(d => d.type ? 0.8 : 1.0)
            .labelDotRadius(d => d.type ? 0 : 0.5)
            .labelColor(d => d.type ? (MARKER_COLORS[d.type] ?? '#ffffff') : '#ffffff')
            .labelResolution(2)
            .labelAltitude(0.01);
        this.#scene.add(this.#globe);
    }

    #setupLights() {
        this.#scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(5, 3, 5);
        this.#scene.add(directionalLight);
    }

    #setupEventListeners() {
        const el = this.#renderer.domElement;

        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1 : -1;
            this.#radius += delta * 5;
            this.#radius = Math.max(101, Math.min(1000, this.#radius));
            this.#updateCamera();
            this.#updateLabelScale();
        });

        el.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.#isDragging = false;
                this.#dragStartX = e.clientX;
                this.#dragStartY = e.clientY;
                this.#lastX = e.clientX;
                this.#lastY = e.clientY;
            }
        });

        el.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) {
                const dx = e.clientX - this.#dragStartX;
                const dy = e.clientY - this.#dragStartY;
                if (!this.#isDragging && dx * dx + dy * dy > 25) this.#isDragging = true;
                if (this.#isDragging) {
                    this.#theta -= (e.clientX - this.#lastX) * 0.01;
                    this.#phi -= (e.clientY - this.#lastY) * 0.01;
                    this.#phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.#phi));
                    this.#updateCamera();
                }
                this.#lastX = e.clientX;
                this.#lastY = e.clientY;
            }
        });

        el.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                if (!this.#isDragging) {
                    const hitPoint = this.#raycastGlobe(e.clientX, e.clientY);
                    if (hitPoint) {
                        const { lat, lng } = this.#controller.processCoordinates(hitPoint);
                        const nearest = this.#controller.findNearestMarker(lat, lng, this.#userLocations);
                        if (nearest) this.#controller.removeLocation(nearest.id);
                    }
                }
                this.#isDragging = false;
            }
        });

        el.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            const hitPoint = this.#raycastGlobe(e.clientX, e.clientY);
            if (!hitPoint) return;
            const { lat, lng, name } = this.#controller.processCoordinates(hitPoint);
            const type = document.getElementById('locationType').value;
            if (type === 'wishlist') {
                await this.#controller.addWishlistLocation(name, { lat, lng });
            } else {
                await this.#controller.addVisitedLocation(name, { lat, lng });
            }
        });
    }

    #startAnimation() {
        const animate = () => {
            this.#renderer.render(this.#scene, this.#camera);
            requestAnimationFrame(animate);
        };
        animate();
    }

    #loadBorders() {
        fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
            .then(r => r.json())
            .then(usData => {
                fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
                    .then(r => r.json())
                    .then(worldData => {
                        this.#globe.polygonsData([...worldData.features, ...usData.features]);
                    });
            });
    }
}

window.addEventListener('load', async () => {
    const cartographer = new Cartographer();
    const collector = new Collector();
    const controller = new Controller(cartographer, collector);
    const artist = new Artist(document.getElementById('map'));

    controller.setArtist(artist);
    artist.setController(controller);

    // Wire up city name input
    const cityInput = document.getElementById('cityInput');
    const cityError = document.getElementById('cityError');

    async function addCityByName() {
        const result = await controller.addLocationByName(
            cityInput.value,
            document.getElementById('locationType').value
        );
        if (result.success) {
            cityInput.value = '';
            cityError.style.display = 'none';
        } else {
            cityError.textContent = result.error;
            cityError.style.display = 'block';
        }
    }

    cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') addCityByName(); });
    document.getElementById('exportBtn').addEventListener('click', () => controller.handleExport());

    // Load cities dataset, give Cartographer all cities 10k+ for lookups
    const data = await fetch('https://raw.githubusercontent.com/lmfmaier/cities-json/master/cities500.json')
        .then(r => r.json());

    const largestCountryCities = new Map();
    const largestUSStateCities = new Map();
    const megacities = [];

    for (const city of data) {
        const pop = Number(city.pop);
        if (Number.isNaN(pop)) continue;
        if (pop > 10000000) megacities.push(city);
        if (city.country === 'US' && city.admin1) {
            const existing = largestUSStateCities.get(city.admin1);
            if (!existing || pop > Number(existing.pop)) largestUSStateCities.set(city.admin1, city);
        } else {
            const existing = largestCountryCities.get(city.country);
            if (!existing || pop > Number(existing.pop)) largestCountryCities.set(city.country, city);
        }
    }

    cartographer.setCities(data.filter(c => Number(c.pop) > 10000));

    const allLabelsMap = new Map();
    [...megacities, ...largestCountryCities.values(), ...largestUSStateCities.values()].forEach(c => {
        const key = `${c.name}-${c.lat}-${c.lon}`;
        allLabelsMap.set(key, { name: c.name, lat: parseFloat(c.lat), lng: parseFloat(c.lon) });
    });

    artist.setCityLabels(Array.from(allLabelsMap.values()));
    await controller.loadAll();
});
