import type { Shape, ElevationGrid, LatLng, Bounds } from '@/lib/types';

const MAX_ELEVATION_BATCH_SIZE = 512;


// Based on WGS84 ellipsoid
const EARTH_RADIUS_MAJOR = 6378137.0; // meters
const EARTH_RADIUS_MINOR = 6356752.314245; // meters
const E2 = 1 - (EARTH_RADIUS_MINOR * EARTH_RADIUS_MINOR) / (EARTH_RADIUS_MAJOR * EARTH_RADIUS_MAJOR);

function makeLocalProjection(lat0: number, lon0: number, h0: number) {
    const lat0Rad = (lat0 * Math.PI) / 180;
    const lon0Rad = (lon0 * Math.PI) / 180;
    const sinLat0 = Math.sin(lat0Rad);
    const N0 = EARTH_RADIUS_MAJOR / Math.sqrt(1 - E2 * sinLat0 * sinLat0);

    const x0 = (N0 + h0) * Math.cos(lat0Rad) * Math.cos(lon0Rad);
    const y0 = (N0 + h0) * Math.cos(lat0Rad) * Math.sin(lon0Rad);
    const z0 = ((1 - E2) * N0 + h0) * sinLat0;

    return {
        toXY: (p: google.maps.LatLng | LatLng) => {
            const lat = 'lat' in p ? p.lat() : p.lat;
            const lng = 'lng' in p ? p.lng() : p.lng;
            const latRad = lat * (Math.PI / 180);
            const lonRad = lng * (Math.PI / 180);
            const sinLat = Math.sin(latRad);
            const cosLat = Math.cos(latRad);
            const N = EARTH_RADIUS_MAJOR / Math.sqrt(1 - E2 * sinLat * sinLat);
            const h = 0; 

            const x = (N + h) * cosLat * Math.cos(lonRad);
            const y = (N + h) * cosLat * Math.sin(lonRad);
            
            return { x: x - x0, y: y - y0 };
        },
        xyToLL: (x: number, y: number): LatLng => {
            const xp = x + x0;
            const yp = y + y0;
            const zp = z0; 
            
            const p = Math.sqrt(xp * xp + yp * yp);
            const lonRad = Math.atan2(yp, xp);
            
            let latRad = Math.atan2(zp, p * (1 - E2));
            let N_ = 0;
            for(let i=0; i<5; ++i) {
                const sinLat = Math.sin(latRad);
                N_ = EARTH_RADIUS_MAJOR / Math.sqrt(1-E2*sinLat*sinLat);
                latRad = Math.atan2(zp + E2*N_*sinLat, p);
            }

            return { lat: latRad * (180 / Math.PI), lng: lonRad * (180 / Math.PI) };
        }
    };
}


function boundsXY(poly: google.maps.Polygon, proj: ReturnType<typeof makeLocalProjection>) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    poly.getPath().forEach((p) => {
        const xy = proj.toXY(p);
        if (xy.x < minX) minX = xy.x;
        if (xy.x > maxX) maxX = xy.x;
        if (xy.y < minY) minY = xy.y;
        if (xy.y > maxY) maxY = xy.y;
    });
    return { minX, maxX, minY, maxY };
}


async function fetchElevationsInBatches(locations: LatLng[]): Promise<(google.maps.ElevationResult | null)[]> {
    const elevator = new google.maps.ElevationService();
    const batches = [];
    for (let i = 0; i < locations.length; i += MAX_ELEVATION_BATCH_SIZE) {
        batches.push(locations.slice(i, i + MAX_ELEVATION_BATCH_SIZE));
    }

    const results: (google.maps.ElevationResult | null)[] = [];
    for (const batch of batches) {
        try {
            const response = await new Promise<{results: google.maps.ElevationResult[], status: google.maps.ElevationStatus}>((resolve) => {
                elevator.getElevationForLocations({ locations: batch }, (res, status) => resolve({results: res || [], status}));
            });
            
            if (response.status !== google.maps.ElevationStatus.OK) {
                console.error(`Elevation service failed due to: ${response.status}`);
                throw new Error(`Elevation service failed due to: ${response.status}`);
            }
            results.push(...response.results);
        } catch (error) {
            console.error('Error fetching elevation batch:', error);
            throw error;
        }
    }
    return results;
}


