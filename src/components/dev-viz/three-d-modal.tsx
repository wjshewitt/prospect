
'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng } from '@/lib/types';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

interface ThreeDVisualizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Shape[];
  boundary?: Shape;
}

// Helper to calculate the center of a polygon
const getPolygonCenter = (path: LatLng[]): LatLng => {
  const bounds = new google.maps.LatLngBounds();
  path.forEach(p => bounds.extend(p));
  return bounds.getCenter().toJSON();
};

export function ThreeDVisualizationModal({ isOpen, onClose, assets, boundary }: ThreeDVisualizationModalProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    if (!isOpen || !mountRef.current || !boundary) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x1a2638);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 100, 150);
    camera.lookAt(0,0,0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(-100, 150, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.top = 250;
    directionalLight.shadow.camera.bottom = -250;
    directionalLight.shadow.camera.left = -250;
    directionalLight.shadow.camera.right = 250;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
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
    
    // --- Ground Plane ---
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

    // --- Asset Generation ---
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    assets.forEach(asset => {
        if (asset.id === boundary.id) return; // Skip the boundary itself

        // 1. Calculate local position
        const assetCenter = getPolygonCenter(asset.path);
        const localPos = toLocal(assetCenter);

        // 2. Generate 2D shape
        const assetVertices = asset.path.map(p => {
            const local = toLocal(p);
            // Translate vertices so they are relative to the asset's own center
            return new THREE.Vector2(local.x - localPos.x, local.y - localPos.y);
        });
        const assetShape = new THREE.Shape(assetVertices);

        // 3. Create 3D geometry
        const floors = (asset as any).floors ?? 1;
        const height = floors * 3;
        const extrudeSettings = { depth: height, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(assetShape, extrudeSettings);
        geometries.push(geometry);

        // 4. Create Mesh and Material
        let color = '#ADD8E6'; // Default (commercial, community)
        const assetKey = (asset as any).typeKey || '';
        if (assetKey.includes('house') || assetKey.includes('bungalow')) {
            color = '#8B4513'; // Brownish
        } else if (assetKey.includes('flat_block')) {
            color = '#B0B0B0'; // Light grey
        }
        const material = new THREE.MeshStandardMaterial({ color });
        materials.push(material);

        const mesh = new THREE.Mesh(geometry, material);
        
        // 5. Position and Rotate
        mesh.position.set(localPos.x, height / 2, -localPos.y); // Y is up, Z is negative of local Y
        mesh.rotation.x = -Math.PI / 2; // Align shape with XY plane first
        
        const rotationDegrees = (asset as any).rotation ?? 0;
        mesh.rotation.z = -rotationDegrees * (Math.PI / 180); // Z-axis rotation in Three.js corresponds to map rotation
        
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
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      scene.children.forEach(child => {
        if(child instanceof THREE.Mesh) {
            child.geometry.dispose();
            child.material.dispose();
        }
      });
      if(mountRef.current && renderer.domElement){
          mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sceneRef.current = null;
    };
  }, [isOpen, assets, boundary]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div ref={mountRef} className="w-full h-full" />
        <Button
            variant="secondary"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 z-50"
        >
            <X />
        </Button>
    </div>
  );
}
