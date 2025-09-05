'use client';

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp } from 'lucide-react';


const Compass = ({ rotation }: { rotation: number }) => (
    <div className="absolute top-4 right-4 w-16 h-16 bg-background/50 rounded-full flex items-center justify-center text-foreground backdrop-blur-sm shadow-lg pointer-events-none z-50">
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


interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
  elevationGrid: ElevationGrid;
  onDeleteAsset: (assetId: string) => void;
}

export function ThreeDVisualizationModal({ 
    assets, 
    zones, 
    boundary, 
    elevationGrid,
    onDeleteAsset
}: ThreeDVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [compassRotation, setCompassRotation] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<{mesh: THREE.Mesh, shape: Shape} | null>(null);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAsset) {
      onDeleteAsset(selectedAsset.shape.id);
      setSelectedAsset(null);
    }
  }, [selectedAsset, onDeleteAsset]);
  
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);


  const projection = useMemo(() => {
    const origin = new THREE.Vector2(boundary.path[0].lng, boundary.path[0].lat);
    return {
      project: (p: LatLng) => {
        const R = 6371e3;
        const dLat = (p.lat - origin.y) * (Math.PI / 180);
        const dLon = (p.lng - origin.x) * (Math.PI / 180);
        const y = dLat * R;
        const x = dLon * R * Math.cos(origin.y * (Math.PI / 180));
        return new THREE.Vector3(x, 0, -y); // Y is up, Z is north
      },
    };
  }, [boundary.path]);

  useEffect(() => {
    if (!mountRef.current || !elevationGrid.pointGrid || !elevationGrid.xyBounds) return;

    const mountNode = mountRef.current;
    let animationFrameId: number;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    
    const camera = new THREE.PerspectiveCamera(
      75, 
      mountNode.clientWidth / mountNode.clientHeight, 
      0.1, 
      10000
    );
    
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountNode.appendChild(renderer.domElement);

    // Enhanced Lighting
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFF8DC, 2.5);
    sunLight.position.set(1000, 3000, 1000);
    sunLight.castShadow = true;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 10000;
    sunLight.shadow.camera.top = 4000;
    sunLight.shadow.camera.bottom = -4000;
    sunLight.shadow.camera.left = -4000;
    sunLight.shadow.camera.right = 4000;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);
    
    // Controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.1;
    orbitControls.screenSpacePanning = false;
    orbitControls.minDistance = 50;
    orbitControls.maxDistance = 8000;
    orbitControls.maxPolarAngle = Math.PI / 2.1;

    // Raycasting for selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectableMeshes: THREE.Mesh[] = [];

    const onMouseClick = (event: MouseEvent) => {
      if (!renderer.domElement.parentElement?.contains(event.target as Node)) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(selectableMeshes);

      setSelectedAsset(null); // Deselect previous
      if (intersects.length > 0) {
        const firstIntersect = intersects[0].object;
        if (firstIntersect instanceof THREE.Mesh) {
          const shape = (firstIntersect.userData as {shape: Shape}).shape;
          setSelectedAsset({mesh: firstIntersect, shape});
        }
      }
    };
    mountNode.addEventListener('click', onMouseClick);
    
    // Terrain Geometry
    const { grid, nx, ny } = elevationGrid.pointGrid;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds;
    const terrainGeometry = new THREE.PlaneGeometry(maxX - minX, maxY - minY, nx - 1, ny - 1);
    const vertices = terrainGeometry.attributes.position;

    const validElevations = grid.filter(isFinite);
    const avgElevation = validElevations.reduce((a, b) => a + b, 0) / (validElevations.length || 1);

    for (let i = 0; i < vertices.count; i++) {
        const z = grid[i];
        vertices.setY(i, isFinite(z) ? z - avgElevation : 0);
    }
    terrainGeometry.computeVertexNormals();

    const terrainMaterial = new THREE.MeshStandardMaterial({
        color: '#A8A29E', // stone-400
        roughness: 0.8,
        metalness: 0.1,
    });
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.receiveShadow = true;
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    // Boundary Outline
    const boundaryPoints = boundary.path.map(p => projection.project(p));
    const boundaryLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([...boundaryPoints, boundaryPoints[0]]),
      new THREE.LineBasicMaterial({ color: '#ef4444', linewidth: 2 })
    );
    boundaryLine.position.y = 2; // Lift slightly above terrain
    scene.add(boundaryLine);

    // Zones
    zones.forEach(zone => {
      const shapePoints = zone.path.map(p => projection.project(p));
      const shape = new THREE.Shape(shapePoints.map(p => new THREE.Vector2(p.x, p.z)));
      const zoneGeometry = new THREE.ShapeGeometry(shape);
      
      let zoneColor = 0x555555;
      switch(zone.zoneMeta?.kind) {
        case 'residential': zoneColor = 0x4CAF50; break;
        case 'commercial': zoneColor = 0x2196F3; break;
        case 'amenity': zoneColor = 0xFFC107; break;
        case 'green_space': zoneColor = 0x2E7D32; break;
        case 'solar': zoneColor = 0xFF9800; break;
      }
      
      const zoneMaterial = new THREE.MeshBasicMaterial({ 
        color: zoneColor, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      
      const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
      zoneMesh.rotation.x = -Math.PI / 2;
      zoneMesh.position.y = 1; // Draw slightly above terrain
      scene.add(zoneMesh);
    });

    // Asset Materials
    const buildingMaterial = new THREE.MeshStandardMaterial({ color: '#D2B48C', roughness: 0.7, metalness: 0.1 });
    const solarPanelMaterial = new THREE.MeshStandardMaterial({ color: '#0A2A48', roughness: 0.2, metalness: 0.8 });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: '#ff8c00', emissive: '#ff8c00', emissiveIntensity: 0.5 });
    const originalMaterials = new WeakMap();

    // Assets (Buildings, etc.)
    assets.forEach(asset => {
        if (!asset.assetMeta) return;

        const assetPoints = asset.path.map(p => projection.project(p));
        const assetShape = new THREE.Shape(assetPoints.map(p => new THREE.Vector2(p.x, p.z)));
        const height = asset.assetMeta.assetType === 'building' 
            ? (asset.assetMeta.floors ?? 1) * 3.2 
            : 0.1;
        
        const extrudeSettings = { depth: height, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(assetShape, extrudeSettings);

        const material = asset.assetMeta.assetType === 'building' 
            ? buildingMaterial.clone() 
            : solarPanelMaterial.clone();

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { shape: asset, originalMaterial: material };
        originalMaterials.set(mesh, material);
        selectableMeshes.push(mesh);
        
        // Position mesh on terrain
        const centerPoint = new THREE.Vector3();
        new THREE.Box3().setFromPoints(assetPoints).getCenter(centerPoint);
        raycaster.set(new THREE.Vector3(centerPoint.x, 1000, centerPoint.z), new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrain);
        if (intersects.length > 0) {
            mesh.position.y = intersects[0].point.y;
        } else {
            mesh.position.y = -avgElevation; // Fallback
        }
        scene.add(mesh);
    });

    // Camera setup
    const center = new THREE.Vector3((minX + maxX) / 2, -avgElevation, -(minY + maxY) / 2);
    const size = Math.max(maxX - minX, maxY - minY);
    camera.position.set(center.x, center.y + size * 1.5, center.z + size);
    camera.lookAt(center);
    orbitControls.target.copy(center);

    // Compass update logic
    const updateCompass = () => {
        const vector = new THREE.Vector3();
        camera.getWorldDirection(vector);
        const angle = Math.atan2(vector.x, vector.z);
        setCompassRotation(angle);
    };
    orbitControls.addEventListener('change', updateCompass);
    updateCompass();

    // Animation loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      selectableMeshes.forEach(mesh => {
        mesh.material = (selectedAsset?.mesh === mesh) 
          ? selectedMaterial 
          : originalMaterials.get(mesh) || mesh.userData.originalMaterial;
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
      orbitControls.removeEventListener('change', updateCompass);
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
  }, [assets, zones, boundary, elevationGrid, projection, onDeleteAsset, selectedAsset]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={mountRef} className="w-full h-full" />
      <Compass rotation={compassRotation} />
       {selectedAsset && (
        <div className="absolute top-4 left-4 bg-background/80 p-2 rounded-md shadow-lg text-foreground text-sm flex items-center gap-2">
          <span>Selected: <span className="font-semibold">{selectedAsset.shape.assetMeta?.key}</span></span>
          <span className="text-xs text-muted-foreground">(Press Delete to remove)</span>
        </div>
      )}
    </div>
  );
}
