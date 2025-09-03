// src/services/elevation.ts
import type { Shape } from '@/lib/types';

// Configuration constants
const ELEVATION_CONFIG = {
  MAX_SAMPLES: 512, // Google Elevation API limit
  MIN_SAMPLES: 100, // Minimum samples for meaningful analysis
  DEFAULT_GRID_SIZE: 20, // Default grid resolution
  MAX_GRID_SIZE: 50, // Maximum grid resolution for performance
  BATCH_SIZE: 256, // Batch size for API requests
  REQUEST_DELAY: 100, // Delay between batches (ms)
  CACHE_TTL: 3600000, // Cache TTL in milliseconds (1 hour)
} as const;

// Types
interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
}

interface ElevationGrid {
  points: ElevationPoint[][];
  bounds: google.maps.LatLngBounds;
  gridSize: number;
}

interface SlopeAnalysis {
  maxSlope: number;
  avgSlope: number;
  minElevation: number;
  maxElevation: number;
  elevationRange: number;
  slopeDistribution: SlopeDistribution;
  gridData: ElevationGrid;
}

interface SlopeDistribution {
  flat: number; // 0-5%
  gentle: number; // 5-10%
  moderate: number; // 10-15%
  steep: number; // 15-25%
  verySteep: number; // 25%+
}

interface ElevationCache {
  data: Map<string, { elevation: number; timestamp: number }>;
  get(lat: number, lng: number): number | null;
  set(lat: number, lng: number, elevation: number): void;
  clear(): void;
}

// Cache implementation
class ElevationCacheImpl implements ElevationCache {
  data: Map<string, { elevation: number; timestamp: number }>;

  constructor() {
    this.data = new Map();
  }

  private getKey(lat: number, lng: number): string {
    // Round to 5 decimal places for cache key
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }

  get(lat: number, lng: number): number | null {
    const key = this.getKey(lat, lng);
    const cached = this.data.get(key);
    
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > ELEVATION_CONFIG.CACHE_TTL) {
      this.data.delete(key);
      return null;
    }
    
    return cached.elevation;
  }

  set(lat: number, lng: number, elevation: number): void {
    const key = this.getKey(lat, lng);
    this.data.set(key, { elevation, timestamp: Date.now() });
  }

  clear(): void {
    this.data.clear();
  }
}

// Singleton cache instance
const elevationCache = new ElevationCacheImpl();

/**
 * Calculate optimal grid size based on shape area and complexity
 */
function calculateOptimalGridSize(bounds: google.maps.LatLngBounds): number {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  
  // Calculate approximate area in square kilometers
  const latDiff = Math.abs(ne.lat() - sw.lat());
  const lngDiff = Math.abs(ne.lng() - sw.lng());
  const approxAreaKm2 = latDiff * lngDiff * 111 * 111; // Rough conversion to km²
  
  // Adjust grid size based on area
  let gridSize: number;
  if (approxAreaKm2 < 0.1) {
    gridSize = 40; // Very small area - high resolution
  } else if (approxAreaKm2 < 1) {
    gridSize = 30; // Small area
  } else if (approxAreaKm2 < 10) {
    gridSize = 20; // Medium area
  } else {
    gridSize = 15; // Large area - lower resolution for performance
  }
  
  // Ensure we don't exceed max samples
  const totalSamples = gridSize * gridSize;
  if (totalSamples > ELEVATION_CONFIG.MAX_SAMPLES) {
    gridSize = Math.floor(Math.sqrt(ELEVATION_CONFIG.MAX_SAMPLES));
  }
  
  return Math.min(gridSize, ELEVATION_CONFIG.MAX_GRID_SIZE);
}

/**
 * Generate grid points for elevation sampling
 */
function generateGridPoints(
  shape: Shape,
  bounds: google.maps.LatLngBounds,
  gridSize: number
): google.maps.LatLng[] {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  
  const latStep = (ne.lat() - sw.lat()) / (gridSize - 1);
  const lngStep = (ne.lng() - sw.lng()) / (gridSize - 1);
  
  const points: google.maps.LatLng[] = [];
  const polygon = new google.maps.Polygon({ paths: shape.path });
  
  // Generate grid points only within the polygon
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lat = sw.lat() + (i * latStep);
      const lng = sw.lng() + (j * lngStep);
      const point = new google.maps.LatLng(lat, lng);
      
      // Only include points inside the polygon
      if (google.maps.geometry.poly.containsLocation(point, polygon)) {
        points.push(point);
      }
    }
  }
  
  // Add shape vertices to ensure boundary coverage
  shape.path.forEach(coord => {
    points.push(new google.maps.LatLng(coord.lat, coord.lng));
  });
  
  return points;
}

/**
 * Fetch elevation data with batching and error handling
 */
