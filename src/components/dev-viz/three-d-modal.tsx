

'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng } from '@/lib/types';

interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
}

export function ThreeDVisualizationModal({ assets, zones, boundary }: ThreeDVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current || !boundary) return;

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
    
    const mountNode = mountRef.current;
    
    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2638); // Dark blueish grey
    const camera = new THREE.PerspectiveCamera(75, mountNode.clientWidth / mountNode.clientHeight, 0.1, 10000);
    camera.position.set(0, 150, 250);
    camera.lookAt(0,0,0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.shadowMap.enabled = true;
    mountNode.appendChild(renderer.domElement);

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
    
    // --- Coordinate System ---
    const siteCenter = getPolygonCenter(boundary.path);
    const toLocal = (p: LatLng) => {
        const R = 6371e3; // metres
        const φ1 = siteCenter.lat * Math.PI/180;
        const φ2 = p.lat * Math.PI/180;
        const Δφ = (p.lat-siteCenter.lat) * Math.PI/180;
        const Δλ = (p.lng-siteCenter.lng) * Math.PI/180;
        
        const y = Δφ * R;
        const x = Δλ * R * Math.cos(φ1);
        return { x, y };
    };
    
    // --- Ground Plane (from boundary) ---
    const groundPath = boundary.path.map(p => {
        const local = toLocal(p);
        return new THREE.Vector2(local.x, local.y);
    });
    const groundShape = new THREE.Shape(groundPath);
    const groundGeometry = new THREE.ShapeGeometry(groundShape);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5a40, side: THREE.DoubleSide });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // --- Render Zones ---
    zones.forEach(zone => {
        const zonePath = zone.path.map(p => {
            const local = toLocal(p);
            return new THREE.Vector2(local.x, local.y);
        });
        const zoneShape = new THREE.Shape(zonePath);
        const zoneGeometry = new THREE.ShapeGeometry(zoneShape);

        let color = '#ffffff';
        switch(zone.zoneMeta?.kind) {
            case 'residential': color = '#86efac'; break; // green-300
            case 'commercial': color = '#93c5fd'; break; // blue-300
            case 'amenity': color = '#fcd34d'; break; // amber-300
            case 'green_space': color = '#22c55e'; break; // green-500
        }
        const zoneMaterial = new THREE.MeshStandardMaterial({ 
            color, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0.6 
        });
        const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
        zoneMesh.position.y = 0.1; // Slightly above ground
        zoneMesh.rotation.x = -Math.PI / 2;
        scene.add(zoneMesh);
    });

    // --- Render Assets ---
    assets.forEach(asset => {
        if (!asset.assetMeta) return;

        // 1. Calculate local position
        const assetCenter = getPolygonCenter(asset.path);
        const localPos = toLocal(assetCenter);

        // 2. Generate 2D shape for extrusion base
        const assetVertices = asset.path.map(p => {
            const local = toLocal(p);
            // Translate vertices so they are relative to the asset's own center
            return new THREE.Vector2(local.x - localPos.x, local.y - localPos.y);
        });
        const assetShape = new THREE.Shape(assetVertices);

        // 3. Create 3D geometry
        const floors = asset.assetMeta.floors ?? 1;
        const height = floors * 3; // 3m per floor
        const extrudeSettings = { depth: height, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(assetShape, extrudeSettings);
        
        // 4. Create Mesh and Material
        let color = '#ADD8E6'; // Default (commercial)
        const assetKey = asset.assetMeta.key || '';
        if (assetKey.includes('house') || assetKey.includes('bungalow')) {
            color = '#8B4513'; // Brownish
        } else if (assetKey.includes('flat_block')) {
            color = '#B0B0B0'; // Light grey
        }
        const material = new THREE.MeshStandardMaterial({ color });

        const mesh = new THREE.Mesh(geometry, material);
        
        // 5. Position and Rotate
        mesh.position.set(localPos.x, height / 2, -localPos.y); // Y is up, Z is negative of local Y
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
      
      // Dispose all scene objects
      scene.children.forEach(child => {
        if(child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                (child.material as THREE.Material).dispose();
            }
        }
      });

      if(mountNode && renderer.domElement){
          mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [assets, zones, boundary]); // Re-run when project data changes

  return (
    <div className="relative w-full h-full bg-black">
        <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
