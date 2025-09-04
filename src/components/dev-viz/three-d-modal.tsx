

'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { BufferGeometry, Float32BufferAttribute } from 'three';

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
      return path[0] || { lat: 0, lng: 0};
    }
    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    return bounds.getCenter().toJSON();
};

export function ThreeDVisualizationModal({ assets, zones, boundary, elevationGrid }: ThreeDVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current || !boundary || !elevationGrid) return;

    const mountNode = mountRef.current;
    
    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2638);
    const camera = new THREE.PerspectiveCamera(75, mountNode.clientWidth / mountNode.clientHeight, 0.1, 10000);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.shadowMap.enabled = true;
    mountNode.appendChild(renderer.domElement);
    const canvasElement = renderer.domElement;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(-150, 200, 150);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    scene.add(directionalLight);
    
    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // --- Coordinate System & Projections ---
    const siteCenter = getPolygonCenter(boundary.path);
    const proj = {
        toLocal: (p: LatLng) => {
            const R = 6371e3; // metres
            const φ1 = siteCenter.lat * Math.PI/180;
            const dLat = (p.lat-siteCenter.lat) * Math.PI/180;
            const dLng = (p.lng-siteCenter.lng) * Math.PI/180;
            const x = dLng * R * Math.cos(φ1);
            const y = dLat * R;
            return { x, y: -y }; // y is inverted for Three.js (z becomes negative)
        },
    };

    // --- Elevation Data Interpolation ---
    const { grid, nx, ny } = elevationGrid.pointGrid!;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;
    const elevRange = elevationGrid.maxElevation! - elevationGrid.minElevation!;

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
        
        // Bilinear interpolation
        const z0 = z00 * (1 - s) + z10 * s;
        const z1 = z01 * (1 - s) + z11 * s;
        return z0 * (1 - t) + z1 * t;
    };
    
    // --- Ground Plane (from boundary) ---
    const groundShape = new THREE.Shape(boundary.path.map(p => {
        const local = proj.toLocal(p);
        return new THREE.Vector2(local.x, local.y);
    }));

    // --- Create Topographic Terrain Mesh ---
    const terrainDivisionsX = 100;
    const terrainDivisionsY = 100;

    const terrainGeometry = new THREE.PlaneGeometry(
        maxX - minX,
        maxY - minY,
        terrainDivisionsX,
        terrainDivisionsY
    );
    terrainGeometry.rotateX(-Math.PI / 2);

    const positions = terrainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) + minX + (maxX-minX)/2;
        const z = positions.getZ(i) - minY - (maxY-minY)/2; // z is inverted
        const y = getElevationAt(x, -z); // use inverted z for lookup
        positions.setY(i, y);
    }
    terrainGeometry.computeVertexNormals();
    
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5a40, side: THREE.DoubleSide });
    const terrainMesh = new THREE.Mesh(terrainGeometry, groundMaterial);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);


    // Adjust camera to fit the terrain
    const terrainBbox = new THREE.Box3().setFromObject(terrainMesh);
    const terrainCenter = terrainBbox.getCenter(new THREE.Vector3());
    const terrainSize = terrainBbox.getSize(new THREE.Vector3());
    const cameraDistance = Math.max(terrainSize.x, terrainSize.y, terrainSize.z) * 1.5;
    
    camera.position.copy(terrainCenter);
    camera.position.y += cameraDistance / 2;
    camera.position.z += cameraDistance;
    camera.lookAt(terrainCenter);
    controls.target.copy(terrainCenter);
    
    
    // --- Render Zones as decals on the terrain ---
    zones.forEach(zone => {
        const zonePath = zone.path.map(p => {
            const local = proj.toLocal(p);
            return new THREE.Vector2(local.x, local.y);
        });
        const zoneShape = new THREE.Shape(zonePath);
        const zoneGeometry = new THREE.ShapeGeometry(zoneShape);

        let color = '#ffffff';
        switch(zone.zoneMeta?.kind) {
            case 'residential': color = '#86efac'; break;
            case 'commercial': color = '#93c5fd'; break;
            case 'amenity': color = '#fcd34d'; break;
            case 'green_space': color = '#22c55e'; break;
        }
        const zoneMaterial = new THREE.MeshStandardMaterial({ 
            color, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0.6,
            polygonOffset: true, // Prevents z-fighting
            polygonOffsetFactor: -1.0,
            polygonOffsetUnits: -4.0
        });
        const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
        zoneMesh.rotation.x = -Math.PI / 2;
        // No need to set y position, it will be handled by the offset
        scene.add(zoneMesh);
    });
    

    // --- Render Assets on the terrain ---
    assets.forEach(asset => {
        if (!asset.assetMeta) return;

        const assetCenter = getPolygonCenter(asset.path);
        const localPos = proj.toLocal(assetCenter);
        const elevation = getElevationAt(localPos.x, localPos.y);

        const assetVertices = asset.path.map(p => {
            const local = proj.toLocal(p);
            return new THREE.Vector2(local.x - localPos.x, local.y - localPos.y);
        });
        const assetShape = new THREE.Shape(assetVertices);

        const floors = asset.assetMeta.floors ?? 1;
        const height = floors * 3;
        const extrudeSettings = { depth: height, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(assetShape, extrudeSettings);
        
        let color = '#ADD8E6';
        const assetKey = asset.assetMeta.key || '';
        if (assetKey.includes('house') || assetKey.includes('bungalow')) {
            color = '#8B4513';
        } else if (assetKey.includes('flat_block')) {
            color = '#B0B0B0';
        }
        const material = new THREE.MeshStandardMaterial({ color });

        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(localPos.x, elevation + height / 2, localPos.y);
        mesh.rotation.x = -Math.PI / 2;
        
        const rotationDegrees = asset.assetMeta.rotation ?? 0;
        mesh.rotation.z = -rotationDegrees * (Math.PI / 180);
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
    });

    // --- Animation Loop ---
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Resize Listener ---
    const handleResize = () => {
      if (!mountNode) return;
      camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
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
                object.material.forEach(material => material.dispose());
            } else if (object.material) {
                (object.material as THREE.Material).dispose();
            }
        }
      });
      
      if (mountNode && mountNode.contains(canvasElement)) {
        mountNode.removeChild(canvasElement);
      }
      renderer.dispose();
    };
  }, [assets, zones, boundary, elevationGrid]);

  return (
    <div className="relative w-full h-full bg-black">
        <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
