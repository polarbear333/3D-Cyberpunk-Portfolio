import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';
import { gsap } from 'gsap';

// Load the drone model
const DRONE_MODEL_PATH = '/models/cyberdrone/drone.glb'; 

// Constants for physics and performance
const COLLISION_CHECK_INTERVAL = 3; // Only check every 3 frames
const PHYSICS_SUBSTEPS = 2; // Number of physics steps per frame for smoother motion
const FAST_MODE_THRESHOLD = 3.0; // Speed threshold for fast movement mode
const CAMERA_SMOOTHING = 0.12; // Camera smoothing factor (lower = smoother)
const ROTATION_SMOOTHING = 0.08; // Rotation smoothing factor

const DroneNavigation = ({ audio, spatialManager }) => {
  const { 
    dronePosition, droneRotation, droneVelocity,
    droneSpeed, droneAcceleration, droneTurnSpeed, cityBounds,
    updateDronePosition, updateDroneRotation, updateDroneVelocity,
    debugMode, soundEnabled, activeHotspotId, setActiveHotspot
  } = useStore();
  
  // Debug state
  const [initialized, setInitialized] = useState(false);
  const [collisionPoints, setCollisionPoints] = useState([]);
  const [engineSoundPlaying, setEngineSoundPlaying] = useState(false);
  const [isMovingToTarget, setIsMovingToTarget] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false);

  // References for the drone model and camera
  const droneRef = useRef();
  const droneModelRef = useRef();
  const propellersRef = useRef([]);
  const cameraRef = useRef();
  const { camera, scene } = useThree();
  
  // Target position reference
  const targetPositionRef = useRef(null);
  
  // Performance optimization: Use a frame counter for skipping heavy operations
  const frameCountRef = useRef(0);
  
  // Physics accumulator for consistent movement regardless of frame rate
  const physicsAccumulator = useRef(0);
  const lastUpdateTime = useRef(performance.now());
  
  // Reusable temporary objects for performance optimization
  const tempVector = useRef(new THREE.Vector3());
  const tempVector2 = useRef(new THREE.Vector3());
  const tempVector3 = useRef(new THREE.Vector3());
  const tempQuaternion = useRef(new THREE.Quaternion());
  const tempEuler = useRef(new THREE.Euler());
  const tempDirection = useRef(new THREE.Vector3());
  const tempRightVector = useRef(new THREE.Vector3());
  const tempMatrix = useRef(new THREE.Matrix4());
  
  // Collision detection reusable objects
  const raycasterRef = useRef(new THREE.Raycaster());
  const tempNormal = useRef(new THREE.Vector3());
  const tempCollisionPoint = useRef(new THREE.Vector3());
  const tempNewPosition = useRef(new THREE.Vector3());
  const tempNewVelocity = useRef(new THREE.Vector3());
  const tempDirectionVector = useRef(new THREE.Vector3());
  
  // Cache for collision detection results
  const lastVelocityRef = useRef(new THREE.Vector3());
  const lastCollisionResultRef = useRef(null);
  
  // Camera tracking
  const idealCameraPosition = useRef(new THREE.Vector3(-30, 50, -30));
  const currentCameraPosition = useRef(new THREE.Vector3(-30, 50, -30));
  const cameraLookAt = useRef(new THREE.Vector3());
  
  // Initialize drone position once
  useEffect(() => {
    if (!initialized) {
      console.log("Initializing drone position");
      // Start the drone higher up to match the screenshot
      updateDronePosition(new THREE.Vector3(0, 15, 0));
      updateDroneRotation(new THREE.Euler(0, 0, 0));
      updateDroneVelocity(new THREE.Vector3(0, 0, 0));
      
      // Setup the main camera with angled perspective view
      setupMainCamera();
      
      setInitialized(true);
    }
  }, [initialized, updateDronePosition, updateDroneRotation, updateDroneVelocity, debugMode]);
  
  // Setup the main camera with the desired angle and position
  const setupMainCamera = () => {
    // Position the camera at an angle looking down at the city (like in the screenshot)
    camera.position.set(-30, 50, -30);
    currentCameraPosition.current.copy(camera.position);
    idealCameraPosition.current.copy(camera.position);
    
    // Set appropriate field of view to see the city
    camera.fov = 45;
    
    // Set better near/far clipping planes for this view
    camera.near = 0.1;
    camera.far = 2000;
    
    // Point the camera toward the center of the city
    camera.lookAt(0, 0, 0);
    cameraLookAt.current.set(0, 0, 0);
    
    // Update the projection matrix after changes
    camera.updateProjectionMatrix();
    
    console.log("Main camera configured for angled perspective view");
  };
  
  // Use memo to avoid recreating advanced propeller effect material
  const propellerMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }, []);
  
  // Advanced drone effects materials - memoized for better performance
  const droneMaterials = useMemo(() => {
    return {
      body: new THREE.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x00FFFF,
        emissiveIntensity: 0.5
      }),
      lights: new THREE.MeshBasicMaterial({
        color: 0x00FFFF,
        emissive: 0x00FFFF,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      }),
      thruster: new THREE.MeshBasicMaterial({
        color: 0xFF00FF,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      })
    };
  }, []);
  
  // Try to load the drone model if available
  let droneModel;
  try {
    // This might fail if the model isn't available yet, which is fine
    droneModel = useGLTF(DRONE_MODEL_PATH, true); // true for loading without blocking
  } catch (error) {
    console.log("Using default drone model");
  }
  
  // Set up the drone model once loaded
  useEffect(() => {
    if (droneModel && droneModel.scene && droneModelRef.current) {
      // Clear any existing children
      while (droneModelRef.current.children.length > 0) {
        droneModelRef.current.remove(droneModelRef.current.children[0]);
      }
      
      // Clone the model to avoid modifying the cached original
      const model = droneModel.scene.clone();
      
      // Optimize the model for performance
      let propellerCount = 0;
      model.traverse((child) => {
        if (child.isMesh) {
          // Find and mark propellers
          if (child.name.includes('propeller') || child.name.includes('rotor')) {
            propellersRef.current.push(child);
            child.material = propellerMaterial;
            propellerCount++;
          } 
          // Apply custom materials
          else if (child.name.includes('body')) {
            child.material = droneMaterials.body;
          }
          else if (child.name.includes('light') || child.name.includes('glow')) {
            child.material = droneMaterials.lights;
          }
          else if (child.name.includes('engine') || child.name.includes('thruster')) {
            child.material = droneMaterials.thruster;
          }
          
          // Optimize shadows - only cast shadows from body parts
          child.castShadow = child.name.includes('body');
          child.receiveShadow = false;
        }
      });
      
      console.log(`Found ${propellerCount} propellers in drone model`);
      
      // Adjust scale and position as needed - increased scale for better visibility
      model.scale.set(0.8, 0.8, 0.8); // Larger to be more visible from above
      model.position.set(0, 0, 0); // Center the model
      
      // Add more prominent lights to the drone for better visibility
      const droneLight1 = new THREE.PointLight('#00FFFF', 2, 10);
      droneLight1.position.set(0.5, 0.2, 0.5);
      model.add(droneLight1);
      
      const droneLight2 = new THREE.PointLight('#FF00FF', 2, 10);
      droneLight2.position.set(-0.5, 0.2, -0.5);
      model.add(droneLight2);
      
      // Add the model to the reference
      droneModelRef.current.add(model);
    }
  }, [droneModel, propellerMaterial, droneMaterials]);
  
  // Handle audio engine sound
  useEffect(() => {
    if (audio && audio.isInitialized && soundEnabled && !engineSoundPlaying) {
      // Play looping engine sound
      audio.playSound('drone', { loop: true, volume: 0.3 });
      setEngineSoundPlaying(true);
    } else if ((!soundEnabled || !audio?.isInitialized) && engineSoundPlaying) {
      // Stop sound if audio is disabled
      if (audio?.isInitialized) {
        audio.stopSound('drone');
      }
      setEngineSoundPlaying(false);
    }
    
    return () => {
      // Cleanup
      if (audio?.isInitialized && engineSoundPlaying) {
        audio.stopSound('drone');
      }
    };
  }, [audio, soundEnabled, engineSoundPlaying]);
  
  // Input state
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    turnLeft: false,
    turnRight: false,
    pitchUp: false,
    pitchDown: false,
    boost: false // New key for speed boost
  });
  
  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'KeyW') keys.current.forward = true;
      if (e.code === 'KeyS') keys.current.backward = true;
      if (e.code === 'KeyA') keys.current.left = true;
      if (e.code === 'KeyD') keys.current.right = true;
      if (e.code === 'Space') keys.current.up = true;
      if (e.code === 'ShiftLeft') keys.current.down = true;
      if (e.code === 'ArrowLeft') keys.current.turnLeft = true;
      if (e.code === 'ArrowRight') keys.current.turnRight = true;
      if (e.code === 'ArrowUp') keys.current.pitchUp = true;
      if (e.code === 'ArrowDown') keys.current.pitchDown = true;
      if (e.code === 'KeyF') keys.current.boost = true; // F key for boost
    };
    
    const handleKeyUp = (e) => {
      if (e.code === 'KeyW') keys.current.forward = false;
      if (e.code === 'KeyS') keys.current.backward = false;
      if (e.code === 'KeyA') keys.current.left = false;
      if (e.code === 'KeyD') keys.current.right = false;
      if (e.code === 'Space') keys.current.up = false;
      if (e.code === 'ShiftLeft') keys.current.down = false;
      if (e.code === 'ArrowLeft') keys.current.turnLeft = false;
      if (e.code === 'ArrowRight') keys.current.turnRight = false;
      if (e.code === 'ArrowUp') keys.current.pitchUp = false;
      if (e.code === 'ArrowDown') keys.current.pitchDown = false;
      if (e.code === 'KeyF') keys.current.boost = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Handle mouse click for target navigation with advanced path planning
  useEffect(() => {
    const handleClick = (event) => {
      // Convert mouse position to normalized device coordinates
      const mouse = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1
      };
      
      // Update the picking ray
      raycasterRef.current.setFromCamera(mouse, camera);
      
      // Find intersections with floor plane
      const groundPlane = scene.children.find(child => 
        child.isObject3D && 
        child.type === 'Mesh' && 
        child.rotation.x === -Math.PI / 2
      );
      
      if (groundPlane) {
        const intersects = raycasterRef.current.intersectObject(groundPlane);
        
        if (intersects.length > 0) {
          // Set target position for drone to move to
          const clickPoint = intersects[0].point;
          targetPositionRef.current = clickPoint.clone();
          
          // Automatically adjust target height for better navigation
          targetPositionRef.current.y = Math.max(5, dronePosition.y);
          
          setIsMovingToTarget(true);
          
          // Play click sound
          if (audio?.isInitialized && soundEnabled) {
            audio.playSound('click', { volume: 0.3 });
          }
          
          console.log(`Moving to: ${clickPoint.x.toFixed(2)}, ${clickPoint.y.toFixed(2)}, ${clickPoint.z.toFixed(2)}`);
        }
      }
      
      // Check for hotspot intersections
      const hotspots = scene.children.filter(child => 
        child.isObject3D && 
        child.type === 'Group' && 
        child.name.includes('hotspot')
      );
      
      const hotspotIntersects = raycasterRef.current.intersectObjects(hotspots, true);
      
      if (hotspotIntersects.length > 0) {
        let hotspotObject = hotspotIntersects[0].object;
        
        // Traverse up to find the hotspot group
        while (hotspotObject && !hotspotObject.name.includes('hotspot')) {
          hotspotObject = hotspotObject.parent;
        }
        
        if (hotspotObject) {
          const hotspotId = hotspotObject.name.replace('hotspot-', '');
          setActiveHotspot(hotspotId);
          
          // Set target position to the hotspot with appropriate height
          targetPositionRef.current = hotspotObject.position.clone();
          targetPositionRef.current.y = Math.max(hotspotObject.position.y + 2, dronePosition.y);
          
          setIsMovingToTarget(true);
          
          console.log(`Selected hotspot: ${hotspotId}`);
        }
      }
    };
    
    window.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, [camera, scene, audio, soundEnabled, setActiveHotspot, dronePosition.y]);
  
  // Set up collision directions once
  const collisionDirections = useRef([
    new THREE.Vector3(1, 0, 0),    // right
    new THREE.Vector3(-1, 0, 0),   // left
    new THREE.Vector3(0, 0, 1),    // forward
    new THREE.Vector3(0, 0, -1),   // backward
    new THREE.Vector3(0, -1, 0),   // down
  ]);
  
  // Optimized collision detection function with memory reuse
  const checkCollisions = (position, velocity) => {
    if (!initialized) return { hasCollision: false, position, velocity };
    
    // Increment frame counter for throttling
    frameCountRef.current = (frameCountRef.current + 1) % COLLISION_CHECK_INTERVAL;
    
    // Skip checks if not moving significantly or if not on a check frame
    if (frameCountRef.current !== 0 && velocity.lengthSq() < 0.01) {
      return lastCollisionResultRef.current || { hasCollision: false, position, velocity };
    }
    
    // Store current velocity for next frame comparison
    lastVelocityRef.current.copy(velocity);
    
    // Reset collision points if in debug mode
    if (debugMode) {
      setCollisionPoints([]);
    }
    
    let hasCollision = false;
    const collisionDistance = 0.5; // Distance for collision detection
    
    // Reuse vector objects instead of creating new ones
    tempNewPosition.current.copy(position);
    tempNewVelocity.current.copy(velocity);
    
    // Check if position is within city bounds
    if (cityBounds) {
      // Add some buffer to keep drone within the scene
      const buffer = 5; 
      
      if (position.x < cityBounds.min.x + buffer) {
        tempNewPosition.current.x = cityBounds.min.x + buffer;
        tempNewVelocity.current.x = Math.max(0, tempNewVelocity.current.x);
        hasCollision = true;
      } else if (position.x > cityBounds.max.x - buffer) {
        tempNewPosition.current.x = cityBounds.max.x - buffer;
        tempNewVelocity.current.x = Math.min(0, tempNewVelocity.current.x);
        hasCollision = true;
      }
      
      if (position.z < cityBounds.min.z + buffer) {
        tempNewPosition.current.z = cityBounds.min.z + buffer;
        tempNewVelocity.current.z = Math.max(0, tempNewVelocity.current.z);
        hasCollision = true;
      } else if (position.z > cityBounds.max.z - buffer) {
        tempNewPosition.current.z = cityBounds.max.z - buffer;
        tempNewVelocity.current.z = Math.min(0, tempNewVelocity.current.z);
        hasCollision = true;
      }
      
      // Keep the drone within a reasonable height range
      const minHeight = 0.5;
      const maxHeight = cityBounds.max.y - buffer;
      
      if (position.y < minHeight) {
        tempNewPosition.current.y = minHeight;
        tempNewVelocity.current.y = Math.max(0, tempNewVelocity.current.y);
        hasCollision = true;
      } else if (position.y > maxHeight) {
        tempNewPosition.current.y = maxHeight;
        tempNewVelocity.current.y = Math.min(0, tempNewVelocity.current.y);
        hasCollision = true;
      }
    }
    
    // Use spatial manager if available
    if (spatialManager && velocity.lengthSq() > 0.01) {
      const collisionInfo = spatialManager.checkCollisions(position, velocity, collisionDistance);
      
      // If a collision is detected by the spatial manager
      if (collisionInfo.hasCollision) {
        hasCollision = true;
        
        // If in debug mode, store collision points for visualization
        if (debugMode && collisionInfo.point) {
          setCollisionPoints(points => [...points, collisionInfo.point.clone()]);
        }
        
        // Apply collision response if available
        if (collisionInfo.newPosition && collisionInfo.newVelocity) {
          tempNewPosition.current.copy(collisionInfo.newPosition);
          tempNewVelocity.current.copy(collisionInfo.newVelocity);
        }
      }
    }
    // Skip detailed collision checks if we're already at the boundary
    else if (!hasCollision && velocity.lengthSq() > 0.01) {
      // Only check the direction we're moving
      if (velocity.lengthSq() > 0.1) {
        // Forward direction ray (in the direction of travel)
        tempDirectionVector.current.copy(velocity).normalize();
        raycasterRef.current.set(position, tempDirectionVector.current);
        
        // Only intersect with a filtered subset of objects
        const intersects = raycasterRef.current.intersectObjects(scene.children, true);
        
        // Check if any intersections are within our collision distance
        if (intersects.length > 0 && intersects[0].distance < collisionDistance) {
          hasCollision = true;
          
          // If in debug mode, store collision points for visualization
          if (debugMode) {
            tempCollisionPoint.current.copy(intersects[0].point);
            setCollisionPoints(points => [...points, tempCollisionPoint.current.clone()]);
          }
          
          // Calculate bounce/slide direction
          if (intersects[0].face) {
            tempNormal.current.copy(intersects[0].face.normal);
          } else {
            tempNormal.current.copy(tempDirectionVector.current).negate();
          }
          
          const dot = tempNewVelocity.current.dot(tempNormal.current);
          
          if (dot < 0) {
            // Component of velocity in the direction of the normal (reuse tempVector3)
            tempVector3.current.copy(tempNormal.current).multiplyScalar(dot);
            
            // Subtract the normal component to get the tangential component
            tempNewVelocity.current.sub(tempVector3.current);
            
            // Apply some damping to simulate energy loss in collision
            tempNewVelocity.current.multiplyScalar(0.8);
          }
        }
      }
    }
    
    // Cache the result for next frame
    lastCollisionResultRef.current = { 
      hasCollision, 
      position: tempNewPosition.current.clone(), 
      velocity: tempNewVelocity.current.clone() 
    };
    
    return lastCollisionResultRef.current;
  };
  
  // Propeller animation with speed variation
  useFrame(({ clock }) => {
    // Determine propeller speed based on drone velocity
    const speed = droneVelocity.length();
    const propellerSpeed = THREE.MathUtils.clamp(0.5 + speed * 0.3, 0.5, 2.5);
    
    // Rotate propellers if found in the model
    propellersRef.current.forEach((propeller, index) => {
      if (propeller) {
        // Different speeds for different propellers for more realism
        const individualSpeed = propellerSpeed * (1 + index * 0.05);
        propeller.rotation.y += individualSpeed;
      }
    });
    
    // Animate drone tilt based on movement
    if (droneModelRef.current) {
      // Calculate desired tilt angles based on movement direction
      let targetTiltX = 0;
      let targetTiltZ = 0;
      
      if (keys.current.forward) targetTiltX = -0.2;
      if (keys.current.backward) targetTiltX = 0.2;
      if (keys.current.left) targetTiltZ = 0.2;
      if (keys.current.right) targetTiltZ = -0.2;
      
      // Exaggerate tilt in fast mode
      if (isFastMode) {
        targetTiltX *= 1.5;
        targetTiltZ *= 1.5;
      }
      
      // Apply smooth tilting animation
      gsap.to(droneModelRef.current.rotation, {
        x: targetTiltX,
        z: targetTiltZ,
        duration: 0.2,
        overwrite: true,
      });
    }
  });
  
  // Update drone position and rotation on each frame with delta time compensation
  useFrame((state, frameTime) => {
    if (!droneRef.current) return;
    
    // Calculate delta time (capped to avoid extreme values during pauses)
    const now = performance.now();
    const rawDeltaTime = Math.min((now - lastUpdateTime.current) / 1000, 0.1); // Cap at 100ms
    lastUpdateTime.current = now;
    
    // Update physics accumulator
    physicsAccumulator.current += rawDeltaTime;
    
    // Fixed timestep physics simulation
    const fixedTimeStep = 1 / 120; // 120 Hz physics
    
    // Process multiple physics steps if needed for smoother movement
    while (physicsAccumulator.current >= fixedTimeStep) {
      physicsAccumulator.current -= fixedTimeStep;
      
      // Process physics with fixed timestep
      processPhysics(fixedTimeStep);
    }
    
    // Apply remaining time (interpolation step)
    if (physicsAccumulator.current > 0) {
      processPhysics(physicsAccumulator.current);
    }
    
    // Update spatial manager if available
    if (spatialManager) {
      spatialManager.setMoving(droneVelocity.lengthSq() > 0.01);
    }
    
    // Update fast mode state based on velocity (for visual effects)
    const currentSpeed = droneVelocity.length();
    const newFastMode = currentSpeed > FAST_MODE_THRESHOLD;
    
    if (newFastMode !== isFastMode) {
      setIsFastMode(newFastMode);
    }
    
    // Update camera smoothly
    updateCamera();
  });
  
  /**
   * Process physics simulation for one time step
   * @param {number} deltaTime - Time step in seconds
   */
  const processPhysics = (deltaTime) => {
    // Use temp objects to avoid creating new ones
    tempVector.current.set(droneVelocity.x, droneVelocity.y, droneVelocity.z);
    tempEuler.current.set(droneRotation.x, droneRotation.y, droneRotation.z);
    
    // Handle automatic movement to target position if active
    if (isMovingToTarget && targetPositionRef.current) {
      // Calculate direction to target
      tempDirection.current.copy(targetPositionRef.current).sub(dronePosition).normalize();
      
      // Calculate distance to target
      const distanceToTarget = dronePosition.distanceTo(targetPositionRef.current);
      
      // If we're close enough to the target, stop moving
      if (distanceToTarget < 1) {
        setIsMovingToTarget(false);
        targetPositionRef.current = null;
        updateDroneVelocity(new THREE.Vector3(0, 0, 0));
      } else {
        // Smoothly rotate toward target
        const targetAngle = Math.atan2(tempDirection.current.x, tempDirection.current.z);
        tempEuler.current.y = THREE.MathUtils.lerp(tempEuler.current.y, targetAngle, ROTATION_SMOOTHING);
        
        // Calculate appropriate speed based on distance
        // Slow down as we approach the target
        const adaptiveSpeed = THREE.MathUtils.clamp(
          distanceToTarget * 0.3, // Faster initial approach
          0.2,                   // Minimum speed
          droneSpeed * 1.5       // Maximum speed (boosted)
        );
        
        // Move toward target
        tempVector.current.x = tempDirection.current.x * adaptiveSpeed;
        tempVector.current.z = tempDirection.current.z * adaptiveSpeed;
        
        // Maintain current height or adjust if needed
        if (Math.abs(targetPositionRef.current.y - dronePosition.y) > 0.5) {
          const heightDifference = targetPositionRef.current.y - dronePosition.y;
          const verticalSpeed = Math.sign(heightDifference) * 
                               Math.min(Math.abs(heightDifference) * 0.1, adaptiveSpeed * 0.5);
                               
          tempVector.current.y = verticalSpeed;
        } else {
          tempVector.current.y = 0;
        }
      }
    } else {
      // Manual control with keyboard
      
      // Apply rotation changes
      if (keys.current.turnLeft) tempEuler.current.y += droneTurnSpeed * deltaTime * 60;
      if (keys.current.turnRight) tempEuler.current.y -= droneTurnSpeed * deltaTime * 60;
      if (keys.current.pitchUp) tempEuler.current.x += droneTurnSpeed * 0.5 * deltaTime * 60;
      if (keys.current.pitchDown) tempEuler.current.x -= droneTurnSpeed * 0.5 * deltaTime * 60;
      
      // Limit pitch rotation
      tempEuler.current.x = Math.max(Math.min(tempEuler.current.x, Math.PI / 4), -Math.PI / 4);
      
      // Convert rotation to direction vector (reuse tempDirection)
      tempDirection.current.set(0, 0, -1);
      tempQuaternion.current.setFromEuler(tempEuler.current);
      tempDirection.current.applyQuaternion(tempQuaternion.current);
      
      // Calculate acceleration multiplier based on boost key
      const accelerationMultiplier = keys.current.boost ? 2.0 : 1.0;
      const currentAcceleration = droneAcceleration * accelerationMultiplier * deltaTime * 60;
      
      // Apply acceleration in the direction of movement
      if (keys.current.forward) {
        tempVector.current.x += tempDirection.current.x * currentAcceleration;
        tempVector.current.z += tempDirection.current.z * currentAcceleration;
      }
      if (keys.current.backward) {
        tempVector.current.x -= tempDirection.current.x * currentAcceleration;
        tempVector.current.z -= tempDirection.current.z * currentAcceleration;
      }
      
      // Strafe movement (reuse tempRightVector)
      tempRightVector.current.set(1, 0, 0).applyQuaternion(tempQuaternion.current);
      if (keys.current.right) {
        tempVector.current.x += tempRightVector.current.x * currentAcceleration;
        tempVector.current.z += tempRightVector.current.z * currentAcceleration;
      }
      if (keys.current.left) {
        tempVector.current.x -= tempRightVector.current.x * currentAcceleration;
        tempVector.current.z -= tempRightVector.current.z * currentAcceleration;
      }
      
      // Vertical movement
      if (keys.current.up) tempVector.current.y += currentAcceleration;
      if (keys.current.down) tempVector.current.y -= currentAcceleration;
      
      // Apply friction/drag
      const dragFactor = Math.pow(0.95, deltaTime * 60);
      tempVector.current.multiplyScalar(dragFactor);
    }
    
    // Limit maximum speed (higher limit when boosting)
    const maxSpeed = keys.current.boost ? droneSpeed * 2.0 : droneSpeed;
    const speedSq = tempVector.current.lengthSq();
    if (speedSq > maxSpeed * maxSpeed) {
      tempVector.current.multiplyScalar(maxSpeed / Math.sqrt(speedSq));
    }
    
    // Calculate next position with velocity (reuse tempVector2)
    tempVector2.current.copy(dronePosition).addScaledVector(tempVector.current, deltaTime);
    
    // Check for collisions
    const { hasCollision, position: adjustedPosition, velocity: adjustedVelocity } = 
      checkCollisions(tempVector2.current, tempVector.current);
    
    // Update state
    updateDronePosition(adjustedPosition);
    updateDroneRotation(tempEuler.current);
    updateDroneVelocity(adjustedVelocity);
    
    // Update drone mesh position and rotation
    if (droneRef.current) {
      droneRef.current.position.copy(adjustedPosition);
      droneRef.current.rotation.copy(tempEuler.current);
    }
  };
  
  /**
   * Update camera position and target with smooth interpolation
   */
  const updateCamera = () => {
    // Calculate ideal camera position based on drone position
    idealCameraPosition.current.set(
      dronePosition.x - 30, 
      50, // Fixed height for the angled perspective
      dronePosition.z - 30
    );
    
    // Calculate camera target (drone position)
    cameraLookAt.current.copy(dronePosition);
    
    // Smoothly interpolate current camera position
    currentCameraPosition.current.lerp(idealCameraPosition.current, CAMERA_SMOOTHING);
    
    // Apply to camera
    camera.position.copy(currentCameraPosition.current);
    camera.lookAt(cameraLookAt.current);
  };
  
  return (
    <group>
      {/* Main drone group */}
      <group ref={droneRef}>
        {/* Drone model container */}
        <group ref={droneModelRef} />
        
        {/* Fallback simple drone mesh if model isn't loaded */}
        {!droneModel && (
          <mesh castShadow>
            <boxGeometry args={[1, 0.2, 1]} />
            <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
            
            {/* Drone propellers/lights */}
            <pointLight color="#00FFFF" intensity={2} distance={8} position={[0.5, 0.2, 0.5]} />
            <pointLight color="#00FFFF" intensity={2} distance={8} position={[-0.5, 0.2, 0.5]} />
            <pointLight color="#00FFFF" intensity={2} distance={8} position={[0.5, 0.2, -0.5]} />
            <pointLight color="#00FFFF" intensity={2} distance={8} position={[-0.5, 0.2, -0.5]} />
          </mesh>
        )}
      
        {/* Enhanced drone effects based on movement speed */}
        <group position={[0, -0.15, 0]}>
          {/* Engine glow effect - size/intensity based on speed */}
          <mesh>
            <sphereGeometry args={[isFastMode ? 1.5 : 1, 16, 16]} />
            <meshBasicMaterial 
              color="#00FFFF" 
              transparent 
              opacity={isFastMode ? 0.3 : 0.2} 
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          
          {/* Thruster trail effect when moving fast */}
          {isFastMode && (
            <mesh position={[0, -0.5, 0]}>
              <coneGeometry args={[0.8, 4, 16, 1, true]} />
              <meshBasicMaterial 
                color="#00FFFF" 
                transparent 
                opacity={0.15} 
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
        
        {/* Drone navigation beacon - enhanced brightness */}
        <pointLight 
          color={isFastMode ? "#FF00FF" : "#00FFFF"} 
          intensity={isFastMode ? 1.8 : 1.2} 
          distance={isFastMode ? 8 : 5} 
          position={[0, 0.5, 0]} 
        />
      </group>
      
      {/* Debug visualization of collision points */}
      {debugMode && collisionPoints.map((point, index) => (
        <mesh key={`collision-${index}`} position={point}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      ))}
      
      {/* Reference camera for main view */}
      <PerspectiveCamera 
        ref={cameraRef}
        makeDefault
        position={[-30, 50, -30]}
        fov={45}
        near={0.1}
        far={2000}
        aspect={window.innerWidth / window.innerHeight}
      />
    </group>
  );
};

export default DroneNavigation;