
'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThreeDVisualizationProps {
assets: Shape[];
zones: Shape[];
boundary: Shape;
elevationGrid: ElevationGrid;
mapScreenshot?: string | null;
}

// Helper to calculate the center of a polygon - MUST be inside useEffect
const getPolygonCenter = (path: LatLng[]): LatLng => {
if (!window.google || !window.google.maps) {
return path[0] || { lat: 0, lng: 0 };
}
const bounds = new google.maps.LatLngBounds();
path.forEach(p => bounds.extend(p));
return bounds.getCenter().toJSON();
};

const Compass = ({ camera }: { camera: THREE.Camera | null }) => {
const [rotation, setRotation] = useState(0);

useEffect(() => {
if (!camera) return;

const updateCompass = () => {
  const vector = new THREE.Vector3();
  camera.getWorldDirection(vector);
  const angle = Math.atan2(vector.x, vector.z);
  setRotation(angle);
};

const controls = (camera as any).__orbitControls;
if (controls) {
  controls.addEventListener('change', updateCompass);
  // Initial update
  updateCompass();
  return () => controls.removeEventListener('change', updateCompass);
}
}, [camera]);

return (
<div className="absolute bottom-4 right-4 w-16 h-16 bg-background/50 rounded-full flex items-center justify-center text-foreground backdrop-blur-sm shadow-lg">
<div
className="relative w-full h-full"
style={{ transform: `rotate(${-rotation}rad)` }}
>
<div className="absolute top-1 left-1/2 -translate-x-1/2 font-bold text-lg">N</div>
<div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-sm">S</div>
<div className="absolute left-1 top-1/2 -translate-y-1/2 text-sm">W</div>
<div className="absolute right-1 top-1/2 -translate-y-1/2 text-sm">E</div>
</div>
<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
<ArrowUp className="w-6 h-6 text-red-500" />
</div>
</div>
);
};

export function ThreeDVisualizationModal({ assets, zones, boundary, elevationGrid, mapScreenshot }: ThreeDVisualizationProps) {
const mountRef = useRef<HTMLDivElement>(null);
const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);

useEffect(() => {
if (!mountRef.current || !boundary || !elevationGrid || !elevationGrid.pointGrid) return;

const mountNode = mountRef.current;
let animationFrameId: number;

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(65, mountNode.clientWidth / mountNode.clientHeight, 0.1, 10000);
setCamera(camera);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const canvasElement = renderer.domElement;
mountNode.appendChild(canvasElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x4A90E2, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xFFF8DC, 1.2);
sunLight.position.set(150, 300, 100);
sunLight.castShadow = true;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 1000;
sunLight.shadow.camera.top = 400;
sunLight.shadow.camera.bottom = -400;
sunLight.shadow.camera.left = -400;
sunLight.shadow.camera.right = 400;
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.3);
fillLight.position.set(-50, 100, -50);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.3);
scene.add(hemiLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 1000;
controls.maxPolarAngle = Math.PI / 2.1;
(camera as any).__orbitControls = controls;

// SHARED MAP-SPACE ORIENTATION
const geoGroup = new THREE.Group();
geoGroup.rotation.x = -Math.PI / 2;
scene.add(geoGroup);

// Coordinate System & Projections (local tangent plane)
const siteCenter = getPolygonCenter(boundary.path);
const proj = {
  toLocal: (p: LatLng) => {
    const R = 6371e3;
    const φ1 = siteCenter.lat * Math.PI / 180;
    const dLat = (p.lat - siteCenter.lat) * Math.PI / 180;
    const dLng = (p.lng - siteCenter.lng) * Math.PI / 180;
    const x = dLng * R * Math.cos(φ1);
    const y = -dLat * R;
    return { x, y };
  },
};

// Elevation Data
const { grid, nx, ny } = elevationGrid.pointGrid!;
const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;

const getElevationAt = (x: number, y: number): number => {
  if (!grid || nx < 2 || ny < 2) return 0;

  const u = ((x - minX) / (maxX - minX)) * (nx - 1);
  const v = ((y - minY) / (maxY - minY)) * (ny - 1);

  const i = Math.floor(u);
  const j = Math.floor(v);

  if (i < 0 || i >= nx - 1 || j < 0 || j >= ny - 1) return 0;

  const s = u - i;
  const t = v - j;

  const z00 = grid[j * nx + i];
  const z10 = grid[j * nx + i + 1];
  const z01 = grid[(j + 1) * nx + i];
  const z11 = grid[(j + 1) * nx + i + 1];

  if (!isFinite(z00) || !isFinite(z10) || !isFinite(z01) || !isFinite(z11)) return 0;

  const z0 = z00 * (1 - s) + z10 * s;
  const z1 = z01 * (1 - s) + z11 * s;
  return z0 * (1 - t) + z1 * t;
};

// Create Terrain
const terrainDivisionsX = 150;
const terrainDivisionsY = 150;
const terrainWidth = maxX - minX;
const terrainHeight = maxY - minY;

const terrainGeometry = new THREE.PlaneGeometry(terrainWidth, terrainHeight, terrainDivisionsX, terrainDivisionsY);

const positions = terrainGeometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
  const x = positions.getX(i);
  const y = positions.getY(i);
  const worldX = x + (maxX + minX) / 2;
  const worldY = y + (maxY + minY) / 2;

  const elevation = getElevationAt(worldX, worldY);
  positions.setZ(i, elevation);
}
terrainGeometry.computeVertexNormals();


