
export type LatLng = { lat: number; lng: number };

export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type Shape = {
  id: string;
  type: 'rectangle' | 'polygon';
  path: LatLng[];
  area?: number;
};

export type Tool = 'pan' | 'rectangle' | 'polygon';

export type ElevationPoint = {
    location: LatLng;
    elevation: number;
}

export type ElevationGridCell = {
    bounds: Bounds;
    slope: number;
    aspect: number;
}

export type ElevationGrid = {
    cells: ElevationGridCell[];
    resolution: number;
}
