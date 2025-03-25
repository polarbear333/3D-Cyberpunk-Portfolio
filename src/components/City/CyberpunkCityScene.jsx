import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';
import { createResourceManager, enhanceSceneObjects } from '../../utils/resourceUtils';
import { CyberpunkEnhancer } from '../../utils/CyberpunkEnhancer';
import { CyberpunkEffects } from '../Effects/CyberpunkSceneEffects';

/**
 * Enhanced CityScene with custom material enhancements and dynamic effects
 */
const CyberpunkCityScene = React.memo(() => {
  const { debugMode, setCityBounds, setLoading } = useStore();
  const [cityLoaded, setCityLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [environmentMap, setEnvironmentMap] = useState(null);
  
  // Get access to invalidate for on-demand rendering
  const { invalidate, scene, gl } = useThree();
  
  // Refs for scene elements
  const cityRef = useRef();
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
  
  // Create material enhancer - memoized for stability
  const enhancer = useMemo(() => new CyberpunkEnhancer(), []);
  
  // Create resource manager - memoized for stability 
  const resourceManager = useMemo(() => createResourceManager(gl), [gl]);
  
  // Generate environment map
  useEffect(() => {
    // Only create environment map once
    if (environmentMap) return;
    
    try {
      const generatedEnvMap = enhancer.createCyberpunkEnvMap();
      setEnvironmentMap(generatedEnvMap);
    } catch (error) {
      console.error("Error creating environment map:", error);
      
      // Fallback environment
      const fallbackEnv = new THREE.CubeTextureLoader()
        .setPath('/textures/cyberpunk/')
        .load(['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']);
      
      setEnvironmentMap(fallbackEnv);
    }
    
    return () => {
      // Clean up environment map when component unmounts
      if (environmentMap && environmentMap.dispose) {
        environmentMap.dispose();
      }
    };
  }, [enhancer, environmentMap]);
  
  // Load city model using ResourceManager
  useEffect(() => {
    if (cityLoaded) return;
    
    console.log("Loading city model with enhanced cyberpunk styling...");
    setLoading(true);
    
    // Configure resource manager
    resourceManager.setProgressCallback((progress) => {
      setLoadingProgress(progress);
      invalidate(); // Render for progress updates
    });
    
    resourceManager.setLoadCallback(() => {
      // Process the loaded model
      try {
        // Get model from cache
        const model = resourceManager.manager.cache.models['/models/cybercity/scene.gltf']?.scene;
        
        if (!model) {
          console.error("Failed to load city model from resource manager");
          return;
        }
        
        // Apply scale
        model.scale.set(0.01, 0.01, 0.01);
        
        // Apply custom material enhancements
        const { animatedMaterials } = enhancer.enhanceModel(model);
        animationState.current.materials = animatedMaterials;
        
        // Apply environment map if available
        if (environmentMap) {
          enhancer.applyEnvironmentMap(model, environmentMap);
        }
        
        // Add to scene
        if (cityRef.current) {
          cityRef.current.add(model);
          
          // Register with spatial manager for culling and optimization
          if (window.spatialManager?.initialized) {
            // Register the entire model first with general settings
            window.spatialManager.registerObject(model, {
              important: false, // City can be culled when far away
              lod: true,       // Enable LOD for the city model
              cullDistance: 800 // Large cull distance for the main city
            });
            
            // Register individual buildings and objects with appropriate settings
            model.traverse((object) => {
              if (object.isMesh) {
                let settings = {
                  important: false,
                  lod: true,
                  cullDistance: 500
                };
                
                // Customize settings based on object name/type
                const name = object.name.toLowerCase();
                
                // Hotspots and important landmarks should never be culled
                if (name.includes('hotspot') || name.includes('landmark') || name.includes('important')) {
                  settings.important = true;
                  settings.lod = false;
                  settings.cullDistance = Infinity;
                }
                // Moving objects should be marked as dynamic
                else if (name.includes('vehicle') || name.includes('drone') || name.includes('moving')) {
                  settings.dynamic = true;
                  settings.cullDistance = 300;
                }
                // Small details can be culled earlier
                else if (name.includes('detail') || object.geometry.boundingSphere?.radius < 1) {
                  settings.cullDistance = 200;
                }
                
                window.spatialManager.registerObject(object, settings);
              }
            });
          }
          
          // Calculate bounds
          const boundingBox = new THREE.Box3().setFromObject(model);
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
          
          console.log(`City model loaded with ${animatedMaterials.length} animated emissive materials`);
          
          // Request a render once the model is loaded
          invalidate();
        }
      } catch (error) {
        console.error("Error processing city model:", error);
        setLoading(false);
      }
    });
    
    resourceManager.setErrorCallback((error) => {
      console.error("Resource loading error:", error);
      setLoading(false);
    });
    
    // Load model
    resourceManager.manager.loadModel('/models/cybercity/scene.gltf', {
      optimizeMaterials: true,
      emissiveObjects: ['neon', 'light', 'glow', 'sign', 'led', 'emit', 'window'],
      debugName: 'cybercity'
    });
    
  }, [cityLoaded, setLoading, setCityBounds, invalidate, enhancer, environmentMap, resourceManager]);
  
  // Trigger animation sequences - memoized handler
  const startRandomAnimations = useCallback(() => {
    // Don't start new animations if we're already running one
    if (animationState.current.runningAnimation) return;
    
    // Only animate if we have materials to animate
    if (animationState.current.materials.length > 0) {
      // Flag that animation needs an update
      animationState.current.animationNeedsUpdate = true;
      animationState.current.runningAnimation = true;
      
      // Request a render to start animation
      invalidate();
    }
  }, [invalidate]);
  
  // Setup animation interval
  useEffect(() => {
    // Start random animations at intervals
    const intervalId = setInterval(() => {
      // 75% chance to start animations
      if (Math.random() < 0.75) {
        startRandomAnimations();
      }
    }, 2000 + Math.random() * 2000); // 2-4 seconds between animations
    
    // Clear interval on unmount
    return () => clearInterval(intervalId);
  }, [startRandomAnimations]);
  
  // Animation loop for materials
  useFrame((state, delta) => {
    // Update internal time
    const stateRef = animationState.current;
    stateRef.time += delta;
    
    // Skip if not in animation cycle
    if (!stateRef.runningAnimation && !stateRef.animationNeedsUpdate) return;
    
    // Check if we should update this frame
    if (stateRef.time - stateRef.lastUpdate < stateRef.updateInterval) return;
    stateRef.lastUpdate = stateRef.time;
    
    // Update material animations using the enhancer
    const anyChanges = enhancer.updateAnimations(
      stateRef.time, 
      stateRef.runningAnimation
    );
    
    // Request another render if changes were made
    if (anyChanges) {
      invalidate();
    }
    
    // Stop continuous animations after a period
    if (stateRef.runningAnimation && stateRef.time - stateRef.lastUpdate > 3) {
      stateRef.runningAnimation = false;
      stateRef.animationNeedsUpdate = false;
    }
  });
  
  return (
    <group>
      {/* Custom environment with cyberpunk sky */}
      <fog attach="fog" args={['#050023', 0.0012]} /> {/* Optimized fog density */}
      <color attach="background" args={['#05001E']} /> {/* Dark blue background */}
      
      {/* Custom procedural environment for reflections */}
      <Environment>
        <mesh scale={100}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial color="#050023" side={THREE.BackSide} />
        </mesh>
        
        {/* Emissive elements in environment */}
        {Array.from({ length: 50 }).map((_, i) => (
          <mesh 
            key={i} 
            position={[
              Math.sin(i * 0.5) * 20, 
              Math.abs(Math.cos(i * 0.3) * 10) + 5, 
              Math.cos(i * 0.4) * 20
            ]}
          >
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial 
              color={
                i % 5 === 0 ? "#FF10F0" : 
                i % 5 === 1 ? "#00FFFF" : 
                i % 5 === 2 ? "#39FF14" : 
                i % 5 === 3 ? "#FFFF00" :
                "#B026FF"
              }
            />
          </mesh>
        ))}
      </Environment>
      
      {/* Enhanced cyberpunk lighting setup */}
      <ambientLight intensity={0.3} color="#2211AA" /> {/* Subtle blue ambient */}
      
      {/* Main directional light */}
      <directionalLight 
        position={[5, 30, 5]} 
        intensity={0.5} 
        color="#7040FF" 
        castShadow
      />
      
      {/* Accent lighting to enhance mood */}
      <pointLight position={[10, 25, 10]} intensity={0.8} color="#00FFFF" distance={90} />
      <pointLight position={[-10, 20, -10]} intensity={0.7} color="#FF10F0" distance={90} />
      <pointLight position={[0, 15, -15]} intensity={0.6} color="#39FF14" distance={90} />
      <pointLight position={[-15, 10, 5]} intensity={0.5} color="#B026FF" distance={90} />
      <pointLight position={[15, 5, 15]} intensity={0.4} color="#FFFF00" distance={90} />
      
      {/* Enhanced cyberpunk sky */}
      <Sky
        distance={450000}
        sunPosition={[0, -1, 0]} 
        inclination={0}
        azimuth={180}
        turbidity={30} 
        rayleigh={0.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.7}
      />
      
      {/* City model container */}
      <group ref={cityRef} />
      
      {/* Debug visualization */}
      {debugMode && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#FF0000" wireframe={true} />
        </mesh>
      )}
      
      {/* Enhanced cyberpunk loading indicator */}
      {!cityLoaded && (
        <group position={[0, 10, 0]}>
          <mesh>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#FF10F0" />
            <pointLight color="#FF10F0" intensity={3} distance={20} />
          </mesh>
          
          {/* Loading progress bar with neon glow */}
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
              <meshBasicMaterial color="#FF10F0" />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
});

export default CyberpunkCityScene;