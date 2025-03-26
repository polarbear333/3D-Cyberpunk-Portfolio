import React, { useRef, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';
import { useEventSystem, EVENT_TYPES, PRIORITY, useSystem } from '../../systems/EventSystem';

// Path constants
const DRONE_MODEL_PATH = '/models/cyberdrone/drone.glb';

const DroneNavigationEvents = ({ audio }) => {
  // Get state from Zustand store
  const { 
    dronePosition, 
    updateDronePosition, 
    debugMode, 
    soundEnabled,
    setActiveHotspot
  } = useStore();
  
  // Get Three.js context
  const { scene, camera, invalidate } = useThree();
  
  // Refs
  const droneRef = useRef();
  const droneModelRef = useRef();
  const propellersRef = useRef([]);
  const droneLightRef = useRef();
  
  // Target position for navigation
  const targetPositionRef = useRef(null);
  
  // Animation state - persistent references
  const propellerSpeed = useRef(0.5);
  const lightIntensity = useRef(1.5);
  const isMovingRef = useRef(false);
  
  // Vector references to reduce garbage collection
  const tempVec = useRef(new THREE.Vector3());
  const directionVec = useRef(new THREE.Vector3());
  
  // Get event system
  const { emit, subscribe, unsubscribe } = useEventSystem();
  
  // Try to load the drone model
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
      
      // Register drone with spatial manager as dynamic object
      emit(EVENT_TYPES.OBJECT_ADDED, {
        object: model,
        options: {
          important: true, // Drone is important and never gets culled
          dynamic: true,   // Drone is dynamic
          lod: false       // No LOD for the drone
        }
      });
      
      // Trigger a render
      invalidate();
    }
    
    return () => {
      // Clean up resources
      if (droneModelRef.current) {
        // Unregister from spatial manager
        emit(EVENT_TYPES.OBJECT_REMOVED, { object: droneModelRef.current });
        
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
  
  // Setup click handler for navigation
  useEffect(() => {
    const handleClick = (event) => {
      // Get normalized device coordinates
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      
      // Create raycaster
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      
      // First, check for hotspot intersections
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
          
          // Set target to hotspot position
          if (!targetPositionRef.current) {
            targetPositionRef.current = new THREE.Vector3();
          }
          
          // Get hotspot position
          targetPositionRef.current.copy(hotspotObject.position);
          targetPositionRef.current.y = Math.max(hotspotObject.position.y + 2, 5);
          
          // Update moving state
          isMovingRef.current = true;
          
          // Emit drone move event
          emit(EVENT_TYPES.DRONE_MOVE, {
            targetPosition: targetPositionRef.current.clone(),
            source: 'hotspot',
            hotspotId
          });
          
          // Play click sound
          if (audio?.isInitialized && soundEnabled) {
            audio.playSound('click', { volume: 0.3 });
          }
          
          // Request render
          invalidate();
          return;
        }
      }
      
      // Check for ground intersection
      const groundObjects = scene.children.filter(child => 
        child.isObject3D && 
        child.type === 'Mesh' && 
        (child.rotation.x === -Math.PI / 2 || child.name.includes('ground'))
      );
      
      if (groundObjects.length > 0) {
        const intersects = raycaster.intersectObjects(groundObjects, false);
        
        if (intersects.length > 0) {
          // Create target position if needed
          if (!targetPositionRef.current) {
            targetPositionRef.current = new THREE.Vector3();
          }
          
          // Copy intersection point
          targetPositionRef.current.copy(intersects[0].point);
          
          // Set minimum height
          targetPositionRef.current.y = Math.max(5, targetPositionRef.current.y);
          
          // Update moving state
          isMovingRef.current = true;
          
          // Emit drone move event
          emit(EVENT_TYPES.DRONE_MOVE, {
            targetPosition: targetPositionRef.current.clone(),
            source: 'ground'
          });
          
          // Play click sound
          if (audio?.isInitialized && soundEnabled) {
            audio.playSound('click', { volume: 0.3 });
          }
          
          // Request render
          invalidate();
        }
      }
    };
    
    // Add click listener
    window.addEventListener('click', handleClick);
    
    // Remove listener on cleanup
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, [camera, scene, setActiveHotspot, audio, soundEnabled, invalidate]);
  
  // Register drone update system
  useSystem('drone-movement', ({ deltaTime }) => {
    // Only update if we have a target and are moving
    if (!isMovingRef.current || !targetPositionRef.current) return;
    
    // Use temp vector to avoid creating new objects
    tempVec.current.fromArray(dronePosition.toArray());
    
    // Calculate direction vector
    directionVec.current.copy(targetPositionRef.current).sub(tempVec.current);
    const distance = directionVec.current.length();
    
    // Check if we're close enough to stop
    if (distance < 1) {
      isMovingRef.current = false;
      
      // Emit arrival event
      emit(EVENT_TYPES.DRONE_ARRIVED, {
        position: tempVec.current.clone()
      });
      
      return;
    }
    
    // Normalize direction vector
    directionVec.current.normalize();
    
    // Calculate speed based on distance with delta time
    const speed = Math.min(Math.max(distance * 0.02, 0.2), 1.5) * deltaTime * 60;
    
    // Scale direction vector
    directionVec.current.multiplyScalar(speed);
    
    // Update position - avoid creating new Vector3
    const newPosition = tempVec.current.clone().add(directionVec.current);
    updateDronePosition(newPosition);
    
    // Update drone mesh directly
    if (droneRef.current) {
      droneRef.current.position.copy(newPosition);
    }
    
    // Request another render
    invalidate();
  }, PRIORITY.HIGH, true);
  
  // Register propeller animation system
  useSystem('drone-propellers', ({ deltaTime }) => {
    // Calculate target propeller speed
    const targetPropellerSpeed = isMovingRef.current ? 2.0 : 0.5;
    
    // Smoothly interpolate propeller speed
    propellerSpeed.current += (targetPropellerSpeed - propellerSpeed.current) * deltaTime * 5;
    
    // Update propellers
    propellersRef.current.forEach((propeller, index) => {
      if (propeller) {
        propeller.rotation.y += propellerSpeed.current * (1 + index * 0.05) * deltaTime * 60;
      }
    });
    
    // Update drone light intensity
    if (droneLightRef.current) {
      const time = performance.now() / 1000;
      const targetIntensity = 1.5 + Math.sin(time * 2) * 0.5;
      // Smooth interpolation
      lightIntensity.current += (targetIntensity - lightIntensity.current) * deltaTime * 3;
      droneLightRef.current.intensity = lightIntensity.current;
    }
    
    // Only request render if drone is moving
    if (isMovingRef.current) {
      invalidate();
    }
  }, PRIORITY.MEDIUM, true);
  
  // Sync with store position on each update
  useEffect(() => {
    if (droneRef.current) {
      droneRef.current.position.fromArray(dronePosition.toArray());
    }
  }, [dronePosition]);
  
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
    </group>
  );
};

export default DroneNavigationEvents;