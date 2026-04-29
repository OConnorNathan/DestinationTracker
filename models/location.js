const GLOBE_RADIUS = 100;
const MARKER_COLORS = {
    visited: '#00cfff',
    wishlist: '#ff3333'
};

class Location {
    constructor(id, { lat, lng, name }, type) {
        this.id = id;
        this.lat = lat;
        this.lng = lng;
        this.name = name;
        this.type = type;
        this.color = MARKER_COLORS[type] ?? MARKER_COLORS.visited;
    }
}