function computeSlopePointGrid(z: Float64Array, nx: number, ny: number, dx: number, dy: number): Float32Array {
    const out = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const zl = z[j * nx + Math.max(0, i - 1)];
        const zr = z[j * nx + Math.min(nx - 1, i + 1)];
        const zt = z[Math.max(0, j - 1) * nx + i];
        const zb = z[Math.min(ny - 1, j + 1) * nx + i];

        const dxUse = i > 0 && i < nx - 1 ? 2 * dx : dx;
        const dyUse = j > 0 && j < ny - 1 ? 2 * dy : dy;
        
        const gx = !isNaN(zr) && !isNaN(zl) ? (zr - zl) / dxUse : 0;
        const gy = !isNaN(zb) && !isNaN(zt) ? (zb - zt) / dyUse : 0;

        const slopePct = Math.sqrt(gx * gx + gy * gy) * 100;
        out[j * nx + i] = slopePct;
      }
    }
    return out;
}


export async function getElevationGrid(shape: Shape, resolution: number): Promise<ElevationGrid> {
    const sitePolygon = new google.maps.Polygon({ paths: shape.path });
    const bounds = new google.maps.LatLngBounds();
    shape.path.forEach(p => bounds.extend(p));
    const origin = bounds.getCenter();

    const proj = makeLocalProjection(origin.lat(), origin.lng(), 0);
    const xyB = boundsXY(sitePolygon, proj);

    let width = xyB.maxX - xyB.minX;
    let height = xyB.maxY - xyB.minY;

    let nx = Math.max(2, Math.floor(width / resolution) + 1);
    let ny = Math.max(2, Math.floor(height / resolution) + 1);

    const locations: LatLng[] = [];
    for (let j = 0; j < ny; j++) {
        const y = xyB.minY + j * resolution;
        for (let i = 0; i < nx; i++) {
            const x = xyB.minX + i * resolution;
            locations.push(proj.xyToLL(x, y));
        }
    }

    if (locations.length === 0) {
        return { cells: [], resolution };
    }

    const elevResults = await fetchElevationsInBatches(locations);

    const z = new Float64Array(locations.length);
    elevResults.forEach((res, i) => {
        z[i] = res && typeof res.elevation === 'number' ? res.elevation : NaN;
    });

    const slopesPoint = computeSlopePointGrid(z, nx, ny, resolution, resolution);
    const cells = [];

    for (let j = 0; j < ny - 1; j++) {
        const y = xyB.minY + j * resolution;
        const y2 = y + resolution;

        for (let i = 0; i < nx - 1; i++) {
            const x = xyB.minX + i * resolution;
            const x2 = x + resolution;

            const cellLatLngs: LatLng[] = [
                proj.xyToLL(x, y),
                proj.xyToLL(x2, y),
                proj.xyToLL(x2, y2),
                proj.xyToLL(x, y2),
            ];
            
            const isInside = cellLatLngs.some(pt => 
                google.maps.geometry.poly.containsLocation(new google.maps.LatLng(pt), sitePolygon)
            );

            if (!isInside) {
                continue;
            }

            const s00 = slopesPoint[j * nx + i] || 0;
            const s10 = slopesPoint[j * nx + i + 1] || 0;
            const s01 = slopesPoint[(j + 1) * nx + i] || 0;
            const s11 = slopesPoint[(j + 1) * nx + i + 1] || 0;
            const slope = (s00 + s10 + s01 + s11) / 4;

            const cellBounds: Bounds = {
                north: cellLatLngs[2].lat,
                south: cellLatLngs[0].lat,
                east: cellLatLngs[1].lng,
                west: cellLatLngs[0].lng,
            };

            cells.push({
                bounds: cellBounds,
                path: cellLatLngs,
                slope: slope,
                aspect: 0 // Aspect calculation can be added here if needed
            });
        }
    }

    return { cells, resolution };
}
