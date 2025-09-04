
'use client';
import type { Shape, LatLng } from '@/lib/types';
import { uuid } from '@/components/map/map-canvas';

// Asset dimensions and spacing (in meters)
const ASSET_SPECS = {
    house: { w: 8, d: 10, gapU: 3, gapV: 6, floors: 2 },
    flat: { w: 20, d: 30, gapU: 12, gapV: 12, floors: 4 },
    commercial: { w: 25, d: 40, gapU: 15, gapV: 15, floors: 1 },
    amenity: { w: 15, d: 15, gapU: 10, gapV: 10, floors: 1 },
};

/**
 * Creates a local projection to convert between LatLng and a local XY coordinate system.
 * This is essential for performing accurate metric calculations.
 */
function makeLocalProjection(origin: LatLng, angleDeg: number = 0) {
    const R = 6378137.0; // Earth radius in meters
    const rad = Math.PI / 180;
    const cosLat = Math.cos(origin.lat * rad);
    const ang = (angleDeg || 0) * rad;
    const sinA = Math.sin(ang);
    const cosA = Math.cos(ang);
    
    return {
        toXY: (ll: LatLng) => {
            const x = R * cosLat * (ll.lng - origin.lng) * rad;
            const y = R * (ll.lat - origin.lat) * rad;
            return { x, y };
        },
        xyToLL: (x: number, y: number) => {
            const lat = y / R / rad + origin.lat;
            const lng = x / (R * cosLat) / rad + origin.lng;
            return { lat, lng };
        },
        xyToUV: (x: number, y: number) => {
            return { u: x * cosA + y * sinA, v: -x * sinA + y * cosA };
        },
        uvToXY: (u: number, v: number) => {
            return { x: u * cosA - v * sinA, y: u * sinA + v * cosA };
        },
    };
}

/**
 * Calculates the bounding box of a polygon in the local UV (rotated) coordinate system.
 */
function boundsUV(polyPath: LatLng[], proj: ReturnType<typeof makeLocalProjection>) {
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    polyPath.forEach(p => {
        const xy = proj.toXY(p);
        const uv = proj.xyToUV(xy.x, xy.y);
        if (uv.u < minU) minU = uv.u;
        if (uv.u > maxU) maxU = uv.u;
        if (uv.v < minV) minV = uv.v;
        if (uv.v > maxV) maxV = uv.v;
    });
    return { minU, maxU, minV, maxV };
}

/**
 * Creates a rectangular path from a center point (u,v) and dimensions in the local projection.
 */
function rectFromUV(u: number, v: number, w: number, h: number, proj: ReturnType<typeof makeLocalProjection>) {
    const hw = w / 2, hh = h / 2;
    const uvCorners = [
        { u: u - hw, v: v - hh },
        { u: u + hw, v: v - hh },
        { u: u + hw, v: v + hh },
        { u: u - hw, v: v + hh },
    ];
    return uvCorners.map(c => {
        const xy = proj.uvToXY(c.u, c.v);
        return proj.xyToLL(xy.x, xy.y);
    });
}

/**
 * Checks if all corners of a rectangular path are inside a given polygon.
 */
function rectCornersInside(rectPath: LatLng[], zonePolygon: google.maps.Polygon) {
    return rectPath.every(pt =>
        google.maps.geometry.poly.containsLocation(new google.maps.LatLng(pt), zonePolygon)
    );
}

/**
 * Main function to lay out assets within a given zone.
 * @param zone - The zone shape to fill with assets.
 * @returns An array of new asset shapes.
 */
export function layoutAssetsInZone(zone: Shape): Shape[] {
    if (!zone.zoneMeta) return [];

    const zonePolygonForCheck = new google.maps.Polygon({ paths: zone.path });
    const bounds = new google.maps.LatLngBounds();
    zone.path.forEach(p => bounds.extend(p));
    const origin = bounds.getCenter().toJSON();
    const proj = makeLocalProjection(origin, 0);

    const kind = zone.zoneMeta.kind;
    const spec = kind === 'residential' ? ASSET_SPECS.house :
                 kind === 'commercial' ? ASSET_SPECS.commercial :
                 ASSET_SPECS.amenity; // Default for amenity/green space
                 
    if (kind === 'green_space') return []; // Don't generate assets for green space

    const { w, d, gapU, gapV, floors } = spec;
    const margin = 2; // meters to inset from zone boundary

    const bb = boundsUV(zone.path, proj);
    const startU = bb.minU + w / 2 + margin;
    const endU = bb.maxU - w / 2 - margin;
    const startV = bb.minV + d / 2 + margin;
    const endV = bb.maxV - d / 2 - margin;
    
    const newAssets: Shape[] = [];

    for (let v = startV; v <= endV; v += d + gapV) {
        for (let u = startU; u <= endU; u += w + gapU) {
            const rectPath = rectFromUV(u, v, w, d, proj);
            if (!rectCornersInside(rectPath, zonePolygonForCheck)) continue;

            const area = google.maps.geometry.spherical.computeArea(rectPath);
            const asset: Shape = {
                id: uuid(),
                type: 'rectangle', // Assets are visually represented by their rectangular footprint
                path: rectPath,
                area: area,
                assetMeta: {
                    key: kind === 'residential' ? 'house_procedural' : 'building_procedural',
                    floors: floors,
                    rotation: 0, // Rotation could be a parameter in the future
                },
            };
            newAssets.push(asset);
        }
    }

    return newAssets;
}
