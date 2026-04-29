let globe;
let citiesAbove10k = [];
let cityLabels = [];
let userLocations = [];

function haversine(lat1, lng1, lat2, lng2) {
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * Math.asin(Math.sqrt(a));
}

function nearestCity(lat, lng) {
    let best = null;
    let bestDist = Infinity;
    for (const city of citiesAbove10k) {
        const d = haversine(lat, lng, parseFloat(city.lat), parseFloat(city.lon));
        if (d < bestDist) { bestDist = d; best = city; }
    }
    return best;
}

function updateGlobe() {
    if (!globe) return;
    globe.pointsData(userLocations);
    globe.labelsData([...cityLabels, ...userLocations]);
}

const MARKER_COLORS = {
    visited: '#00cfff',  // blue-cyan
    wishlist: '#ff3333'  // red
};

async function loadLocations() {
    const response = await fetch('/api/locations');
    userLocations = await response.json();
    userLocations.forEach(loc => {
        loc.color = MARKER_COLORS[loc.type] ?? MARKER_COLORS.visited;
    });
    updateGlobe();
}

async function deleteLocation(id) {
    await fetch(`/api/locations/${id}`, {
        method: 'DELETE'
    });

    loadLocations();
}

window.addEventListener('load', () => {
    const mapEl = document.getElementById('map');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, mapEl.clientWidth / mapEl.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mapEl.clientWidth, mapEl.clientHeight);
    mapEl.appendChild(renderer.domElement);
    renderer.domElement.focus();

    let radius = 300;
    let theta = 0;
    let phi = Math.PI / 2;

    const updateCamera = () => {
        camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
        camera.position.y = radius * Math.cos(phi);
        camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
        camera.lookAt(0, 0, 0);
    };

    updateCamera();

    let labelScaleTimeout = null;
    function updateLabelScale() {
        clearTimeout(labelScaleTimeout);
    
        labelScaleTimeout = setTimeout(() => {
            const scale = Math.min(1, Math.pow(radius / 300, 1.5));
    
            globe
                .labelSize(d => (d.type ? 0.8 : 1.0) * scale)
                .labelDotRadius(d => d.type ? 0 : 0.5 * scale)
                .pointRadius(0.4 * scale);
        }, 150);
    }

    renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        radius += delta * 5;
        radius = Math.max(101, Math.min(1000, radius));
        updateCamera();
        updateLabelScale();
    });

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // left click
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            e.preventDefault();
        }
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            theta -= deltaX * 0.01;
            phi -= deltaY * 0.01;
            phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));
            updateCamera();
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });

    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isDragging = false;
        }
    });

    globe = new ThreeGlobe({ camera: camera, renderer: renderer })
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

    // Add globe and lights to scene immediately so rendering is never blocked
    scene.add(globe);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    function animate() {
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener('resize', () => {
        renderer.setSize(mapEl.clientWidth, mapEl.clientHeight);
        camera.aspect = mapEl.clientWidth / mapEl.clientHeight;
        camera.updateProjectionMatrix();
    });

    //// Load country border polygons
    // Load country and US state border polygons
    fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
        .then(r => r.json())
        .then(usData => {
            fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
                .then(r => r.json())
                .then(worldData => {
                    globe.polygonsData([...worldData.features, ...usData.features]);
                });
        });

    fetch('https://raw.githubusercontent.com/lmfmaier/cities-json/master/cities500.json')
        .then(r => r.json())
        .then(data => {
            const largestCountryCities = new Map();
            const largestUSStateCities = new Map();
            const megacities = []; 

            for (const city of data) {
                const pop = Number(city.pop);
                if (Number.isNaN(pop)) continue;

                // 1. Capture Megacities (> 10 million)
                if (pop > 10000000) {
                    megacities.push(city);
                }

                // 2. Existing logic for largest per US state
                if (city.country === 'US' && city.admin1) {
                    const stateKey = city.admin1;
                    const existing = largestUSStateCities.get(stateKey);
                    if (!existing || pop > Number(existing.pop)) {
                        largestUSStateCities.set(stateKey, city);
                    }
                } else {
                    // 3. Existing logic for largest per country
                    const countryKey = city.country;
                    const existing = largestCountryCities.get(countryKey);
                    if (!existing || pop > Number(existing.pop)) {
                        largestCountryCities.set(countryKey, city);
                    }
                }
            }

            citiesAbove10k = data.filter(c => Number(c.pop) > 10000);

            // Combine all sets and map to labels
            // Using a Map to prevent duplicate labels if a megacity is also the largest in its region
            const allLabelsMap = new Map();
            
            [
                ...megacities,
                ...largestCountryCities.values(),
                ...largestUSStateCities.values()
            ].forEach(c => {
                // Use a unique key (name + lat + lon) to ensure no duplicates
                const key = `${c.name}-${c.lat}-${c.lon}`;
                allLabelsMap.set(key, {
                    name: c.name,
                    lat: parseFloat(c.lat),
                    lng: parseFloat(c.lon),
                });
            });

            cityLabels = Array.from(allLabelsMap.values());

            loadLocations();
        }
    );

    // Delete a saved location on left-click
    globe.onPointClick = async d => {
        if (confirm(`Delete '${d.name}' from the globe?`)) {
            await deleteLocation(d.id);
        }
    };

    // Place a marker at the exact click position on right-click
    renderer.domElement.addEventListener('contextmenu', async (e) => {
        e.preventDefault();

        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // three-globe renders its sphere at radius 100
        const GLOBE_RADIUS = 100;
        const globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS);
        const hitPoint = new THREE.Vector3();

        if (!raycaster.ray.intersectSphere(globeSphere, hitPoint)) return;

        // Convert 3D hit point to lat/lng — matches three-globe's internal me() inverse:
        // theta = (90 - lng) * PI/180, so lng = 90 - atan2(z,x) * 180/PI
        const a = Math.atan2(hitPoint.z, hitPoint.x);
        const lat = 90 - Math.acos(hitPoint.y / GLOBE_RADIUS) * (180 / Math.PI);
        const lng = 90 - a * (180 / Math.PI) - (a < -Math.PI / 2 ? 360 : 0);

        const city = nearestCity(lat, lng);
        const name = city ? `${city.name}, ${city.country}` : `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;

        const type = document.getElementById('locationType').value;

        await fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, lat, lng, type })
        });

        loadLocations();
    });

    loadLocations();
});

document.getElementById('exportBtn').addEventListener('click', () => {
    window.location.href = '/api/locations/export';
});