async function fetchElevationData(
  points: google.maps.LatLng[],
  elevationService: google.maps.ElevationService
): Promise<ElevationPoint[]> {
  const results: ElevationPoint[] = [];
  const uncachedPoints: google.maps.LatLng[] = [];
  
  // Check cache first
  for (const point of points) {
    const cached = elevationCache.get(point.lat(), point.lng());
    if (cached !== null) {
      results.push({
        lat: point.lat(),
        lng: point.lng(),
        elevation: cached
      });
    } else {
      uncachedPoints.push(point);
    }
  }
  
  // Fetch uncached points in batches
  for (let i = 0; i < uncachedPoints.length; i += ELEVATION_CONFIG.BATCH_SIZE) {
    const batch = uncachedPoints.slice(i, i + ELEVATION_CONFIG.BATCH_SIZE);
    
    if (batch.length === 0) continue;
    
    try {
      const response = await new Promise<google.maps.ElevationResult[]>((resolve, reject) => {
        elevationService.getElevationForLocations(
          { locations: batch },
          (results, status) => {
            if (status === google.maps.ElevationStatus.OK && results) {
              resolve(results);
            } else {
              reject(new Error(`Elevation API error: ${status}`));
            }
          }
        );
      });
      
      // Process and cache results
      response.forEach((result, index) => {
        const point = batch[index];
        const elevation = result.elevation;
        
        elevationCache.set(point.lat(), point.lng(), elevation);
        
        results.push({
          lat: point.lat(),
          lng: point.lng(),
          elevation
        });
      });
      
      // Add delay between batches to avoid rate limiting
      if (i + ELEVATION_CONFIG.BATCH_SIZE < uncachedPoints.length) {
        await new Promise(resolve => setTimeout(resolve, ELEVATION_CONFIG.REQUEST_DELAY));
      }
    } catch (error) {
      console.error('Error fetching elevation batch:', error);
      // Continue with partial results rather than failing completely
    }
  }
  
  return results;
}

/**
 * Calculate slope between two elevation points
 */
function calculateSlope(p1: ElevationPoint, p2: ElevationPoint): number {
  const distance = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
  
  if (distance === 0) return 0;
  
  const elevationChange = Math.abs(p2.elevation - p1.elevation);
  const slope = (elevationChange / distance) * 100; // Convert to percentage
  
  return slope;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Organize elevation points into grid structure
 */
function organizeIntoGrid(
  points: ElevationPoint[],
  bounds: google.maps.LatLngBounds,
  gridSize: number
): ElevationGrid {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  
  const latStep = (ne.lat() - sw.lat()) / (gridSize - 1);
  const lngStep = (ne.lng() - sw.lng()) / (gridSize - 1);
  
  // Initialize grid
  const grid: ElevationPoint[][] = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null));
  
  // Assign points to nearest grid position
  points.forEach(point => {
    const i = Math.round((point.lat - sw.lat()) / latStep);
    const j = Math.round((point.lng - sw.lng()) / lngStep);
    
    if (i >= 0 && i < gridSize && j >= 0 && j < gridSize) {
      grid[i][j] = point;
    }
  });
  
  // Fill gaps with interpolated values
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      if (!grid[i][j]) {
        grid[i][j] = interpolatePoint(grid, i, j, sw, latStep, lngStep);
      }
    }
  }
  
  return { points: grid, bounds, gridSize };
}

/**
 * Interpolate missing grid point from neighbors
 */
function interpolatePoint(
  grid: (ElevationPoint | null)[][],
  i: number,
  j: number,
  sw: google.maps.LatLng,
  latStep: number,
  lngStep: number
): ElevationPoint {
  const neighbors: ElevationPoint[] = [];
  
  // Collect valid neighbors
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (di === 0 && dj === 0) continue;
      
      const ni = i + di;
      const nj = j + dj;
      
      if (ni >= 0 && ni < grid.length && nj >= 0 && nj < grid[0].length && grid[ni][nj]) {
        neighbors.push(grid[ni][nj]!);
      }
    }
  }
  
  // Calculate interpolated elevation
  let elevation = 0;
  if (neighbors.length > 0) {
    elevation = neighbors.reduce((sum, p) => sum + p.elevation, 0) / neighbors.length;
  }
  
  return {
    lat: sw.lat() + (i * latStep),
    lng: sw.lng() + (j * lngStep),
    elevation
  };
}

/**
 * Analyze slopes across the grid
 */
