
/**
 * @file src/services/elevation.ts
 * @description Service for elevation analysis.
 *
 * This script provides functionalities to analyze the elevation profile of a given geographical shape.
 * It is optimized for a React/TypeScript environment, focusing on stability, performance, and maintainability.
 */
import type { Shape, LatLng, ElevationGrid, ElevationGridCell } from '@/lib/types';


// --- TYPE DEFINITIONS ---
interface XY {
  x: number;
  y: number;
}
interface XYBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
interface Projection {
  toXY: (p: LatLng) => XY;
  xyToLL: (x: number, y: number) => LatLng;
}
interface ElevationResult {
  elevation: number;
  location: LatLng;
  resolution: number;
}

// --- CORE FUNCTIONS ---
export async function analyzeElevationForShape(shape: Shape, resolution: number): Promise<ElevationGrid> {
  const sitePolygon = new google.maps.Polygon({ paths: shape.path });
  const bounds = new google.maps.LatLngBounds();
  shape.path.forEach(p => bounds.extend(p));
  const origin = bounds.getCenter();

  const proj = makeLocalProjection(origin.lat(), origin.lng());
  const xyB = boundsXY(sitePolygon, proj);

  let width = xyB.maxX - xyB.minX;
  let height = xyB.maxY - xyB.minY;
  let dx = resolution;
  let dy = resolution;
  let nx = Math.floor(width / dx) + 1;
  let ny = Math.floor(height / dy) + 1;
  let totalPts = nx * ny;

  // Build grid of locations
  const locations: LatLng[] = new Array(totalPts);
  for (let j = 0; j < ny; j++) {
    const y = xyB.minY + j * dy;
    for (let i = 0; i < nx; i++) {
      const x = xyB.minX + i * dx;
      locations[j * nx + i] = proj.xyToLL(x, y);
    }
  }

  // Fetch elevations
  const elevService = new google.maps.ElevationService();
  const elevResults = await fetchElevationsInBatches(locations, elevService);
  const z = new Float64Array(totalPts);
  for (let k = 0; k < totalPts; k++) {
    z[k] = elevResults[k] && typeof elevResults[k].elevation === 'number'
        ? elevResults[k].elevation
        : NaN;
  }

  // Compute gradient
  const slopesPoint = computeSlopePointGrid(z, nx, ny, dx, dy);

  // Create grid cells for visualization
  const cells: ElevationGridCell[] = [];
  for (let j = 0; j < ny - 1; j++) {
    const y = xyB.minY + j * dy;
    const y2 = y + dy;
    for (let i = 0; i < nx - 1; i++) {
      const x = xyB.minX + i * dx;
      const x2 = x + dx;

      const cellPath = [
        proj.xyToLL(x, y),
        proj.xyToLL(x2, y),
        proj.xyToLL(x2, y2),
        proj.xyToLL(x, y2),
      ];

      // Check if any corner is inside the polygon
      if (!cellPath.some(pt => google.maps.geometry.poly.containsLocation(pt, sitePolygon))) {
        continue;
      }
      
      const s00 = slopesPoint[j * nx + i] || 0;
      const s10 = slopesPoint[j * nx + i + 1] || 0;
      const s01 = slopesPoint[(j + 1) * nx + i] || 0;
      const s11 = slopesPoint[(j + 1) * nx + i + 1] || 0;
      const slope = (s00 + s10 + s01 + s11) / 4;

      cells.push({
        path: cellPath,
        bounds: {
            north: cellPath[1].lat,
            south: cellPath[0].lat,
            east: cellPath[2].lng,
            west: cellPath[0].lng
        },
        slope: slope,
        aspect: 0, // Aspect calculation not implemented
      });
    }
  }

  return {
    cells,
    resolution: (dx + dy) / 2
  };
}

// --- HELPER FUNCTIONS ---

function computeSlopePointGrid(z: Float64Array, nx: number, ny: number, dx: number, dy: number): Float32Array {
    const out = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const idx = j * nx + i;
            const zl = z[j * nx + Math.max(0, i - 1)];
            const zr = z[j * nx + Math.min(nx - 1, i + 1)];
            const zt = z[Math.max(0, j - 1) * nx + i];
            const zb = z[Math.min(ny - 1, j + 1) * nx + i];
            const dxUse = i > 0 && i < nx - 1 ? 2 * dx : dx;
            const dyUse = j > 0 && j < ny - 1 ? 2 * dy : dy;
            const gx = isFinite(zr) && isFinite(zl) ? (zr - zl) / dxUse : 0;
            const gy = isFinite(zb) && isFinite(zt) ? (zb - zt) / dyUse : 0;
            const slopePct = Math.sqrt(gx * gx + gy * gy) * 100;
            out[idx] = slopePct;
        }
    }
    return out;
}

function fetchElevationsInBatches(locations: LatLng[], service: google.maps.ElevationService): Promise<ElevationResult[]> {
    return new Promise((resolve, reject) => {
        const batchSize = 512;
        const out: ElevationResult[] = new Array(locations.length);
        let index = 0;

        const next = () => {
            if (index >= locations.length) {
                resolve(out);
                return;
            }
            const batch = locations.slice(index, index + batchSize);
            service.getElevationForLocations({ locations: batch }, (res, status) => {
                if (status !== google.maps.ElevationStatus.OK) {
                    reject(new Error("Elevation request failed: " + status));
                    return;
                }
                if (res) {
                    for (let i = 0; i < res.length; i++) {
                        out[index + i] = res[i];
                    }
                }
                index += batchSize;
                setTimeout(next, 100); // Be courteous to API
            });
        };
        next();
    });
}

function boundsXY(poly: google.maps.Polygon, proj: Projection): XYBounds {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    poly.getPath().forEach(p => {
        const xy = proj.toXY(p.toJSON());
        if (xy.x < minX) minX = xy.x;
        if (xy.x > maxX) maxX = xy.x;
        if (xy.y < minY) minY = xy.y;
        if (xy.y > maxY) maxY = xy.y;
    });
    return { minX, maxX, minY, maxY };
}

function makeLocalProjection(lat0: number, lon0: number): Projection {
  const R = 6378137;
  const k0 = 0.9996;
  const a = R;

  function toXY(p: LatLng): XY {
    const lon = p.lng;
    const lat = p.lat;
    const dLon = lon - lon0;
    const x = a * k0 * dLon * Math.cos(lat0 * Math.PI / 180);
    const y = a * k0 * (lat - lat0) * (Math.PI / 180);
    return { x, y };
  }

  function xyToLL(x: number, y: number): LatLng {
    const dLon = x / (a * k0 * Math.cos(lat0 * Math.PI / 180));
    const dLat = y / (a * k0 * (Math.PI / 180));
    return { lat: lat0 + dLat, lng: lon0 + dLon };
  }

  return { toXY, xyToLL };
}

    