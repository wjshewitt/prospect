
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp, Orbit, MousePointer, X } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Earcut } from 'three/src/extras/Earcut';


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

    const controls = (camera as any)._controls;
    if (controls && controls.addEventListener) {
      controls.addEventListener('change', updateCompass);
      updateCompass(); // Initial update
      return () => controls.removeEventListener('change', updateCompass);
    }
  }, [camera]);

  return (
    <div className="absolute top-4 right-4 w-16 h-16 bg-background/50 rounded-full flex items-center justify-center text-foreground backdrop-blur-sm shadow-lg pointer-events-none">
      <div
        className="relative w-full h-full transition-transform"
        style={{ transform: `rotate(${-rotation}rad)` }}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 font-bold text-lg">N</div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-sm">S</div>
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-sm">W</div>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 text-sm">E</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <ArrowUp className="w-6 h-6 text-red-500" />
      </div>
    </div>
  );
};


interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
  elevationGrid: ElevationGrid;
  onDeleteAsset: (assetId: string) => void;
}

export function ThreeDVisualizationModal({ assets, zones, boundary, elevationGrid, onDeleteAsset }: ThreeDVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{mesh: THREE.Mesh, shape: Shape} | null>(null);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAsset) {
        onDeleteAsset(selectedAsset.shape.id);
        setSelectedAsset(null); // Deselect after deletion
      }
  }, [selectedAsset, onDeleteAsset]);
  
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);


  useEffect(() => {
    if (!mountRef.current || !boundary || !elevationGrid || !elevationGrid.pointGrid) return;

    const mountNode = mountRef.current;
    let animationFrameId: number;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    const camera = new THREE.PerspectiveCamera(65, mountNode.clientWidth / mountNode.clientHeight, 0.1, 10000);
    cameraRef.current = camera;
    
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
    rendererRef.current = renderer;
    mountNode.appendChild(renderer.domElement);


    // Lighting
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFF8DC, 1.5);
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

    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x4F2E14, 0.5);
    scene.add(hemiLight);

    // Controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.screenSpacePanning = false;
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 1000;
    orbitControls.maxPolarAngle = Math.PI / 2.1;
    (camera as any)._controls = orbitControls;


    // Raycasting for object selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectableMeshes: THREE.Mesh[] = [];

    const onMouseClick = (event: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(selectableMeshes);

        if (intersects.length > 0) {
            const firstIntersect = intersects[0].object;
            if (firstIntersect instanceof THREE.Mesh) {
                const shape = (firstIntersect.userData as {shape: Shape}).shape;
                setSelectedAsset({mesh: firstIntersect, shape});
            }
        } else {
            setSelectedAsset(null);
        }
    };
    mountNode.addEventListener('click', onMouseClick);
    

    // SHARED MAP-SPACE ORIENTATION
    const geoGroup = new THREE.Group();
    geoGroup.rotation.x = -Math.PI / 2;
    scene.add(geoGroup);

    // Coordinate System & Projections (local tangent plane)
    const siteCenter = getPolygonCenter(boundary.path);
    const R_EARTH = 6371e3; // meters
    const COS_LAT = Math.cos(siteCenter.lat * Math.PI / 180);

    const proj = {
      toLocal: (p: LatLng) => {
        const dLat = (p.lat - siteCenter.lat) * Math.PI / 180;
        const dLng = (p.lng - siteCenter.lng) * Math.PI / 180;
        const x = dLng * R_EARTH * COS_LAT;
        const y = -dLat * R_EARTH;
        return { x, y };
      },
       xyToLL: (x: number, y: number): LatLng => {
        const dLat = -y / R_EARTH;
        const dLng = x / (R_EARTH * COS_LAT);
        return {
            lat: siteCenter.lat + dLat * 180 / Math.PI,
            lng: siteCenter.lng + dLng * 180 / Math.PI,
        };
      },
    };

    // Elevation Data
    const { grid, nx, ny } = elevationGrid.pointGrid!;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;

    const getElevationAt = (x: number, y: number): number => {
      if (!grid || nx < 2 || ny < 2) return 0;
      const u = ((x - minX) / (maxX - minX)) * (nx - 1);
      const v = 1 - ((y - minY) / (maxY - minY)); // Invert v-coordinate
      const i = Math.floor(u);
      const j = Math.floor(v * (ny - 1));
      if (i < 0 || i >= nx - 1 || j < 0 || j >= ny - 1) return 0;
      const s = u - i;
      const t = v * (ny - 1) - j;
      const z00 = grid[j * nx + i];
      const z10 = grid[j * nx + i + 1];
      const z01 = grid[(j + 1) * nx + i];
      const z11 = grid[(j + 1) * nx + i + 1];
      if (!isFinite(z00) || !isFinite(z10) || !isFinite(z01) || !isFinite(z11)) return 0;
      const z0 = z00 * (1 - s) + z10 * s;
      const z1 = z01 * (1 - s) + z11 * s;
      return z0 * (1 - t) + z1 * t;
    };

    // Create Terrain from boundary shape
    const boundaryPoints = boundary.path.map(p => proj.toLocal(p));
    
    // Triangulate the polygon shape
    const vertices = boundaryPoints.flatMap(p => [p.x, p.y]);
    const holes: number[] = []; // Assuming no holes for simplicity
    const triangles = Earcut.triangulate(vertices, holes, 2);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(triangles.length * 3);
    
    for (let i = 0; i < triangles.length; i++) {
        const index = triangles[i];
        const x = vertices[index * 2];
        const y = vertices[index * 2 + 1];
        const z = getElevationAt(x, y);
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // --- Zone Coloring Logic ---
    const getZoneMaterial = (kind: Shape['zoneMeta']['kind']) => {
        let color: THREE.ColorRepresentation = 0x555555; // Default grey
        switch(kind) {
            case 'residential': color = 0x4CAF50; break; // Green
            case 'commercial': color = 0x2196F3; break; // Blue
            case 'amenity': color = 0xFFC107; break; // Amber
            case 'green_space': color = 0x2E7D32; break; // Darker Green
            case 'solar': color = 0xFF9800; break; // Orange
        }
        return new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9, metalness: 0.1 });
    }

    const materials = [
        new THREE.MeshStandardMaterial({ color: 0x2D5016, side: THREE.DoubleSide, roughness: 0.9, metalness: 0.1 }), // Default terrain
        ...zones.map(z => getZoneMaterial(z.zoneMeta?.kind)),
    ];
    const zoneMaterialMap = new Map(zones.map((z, i) => [z.id, i + 1]));

    // Check which zone each face belongs to
    const faceCount = triangles.length / 3;

    for (let i = 0; i < faceCount; i++) {
        const vA = new THREE.Vector3(positions[i*9 + 0], positions[i*9 + 1], positions[i*9 + 2]);
        const vB = new THREE.Vector3(positions[i*9 + 3], positions[i*9 + 4], positions[i*9 + 5]);
        const vC = new THREE.Vector3(positions[i*9 + 6], positions[i*9 + 7], positions[i*9 + 8]);
        const center = new THREE.Vector3().add(vA).add(vB).add(vC).divideScalar(3);

        let materialIndex = 0; // Default terrain
        for (const zone of zones) {
            const googleZone = new google.maps.Polygon({ paths: zone.path });
            const centerLL = proj.xyToLL(center.x, -center.y);
            if(google.maps.geometry.poly.containsLocation(new google.maps.LatLng(centerLL), googleZone)) {
                materialIndex = zoneMaterialMap.get(zone.id) ?? 0;
                break; // Assign to first matching zone
            }
        }
        
        geometry.addGroup(i * 3, 3, materialIndex);
    }
    
    geometry.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(geometry, materials);
    terrainMesh.receiveShadow = true;
    geoGroup.add(terrainMesh);


    // Asset materials
    const buildingMaterial = new THREE.MeshStandardMaterial({ color: '#D2B48C', roughness: 0.8, metalness: 0.0 });
    const solarPanelMaterial = new THREE.MeshStandardMaterial({ color: '#0A2A48', roughness: 0.2, metalness: 0.6 });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: '#ff8c00', emissive: '#ff8c00', emissiveIntensity: 0.5 });
    
    const originalMaterials = new WeakMap();


    const shapeFromPathRelativeToCenter = (path: LatLng[], centerXY: { x: number; y: number }) => {
      const points = path.map(p => {
        const l = proj.toLocal(p);
        return new THREE.Vector2(l.x - centerXY.x, l.y - centerXY.y);
      });
      return new THREE.Shape(points);
    };

    // Render assets
    assets.forEach(asset => {
      if (!asset.assetMeta) return;

      const assetCenterLL = getPolygonCenter(asset.path);
      const centerXY = proj.toLocal(assetCenterLL);
      const baseElevation = getElevationAt(centerXY.x, centerXY.y);
      const footprintShape = shapeFromPathRelativeToCenter(asset.path, centerXY);
      
      let height = 0;
      let material: THREE.Material;

      if(asset.assetMeta.assetType === 'building') {
        height = (asset.assetMeta.floors ?? 1) * 3.2;
        material = buildingMaterial.clone();
      } else if(asset.assetMeta.assetType === 'solar_panel') {
        height = 0.1;
        material = solarPanelMaterial.clone();
      } else {
        return; // Skip unknown asset types
      }

      const geometry = new THREE.ExtrudeGeometry(footprintShape, { depth: height, bevelEnabled: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { shape: asset, originalMaterial: material }; // Store shape data
      originalMaterials.set(mesh, material);
      selectableMeshes.push(mesh);
      
      const pivot = new THREE.Object3D();
      const elevationOffset = asset.assetMeta.assetType === 'solar_panel' ? 0.1 : 0;
      pivot.position.set(centerXY.x, centerXY.y, baseElevation + elevationOffset);
      pivot.add(mesh);
      pivot.rotation.z = - (asset.assetMeta.rotation ?? 0) * (Math.PI / 180);
      geoGroup.add(pivot);
    });

    // Camera framing
    const groupBBox = new THREE.Box3().setFromObject(geoGroup);
    const groupCenter = groupBBox.getCenter(new THREE.Vector3());
    const groupSize = groupBBox.getSize(new THREE.Vector3());
    const radius = Math.max(groupSize.x, groupSize.z) * 0.6;
    
    camera.position.set( groupCenter.x - radius * 0.8, groupCenter.y + radius * 0.9, groupCenter.z + radius * 0.8 );
    camera.lookAt(groupCenter);
    orbitControls.target.copy(groupCenter);

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      selectableMeshes.forEach(mesh => {
        if (selectedAsset?.mesh === mesh) {
            mesh.material = selectedMaterial;
        } else {
            mesh.material = originalMaterials.get(mesh) || mesh.userData.originalMaterial;
        }
      });
      
      orbitControls.update();
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
      mountNode.removeEventListener('click', onMouseClick);
      cancelAnimationFrame(animationFrameId);

      orbitControls.dispose();

      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (mountNode && renderer.domElement && mountNode.contains(renderer.domElement)) {
          mountNode.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, zones, boundary, elevationGrid]);


  return (
    <div className="relative w-full h-full bg-black">
      <div ref={mountRef} className="w-full h-full" />
      <Compass camera={cameraRef.current} />

      {selectedAsset && (
        <div className="absolute top-4 left-4 bg-background/80 p-2 rounded-md shadow-lg text-foreground text-sm flex items-center gap-2">
           <span>Selected: <span className="font-semibold">{selectedAsset.shape.assetMeta?.key}</span></span>
           <span className="text-xs text-muted-foreground">(Press Delete to remove)</span>
        </div>
      )}
    </div>
  );
}
