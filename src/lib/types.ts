export type LatLng = { lat: number; lng: number };

export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type RectangleShape = {
  id: string;
  type: 'rectangle';
  bounds: Bounds;
  area?: number;
};

export type PolygonShape = {
  id:string;
  type: 'polygon';
  path: LatLng[];
  area?: number;
}

export type Shape = RectangleShape | PolygonShape;

export type Tool = 'pan' | 'rectangle' | 'polygon';