function analyzeSlopes(grid: ElevationGrid): SlopeAnalysis {
  const slopes: number[] = [];
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  
  const { points } = grid;
  
  // Calculate slopes and elevation range
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points[i].length; j++) {
      const current = points[i][j];
      
      if (!current) continue;
      
      minElevation = Math.min(minElevation, current.elevation);
      maxElevation = Math.max(maxElevation, current.elevation);
      
      // Calculate slopes to adjacent points
      const neighbors = [
        { i: i + 1, j }, // North
        { i, j: j + 1 }, // East
        { i: i + 1, j: j + 1 }, // Northeast
        { i: i - 1, j: j + 1 } // Southeast
      ];
      
      neighbors.forEach(({ i: ni, j: nj }) => {
        if (ni >= 0 && ni < points.length && nj >= 0 && nj < points[ni].length) {
          const neighbor = points[ni][nj];
          if (neighbor) {
            const slope = calculateSlope(current, neighbor);
            slopes.push(slope);
          }
        }
      });
    }
  }
  
  // Calculate slope statistics
  const maxSlope = Math.max(...slopes, 0);
  const avgSlope = slopes.length > 0 
    ? slopes.reduce((sum, s) => sum + s, 0) / slopes.length 
    : 0;
  
  // Calculate slope distribution
  const distribution: SlopeDistribution = {
    flat: 0,
    gentle: 0,
    moderate: 0,
    steep: 0,
    verySteep: 0
  };
  
  slopes.forEach(slope => {
    if (slope < 5) distribution.flat++;
    else if (slope < 10) distribution.gentle++;
    else if (slope < 15) distribution.moderate++;
    else if (slope < 25) distribution.steep++;
    else distribution.verySteep++;
  });
  
  // Convert counts to percentages
  const total = slopes.length || 1;
  Object.keys(distribution).forEach(key => {
    distribution[key as keyof SlopeDistribution] = 
      (distribution[key as keyof SlopeDistribution] / total) * 100;
  });
  
  return {
    maxSlope,
    avgSlope,
    minElevation,
    maxElevation,
    elevationRange: maxElevation - minElevation,
    slopeDistribution: distribution,
    gridData: grid
  };
}

/**
 * Main elevation analysis function
 */
export async function analyzeElevation(
  shape: Shape,
  elevationService: google.maps.ElevationService
): Promise<SlopeAnalysis> {
  try {
    // Calculate bounds
    const bounds = new google.maps.LatLngBounds();
    shape.path.forEach(coord => {
      bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
    });
    
    // Determine optimal grid size
    const gridSize = calculateOptimalGridSize(bounds);
    
    // Generate sampling points
    const gridPoints = generateGridPoints(shape, bounds, gridSize);
    
    // Validate we have enough points
    if (gridPoints.length < ELEVATION_CONFIG.MIN_SAMPLES) {
      console.warn(`Only ${gridPoints.length} sample points generated, analysis may be less accurate`);
    }
    
    // Fetch elevation data
    const elevationPoints = await fetchElevationData(gridPoints, elevationService);
    
    // Organize into grid
    const grid = organizeIntoGrid(elevationPoints, bounds, gridSize);
    
    // Analyze slopes
    const analysis = analyzeSlopes(grid);
    
    return analysis;
  } catch (error) {
    console.error('Elevation analysis error:', error);
    throw new Error('Failed to complete elevation analysis. Please try again.');
  }
}

/**
 * Clear elevation cache
 */
export function clearElevationCache(): void {
  elevationCache.clear();
}

/**
 * Export elevation data as CSV
 */
export function exportElevationData(analysis: SlopeAnalysis): string {
  const headers = ['Latitude', 'Longitude', 'Elevation (m)', 'Row', 'Column'];
  const rows: string[] = [headers.join(',')];
  
  analysis.gridData.points.forEach((row, i) => {
    row.forEach((point, j) => {
      if (point) {
        rows.push([
          point.lat.toFixed(6),
          point.lng.toFixed(6),
          point.elevation.toFixed(2),
          i.toString(),
          j.toString()
        ].join(','));
      }
    });
  });
  
  return rows.join('\n');
}

/**
 * Generate elevation heatmap data
 */
export function generateHeatmapData(analysis: SlopeAnalysis): {
  data: number[][];
  minValue: number;
  maxValue: number;
} {
  const data = analysis.gridData.points.map(row =>
    row.map(point => point?.elevation || 0)
  );
  
  return {
    data,
    minValue: analysis.minElevation,
    maxValue: analysis.maxElevation
  };
}

/**
 * Calculate buildable area percentage based on slope thresholds
 */
export function calculateBuildableArea(
  analysis: SlopeAnalysis,
  maxSlopeThreshold: number = 15
): number {
  const buildable = 
    analysis.slopeDistribution.flat + 
    analysis.slopeDistribution.gentle +
    (maxSlopeThreshold >= 15 ? analysis.slopeDistribution.moderate : 0);
  
  return Math.min(100, Math.max(0, buildable));
}