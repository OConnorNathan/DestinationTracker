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
    #labelScale = 1;

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
        this.#globe.customLayerData([...this.#cityLabels, ...this.#userLocations]);
    }

    #makeLabel(d) {
        const isLocation = !!d.type;
        const color = isLocation ? (MARKER_COLORS[d.type] ?? '#ffffff') : '#ffffff';
        const fontSize = 90;
        const padding = 10;
        const dotR = 22;
        const dotSlot = dotR * 2 + padding; // The space reserved for the bullet point

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontSize}px "Segoe UI", "Arial Unicode MS", Arial, sans-serif`;
        
        const textWidth = Math.ceil(ctx.measureText(d.name).width) || 80;

        // Standardize: Both types now use the same width calculation
        canvas.width = dotSlot + textWidth + padding * 2;
        canvas.height = fontSize + padding * 2;

        // Standardize: Both types start text at the exact same X position
        const textX = dotSlot + padding;

        ctx.font = `${fontSize}px "Segoe UI", "Arial Unicode MS", Arial, sans-serif`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';

        // Only draw the dot for major cities (non-user locations)
        // If you want dots for both, just remove the 'if (!isLocation)' check
        if (!isLocation) {
            ctx.beginPath();
            ctx.arc(padding + dotR, canvas.height / 2, dotR, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillText(d.name, textX, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(mat);

        // Standardize: Use the same base height for both to ensure consistent vertical scaling
        const baseH = 2.5; 
        const baseW = (canvas.width / canvas.height) * baseH;

        const anchorX = (padding + dotR) / canvas.width;
        sprite.center.set(anchorX, 0.5);

        sprite.userData.baseW = baseW;
        sprite.userData.baseH = baseH;
        sprite.scale.set(baseW * this.#labelScale, baseH * this.#labelScale, 1);

        return sprite;
    }

    #updateLabelScale() {
        clearTimeout(this.#labelScaleTimeout);
        this.#labelScaleTimeout = setTimeout(() => {
            this.#labelScale = Math.min(1, Math.pow(this.#radius / 300, 1.5));
            this.#globe.traverse(obj => {
                if (obj.isSprite && obj.userData.baseH !== undefined) {
                    obj.scale.set(
                        obj.userData.baseW * this.#labelScale,
                        obj.userData.baseH * this.#labelScale,
                        1
                    );
                }
            });
            this.#globe.pointRadius(0.4 * this.#labelScale);
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
            .customLayerData([])
            .customThreeObject(d => this.#makeLabel(d))
            .customThreeObjectUpdate((obj, d) => {
                const phi = (90 - d.lat) * Math.PI / 180;
                const theta = (90 - d.lng) * Math.PI / 180;
                const r = GLOBE_RADIUS * 1.01;
                obj.position.set(
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.cos(phi),
                    r * Math.sin(phi) * Math.sin(theta)
                );
            });
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
