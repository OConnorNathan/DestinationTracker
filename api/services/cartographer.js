const US_STATES = new Map([
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
    ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
    ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
    ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
    ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
    ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
    ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
    ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
    ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
    ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
    ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
    ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
    ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['DC', 'District of Columbia'],
    ['PR', 'Puerto Rico'], ['GU', 'Guam'],
]);

class Cartographer {
    #cities = [];

    #haversine(lat1, lng1, lat2, lng2) {
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * Math.asin(Math.sqrt(a));
    }

    async loadCities() {
        const res = await fetch('https://raw.githubusercontent.com/lmfmaier/cities-json/master/cities500.json');
        if (!res.ok) throw new Error(`Failed to fetch city dataset: ${res.statusText}`);
        this.#cities = await res.json();
        console.log(`Loaded ${this.#cities.length} cities`);
    }

    nearestCity(lat, lng) {
        let best = null;
        let bestDist = Infinity;
        for (const city of this.#cities) {
            const d = this.#haversine(lat, lng, parseFloat(city.lat), parseFloat(city.lon));
            if (d < bestDist) { bestDist = d; best = city; }
        }
        return best;
    }

    nearestLocation(lat, lng, locations) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const loc of locations) {
            const d = this.#haversine(lat, lng, loc.lat, loc.lng);
            if (d < nearestDist) { nearestDist = d; nearest = loc; }
        }
        return nearestDist < 0.05 ? nearest : null;
    }

    findCityByName(query) {
        const parts = query.split(',').map(s => s.trim());
        const name = parts[0];
        const qualifier = parts[1]?.toUpperCase() ?? null;
        const q = name.toLowerCase();
        if (!q) return null;

        const matchesQualifier = qualifier ? (c) => {
            if (c.country === qualifier) return true;
            if (c.country !== 'US') return false;
            const stateName = US_STATES.get(qualifier);
            return c.admin1 === qualifier || (stateName && c.admin1 === stateName);
        } : () => true;

        let match = this.#cities.find(c => c.name.toLowerCase() === q && matchesQualifier(c));
        if (!match) match = this.#cities.find(c => c.name.toLowerCase().startsWith(q) && matchesQualifier(c));
        if (!match) {
            const candidates = this.#cities.filter(c => c.name.toLowerCase().includes(q) && matchesQualifier(c));
            if (candidates.length) {
                candidates.sort((a, b) => Number(b.pop) - Number(a.pop));
                match = candidates[0];
            }
        }
        return match || null;
    }

    formatCityName(city) {
        return `${city.name}, ${city.country}`;
    }

    buildCoordLabel(lat, lng) {
        return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
    }

    getLabels() {
        const largestCountryCities = new Map();
        const largestUSStateCities = new Map();
        const megacities = [];

        for (const city of this.#cities) {
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

        const allLabelsMap = new Map();
        [...megacities, ...largestCountryCities.values(), ...largestUSStateCities.values()].forEach(c => {
            const key = `${c.name}-${c.lat}-${c.lon}`;
            allLabelsMap.set(key, { name: c.name, lat: parseFloat(c.lat), lng: parseFloat(c.lon) });
        });

        return Array.from(allLabelsMap.values());
    }
}

module.exports = new Cartographer();
