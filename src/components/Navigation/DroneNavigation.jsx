import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';

// Load the drone model
const DRONE_MODEL_PATH = '/models/cyberdrone/drone.glb'; 

const DroneNavigation = React.memo(({ audio }) => {
  const { 
    dronePosition, 
    updateDronePosition, 
    setActiveHotspot,
    debugMode, 
    soundEnabled
  } = useStore();
  
  // Get reference to Three.js state including the invalidate function
  const { scene, camera, invalidate } = useThree();
  
  // Drone refs
  const droneRef = useRef();
  const droneModelRef = useRef();
  const propellersRef = useRef([]);
  const droneLightRef = useRef();
  
  // Persistent vector references to avoid garbage collection
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const tempVec3 = useMemo(() => new THREE.Vector3(), []);
  const directionVec = useMemo(() => new THREE.Vector3(), []);
  
  // Movement state
  const [isMoving, setIsMoving] = useState(false);
  const targetPosition = useRef(null);
  
  // Animation state - persistent references
  const propellerSpeed = useRef(0.5);
  const lightIntensity = useRef(1.5);
  const timeRef = useRef(0);
  const lastUpdateTime = useRef(0);
  
  // Animation timing parameters
  const animationInterval = useRef(1000 / 30); // Aim for ~30 FPS for animations
  
  // Load drone model
  let droneModel;
  try {
    droneModel = useGLTF(DRONE_MODEL_PATH, true);
  } catch (error) {
    console.log("Using default drone model");
  }
  
  // Setup drone model only once
  useEffect(() => {
    if (droneModel && droneModel.scene && droneModelRef.current) {
      // Clear existing children
      while (droneModelRef.current.children.length > 0) {
        droneModelRef.current.remove(droneModelRef.current.children[0]);
      }
      
      // Clone the model
      const model = droneModel.scene.clone();
      
      // Process the model and find propellers
      model.traverse((child) => {
        if (child.isMesh) {
          // Find propellers
          if (child.name.includes('propeller') || child.name.includes('rotor')) {
            propellersRef.current.push(child);
          }
          
          // Optimize shadows
          child.castShadow = child.name.includes('body');
          child.receiveShadow = false;
          
          // Optimize materials
          if (child.material) {
            if (child.material.map) {
              child.material.map.anisotropy = 4;
            }
            child.material.needsUpdate = true;
          }
        }
      });
      
      // Set scale and position
      model.scale.set(0.1, 0.1, 0.1);
      
      // Add drone light only once
      const droneLight = new THREE.PointLight('#00FFFF', lightIntensity.current, 10);
      droneLight.position.set(0, 0.5, 0);
      droneLightRef.current = droneLight;
      model.add(droneLight);
      
      // Add to ref
      droneModelRef.current.add(model);
      
      // Trigger a render
      invalidate();
    }
    
    return () => {
      // Clean up resources
      if (droneModelRef.current) {
        while (droneModelRef.current.children.length > 0) {
          const child = droneModelRef.current.children[0];
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
          if (child.geometry) {
            child.geometry.dispose();
          }
          droneModelRef.current.remove(child);
        }
      }
      
      // Reset propellers array
      propellersRef.current = [];
    };
  }, [droneModel, invalidate]);
  
  // Handle mouse click for target navigation - memoized callback
  const handleClick = useCallback((event) => {
    // Get mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersection with the ground
    const groundObjects = scene.children.filter(child => 
      child.isObject3D && 
      child.type === 'Mesh' && 
      (child.rotation.x === -Math.PI / 2 || child.name.includes('ground'))
    );
    
    if (groundObjects.length > 0) {
      const intersects = raycaster.intersectObjects(groundObjects, false);
      
      if (intersects.length > 0) {
        // Store target position (reuse the same reference)
        if (!targetPosition.current) {
          targetPosition.current = new THREE.Vector3();
        }
        
        // Copy values instead of creating new Vector3
        targetPosition.current.copy(intersects[0].point);
        
        // Set minimum height
        targetPosition.current.y = Math.max(5, targetPosition.current.y);
        
        setIsMoving(true);
        
        // Play click sound
        if (audio?.isInitialized && soundEnabled) {
          audio.playSound('click', { volume: 0.3 });
        }
        
        // Trigger a render
        invalidate();
      }
    }
    
    // Check for hotspot intersections
    const hotspots = scene.children.filter(child => 
      child.isObject3D && 
      child.type === 'Group' && 
      child.name.includes('hotspot')
    );
    
    const hotspotIntersects = raycaster.intersectObjects(hotspots, true);
    
    if (hotspotIntersects.length > 0) {
      let hotspotObject = hotspotIntersects[0].object;
      
      // Traverse up to find the hotspot group
      while (hotspotObject && !hotspotObject.name.includes('hotspot')) {
        hotspotObject = hotspotObject.parent;
      }
      
      if (hotspotObject) {
        const hotspotId = hotspotObject.name.replace('hotspot-', '');
        setActiveHotspot(hotspotId);
        
        // Set target position to the hotspot
        if (!targetPosition.current) {
          targetPosition.current = new THREE.Vector3();
        }
        
        // Copy hotspot position (don't create a new Vector3)
        targetPosition.current.copy(hotspotObject.position);
        targetPosition.current.y = Math.max(hotspotObject.position.y + 2, 5);
        
        setIsMoving(true);
        
        // Trigger a render
        invalidate();
      }
    }
  }, [camera, scene, audio, soundEnabled, setActiveHotspot, raycaster, mouse, invalidate]);
  
  // Add click listener only once
  useEffect(() => {
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, [handleClick]);
  
  // Optimized animation frame with delta time that respects on-demand rendering
  useFrame((state, delta) => {
    // Update our own time reference for consistent animations
    timeRef.current += delta;
    
    // Check if we should update animations - limit to the target framerate
    const now = performance.now();
    const shouldUpdateAnimations = now - lastUpdateTime.current >= animationInterval.current;
    
    // Only do animation updates when needed
    if (shouldUpdateAnimations || isMoving) {
      lastUpdateTime.current = now;
      
      // 1. Animate propellers with proper interpolation
      const targetPropellerSpeed = isMoving ? 2.0 : 0.5;
      // Interpolate propeller speed
      propellerSpeed.current += (targetPropellerSpeed - propellerSpeed.current) * delta * 5;
      
      // Apply to propellers - mutate existing objects instead of creating new ones
      propellersRef.current.forEach((propeller, index) => {
        if (propeller) {
          propeller.rotation.y += propellerSpeed.current * (1 + index * 0.05) * delta * 60;
        }
      });
      
      // 2. Pulse drone light with time-based animation (less frequent updates)
      if (droneLightRef.current) {
        const targetIntensity = 1.5 + Math.sin(timeRef.current * 2) * 0.5;
        // Smooth interpolation for light intensity
        lightIntensity.current += (targetIntensity - lightIntensity.current) * delta * 3;
        droneLightRef.current.intensity = lightIntensity.current;
      }
      
      // Request another render for continuous animations if moving
      if (isMoving) {
        invalidate();
      }
    }
    
    // 3. Move drone to target with proper interpolation and delta time
    if (isMoving && targetPosition.current) {
      // Use temp vector to avoid creating new objects
      tempVec3.fromArray(dronePosition.toArray());
      
      // Calculate direction vector (reuse directionVec)
      directionVec.copy(targetPosition.current).sub(tempVec3);
      const distance = directionVec.length();
      
      // Check if we're close enough to stop
      if (distance < 1) {
        setIsMoving(false);
        return;
      }
      
      // Normalize in-place
      directionVec.normalize();
      
      // Calculate speed based on distance with delta time
      const speed = Math.min(Math.max(distance * 0.02, 0.2), 1.5) * delta * 60;
      
      // Scale direction vector
      directionVec.multiplyScalar(speed);
      
      // Add to current position
      tempVec3.add(directionVec);
      
      // Update drone position - avoid creating new Vector3
      updateDronePosition(tempVec3);
      
      // Update drone mesh directly
      if (droneRef.current) {
        droneRef.current.position.copy(tempVec3);
      }
      
      // Always request another render when the drone is moving
      invalidate();
    } else if (droneRef.current) {
      // Make sure mesh is in sync with state even when not moving
      droneRef.current.position.fromArray(dronePosition.toArray());
    }
  });
  
  return (
    <group>
      {/* Main drone group */}
      <group ref={droneRef} position={dronePosition.toArray()}>
        {/* Drone model container */}
        <group ref={droneModelRef} />
        
        {/* Fallback simple drone mesh if model isn't loaded */}
        {!droneModel && (
          <mesh castShadow>
            <boxGeometry args={[1, 0.2, 1]} />
            <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
            
            {/* Drone light */}
            <pointLight color="#00FFFF" intensity={2} distance={8} position={[0, 0.2, 0]} />
          </mesh>
        )}
      </group>
      
      {/* OrbitControls for camera manipulation - now configured to work with on-demand rendering */}
      <OrbitControls 
        enableDamping={true}
        dampingFactor={0.05}
        screenSpacePanning={false}
        minDistance={10}
        maxDistance={1000}
        enablePan={debugMode}
        target={[0, 10, 0]}
        // For on-demand rendering, we need to manually invoke updates
        onChange={() => invalidate()}
      />
    </group>
  );
});

export default DroneNavigation;