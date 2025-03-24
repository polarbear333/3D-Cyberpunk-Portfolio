import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useStore } from '../../state/useStore';

// Optimized CityScene with cyberpunk Hong Kong/Tokyo night theme
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
  
  // Cyberpunk color palette
  const cyberpunkColors = useMemo(() => ({
    neonPink: new THREE.Color('#FF00FF').convertSRGBToLinear(),
    neonBlue: new THREE.Color('#00FFFF').convertSRGBToLinear(),
    neonPurple: new THREE.Color('#9D00FF').convertSRGBToLinear(),
    neonGreen: new THREE.Color('#00FF66').convertSRGBToLinear(),
    neonOrange: new THREE.Color('#FF6E27').convertSRGBToLinear(),
    neonYellow: new THREE.Color('#FCEE09').convertSRGBToLinear(),
    darkBlue: new THREE.Color('#05001E').convertSRGBToLinear(),
    darkPurple: new THREE.Color('#0D0221').convertSRGBToLinear(),
  }), []);
  
  // Load city model
  useEffect(() => {
    if (cityLoaded) return;
    
    console.log("Loading city model with cyberpunk styling...");
    setLoading(true);
    
    // Load model with cyberpunk styling
    loader.load(
      '/models/cybercity/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        
        // Apply scale as in main.js
        model.scale.set(0.01, 0.01, 0.01);
        
        // Process materials for cyberpunk theme
        const emissiveMaterials = [];
        
        model.traverse((child) => {
          if (child.isMesh) {
            // Disable shadows for performance
            child.castShadow = false;
            child.receiveShadow = false;
            
            // Enhance all materials for cyberpunk look
            if (child.material) {
              // Make regular materials darker
              if (child.material.color) {
                // Darken non-emissive colors slightly to create contrast with neons
                child.material.color.multiplyScalar(0.85);
              }
              
              // Find materials with emissive properties to make them pop
              if (child.material.emissive) {
                // Determine which cyberpunk color to use based on original color
                let originalColor = child.material.emissive.clone();
                
                // Boost the emissive intensity significantly for a neon look
                child.material.emissiveIntensity = 1.5;
                
                // Apply a more vibrant neon color based on closest match
                if (originalColor.r > originalColor.g && originalColor.r > originalColor.b) {
                  // Red-dominant becomes neon pink
                  child.material.emissive.copy(cyberpunkColors.neonPink);
                } else if (originalColor.g > originalColor.r && originalColor.g > originalColor.b) {
                  // Green-dominant becomes neon green
                  child.material.emissive.copy(cyberpunkColors.neonGreen);
                } else if (originalColor.b > originalColor.r && originalColor.b > originalColor.g) {
                  // Blue-dominant becomes neon blue
                  child.material.emissive.copy(cyberpunkColors.neonBlue);
                } else if (originalColor.r > 0.5 && originalColor.g > 0.5) {
                  // Yellow-ish becomes neon yellow
                  child.material.emissive.copy(cyberpunkColors.neonYellow);
                } else if (originalColor.r > 0.5 && originalColor.b > 0.5) {
                  // Purple-ish becomes neon purple
                  child.material.emissive.copy(cyberpunkColors.neonPurple);
                }
                
                // Track 40% of emissive materials for animation (more than before for better visual impact)
                if (Math.random() < 0.4) {
                  emissiveMaterials.push({
                    material: child.material,
                    position: [child.position.x, child.position.y, child.position.z],
                    phase: Math.random() * Math.PI * 2,
                    baseIntensity: child.material.emissiveIntensity
                  });
                }
              }
              
              // Adjust metalness and roughness for a more cyberpunk look
              if (child.material.metalness !== undefined) {
                child.material.metalness = 0.7; // Higher metalness for reflectivity
                child.material.roughness = 0.3; // Less roughness for more shine
              }
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
        loadCyberpunkFallbackModel();
      }
    );
  }, [cityLoaded, setLoading, setCityBounds, loader, invalidate, cyberpunkColors]);
  
  // Create a cyberpunk fallback model if loading fails
  const loadCyberpunkFallbackModel = () => {
    console.log("Loading cyberpunk fallback model");
    
    // Create a ground plane with cyberpunk grid texture
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: '#050023',
      roughness: 0.8,
      metalness: 0.2
    });
    
    // Add grid pattern to the ground with GridHelper
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      groundMaterial
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    
    // Add grid lines separately
    const grid = new THREE.GridHelper(200, 40, 0x00FFFF, 0x00FFFF);
    grid.position.y = 0.1;
    
    // Create buildings with neon outlines
    const cityGroup = new THREE.Group();
    cityGroup.add(ground);
    cityGroup.add(grid);
    
    // Building materials with cyberpunk style
    const buildingMaterials = [
      new THREE.MeshStandardMaterial({
        color: '#05001E',
        roughness: 0.7,
        metalness: 0.3
      }),
      new THREE.MeshStandardMaterial({
        color: '#0A0A25',
        roughness: 0.5,
        metalness: 0.5
      }),
      // Neon-rimmed buildings
      new THREE.MeshStandardMaterial({
        color: '#030012',
        emissive: cyberpunkColors.neonBlue,
        emissiveIntensity: 2.0,
        roughness: 0.3,
        metalness: 0.7
      }),
      new THREE.MeshStandardMaterial({
        color: '#030012',
        emissive: cyberpunkColors.neonPink,
        emissiveIntensity: 2.0,
        roughness: 0.3,
        metalness: 0.7
      }),
      new THREE.MeshStandardMaterial({
        color: '#030012',
        emissive: cyberpunkColors.neonPurple,
        emissiveIntensity: 2.0,
        roughness: 0.3,
        metalness: 0.7
      })
    ];
    
    const emissiveMaterials = [];
    const buildingGeo = new THREE.BoxGeometry(5, 1, 5);
    
    // Create a cyberpunk-style skyline with taller buildings
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 100 - 50;
      const z = Math.random() * 100 - 50;
      const height = Math.random() * 25 + 10; // Taller buildings for a city skyline
      
      const materialIndex = Math.floor(Math.random() * buildingMaterials.length);
      const building = new THREE.Mesh(buildingGeo, buildingMaterials[materialIndex]);
      building.position.set(x, height / 2, z);
      building.scale.set(1, height, 1);
      cityGroup.add(building);
      
      // Add window lights to buildings
      if (Math.random() > 0.3) {
        const windowMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0x00FFFF : 0xFF00FF,
          transparent: true,
          opacity: 0.9
        });
        
        // Add random window patterns
        const windowCount = Math.floor(Math.random() * 8) + 3;
        for (let j = 0; j < windowCount; j++) {
          const windowSize = 0.3;
          const windowGeo = new THREE.PlaneGeometry(windowSize, windowSize);
          const window = new THREE.Mesh(windowGeo, windowMat);
          
          // Position on building face
          const side = Math.floor(Math.random() * 4); // 0: front, 1: right, 2: back, 3: left
          const wx = (side === 1) ? 0.5 : (side === 3 ? -0.5 : (Math.random() - 0.5));
          const wz = (side === 0) ? 0.5 : (side === 2 ? -0.5 : (Math.random() - 0.5));
          const wy = (Math.random() - 0.5) * 0.8;
          
          window.position.set(wx * 5, wy * height, wz * 5);
          
          // Rotate based on side
          if (side === 1) window.rotation.y = Math.PI / 2;
          if (side === 2) window.rotation.y = Math.PI;
          if (side === 3) window.rotation.y = -Math.PI / 2;
          
          building.add(window);
        }
      }
      
      // Track emissive materials from buildings
      if (materialIndex >= 2) { // Only buildings with emissive materials
        emissiveMaterials.push({
          material: buildingMaterials[materialIndex],
          position: [x, height/2, z],
          phase: Math.random() * Math.PI * 2,
          baseIntensity: buildingMaterials[materialIndex].emissiveIntensity
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
    // Run animations more frequently for cyberpunk feel
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
        // Run longer for more visual impact
        setTimeout(() => {
          animationState.current.runningAnimation = false;
          animationState.current.animationNeedsUpdate = false;
        }, 3000); // Run animation for 3 seconds
      }
    };
    
    // Start random animations more frequently for cyberpunk feel
    const intervalId = setInterval(() => {
      // 50% chance to start animations at each interval (higher frequency)
      if (Math.random() < 0.5) {
        startRandomAnimations();
      }
    }, 3000 + Math.random() * 4000); // More frequent animations (3-7 seconds)
    
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
        // Calculate pulse with item-specific phase for a more varied flickering look
        // Use a more dramatic pulse for cyberpunk look
        const baseIntensity = item.baseIntensity || 1.5;
        const pulse = baseIntensity * (Math.sin(state.time * 2.5 + item.phase) * 0.4 + 0.8);
        
        // Only update if the change is significant
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
      {/* Darker cyberpunk environment */}
      <fog attach="fog" args={['#050023', 0.0015]} /> {/* Deeper blue fog */}
      <color attach="background" args={['#05001E']} /> {/* Dark blue background */}
      
      {/* Cyberpunk-themed lighting */}
      <ambientLight intensity={0.25} color="#3311bb" /> {/* Subtle blue ambient */}
      
      {/* Main directional light */}
      <directionalLight 
        position={[5, 30, 5]} 
        intensity={0.7} 
        color="#8840FF" 
        castShadow
      />
      
      {/* Neon accent lights with more saturated colors */}
      <pointLight position={[10, 25, 10]} intensity={0.8} color="#00FFFF" distance={90} />
      <pointLight position={[-10, 20, -10]} intensity={0.7} color="#FF00FF" distance={90} />
      <pointLight position={[0, 15, -15]} intensity={0.6} color="#00FF66" distance={90} />
      <pointLight position={[-15, 10, 5]} intensity={0.5} color="#9D00FF" distance={90} />
      <pointLight position={[15, 5, 15]} intensity={0.4} color="#FCEE09" distance={90} />
      
      {/* Dark night sky */}
      <Sky
        distance={450000}
        sunPosition={[0, -1, 0]} 
        inclination={0}
        azimuth={180}
        turbidity={30} // Higher turbidity for urban smog effect
        rayleigh={0.5}
      />
      
      {/* City model container */}
      <group ref={cityRef} />
      
      {/* Ground plane with neon grid - visible in case model fails to load */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#05001E" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Grid lines - cyberpunk staple */}
      <gridHelper args={[200, 40, '#00FFFF', '#000033']} position={[0, -1.9, 0]} />
      
      {/* Origin marker for debugging */}
      {debugMode && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#FF0000" wireframe={true} />
        </mesh>
      )}
      
      {/* Loading indicator - cyberpunk styled */}
      {!cityLoaded && (
        <group position={[0, 10, 0]}>
          <mesh>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#FF00FF" />
            <pointLight color="#FF00FF" intensity={3} distance={20} />
          </mesh>
          
          {/* Loading progress bar with neon colors */}
          <group position={[0, 3, 0]}>
            <mesh>
              <boxGeometry args={[10, 0.5, 0.5]} />
              <meshBasicMaterial color="#05001E" />
            </mesh>
            <mesh 
              position={[-5 + (5 * loadingProgress), 0, 0]} 
              scale={progressBoxRef.current.set(loadingProgress * 10, 0.4, 0.6)}
            >
              <boxGeometry />
              <meshBasicMaterial color="#FF00FF" />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
};

export default CityScene;