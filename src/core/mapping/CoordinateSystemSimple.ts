import proj4 from 'proj4';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// Define common coordinate reference systems
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'); // WGS84
proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs'); // Web Mercator

export interface UnifiedCoordinateSystem {
  crs: 'EPSG:4326' | 'EPSG:3857';
  transform: {
    lngLatToWorld(lngLat: [number, number], elevation?: number): Vector3;
    worldToLngLat(position: Vector3): [number, number, number];
    screenToWorld(screen: [number, number], tier: 'maplibre' | 'babylon' | 'three'): Vector3;
    worldToScreen(world: Vector3, tier: 'maplibre' | 'babylon' | 'three'): [number, number];
  };
  precision: {
    coordinate: number;
    elevation: number;
    measurement: number;
  };
}

class CoordinateSystemImpl implements UnifiedCoordinateSystem {
  crs: 'EPSG:4326' | 'EPSG:3857' = 'EPSG:4326';
  
  precision = {
    coordinate: 8, // 8 decimal places for coordinates (~1.1mm precision)
    elevation: 2,  // 2 decimal places for elevation (~1cm precision)
    measurement: 3, // 3 decimal places for measurements (~1mm precision)
  };

  transform = {
    lngLatToWorld: (lngLat: [number, number], elevation = 0): Vector3 => {
      const [lng, lat] = lngLat;
      return {
        x: lng,
        y: lat,
        z: elevation,
      };
    },

    worldToLngLat: (position: Vector3): [number, number, number] => {
      return [position.x, position.y, position.z];
    },

    screenToWorld: (screen: [number, number], tier: 'maplibre' | 'babylon' | 'three'): Vector3 => {
      console.warn('screenToWorld not fully implemented yet');
      return { x: screen[0], y: screen[1], z: 0 };
    },

    worldToScreen: (world: Vector3, tier: 'maplibre' | 'babylon' | 'three'): [number, number] => {
      console.warn('worldToScreen not fully implemented yet');
      return [world.x, world.y];
    },
  };

  transformCoordinates(
    coordinates: [number, number],
    fromCRS: string,
    toCRS: string
  ): [number, number] {
    try {
      const result = proj4(fromCRS, toCRS, coordinates);
      return [
        parseFloat(result[0].toFixed(this.precision.coordinate)),
        parseFloat(result[1].toFixed(this.precision.coordinate)),
      ];
    } catch (error) {
      console.error('Coordinate transformation failed:', error);
      return coordinates;
    }
  }

  calculateDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1[1] * Math.PI) / 180;
    const φ2 = (point2[1] * Math.PI) / 180;
    const Δφ = ((point2[1] - point1[1]) * Math.PI) / 180;
    const Δλ = ((point2[0] - point1[0]) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return parseFloat((R * c).toFixed(this.precision.measurement));
  }
}

// Export singleton instance
export const coordinateSystem = new CoordinateSystemImpl();
export type { UnifiedCoordinateSystem };