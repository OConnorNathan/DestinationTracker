class Location {
    constructor(id, name, lat, lng, type) {
        this.id = id;
        this.name = name;
        this.lat = lat;
        this.lng = lng;
        this.type = type;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            lat: this.lat,
            lng: this.lng,
            type: this.type
        };
    }
}

module.exports = Location;