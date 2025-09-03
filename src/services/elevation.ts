
import type { Shape, ElevationPoint, ElevationGrid, LatLng, Bounds } from '@/lib/types';

/**
 * Fetches elevation data for a grid of points within a given shape.
 */
export function getElevationGrid(shape: Shape, resolution: number): Promise<ElevationGrid> {
  return new Promise((resolve, reject) => {
    const elevator = new google.maps.ElevationService();
    const gridPoints = createGrid(shape, resolution);

    elevator.getElevationForLocations({ locations: gridPoints }, (results, status) => {
      if (status === 'OK' && results) {
        const elevationPoints = results.map(result => ({
          location: { lat: result.location!.lat(), lng: result.location!.lng() },
          elevation: result.elevation,
        }));
        const grid = calculateSlopes(elevationPoints, resolution);
        resolve(grid);
      } else {
        reject(`Elevation service failed due to: ${status}`);
      }
    });
  });
}

/**
 * Creates a grid of LatLng points within the bounding box of a shape.
 */
function createGrid(shape: Shape, resolution: number): LatLng[] {
  const path = shape.path;
  const bounds = new google.maps.LatLngBounds();
  path.forEach(p => bounds.extend(p));
  
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const shapePolygon = new google.maps.Polygon({ paths: path });

  const points: LatLng[] = [];
  
  // Calculate the number of steps in latitude and longitude
  // Based on spherical geometry to approximate meter-based resolution
  const latSteps = Math.ceil(google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(sw.lat(), sw.lng()),
      new google.maps.LatLng(ne.lat(), sw.lng())
  ) / resolution);

  const lngSteps = Math.ceil(google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(sw.lat(), sw.lng()),
      new google.maps.LatLng(sw.lat(), ne.lng())
  ) / resolution);

  const latStep = (ne.lat() - sw.lat()) / latSteps;
  const lngStep = (ne.lng() - sw.lng()) / lngSteps;

  for (let i = 0; i <= latSteps; i++) {
    for (let j = 0; j <= lngSteps; j++) {
      const lat = sw.lat() + i * latStep;
      const lng = sw.lng() + j * lngStep;
      const point = new google.maps.LatLng(lat, lng);
      
      if (google.maps.geometry.poly.containsLocation(point, shapePolygon)) {
        points.push({ lat, lng });
      }
    }
  }

  return points;
}

/**
 * Calculates the slope and aspect for each cell in the grid.
 */
function calculateSlopes(points: ElevationPoint[], resolution: number): ElevationGrid {
    if (points.length === 0) return { cells: [], resolution };

    // Create a map for quick elevation lookup
    const elevationMap = new Map<string, number>();
    points.forEach(p => elevationMap.set(`${p.location.lat.toFixed(6)},${p.location.lng.toFixed(6)}`, p.elevation));

    // Determine grid dimensions
    const lats = [...new Set(points.map(p => p.location.lat))].sort((a,b) => b-a); // North to South
    const lngs = [...new Set(points.map(p => p.location.lng))].sort((a,b) => a-b); // West to East
    
    const latStep = lats.length > 1 ? lats[0] - lats[1] : 0;
    const lngStep = lngs.length > 1 ? lngs[1] - lngs[0] : 0;
    
    const cells = [];

    for (let i = 0; i < lats.length - 1; i++) {
        for (let j = 0; j < lngs.length - 1; j++) {
            const y = lats[i];
            const x = lngs[j];

            // Get elevations of the 3x3 neighborhood around the center point (y,x)
            // Using Horn's method for slope calculation
            const a = elevationMap.get(`${(y + latStep).toFixed(6)},${(x - lngStep).toFixed(6)}`);
            const b = elevationMap.get(`${(y + latStep).toFixed(6)},${x.toFixed(6)}`);
            const c = elevationMap.get(`${(y + latStep).toFixed(6)},${(x + lngStep).toFixed(6)}`);
            const d = elevationMap.get(`${y.toFixed(6)},${(x - lngStep).toFixed(6)}`);
            const f = elevationMap.get(`${y.toFixed(6)},${(x + lngStep).toFixed(6)}`);
            const g = elevationMap.get(`${(y - latStep).toFixed(6)},${(x - lngStep).toFixed(6)}`);
            const h = elevationMap.get(`${(y - latStep).toFixed(6)},${x.toFixed(6)}`);
            const i_ = elevationMap.get(`${(y - latStep).toFixed(6)},${(x + lngStep).toFixed(6)}`);

            if (a === undefined || b === undefined || c === undefined || d === undefined || f === undefined || g === undefined || h === undefined || i_ === undefined) {
                continue;
            }
            
            // [dz/dx] = ((c + 2f + i) - (a + 2d + g)) / (8 * resolution)
            const dz_dx = ((c + 2 * f + i_) - (a + 2 * d + g)) / (8 * resolution);
            
            // [dz/dy] = ((g + 2h + i) - (a + 2b + c)) / (8 * resolution)
            const dz_dy = ((g + 2 * h + i_) - (a + 2 * b + c)) / (8 * resolution);

            const slopeRad = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy));
            const slopeDeg = slopeRad * (180 / Math.PI);
            
            let aspect = Math.atan2(dz_dy, -dz_dx) * (180 / Math.PI);
            if (aspect < 0) {
              aspect = 360 + aspect;
            }

            const cellBounds: Bounds = {
              north: y,
              south: y - latStep,
              west: x,
              east: x + lngStep
            };

            cells.push({
                bounds: cellBounds,
                slope: slopeDeg,
                aspect
            });
        }
    }

    return { cells, resolution };
}
