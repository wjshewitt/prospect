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

// Helper to calculate the center of a polygon - MUST be inside useEffect
const getPolygonCenter = (path: LatLng[]): LatLng => {
  if (!window.google || !window.google.maps) {
    // Return a default if google maps is not loaded
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
    scene.background = new THREE.Color(0x87CEEB);
    
    const camera = new THREE.PerspectiveCamera(65, mountNode.clientWidth / mountNode.clientHeight, 0.1, 10000);
    setCamera(camera);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
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

    // Coordinate System & Projections
    const siteCenter = getPolygonCenter(boundary.path);
    const proj = {
      toLocal: (p: LatLng) => {
        const R = 6371e3;
        const φ1 = siteCenter.lat * Math.PI / 180;
        const dLat = (p.lat - siteCenter.lat) * Math.PI / 180;
        const dLng = (p.lng - siteCenter.lng) * Math.PI / 180;
        const x = dLng * R * Math.cos(φ1);
        const y = dLat * R;
        return { x, y: -y };
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

    // Create Terrain - FIXED COORDINATE SYSTEM
    const terrainDivisionsX = 150;
    const terrainDivisionsY = 150;
    const terrainWidth = maxX - minX;
    const terrainHeight = maxY - minY;

    const terrainGeometry = new THREE.PlaneGeometry(terrainWidth, terrainHeight, terrainDivisionsX, terrainDivisionsY);
    
    // CRITICAL: Rotate terrain to be horizontal
    terrainGeometry.rotateX(-Math.PI / 2);

    // Apply elevation to terrain vertices
    const positions = terrainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      
      // Convert local terrain coordinates to world coordinates
      const worldX = x + (maxX + minX) / 2;
      const worldY = -z + (maxY + minY) / 2; // Z becomes Y after rotation
      
      const elevation = getElevationAt(worldX, worldY);
      positions.setY(i, elevation);
    }
    terrainGeometry.computeVertexNormals();

    // Create terrain texture
    const textureCanvas = document.createElement('canvas');
    const textureSize = 2048;
    textureCanvas.width = textureSize;
    textureCanvas.height = textureSize;
    const textureContext = textureCanvas.getContext('2d')!;

    // Base grass texture
    textureContext.fillStyle = '#2D5016';
    textureContext.fillRect(0, 0, textureSize, textureSize);
    
    // Add texture variation
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * textureSize;
      const y = Math.random() * textureSize;
      const size = Math.random() * 3;
      textureContext.fillStyle = `rgba(${45 + Math.random() * 30}, ${80 + Math.random() * 40}, ${22 + Math.random() * 20}, 0.3)`;
      textureContext.fillRect(x, y, size, size);
    }

    // Function to transform world XY to texture UV
    const worldToTexture = (x: number, y: number) => {
      const u = (x - minX) / (maxX - minX);
      const v = 1 - ((y - minY) / (maxY - minY));
      return { u: u * textureSize, v: v * textureSize };
    };

    // Render zones on texture
    zones.forEach(zone => {
      const kind = zone.zoneMeta?.kind;
      let color = 'rgba(255, 255, 255, 0.3)';
      let borderColor = 'rgba(255, 255, 255, 0.8)';
      
      if (kind === 'residential') {
        color = 'rgba(134, 239, 172, 0.4)';
        borderColor = 'rgba(34, 197, 94, 0.8)';
      }
      if (kind === 'commercial') {
        color = 'rgba(147, 197, 253, 0.4)';
        borderColor = 'rgba(59, 130, 246, 0.8)';
      }
      if (kind === 'amenity') {
        color = 'rgba(252, 211, 77, 0.4)';
        borderColor = 'rgba(245, 158, 11, 0.8)';
      }

      textureContext.fillStyle = color;
      textureContext.beginPath();
      zone.path.forEach((p, index) => {
        const local = proj.toLocal(p);
        const texCoords = worldToTexture(local.x, local.y);
        if (index === 0) {
          textureContext.moveTo(texCoords.u, texCoords.v);
        } else {
          textureContext.lineTo(texCoords.u, texCoords.v);
        }
      });
      textureContext.closePath();
      textureContext.fill();

      textureContext.strokeStyle = borderColor;
      textureContext.lineWidth = 2;
      textureContext.stroke();
    });

    const terrainTexture = new THREE.CanvasTexture(textureCanvas);
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1
    });
    
    const terrainMesh = new THREE.Mesh(terrainGeometry, groundMaterial);
    terrainMesh.receiveShadow = true;
    terrainMesh.position.set((maxX + minX) / 2, 0, (maxY + minY) / 2);
    scene.add(terrainMesh);

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

    // FIXED: Render buildings using their actual footprints and positions
    assets.forEach(asset => {
      if (!asset.assetMeta) return;

      // Get building center
      const assetCenter = getPolygonCenter(asset.path);
      const localCenter = proj.toLocal(assetCenter);
      const elevation = getElevationAt(localCenter.x, localCenter.y);

      // Create building shape from actual footprint (relative to center)
      const assetVertices = asset.path.map(p => {
        const local = proj.toLocal(p);
        return new THREE.Vector2(local.x - localCenter.x, local.y - localCenter.y);
      });
      
      const assetShape = new THREE.Shape(assetVertices);
      const floors = asset.assetMeta.floors ?? 1;
      const height = floors * 3.2;
      
      const geometry = new THREE.ExtrudeGeometry(assetShape, { 
        depth: height, 
        bevelEnabled: false
      });
      
      const material = createBuildingMaterial(asset.assetMeta.key || '');
      const mesh = new THREE.Mesh(geometry, material);

      // Position and orient building correctly
      mesh.rotation.x = -Math.PI / 2; // Make building vertical
      mesh.position.set(localCenter.x, elevation, localCenter.y);
      
      // Apply building rotation
      const rotationDegrees = asset.assetMeta.rotation ?? 0;
      mesh.rotation.z = -rotationDegrees * (Math.PI / 180);
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Add rooftop details
      if (floors > 2) {
        const hvacCount = Math.floor(floors / 3);
        for (let i = 0; i < hvacCount; i++) {
          const hvacGeometry = new THREE.BoxGeometry(1.5, 0.8, 1.2);
          const hvacMaterial = new THREE.MeshStandardMaterial({ color: '#696969' });
          const hvacMesh = new THREE.Mesh(hvacGeometry, hvacMaterial);
          
          const offsetX = (Math.random() - 0.5) * 4;
          const offsetZ = (Math.random() - 0.5) * 4;
          hvacMesh.position.set(
            localCenter.x + offsetX, 
            elevation + height + 0.4, 
            localCenter.y + offsetZ
          );
          hvacMesh.castShadow = true;
          scene.add(hvacMesh);
        }
      }
    });

    // Position camera
    const terrainBbox = new THREE.Box3().setFromObject(terrainMesh);
    const terrainCenter = terrainBbox.getCenter(new THREE.Vector3());
    const terrainSize = terrainBbox.getSize(new THREE.Vector3());
    const cameraDistance = Math.max(terrainSize.x, terrainSize.z) * 1.2;

    camera.position.set(
      terrainCenter.x - cameraDistance * 0.7,
      cameraDistance * 0.8,
      terrainCenter.z + cameraDistance * 0.7
    );
    camera.lookAt(terrainCenter);
    controls.target.copy(terrainCenter);

    // Add trees and vegetation
    const createTree = (x: number, y: number, z: number, scale = 1) => {
      const treeGroup = new THREE.Group();
      
      const trunkGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 3 * scale, 6);
      const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color().setHSL(0.06, 0.4, 0.3),
        roughness: 0.9 
      });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = (1.5 * scale);
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const foliageLevels = 2 + Math.floor(Math.random() * 2);
      for (let level = 0; level < foliageLevels; level++) {
        const levelScale = 1 - (level * 0.3);
        const foliageGeometry = new THREE.SphereGeometry(2 * scale * levelScale, 8, 6);
        const hue = 0.25 + (Math.random() - 0.5) * 0.1;
        const foliageMaterial = new THREE.MeshStandardMaterial({ 
          color: new THREE.Color().setHSL(hue, 0.6, 0.3 + Math.random() * 0.2),
          roughness: 0.8 
        });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = (3 + level * 1.5) * scale;
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        treeGroup.add(foliage);
      }

      treeGroup.position.set(x, y, z);
      return treeGroup;
    };

    // Place trees around the site
    const placedTrees: { x: number, y: number }[] = [];
    const minTreeDistance = 8;

    for (let i = 0; i < 30; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      
      const tooClose = placedTrees.some(tree => 
        Math.sqrt(Math.pow(tree.x - x, 2) + Math.pow(tree.y - y, 2)) < minTreeDistance
      );
      
      if (!tooClose) {
        const elevation = getElevationAt(x, y);
        const treeScale = 0.7 + Math.random() * 0.6;
        const tree = createTree(x, elevation, y, treeScale);
        scene.add(tree);
        placedTrees.push({ x, y });
      }
    }

    // Animation loop
    let animationFrameId: number;
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