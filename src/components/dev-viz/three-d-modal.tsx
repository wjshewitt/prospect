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
}

// Helper to calculate the center of a polygon
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

    updateCompass();

    const controls = (camera as any).__orbitControls;
    if (controls) {
      controls.addEventListener('change', updateCompass);
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

export function ThreeDVisualizationModal({ assets, zones, boundary, elevationGrid }: ThreeDVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    if (!mountRef.current || !boundary || !elevationGrid || !elevationGrid.pointGrid) return;

    const mountNode = mountRef.current;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Simple blue sky fallback

    const camera = new THREE.PerspectiveCamera(75, mountNode.clientWidth / mountNode.clientHeight, 0.1, 20000);
    setCamera(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    
    const canvasElement = renderer.domElement;
    mountNode.appendChild(canvasElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(-150, 200, 150);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    scene.add(directionalLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    (camera as any).__orbitControls = controls;

    // --- SHARED COORDINATE SYSTEM ---
    const siteCenter = getPolygonCenter(boundary.path);
    const proj = {
        toLocal: (p: LatLng) => {
            const R = 6371e3; // metres
            const φ1 = siteCenter.lat * Math.PI/180;
            const dLat = (p.lat-siteCenter.lat) * Math.PI/180;
            const dLng = (p.lng-siteCenter.lng) * Math.PI/180;
            const x = dLng * R * Math.cos(φ1);
            const y = dLat * R;
            return { x, y }; // Keep original Y direction for now
        },
    };
    
    // A single group to hold all projected geometry.
    // We rotate this group so that XY (map plane) becomes XZ (ground plane).
    // Extrusions along local +Z will now point "up" in world space (+Y).
    const geoGroup = new THREE.Group();
    geoGroup.rotation.x = -Math.PI / 2;
    scene.add(geoGroup);

    // --- Elevation Data ---
    const { grid, nx, ny } = elevationGrid.pointGrid!;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;
    
    const getElevationAt = (x: number, y: number): number => {
        if (!grid || nx < 2 || ny < 2) return 0;
        const u = ((x - minX) / (maxX - minX)) * (nx - 1);
        const v = ((y - minY) / (maxY - minY)) * (ny - 1); // Note: Y is not inverted here
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
    
    // --- Create Terrain Mesh ---
    const terrainDivisionsX = 150;
    const terrainDivisionsY = 150;
    const terrainGeometry = new THREE.PlaneGeometry(
        maxX - minX, maxY - minY, terrainDivisionsX, terrainDivisionsY
    );

    // Apply elevation to the terrain vertices.
    const positions = terrainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        // The geometry is created in local XY space matching our projection
        const x = positions.getX(i) + (maxX + minX) / 2;
        const y = positions.getY(i) + (maxY + minY) / 2;
        const elevation = getElevationAt(x, y);
        positions.setZ(i, elevation); // Set elevation on the Z axis
    }
    terrainGeometry.computeVertexNormals();

    // Create terrain texture
    const textureCanvas = document.createElement('canvas');
    const textureSize = 2048;
    textureCanvas.width = textureSize;
    textureCanvas.height = textureSize;
    const textureContext = textureCanvas.getContext('2d')!;
    textureContext.fillStyle = '#2D5016';
    textureContext.fillRect(0, 0, textureSize, textureSize);

    const worldToTexture = (x: number, y: number) => {
        const u = (x - minX) / (maxX - minX);
        const v = 1 - ((y - minY) / (maxY - minY)); // Invert Y for canvas
        return { u: u * textureSize, v: v * textureSize };
    };

    zones.forEach(zone => {
        const kind = zone.zoneMeta?.kind;
        let color = 'rgba(255, 255, 255, 0.3)';
        if (kind === 'residential') color = 'rgba(134, 239, 172, 0.4)';
        if (kind === 'commercial') color = 'rgba(147, 197, 253, 0.4)';
        if (kind === 'amenity') color = 'rgba(252, 211, 77, 0.4)';
        textureContext.fillStyle = color;
        textureContext.beginPath();
        zone.path.forEach((p, index) => {
            const local = proj.toLocal(p);
            const texCoords = worldToTexture(local.x, local.y);
            if (index === 0) textureContext.moveTo(texCoords.u, texCoords.v);
            else textureContext.lineTo(texCoords.u, texCoords.v);
        });
        textureContext.closePath();
        textureContext.fill();
    });

    const terrainTexture = new THREE.CanvasTexture(textureCanvas);
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      side: THREE.DoubleSide
    });
    const terrainMesh = new THREE.Mesh(terrainGeometry, groundMaterial);
    terrainMesh.receiveShadow = true;
    geoGroup.add(terrainMesh); // Add to the rotated group

    // --- Render Assets ---
    assets.forEach(asset => {
        if (!asset.assetMeta) return;

        // Project the shape's vertices into local XY space
        const assetVertices = asset.path.map(p => {
            const local = proj.toLocal(p);
            return new THREE.Vector2(local.x, local.y);
        });
        const assetShape = new THREE.Shape(assetVertices);

        // Find the elevation at the center of the asset
        const assetCenter = getPolygonCenter(asset.path);
        const localCenter = proj.toLocal(assetCenter);
        const elevation = getElevationAt(localCenter.x, localCenter.y);

        const floors = asset.assetMeta.floors ?? 1;
        const height = floors * 3.2;
        const extrudeSettings = { depth: height, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(assetShape, extrudeSettings);
        
        const material = new THREE.MeshStandardMaterial({
             color: asset.assetMeta.key?.includes('house') ? 0xD2B48C : 0xC0C0C0,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Position the base of the mesh at the correct elevation on the Z axis.
        // This will become the Y position after the geoGroup is rotated.
        mesh.position.z = elevation;
        
        // Apply rotation around the extrusion axis (Z-axis).
        // This will become rotation around the world's "up" axis (Y-axis) after group rotation.
        const rotationDegrees = asset.assetMeta.rotation ?? 0;
        mesh.rotation.z = rotationDegrees * (Math.PI / 180);

        geoGroup.add(mesh); // Add the mesh directly to the rotated group
    });

    // --- Final Camera Positioning ---
    const worldBbox = new THREE.Box3().setFromObject(geoGroup);
    const worldCenter = worldBbox.getCenter(new THREE.Vector3());
    const worldSize = worldBbox.getSize(new THREE.Vector3());
    const cameraDistance = Math.max(worldSize.x, worldSize.y, worldSize.z) * 1.5;
    
    camera.position.set(
        worldCenter.x,
        worldCenter.y + cameraDistance,
        worldCenter.z + cameraDistance * 0.5
    );
    camera.lookAt(worldCenter);
    controls.target.copy(worldCenter);
    
    // --- Animation & Cleanup ---
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountNode) return;
      camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();

      if (scene.background instanceof THREE.Texture) {
          scene.background.dispose();
      }
      terrainTexture.dispose();
      
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => {
              if (material.map) material.map.dispose();
              material.dispose();
            });
          } else if (object.material) {
            const material = object.material as THREE.Material & { map?: THREE.Texture };
            if (material.map) material.map.dispose();
            material.dispose();
          }
        }
      });
      
      if (mountNode && mountNode.contains(canvasElement)) {
        mountNode.removeChild(canvasElement);
      }
      renderer.dispose();
      setCamera(null);
    };
  }, [assets, zones, boundary, elevationGrid]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={mountRef} className="w-full h-full" />
      <Compass camera={camera} />
    </div>
  );
}
