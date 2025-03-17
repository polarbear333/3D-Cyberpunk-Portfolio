import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera, useGLTF } from '@react-three/drei';
import { 
  Vector3, 
  Quaternion, 
  Euler, 
  MathUtils, 
  Box3, 
  Raycaster, 
  PointLight, 
  Matrix4 
} from 'three';
import { useStore } from '../../state/useStore';
import { gsap } from 'gsap';

// Load the drone model
const DRONE_MODEL_PATH = '/models/cyberdrone/drone.glb'; 

const DroneNavigation = ({ audio }) => {
  const { 
    dronePosition, droneRotation, droneVelocity, cameraMode,
    droneSpeed, droneAcceleration, droneTurnSpeed, cityBounds,
    updateDronePosition, updateDroneRotation, updateDroneVelocity,
    setCameraMode, debugMode, soundEnabled, activeHotspotId, setActiveHotspot
  } = useStore();
  
  // Debug state
  const [initialized, setInitialized] = useState(false);
  const [collisionPoints, setCollisionPoints] = useState([]);
  const [engineSoundPlaying, setEngineSoundPlaying] = useState(false);
  const [isMovingToTarget, setIsMovingToTarget] = useState(false);

  // References for the drone model and camera
  const droneRef = useRef();
  const droneModelRef = useRef();
  const propellersRef = useRef([]);
  const cameraRef = useRef();
  const orthoCameraRef = useRef();
  const { camera, gl, scene } = useThree();
  
  // Target position reference
  const targetPositionRef = useRef(null);
  
  // Reusable temporary objects for performance optimization
  const tempVector = useRef(new Vector3());
  const tempVector2 = useRef(new Vector3());
  const tempVector3 = useRef(new Vector3());
  const tempQuaternion = useRef(new Quaternion());
  const tempEuler = useRef(new Euler());
  const tempDirection = useRef(new Vector3());
  const tempRightVector = useRef(new Vector3());
  const tempMatrix = useRef(new Matrix4());
  
  // Collision detection reusable objects
  const raycasterRef = useRef(new Raycaster());
  const tempNormal = useRef(new Vector3());
  const tempCollisionPoint = useRef(new Vector3());
  const tempNewPosition = useRef(new Vector3());
  const tempNewVelocity = useRef(new Vector3());
  const tempDirectionVector = useRef(new Vector3());
  
  // Cache for collision detection results
  const lastVelocityRef = useRef(new Vector3());
  const lastCollisionResultRef = useRef(null);
  const frameCountRef = useRef(0);
  
  // Initialize drone position once
  useEffect(() => {
    if (!initialized) {
      console.log("Initializing drone position");
      updateDronePosition(new Vector3(0, 10, 0));
      updateDroneRotation(new Euler(0, 0, 0));
      updateDroneVelocity(new Vector3(0, 0, 0));
      
      // Set camera mode to orthographic angled view
      setCameraMode('orthoAngled');
      
      setInitialized(true);
      
      // Stats.js is now handled by the StatsPanel component
    }
  }, [initialized, updateDronePosition, updateDroneRotation, updateDroneVelocity, setCameraMode, debugMode]);
  
  // Stats.js cleanup is now handled by the StatsPanel component
  
  // Try to load the drone model if available
  let droneModel;
  try {
    // This might fail if the model isn't available yet, which is fine
    droneModel = useGLTF(DRONE_MODEL_PATH);
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
      
      // Adjust scale and position as needed
      model.scale.set(0.5, 0.5, 0.5); // Adjust based on your model's size
      model.position.set(0, 0, 0); // Center the model
      
      // Find propellers for animation
      propellersRef.current = [];
      model.traverse((child) => {
        if (child.name.includes('propeller') || child.name.includes('rotor')) {
          propellersRef.current.push(child);
        }
      });
      
      // Add lights or glowing elements to the drone
      const droneLight1 = new PointLight('#00FFFF', 1, 5);
      droneLight1.position.set(0.5, 0.2, 0.5);
      model.add(droneLight1);
      
      const droneLight2 = new PointLight('#FF00FF', 1, 5);
      droneLight2.position.set(-0.5, 0.2, -0.5);
      model.add(droneLight2);
      
      // Add the model to the reference
      droneModelRef.current.add(model);
    }
  }, [droneModel]);
  
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
    };
    
    // Toggle camera mode with 'C' key
    const handleCameraToggle = (e) => {
      if (e.code === 'KeyC') {
        const modes = ['orthoAngled', 'topDown', 'thirdPerson', 'firstPerson'];
        const currentIndex = modes.indexOf(cameraMode);
        const newMode = modes[(currentIndex + 1) % modes.length];
        
        setCameraMode(newMode);
        console.log(`Camera mode switched to: ${newMode}`);
        
        // Play a sound for mode change
        if (audio?.isInitialized && soundEnabled) {
          audio.playSound('click', { volume: 0.5 });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keypress', handleCameraToggle);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keypress', handleCameraToggle);
    };
  }, [cameraMode, setCameraMode, audio, soundEnabled]);
  
  // Handle mouse click for target navigation
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
          
          // Set target position to the hotspot
          targetPositionRef.current = hotspotObject.position.clone();
          setIsMovingToTarget(true);
          
          console.log(`Selected hotspot: ${hotspotId}`);
        }
      }
    };
    
    window.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, [camera, scene, audio, soundEnabled, setActiveHotspot]);
  
  // Set up collision directions once
  const collisionDirections = useRef([
    new Vector3(1, 0, 0),    // right
    new Vector3(-1, 0, 0),   // left
    new Vector3(0, 0, 1),    // forward
    new Vector3(0, 0, -1),   // backward
    new Vector3(0, -1, 0),   // down
  ]);
  
  // Optimized collision detection function with memory reuse
  const checkCollisions = (position, velocity) => {
    if (!initialized) return { hasCollision: false, position, velocity };
    
    // Increment frame counter for throttling
    frameCountRef.current = (frameCountRef.current + 1) % 3;
    
    // Only check collisions every few frames unless velocity changed significantly
    if (frameCountRef.current !== 0 && velocity.lengthSq() < lastVelocityRef.current.lengthSq() * 1.2) {
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
    
    // Skip detailed collision checks if we're already at the boundary
    if (!hasCollision && velocity.lengthSq() > 0.01) {
      // Only check when moving at a significant speed
      
      // Instead of checking all directions, only check the direction we're moving
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
  
  // Propeller animation
  useFrame(({ clock }) => {
    // Rotate propellers if found in the model
    propellersRef.current.forEach((propeller) => {
      if (propeller) {
        propeller.rotation.y += 0.5; // Adjust speed as needed
      }
    });
    
    // Animate drone tilt based on movement
    if (droneModelRef.current) {
      // Calculate desired tilt angles based on movement direction
      let targetTiltX = 0;
      let targetTiltZ = 0;
      
      if (keys.current.forward) targetTiltX = -0.1;
      if (keys.current.backward) targetTiltX = 0.1;
      if (keys.current.left) targetTiltZ = 0.1;
      if (keys.current.right) targetTiltZ = -0.1;
      
      // Apply smooth tilting animation
      gsap.to(droneModelRef.current.rotation, {
        x: targetTiltX,
        z: targetTiltZ,
        duration: 0.2,
        overwrite: true,
      });
    }
    
    // Stats.js update is now handled by the StatsPanel component
  });
  
  // Update drone position and rotation on each frame
  useFrame((state, delta) => {
    if (!droneRef.current) return;
    
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
        updateDroneVelocity(new Vector3(0, 0, 0));
      } else {
        // Smoothly rotate toward target
        const targetAngle = Math.atan2(tempDirection.current.x, tempDirection.current.z);
        tempEuler.current.y = MathUtils.lerp(tempEuler.current.y, targetAngle, 0.05);
        
        // Move toward target
        const moveSpeed = Math.min(droneSpeed, distanceToTarget * 0.5);
        tempVector.current.x = tempDirection.current.x * moveSpeed;
        tempVector.current.z = tempDirection.current.z * moveSpeed;
        
        // Maintain current height or adjust if needed
        if (Math.abs(targetPositionRef.current.y - dronePosition.y) > 0.5) {
          tempVector.current.y = Math.sign(targetPositionRef.current.y - dronePosition.y) * moveSpeed * 0.5;
        } else {
          tempVector.current.y = 0;
        }
      }
    } else {
      // Manual control with keyboard
      
      // Apply rotation changes
      if (keys.current.turnLeft) tempEuler.current.y += droneTurnSpeed;
      if (keys.current.turnRight) tempEuler.current.y -= droneTurnSpeed;
      if (keys.current.pitchUp) tempEuler.current.x += droneTurnSpeed * 0.5;
      if (keys.current.pitchDown) tempEuler.current.x -= droneTurnSpeed * 0.5;
      
      // Limit pitch rotation
      tempEuler.current.x = Math.max(Math.min(tempEuler.current.x, Math.PI / 4), -Math.PI / 4);
      
      // Convert rotation to direction vector (reuse tempDirection)
      tempDirection.current.set(0, 0, -1);
      tempQuaternion.current.setFromEuler(tempEuler.current);
      tempDirection.current.applyQuaternion(tempQuaternion.current);
      
      // Apply acceleration in the direction of movement
      if (keys.current.forward) {
        tempVector.current.x += tempDirection.current.x * droneAcceleration;
        tempVector.current.z += tempDirection.current.z * droneAcceleration;
      }
      if (keys.current.backward) {
        tempVector.current.x -= tempDirection.current.x * droneAcceleration;
        tempVector.current.z -= tempDirection.current.z * droneAcceleration;
      }
      
      // Strafe movement (reuse tempRightVector)
      tempRightVector.current.set(1, 0, 0).applyQuaternion(tempQuaternion.current);
      if (keys.current.right) {
        tempVector.current.x += tempRightVector.current.x * droneAcceleration;
        tempVector.current.z += tempRightVector.current.z * droneAcceleration;
      }
      if (keys.current.left) {
        tempVector.current.x -= tempRightVector.current.x * droneAcceleration;
        tempVector.current.z -= tempRightVector.current.z * droneAcceleration;
      }
      
      // Vertical movement
      if (keys.current.up) tempVector.current.y += droneAcceleration;
      if (keys.current.down) tempVector.current.y -= droneAcceleration;
      
      // Apply friction/drag
      tempVector.current.multiplyScalar(0.95);
    }
    
    // Limit maximum speed
    const maxSpeed = droneSpeed;
    const speedSq = tempVector.current.lengthSq();
    if (speedSq > maxSpeed * maxSpeed) {
      tempVector.current.multiplyScalar(maxSpeed / Math.sqrt(speedSq));
    }
    
    // Calculate next position with velocity (reuse tempVector2)
    tempVector2.current.copy(dronePosition).addScaledVector(tempVector.current, delta * 60);
    
    // Check for collisions
    const { hasCollision, position: adjustedPosition, velocity: adjustedVelocity } = 
      checkCollisions(tempVector2.current, tempVector.current);
    
    // Update state
    updateDronePosition(adjustedPosition);
    updateDroneRotation(tempEuler.current);
    updateDroneVelocity(adjustedVelocity);
    
    // Update drone mesh position and rotation
    droneRef.current.position.copy(adjustedPosition);
    droneRef.current.rotation.copy(tempEuler.current);
    
    // Update camera based on current mode
    switch (cameraMode) {
      case 'orthoAngled':
        // Position the orthographic camera at an angle above the city (like in the screenshot)
        if (orthoCameraRef.current) {
          const cameraHeight = 50;
          // Reuse temp vectors
          tempVector3.current.set(-30, cameraHeight, -30);
          
          // Set camera position relative to drone but with fixed height and angle
          camera.position.set(
            adjustedPosition.x + tempVector3.current.x,
            cameraHeight,
            adjustedPosition.z + tempVector3.current.z
          );
          
          // Look at the drone
          camera.lookAt(adjustedPosition);
          
          // Update orthographic camera settings
          const orthoCamera = orthoCameraRef.current;
          // Set zoom based on city size or desired view area
          const orthoZoom = 15; // Adjust as needed
          orthoCamera.zoom = orthoZoom;
          orthoCamera.updateProjectionMatrix();
        }
        break;
        
      case 'topDown':
        // True top-down view
        camera.position.set(adjustedPosition.x, 80, adjustedPosition.z);
        camera.lookAt(adjustedPosition.x, 0, adjustedPosition.z);
        break;
        
      case 'thirdPerson':
        // Third-person view following the drone - reuse tempDirection
        tempDirection.current.set(0, 0, -1);
        tempDirection.current.applyQuaternion(tempQuaternion.current.setFromEuler(tempEuler.current));
        
        // Calculate camera position - reuse tempVector3
        tempVector3.current.set(
          -tempDirection.current.x * 8 + adjustedPosition.x,
          5 + adjustedPosition.y,
          -tempDirection.current.z * 8 + adjustedPosition.z
        );
        
        // Smooth camera follow
        camera.position.lerp(tempVector3.current, 0.1);
        camera.lookAt(adjustedPosition);
        break;
        
      case 'firstPerson':
        // First-person view - reuse tempVector3
        tempVector3.current.copy(adjustedPosition).add(new Vector3(0, 0.5, 0));
        camera.position.copy(tempVector3.current);
        camera.rotation.copy(tempEuler.current);
        break;
        
      default:
        break;
    }
  });
  
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
            <pointLight color="#00FFFF" intensity={1} distance={5} position={[0.5, 0.2, 0.5]} />
            <pointLight color="#00FFFF" intensity={1} distance={5} position={[-0.5, 0.2, 0.5]} />
            <pointLight color="#00FFFF" intensity={1} distance={5} position={[0.5, 0.2, -0.5]} />
            <pointLight color="#00FFFF" intensity={1} distance={5} position={[-0.5, 0.2, -0.5]} />
          </mesh>
        )}
      
        {/* Drone engine glow effect */}
        <mesh position={[0, -0.15, 0]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshBasicMaterial color="#00FFFF" transparent opacity={0.2} />
        </mesh>
        
        {/* Drone navigation beacon */}
        <pointLight color="#FF00FF" intensity={0.8} distance={3} position={[0, 0.5, 0]} />
      </group>
      
      {/* Debug visualization of collision points */}
      {debugMode && collisionPoints.map((point, index) => (
        <mesh key={`collision-${index}`} position={point}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      ))}
      
      {/* Orthographic camera for angled view */}
      <OrthographicCamera
        ref={orthoCameraRef}
        makeDefault={cameraMode === 'orthoAngled'}
        position={[0, 50, 0]}
        zoom={15}
        near={1}
        far={1000}
        left={-window.innerWidth / window.innerHeight * 10}
        right={window.innerWidth / window.innerHeight * 10}
        top={10}
        bottom={-10}
      />
      
      {/* Reference camera for other views */}
      <PerspectiveCamera 
        ref={cameraRef}
        makeDefault={cameraMode !== 'orthoAngled'} 
        position={[0, 5, 10]}
        fov={60}
      />
    </group>
  );
};

export default DroneNavigation;