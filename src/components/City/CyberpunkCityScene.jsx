import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { useStore } from '../../state/useStore';

const CyberpunkCityScene = () => {
  const { debugMode, setCityBounds, setLoading } = useStore();
  const [cityLoaded, setCityLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  
  // Get access to Three.js context
  const { scene, gl, invalidate } = useThree();
  
  // Refs
  const cityRef = useRef();
  
  // Use drei's useGLTF hook to load the model
  useEffect(() => {
    if (cityLoaded) return;
    
    console.log("Loading city model...");
    setLoading(true);
    
    // Create a standard GLTFLoader
    const gltfLoader = new GLTFLoader();
    
    // Load the city model
    gltfLoader.load(
      // URL
      '/models/cybercity/scene.gltf',
      
      // onLoad callback
      (gltf) => {
        console.log("City model loaded successfully!", gltf);
        
        // Scale the model if needed
        gltf.scene.scale.set(0.01, 0.01, 0.01);
        
        // Add to scene
        if (cityRef.current) {
          cityRef.current.add(gltf.scene);
          
          // Calculate bounding box for navigation
          const boundingBox = new THREE.Box3().setFromObject(gltf.scene);
          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          
          setCityBounds({
            min: boundingBox.min,
            max: boundingBox.max,
            size: size
          });
          
          // Mark as loaded
          setCityLoaded(true);
          setLoading(false);
          
          console.log("City model added to scene");
          
          // Trigger a render
          invalidate();
        }
      },
      
      // onProgress callback
      (xhr) => {
        const progress = xhr.loaded / xhr.total;
        console.log(`Model loading progress: ${(progress * 100).toFixed(0)}%`);
      },
      
      // onError callback
      (error) => {
        console.error("Error loading city model:", error);
        setLoadingError(true);
        setLoading(false);
      }
    );
  }, [cityLoaded, setCityBounds, setLoading, invalidate]);
  
  return (
    <group>
      {/* Cyberpunk environment */}
      <fog attach="fog" args={['#050023', 0.0012]} />
      <color attach="background" args={['#05001E']} />
      
      {/* Simple lighting */}
      <ambientLight intensity={0.2} color="#2211AA" />
      <directionalLight position={[5, 30, 5]} intensity={0.4} color="#7040FF" />
      <pointLight position={[10, 25, 10]} intensity={0.8} color="#00FFFF" distance={90} />
      <pointLight position={[-10, 20, -10]} intensity={0.7} color="#FF10F0" distance={90} />
      
      {/* City model container */}
      <group ref={cityRef} />
      
      {/* Simple loading indicator */}
      {!cityLoaded && !loadingError && (
        <mesh position={[0, 10, 0]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#FF10F0" />
          <pointLight color="#FF10F0" intensity={3} distance={20} />
        </mesh>
      )}
      
      {/* Error indicator */}
      {loadingError && (
        <mesh position={[0, 10, 0]}>
          <boxGeometry args={[3, 3, 3]} />
          <meshBasicMaterial color="#FF0000" />
        </mesh>
      )}
    </group>
  );
};

export default CyberpunkCityScene;