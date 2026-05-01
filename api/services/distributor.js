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

// Natural Earth I projection — phi in radians
const NE_X_MAX = Math.PI * 0.8707;
const NE_Y_MAX = 1.4224;

// Fit the map to fill the canvas height, with side margins to avoid stretching
const MAP_H = H;
const MAP_W = Math.round(MAP_H * NE_X_MAX / NE_Y_MAX);
const MAP_X = Math.round((W - MAP_W) / 2);

function project(lng, lat) {
    const lambda = lng * Math.PI / 180;
    const phi    = lat * Math.PI / 180;
    const phi2   = phi * phi;
    const phi4   = phi2 * phi2;
    const nx = lambda * (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4)));
    const ny = phi    * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)));
    return {
        x: MAP_X + (nx + NE_X_MAX) / (2 * NE_X_MAX) * MAP_W,
        y:         (NE_Y_MAX - ny) / (2 * NE_Y_MAX) * MAP_H,
    };
}

function drawRing(ctx, ring) {
    if (ring.length === 0) return;
    const p0 = project(ring[0][0], ring[0][1]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < ring.length; i++) {
        const p = project(ring[i][0], ring[i][1]);
        ctx.lineTo(p.x, p.y);
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

    ctx.fillStyle = '#156090';   // deep ocean blue, matching the Blue Marble texture
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#2d6e22';  // natural land green
    ctx.strokeStyle = '#1a3d0d'; // dark green border
    ctx.lineWidth = 0.5;

    for (const feature of worldGeoJson.features) {
        drawFeature(ctx, feature);
    }

    for (const loc of locations) {
        const { x, y } = project(loc.lng, loc.lat);
        const color = MARKER_COLORS[loc.type] ?? MARKER_COLORS.visited;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    ctx.font = 'bold 13px sans-serif';
    ctx.textBaseline = 'middle';

    const MARKER_R = 6;
    const FONT_H = 14;
    const GAP = 4;
    const PAD = 2;

    function labelBox(lx, ly, w) {
        return { left: lx - PAD, top: ly - FONT_H / 2 - PAD, right: lx + w + PAD, bottom: ly + FONT_H / 2 + PAD };
    }

    function overlaps(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    const placed = [];

    for (const loc of locations) {
        const { x: mx, y: my } = project(loc.lng, loc.lat);
        const textW = ctx.measureText(loc.name).width;

        const candidates = [
            [mx + MARKER_R + GAP,          my                               ],  // right
            [mx - MARKER_R - GAP - textW,  my                               ],  // left
            [mx - textW / 2,               my - MARKER_R - GAP - FONT_H / 2],  // above
            [mx - textW / 2,               my + MARKER_R + GAP + FONT_H / 2],  // below
        ];

        let lx = candidates[0][0];
        let ly = candidates[0][1];
        for (const [cx, cy] of candidates) {
            if (!placed.some(p => overlaps(p, labelBox(cx, cy, textW)))) {
                lx = cx;
                ly = cy;
                break;
            }
        }

        placed.push(labelBox(lx, ly, textW));

        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(loc.name, lx, ly);
        ctx.shadowBlur = 0;
    }

    return canvas.toBuffer('image/jpeg', { quality: 0.92 });
};
