
export type LatLng = { lat: number; lng: number };

export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type Shape = {
  id: string;
  type: 'rectangle' | 'polygon' | 'freehand';
  path: LatLng[];
  area?: number;
};

export type Tool = 'pan' | 'rectangle' | 'polygon' | 'freehand';

export type ElevationPoint = {
    location: LatLng;
    elevation: number;
}

export type ElevationGridCell = {
    bounds: Bounds;
    path: LatLng[];
    center: LatLng;
    slope: number; // as percent grade
    aspect: number;
}

export type ElevationGrid = {
    cells: ElevationGridCell[];
    resolution: number;
}
