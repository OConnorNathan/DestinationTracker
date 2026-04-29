class Controller {
    #cartographer;
    #collector;
    #artist;

    constructor(cartographer, collector) {
        this.#cartographer = cartographer;
        this.#collector = collector;
    }

    setArtist(artist) {
        this.#artist = artist;
    }

    async addVisitedLocation(name, coords) {
        await this.#collector.storeVisitedLocation(name, coords);
        await this.loadAll();
    }

    async addWishlistLocation(name, coords) {
        await this.#collector.storeWishlistLocation(name, coords);
        await this.loadAll();
    }

    async addLocationByName(cityName, type) {
        const city = this.#cartographer.findCityByName(cityName);
        if (!city) return { success: false, error: `City "${cityName.trim()}" not found.` };
        const name = this.#cartographer.formatCityName(city);
        const coords = { lat: parseFloat(city.lat), lng: parseFloat(city.lon) };
        if (type === 'wishlist') {
            await this.#collector.storeWishlistLocation(name, coords);
        } else {
            await this.#collector.storeVisitedLocation(name, coords);
        }
        await this.loadAll();
        return { success: true };
    }

    async removeLocation(id) {
        await this.#collector.removeLocation(id);
        await this.loadAll();
    }

    processCoordinates(hitPoint) {
        const { lat, lng } = this.#cartographer.translateToCoords(hitPoint);
        const city = this.#cartographer.nearestCity(lat, lng);
        const name = city
            ? this.#cartographer.formatCityName(city)
            : this.#cartographer.buildCoordLabel(lat, lng);
        return { lat, lng, name };
    }

    findNearestMarker(lat, lng, locations) {
        return this.#cartographer.nearestLocation(lat, lng, locations);
    }

    handleExport() {
        this.#artist.generatePrintableMap();
    }

    async loadAll() {
        const locations = await this.#collector.getAllLocations();
        if (this.#artist) this.#artist.refresh(locations);
    }
}
