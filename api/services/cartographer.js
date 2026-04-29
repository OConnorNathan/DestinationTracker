class Cartographer {
    #cities = [];

    setCities(cities) {
        this.#cities = cities;
    }

    #haversine(lat1, lng1, lat2, lng2) {
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * Math.asin(Math.sqrt(a));
    }

    translateToCoords(hitPoint) {
        const a = Math.atan2(hitPoint.z, hitPoint.x);
        const lat = 90 - Math.acos(hitPoint.y / GLOBE_RADIUS) * (180 / Math.PI);
        const lng = 90 - a * (180 / Math.PI) - (a < -Math.PI / 2 ? 360 : 0);
        return { lat, lng };
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
        const q = query.trim().toLowerCase();
        if (!q) return null;
        let match = this.#cities.find(c => c.name.toLowerCase() === q);
        if (!match) match = this.#cities.find(c => c.name.toLowerCase().startsWith(q));
        if (!match) {
            const candidates = this.#cities.filter(c => c.name.toLowerCase().includes(q));
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
}
