

// src/services/elevation.ts
import type { Shape, LatLng, ElevationGrid, ElevationGridCell } from '@/lib/types';
import axios from 'axios';

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
 * Fetch elevations for a list of locations from Google Maps, batched for the API.
 */
async function fetchElevationsFromGoogle(
    locations: LatLng[],
    elevationService: google.maps.ElevationService
): Promise<(number | null)[]> {

    const batchSize = 512; // API limit
    const results: (number | null)[] = [];
    
    for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        try {
            const response = await elevationService.getElevationForLocations({ locations: batch });
            if (response.results) {
                results.push(...response.results.map(r => r.elevation));
            } else {
                results.push(...batch.map(() => null));
            }
        } catch (e) {
            console.error("Google Elevation API batch failed:", e);
            results.push(...batch.map(() => null));
        }
         // Add a small delay to avoid hitting rate limits
         if (i + batchSize < locations.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return results;
}

/**
 * Fetch elevations from Mapbox Terrain-RGB tiles.
 */
async function fetchElevationsFromMapbox(locations: LatLng[]): Promise<(number | null)[]> {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!accessToken) {
        console.error("Mapbox token is not configured.");
        return locations.map(() => null);
    }
    
    const ZOOM = 15; // Zoom level for terrain detail
    const TILE_SIZE = 256;

    const mercator = (lat: number, lng: number) => {
        const sin = Math.sin(lat * Math.PI / 180);
        const x = lng / 360 + 0.5;
        const y = 0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
        return { x, y };
    }

    const tileRequests = new Map<string, { url: string; points: { index: number; x: number; y: number }[] }>();

    locations.forEach((loc, index) => {
        const { x, y } = mercator(loc.lat, loc.lng);
        const tileX = Math.floor(x * (2 ** ZOOM));
        const tileY = Math.floor(y * (2 ** ZOOM));
        const key = `${tileX}-${tileY}`;

        if (!tileRequests.has(key)) {
            tileRequests.set(key, {
                url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/${ZOOM}/${tileX}/${tileY}.pngraw?access_token=${accessToken}`,
                points: [],
            });
        }
        
        const pixelX = Math.floor((x * (2 ** ZOOM) - tileX) * TILE_SIZE);
        const pixelY = Math.floor((y * (2 ** ZOOM) - tileY) * TILE_SIZE);
        
        tileRequests.get(key)!.points.push({ index, x: pixelX, y: pixelY });
    });

    const elevations: (number | null)[] = new Array(locations.length).fill(null);

    await Promise.all(
      Array.from(tileRequests.values()).map(async ({ url, points }) => {
        try {
          const response = await axios.get(url, { responseType: 'arraybuffer' });
          const imgData = new Uint8Array(response.data);
          
          points.forEach(({ index, x, y }) => {
            const i = (y * TILE_SIZE + x) * 4;
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const elev = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
            elevations[index] = elev;
          });
        } catch (error) {
          console.error(`Failed to fetch Mapbox tile: ${url}`, error);
        }
      })
    );
    
    return elevations;
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
    
    // Fetch elevations from both services in parallel
    const [googleElevations, mapboxElevations] = await Promise.all([
        fetchElevationsFromGoogle(locations, elevationService),
        fetchElevationsFromMapbox(locations)
    ]);
    
    // Combine elevations
    const z = new Float64Array(totalPts).map((_, k) => {
        const gElev = googleElevations[k];
        const mElev = mapboxElevations[k];

        if (gElev !== null && mElev !== null) {
            return (gElev + mElev) / 2; // Average if both exist
        }
        if (gElev !== null) return gElev; // Fallback to Google
        if (mElev !== null) return mElev; // Fallback to Mapbox
        return NaN; // No data from either
    });


    // Compute slope at each grid point
    const slopesPoint = computeSlopePointGrid(z, nx, ny, dx, dy);

    // Create colored grid cells for visualization
    const cells: ElevationGridCell[] = [];
    let minSlope = Infinity, maxSlope = -Infinity;
    let minElevation = Infinity, maxElevation = -Infinity;

    for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
            const x = xyB.minX + i * dx;
            const y = xyB.minY + j * dy;

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
            const s11 = slopesPoint[(j + 1) * nx + i + 1];
            const corners = [s00, s10, s01, s11];
            
            const validCorners = corners.filter(s => isFinite(s));
            const avgSlope = validCorners.length > 0
                ? validCorners.reduce((a, b) => a + b, 0) / validCorners.length
                : NaN;
            
            if (isFinite(avgSlope)) {
                if (avgSlope < minSlope) minSlope = avgSlope;
                if (avgSlope > maxSlope) maxSlope = avgSlope;
            }

            // Find min/max elevation for the cell's corners
            const elevs = [
                z[j * nx + i],
                z[j * nx + i + 1],
                z[(j + 1) * nx + i],
                z[(j + 1) * nx + i + 1]
            ].filter(e => isFinite(e));

            if (elevs.length > 0) {
              const localMin = Math.min(...elevs);
              const localMax = Math.max(...elevs);
              if (localMin < minElevation) minElevation = localMin;
              if (localMax > maxElevation) maxElevation = localMax;
            }
            
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
        minSlope: isFinite(minSlope) ? minSlope : 0,
        maxSlope: isFinite(maxSlope) ? maxSlope : 0,
        minElevation: isFinite(minElevation) ? minElevation : 0,
        maxElevation: isFinite(maxElevation) ? maxElevation : 0,
        pointGrid: { grid: z, nx, ny },
        xyBounds: xyB,
    };
}
