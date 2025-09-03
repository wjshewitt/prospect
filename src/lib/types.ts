export type Shape = {
  id: string;
  type: 'rectangle' | 'circle' | 'polygon';
  path: google.maps.LatLngLiteral[];
  area?: number; // in square meters
};

export type Tool = 'pan' | 'pen' | 'rectangle' | 'circle' | 'text';
