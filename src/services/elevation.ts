
// src/services/elevation.ts
import type { Shape, LatLng, ElevationGrid, ElevationGridCell } from '@/lib/types';

const MAX_GRID_POINTS = 500; // Keep total points reasonable for performance

/**
 * Local projection for converting LatLng to planar XY and back.
 * Simplifies geometric calculations.
 */
function makeLocalProjection(originLat: number, originLng: number) {
    const R = 6371000; // Earth radius in meters
    const cosLat = Math.cos(originLat * Math.PI / 180);

    return {
        toXY: (p: { lat: number, lng: number }): { x: number, y: number } => {
            const dLat = (p.lat - originLat) * Math.PI / 180;
            const dLng = (p.lng - originLng) * Math.PI / 180;
            return {
                x: dLng * R * cosLat,
                y: dLat * R,
            };
        },
        xyToLL: (x: number, y: number): LatLng => {
            const dLat = y / R;
            const dLng = x / (R * cosLat);
            return {
                lat: originLat + dLat * 180 / Math.PI,
                lng: originLng + dLng * 180 / Math.PI,
            };
        },
    };
}

/**
 * Calculate planar XY bounds of a polygon.
 */
function boundsXY(poly: google.maps.Polygon, proj: ReturnType<typeof makeLocalProjection>) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    poly.getPath().getArray().forEach(p => {
        const xy = proj.toXY(p.toJSON());
        if (xy.x < minX) minX = xy.x;
        if (xy.x > maxX) maxX = xy.x;
        if (xy.y < minY) minY = xy.y;
        if (xy.y > maxY) maxY = xy.y;
    });
    return { minX, maxX, minY, maxY };
}


/**
 * Fetch elevations for a list of locations, batched for the API.
 */
async function fetchElevationsInBatches(
    locations: LatLng[],
    elevationService: google.maps.ElevationService
): Promise<google.maps.ElevationResult[]> {

    const batchSize = 512; // API limit
    const results: google.maps.ElevationResult[] = [];
    
    for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        try {
            const response = await elevationService.getElevationForLocations({ locations: batch });
            if (response.results) {
                results.push(...response.results);
            }
        } catch (e) {
            console.error("Elevation API batch failed:", e);
            // Push dummy results with NaN elevation to avoid breaking the analysis
            const failedResults = batch.map(loc => ({
                location: new google.maps.LatLng(loc),
                elevation: NaN,
                resolution: 0,
            }));
            results.push(...failedResults);
        }
         // Add a small delay to avoid hitting rate limits
         if (i + batchSize < locations.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return results;
}


/**
 * Compute slope at each grid point using finite differences.
 */
function computeSlopePointGrid(z: Float64Array, nx: number, ny: number, dx: number, dy: number): Float32Array {
    const out = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const idx = j * nx + i;
            
            if (!isFinite(z[idx])) {
                out[idx] = NaN;
                continue;
            }

            // Central difference for interior points, forward/backward for edges
            const zl = z[j * nx + Math.max(0, i - 1)];
            const zr = z[j * nx + Math.min(nx - 1, i + 1)];
            const zt = z[Math.max(0, j - 1) * nx + i];
            const zb = z[Math.min(ny - 1, j + 1) * nx + i];

            const dxUse = (i > 0 && i < nx - 1) ? 2 * dx : dx;
            const dyUse = (j > 0 && j < ny - 1) ? 2 * dy : dy;

            const gx = isFinite(zr) && isFinite(zl) ? (zr - zl) / dxUse : 0;
            const gy = isFinite(zb) && isFinite(zt) ? (zb - zt) / dyUse : 0;

            const slopePct = Math.sqrt(gx * gx + gy * gy) * 100;
            out[idx] = slopePct;
        }
    }
    return out;
}


/**
 * Main elevation analysis function
 */
export async function analyzeElevation(
    shape: Shape,
    elevationService: google.maps.ElevationService,
    desiredRes: number = 12
): Promise<ElevationGrid> {

    const sitePolygon = new google.maps.Polygon({ paths: shape.path });
    const bounds = new google.maps.LatLngBounds();
    shape.path.forEach(p => bounds.extend(p));
    const origin = bounds.getCenter().toJSON();
    
    // Create a local projection for accurate planar calculations
    const proj = makeLocalProjection(origin.lat, origin.lng);
    const xyB = boundsXY(sitePolygon, proj);

    const width = xyB.maxX - xyB.minX;
    const height = xyB.maxY - xyB.minY;
    
    let dx = desiredRes;
    let dy = desiredRes;

    // Adjust grid resolution to stay under the max points limit
    let nx = Math.max(2, Math.floor(width / dx) + 1);
    let ny = Math.max(2, Math.floor(height / dy) + 1);
    let totalPts = nx * ny;

    if (totalPts > MAX_GRID_POINTS) {
        const scale = Math.sqrt(totalPts / MAX_GRID_POINTS);
        dx *= scale;
        dy *= scale;
        nx = Math.max(2, Math.floor(width / dx) + 1);
        ny = Math.max(2, Math.floor(height / dy) + 1);
        totalPts = nx * ny;
    }

    // Build a grid of LatLng locations to sample
    const locations: LatLng[] = new Array(totalPts);
    for (let j = 0; j < ny; j++) {
        const y = xyB.minY + j * dy;
        for (let i = 0; i < nx; i++) {
            const x = xyB.minX + i * dx;
            locations[j * nx + i] = proj.xyToLL(x, y);
        }
    }
    
    // Fetch elevations for all grid points
    const elevResults = await fetchElevationsInBatches(locations, elevationService);
    const z = new Float64Array(totalPts).map((_, k) =>
        elevResults[k] && typeof elevResults[k].elevation === 'number'
            ? elevResults[k].elevation
            : NaN
    );

    // Compute slope at each grid point
    const slopesPoint = computeSlopePointGrid(z, nx, ny, dx, dy);

    // Create colored grid cells for visualization
    const cells: ElevationGridCell[] = [];
    for (let j = 0; j < ny - 1; j++) {
        const y = xyB.minY + j * dy;
        for (let i = 0; i < nx - 1; i++) {
            const x = xyB.minX + i * dx;

            const cellPath = [
                proj.xyToLL(x, y),
                proj.xyToLL(x + dx, y),
                proj.xyToLL(x + dx, y + dy),
                proj.xyToLL(x, y + dy),
            ];
            
            const cellCenter = proj.xyToLL(x + dx / 2, y + dy / 2);

            // Only include cells where the center is inside the polygon
            if (!google.maps.geometry.poly.containsLocation(new google.maps.LatLng(cellCenter), sitePolygon)) {
                continue;
            }
            
            // Average slope from the four corners of the cell
            const s00 = slopesPoint[j * nx + i];
            const s10 = slopesPoint[j * nx + (i + 1)];
            const s01 = slopesPoint[(j + 1) * nx + i];
            const s11 = slopesPoint[(j + 1) * nx + (i + 1)];
            const corners = [s00, s10, s01, s11];
            
            const validCorners = corners.filter(s => isFinite(s));
            const avgSlope = validCorners.length > 0
                ? validCorners.reduce((a, b) => a + b, 0) / validCorners.length
                : NaN;
            
            cells.push({
                path: cellPath,
                center: cellCenter,
                bounds: { // Not strictly needed, but can be useful
                    north: cellPath[2].lat,
                    south: cellPath[0].lat,
                    east: cellPath[1].lng,
                    west: cellPath[0].lng,
                },
                slope: avgSlope,
                aspect: 0, // Aspect calculation not implemented yet
            });
        }
    }
    
    return {
        cells,
        resolution: (dx + dy) / 2,
    };
}
