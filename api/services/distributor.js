const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const locationService = require('./locationService');

const worldGeoJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../artist/static/data/world.geojson'), 'utf8')
);

const W = 1920;
const H = 960;

const MARKER_COLORS = {
    visited: '#00cfff',
    wishlist: '#ff3333'
};

const MAX_LAT = 85.051129;
const Y_MAX = Math.log(Math.tan(Math.PI / 4 + MAX_LAT * Math.PI / 360));

function toX(lng) {
    return ((lng + 180) / 360) * W;
}

function toY(lat) {
    const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
    const yRaw = Math.log(Math.tan(Math.PI / 4 + clamped * Math.PI / 360));
    return ((Y_MAX - yRaw) / (2 * Y_MAX)) * H;
}

function drawRing(ctx, ring) {
    if (ring.length === 0) return;
    ctx.moveTo(toX(ring[0][0]), toY(ring[0][1]));
    for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(toX(ring[i][0]), toY(ring[i][1]));
    }
    ctx.closePath();
}

function drawFeature(ctx, feature) {
    const { type, coordinates } = feature.geometry;
    if (type === 'Polygon') {
        ctx.beginPath();
        for (const ring of coordinates) drawRing(ctx, ring);
        ctx.fill('evenodd');
        ctx.stroke();
    } else if (type === 'MultiPolygon') {
        for (const polygon of coordinates) {
            ctx.beginPath();
            for (const ring of polygon) drawRing(ctx, ring);
            ctx.fill('evenodd');
            ctx.stroke();
        }
    }
}

exports.exportMap = async () => {
    const locations = await locationService.getAll();

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a1929';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#2d4a22';
    ctx.strokeStyle = '#4a7a38';
    ctx.lineWidth = 0.5;

    for (const feature of worldGeoJson.features) {
        drawFeature(ctx, feature);
    }

    for (const loc of locations) {
        const x = toX(loc.lng);
        const y = toY(loc.lat);
        const color = MARKER_COLORS[loc.type] ?? MARKER_COLORS.visited;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    return canvas.toBuffer('image/jpeg', { quality: 0.92 });
};
