import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useStore } from '../../state/useStore';

// Optimized CityScene with on-demand rendering support
const CityScene = () => {
  const { debugMode, setCityBounds, setLoading } = useStore();
  const [cityLoaded, setCityLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Get access to invalidate for on-demand rendering
  const { invalidate } = useThree();
  
  // Refs for scene elements
  const cityRef = useRef();
  
  // Pre-create and reuse objects instead of generating them in render loop
  const progressBoxRef = useRef(new THREE.Vector3(1, 0.4, 0.6));
  
  // Animation state with refs to avoid recreating objects
  const animationState = useRef({
    time: 0,
    materials: [],
    currentBatch: 0,
    batchSize: 20,
    updateInterval: 0.1, // seconds between updates
    lastUpdate: 0,
    runningAnimation: false, // Track if we need continuous animation
    animationNeedsUpdate: false // Flag to control when animations run
  });
  
  // Create loader once
  const loader = useMemo(() => new GLTFLoader(), []);
  
  // Load city model
  useEffect(() => {
    if (cityLoaded) return;
    
    console.log("Loading city model...");
    setLoading(true);
    
    // Load model with simplified error handling
    loader.load(
      '/models/cybercity/scene.gltf', // Same path as main.js
      (gltf) => {
        const model = gltf.scene;
        
        // Apply same scale as main.js
        model.scale.set(0.01, 0.01, 0.01);
        
        // Collect emissive materials without changing them frequently
        const emissiveMaterials = [];
        
        model.traverse((child) => {
          if (child.isMesh) {
            // Disable shadows for performance
            child.castShadow = false;
            child.receiveShadow = false;
            
            // Find materials with emissive properties
            if (child.material && child.material.emissive) {
              // Store reference to material with fixed intensity
              // Instead of animating continuously, use fixed values
              if (child.material.emissiveIntensity > 0) {
                // We'll only track materials that already have emission
                // Each material gets a random but fixed intensity instead of animating
                const intensity = 0.7 + Math.random() * 0.6;
                child.material.emissiveIntensity = intensity;
                
                // Only store materials we want to animate occasionally
                // Using a heuristic: 20% of emissive materials get animated
                if (Math.random() < 0.2) {
                  emissiveMaterials.push({
                    material: child.material,
                    position: [child.position.x, child.position.y, child.position.z],
                    phase: Math.random() * Math.PI * 2,
                    baseIntensity: intensity,
                  });
                }
              }
            }
            
            // Optimize material properties
            if (child.material && child.material.metalness !== undefined) {
              child.material.metalness = 0.4;
              child.material.roughness = 0.6;
              // Don't call convertSRGBToLinear in the loop - do it once if needed
            }
          }
        });
        
        // Add to scene
        if (cityRef.current) {
          cityRef.current.add(model);
          
          // Calculate bounds
          const boundingBox = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          
          setCityBounds({
            min: boundingBox.min,
            max: boundingBox.max,
            size: size
          });
          
          // Store emissive materials for animation
          animationState.current.materials = emissiveMaterials;
          
          // Mark as loaded
          setCityLoaded(true);
          setLoading(false);
          
          console.log(`City model loaded with ${emissiveMaterials.length} animated emissive materials`);
          
          // Request a render once the model is loaded
          invalidate();
        }
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total);
          setLoadingProgress(percent);
          // Request a render to update the loading progress
          invalidate();
        }
      },
      (error) => {
        console.error("Error loading city model:", error);
        loadFallbackModel();
      }
    );
  }, [cityLoaded, setLoading, setCityBounds, loader, invalidate]);
  
  // Create a simple fallback model if loading fails - only called once
  const loadFallbackModel = () => {
    console.log("Loading fallback model");
    
    // Create a ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        color: '#111111',
        roughness: 0.8,
        metalness: 0.2
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    
    // Create simple buildings
    const cityGroup = new THREE.Group();
    cityGroup.add(ground);
    
    // Add some simple buildings with shared geometry for performance
    const buildingGeo = new THREE.BoxGeometry(5, 1, 5);
    const materials = [
      new THREE.MeshStandardMaterial({
        color: '#333333'
      }),
      new THREE.MeshStandardMaterial({
        color: '#222222'
      }),
      new THREE.MeshStandardMaterial({
        color: '#222222',
        emissive: new THREE.Color('#00FFFF'),
        emissiveIntensity: 0.5
      })
    ];
    
    const emissiveMaterials = [];
    
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 100 - 50;
      const z = Math.random() * 100 - 50;
      const height = Math.random() * 15 + 5;
      
      const materialIndex = Math.floor(Math.random() * materials.length);
      const building = new THREE.Mesh(buildingGeo, materials[materialIndex]);
      building.position.set(x, height / 2, z);
      building.scale.set(1, height, 1);
      cityGroup.add(building);
      
      // Track only some emissive materials for animation
      if (materialIndex === 2 && Math.random() < 0.2) {
        emissiveMaterials.push({
          material: materials[materialIndex],
          position: [x, height/2, z],
          phase: Math.random() * Math.PI * 2,
          baseIntensity: 0.5
        });
      }
    }
    
    if (cityRef.current) {
      cityRef.current.add(cityGroup);
      
      // Calculate bounds
      const boundingBox = new THREE.Box3().setFromObject(cityGroup);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      setCityBounds({
        min: boundingBox.min,
        max: boundingBox.max,
        size: size
      });
      
      // Store emissive materials for animation
      animationState.current.materials = emissiveMaterials;
      
      setCityLoaded(true);
      setLoading(false);
      
      // Request a render once the model is loaded
      invalidate();
    }
  };

  // Animation patterns optimized for on-demand rendering
  useEffect(() => {
    // Only run animations occasionally for emissive materials
    const startRandomAnimations = () => {
      // Don't start new animations if we're already running one
      if (animationState.current.runningAnimation) return;
      
      // Only animate if we have materials to animate
      if (animationState.current.materials.length > 0) {
        // Flag that animation needs an update
        animationState.current.animationNeedsUpdate = true;
        animationState.current.runningAnimation = true;
        
        // Request a render to start animation
        invalidate();
        
        // Set a timeout to stop animations after a short period
        // This prevents continuous re-rendering when not needed
        setTimeout(() => {
          animationState.current.runningAnimation = false;
          animationState.current.animationNeedsUpdate = false;
        }, 2000); // Run animation for 2 seconds
      }
    };
    
    // Start random animations every 5-10 seconds
    const intervalId = setInterval(() => {
      // 30% chance to start animations at each interval
      if (Math.random() < 0.3) {
        startRandomAnimations();
      }
    }, 5000 + Math.random() * 5000);
    
    return () => clearInterval(intervalId);
  }, [invalidate]);

  // Optimized animation for emissive materials using delta time
  useFrame(({ clock }, delta) => {
    const state = animationState.current;
    state.time += delta;
    
    // If we're not in an animation cycle, skip updates
    if (!state.runningAnimation || !state.animationNeedsUpdate) return;
    
    // Only update materials on an interval for better performance
    if (state.time - state.lastUpdate < state.updateInterval) return;
    state.lastUpdate = state.time;
    
    // Get the materials to update in this batch
    const materials = state.materials;
    
    if (!materials || materials.length === 0) return;
    
    // Rotate through batches of materials to update
    const totalBatches = Math.ceil(materials.length / state.batchSize);
    state.currentBatch = (state.currentBatch + 1) % totalBatches;
    
    const startIndex = state.currentBatch * state.batchSize;
    const endIndex = Math.min(startIndex + state.batchSize, materials.length);
    
    // Update just this batch of materials
    let anyChanges = false;
    for (let i = startIndex; i < endIndex; i++) {
      const item = materials[i];
      if (item && item.material) {
        // Calculate pulse with item-specific phase to create variety
        const pulse = Math.sin(state.time * 1.5 + item.phase) * 0.3 + 0.7;
        
        // Only update if the change is significant (reduces unnecessary renders)
        if (Math.abs(item.material.emissiveIntensity - pulse) > 0.05) {
          item.material.emissiveIntensity = pulse;
          anyChanges = true;
        }
      }
    }
    
    // Only request another render if we made material changes
    if (anyChanges) {
      invalidate();
    }
  });
  
  return (
    <group>
      {/* Environment */}
      <fog attach="fog" args={['#0a0a0a', 0.002]} />
      <color attach="background" args={['#0a0a1a']} />
      
      {/* Lighting setup - matching main.js */}
      <ambientLight intensity={1.0} color="#ffffff" />
      
      <directionalLight 
        position={[5, 30, 5]} 
        intensity={1.0} 
        color="#ffffff"
        castShadow
      />
      
      {/* Neon accent lights - same as main.js */}
      <pointLight position={[10, 25, 10]} intensity={0.6} color="#00aaff" distance={70} />
      <pointLight position={[-10, 20, -10]} intensity={0.5} color="#ff00aa" distance={70} />
      <pointLight position={[0, 15, -15]} intensity={0.4} color="#00ff88" distance={70} />
      <pointLight position={[-15, 10, 5]} intensity={0.3} color="#aa00ff" distance={70} />
      
      {/* Simplified Sky */}
      <Sky
        distance={450000}
        sunPosition={[0, -1, 0]} 
        inclination={0}
        azimuth={180}
      />
      
      {/* City model container */}
      <group ref={cityRef} />
      
      {/* Ground plane - visible in case model fails to load */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#112233" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Origin marker for debugging */}
      {debugMode && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#FF0000" wireframe={true} />
        </mesh>
      )}
      
      {/* Loading indicator */}
      {!cityLoaded && (
        <group position={[0, 10, 0]}>
          <mesh>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#FFFF00" />
            <pointLight color="#FFFF00" intensity={2} distance={20} />
          </mesh>
          
          {/* Loading progress bar - reuse objects */}
          <group position={[0, 3, 0]}>
            <mesh>
              <boxGeometry args={[10, 0.5, 0.5]} />
              <meshBasicMaterial color="#333333" />
            </mesh>
            <mesh 
              position={[-5 + (5 * loadingProgress), 0, 0]} 
              scale={progressBoxRef.current.set(loadingProgress * 10, 0.4, 0.6)}
            >
              <boxGeometry />
              <meshBasicMaterial color="#00FFFF" />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
};

export default CityScene;