let groundMaterial;

if (mapScreenshot) {
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load(mapScreenshot);
    groundTexture.colorSpace = THREE.SRGBColorSpace;
    groundMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.1,
    });
} else {
    // Fallback if no screenshot is provided
    const textureCanvas = document.createElement('canvas');
    const textureSize = 2048;
    textureCanvas.width = textureSize;
    textureCanvas.height = textureSize;
    const textureContext = textureCanvas.getContext('2d')!;
    textureContext.fillStyle = '#2D5016';
    textureContext.fillRect(0, 0, textureSize, textureSize);
    
    const terrainTexture = new THREE.CanvasTexture(textureCanvas);
    groundMaterial = new THREE.MeshStandardMaterial({
        map: terrainTexture,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.1,
    });
}

const terrainMesh = new THREE.Mesh(terrainGeometry, groundMaterial);
terrainMesh.receiveShadow = true;
terrainMesh.position.set((maxX + minX) / 2, (maxY + minY) / 2, 0);
geoGroup.add(terrainMesh);

// Building materials
const createBuildingMaterial = (assetKey: string) => {
  let baseColor = '#E6E6FA';
  let roughness = 0.7;
  let metalness = 0.1;

  if (assetKey.includes('house') || assetKey.includes('bungalow')) {
    baseColor = '#D2B48C';
    roughness = 0.8;
    metalness = 0.0;
  } else if (assetKey.includes('flat_block')) {
    baseColor = '#C0C0C0';
    roughness = 0.3;
    metalness = 0.2;
  }

  return new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness,
    transparent: false,
  });
};

const shapeFromPathRelativeToCenter = (path: LatLng[], centerXY: { x: number; y: number }) => {
  const points = path.map(p => {
    const l = proj.toLocal(p);
    return new THREE.Vector2(l.x - centerXY.x, l.y - centerXY.y);
  });
  return new THREE.Shape(points);
};

// Render buildings
assets.forEach(asset => {
  if (!asset.assetMeta) return;

  const assetCenterLL = getPolygonCenter(asset.path);
  const centerXY = proj.toLocal(assetCenterLL);
  const baseElevation = getElevationAt(centerXY.x, centerXY.y);
  const footprintShape = shapeFromPathRelativeToCenter(asset.path, centerXY);
  const floors = asset.assetMeta.floors ?? 1;
  const height = floors * 3.2;

  const geometry = new THREE.ExtrudeGeometry(footprintShape, {
    depth: height,
    bevelEnabled: false,
  });

  const material = createBuildingMaterial(asset.assetMeta.key || '');
  const buildingMesh = new THREE.Mesh(geometry, material);
  buildingMesh.castShadow = true;
  buildingMesh.receiveShadow = true;

  const pivot = new THREE.Object3D();
  pivot.position.set(centerXY.x, centerXY.y, baseElevation);
  pivot.add(buildingMesh);

  const rotationDegrees = asset.assetMeta.rotation ?? 0;
  pivot.rotation.z = -rotationDegrees * (Math.PI / 180);

  geoGroup.add(pivot);
});

// Camera framing
const groupBBox = new THREE.Box3().setFromObject(geoGroup);
const groupCenter = groupBBox.getCenter(new THREE.Vector3());
const groupSize = groupBBox.getSize(new THREE.Vector3());
const radius = Math.max(groupSize.x, groupSize.z) * 0.6;

camera.position.set(
  groupCenter.x - radius * 0.8,
  groupCenter.y + radius * 0.9,
  groupCenter.z + radius * 0.8
);
camera.lookAt(groupCenter);
controls.target.copy(groupCenter);

// Animation loop
const animate = () => {
  animationFrameId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};
animate();

// Resize handler
const handleResize = () => {
  if (!mountNode) return;
  camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
};
window.addEventListener('resize', handleResize);

// Cleanup
return () => {
  window.removeEventListener('resize', handleResize);
  cancelAnimationFrame(animationFrameId);
  controls.dispose();

  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (Array.isArray(object.material)) {
        object.material.forEach(material => {
          if ((material as any).map) (material as any).map.dispose?.();
          material.dispose();
        });
      } else if (object.material) {
        const material = object.material as THREE.Material & { map?: THREE.Texture };
        if (material.map) material.map.dispose();
        material.dispose();
      }
    }
  });

  // Let React handle the removal of the canvas from the DOM.
  // Do not call mountNode.removeChild(canvasElement).
  renderer.dispose();
  if (mountNode) {
    mountNode.innerHTML = "";
  }
  setCamera(null);
};

}, [assets, zones, boundary, elevationGrid, mapScreenshot]);

return (
<div className="relative w-full h-full bg-black">
<div ref={mountRef} className="w-full h-full" />
<Compass camera={camera} />
</div>
);
}

    