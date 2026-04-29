class Collector {
    async getAllLocations() {
        const response = await fetch('/api/locations');
        return response.json();
    }

    async storeVisitedLocation(name, coords) {
        return this.#storeLocation({ name, lat: coords.lat, lng: coords.lng, type: 'visited' });
    }

    async storeWishlistLocation(name, coords) {
        return this.#storeLocation({ name, lat: coords.lat, lng: coords.lng, type: 'wishlist' });
    }

    async removeLocation(id) {
        await fetch(`/api/locations/${id}`, { method: 'DELETE' });
    }

    async #storeLocation({ name, lat, lng, type }) {
        const response = await fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, lat, lng, type })
        });
        return response.json();
    }
}
