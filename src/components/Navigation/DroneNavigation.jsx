import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Vector3, Quaternion, Euler, MathUtils, Box3, Raycaster, PointLight } from 'three';
import { useStore } from '../../state/useStore';
import { gsap } from 'gsap';

// Load the drone model
const DRONE_MODEL_PATH = '/models/cyberdrone/drone.glb'; 
// You'll need to create or acquire a drone model and put it in this location

const DroneNavigation = ({ audio }) => {
  const { 
    dronePosition, droneRotation, droneVelocity, cameraMode,
    droneSpeed, droneAcceleration, droneTurnSpeed, cityBounds,
    updateDronePosition, updateDroneRotation, updateDroneVelocity,
    setCameraMode, debugMode, soundEnabled
  } = useStore();
  
  // Debug state
  const [initialized, setInitialized] = useState(false);
  const [collisionPoints, setCollisionPoints] = useState([]);
  const [engineSoundPlaying, setEngineSoundPlaying] = useState(false);

  // References for the drone model and camera
  const droneRef = useRef();
  const droneModelRef = useRef();
  const propellersRef = useRef([]);
  const cameraRef = useRef();
  const { camera, gl, scene } = useThree();
  
  // Initialize drone position once
  useEffect(() => {
    if (!initialized) {
      console.log("Initializing drone position");
      updateDronePosition(new Vector3(0, 10, 0));
      updateDroneRotation(new Euler(0, 0, 0));
      updateDroneVelocity(new Vector3(0, 0, 0));
      setCameraMode('thirdPerson');
      setInitialized(true);
    }
  }, [initialized, updateDronePosition, updateDroneRotation, updateDroneVelocity, setCameraMode]);
  
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
        const newMode = cameraMode === 'firstPerson' ? 'thirdPerson' : 'firstPerson';
        useStore.getState().setCameraMode(newMode);
        
        // Smooth transition between camera modes
        gsap.to(camera.position, {
          x: newMode === 'firstPerson' ? 0 : 5,
          y: newMode === 'firstPerson' ? 0.5 : 3,
          z: newMode === 'firstPerson' ? 0 : 5,
          duration: 1,
          ease: 'power2.inOut'
        });
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
  }, [cameraMode]);
  
  // Set up collision detection
  const raycaster = new Raycaster();
  const collisionDirections = [
    new Vector3(1, 0, 0),    // right
    new Vector3(-1, 0, 0),   // left
    new Vector3(0, 0, 1),    // forward
    new Vector3(0, 0, -1),   // backward
    new Vector3(0, -1, 0),   // down
  ];
  
  // Collision detection function
  const checkCollisions = (position, velocity) => {
    if (!initialized) return { hasCollision: false, position, velocity };
    
    // Reset collision points if in debug mode
    if (debugMode) {
      setCollisionPoints([]);
    }
    
    let hasCollision = false;
    const collisionDistance = 0.5; // Distance for collision detection
    const newPosition = position.clone();
    const newVelocity = velocity.clone();
    
    // Check if position is within city bounds
    if (cityBounds) {
      // Add some buffer to keep drone within the scene
      const buffer = 5; 
      
      if (position.x < cityBounds.min.x + buffer) {
        newPosition.x = cityBounds.min.x + buffer;
        newVelocity.x = Math.max(0, newVelocity.x);
        hasCollision = true;
      } else if (position.x > cityBounds.max.x - buffer) {
        newPosition.x = cityBounds.max.x - buffer;
        newVelocity.x = Math.min(0, newVelocity.x);
        hasCollision = true;
      }
      
      if (position.z < cityBounds.min.z + buffer) {
        newPosition.z = cityBounds.min.z + buffer;
        newVelocity.z = Math.max(0, newVelocity.z);
        hasCollision = true;
      } else if (position.z > cityBounds.max.z - buffer) {
        newPosition.z = cityBounds.max.z - buffer;
        newVelocity.z = Math.min(0, newVelocity.z);
        hasCollision = true;
      }
      
      // Keep the drone within a reasonable height range
      const minHeight = 0.5;
      const maxHeight = cityBounds.max.y - buffer;
      
      if (position.y < minHeight) {
        newPosition.y = minHeight;
        newVelocity.y = Math.max(0, newVelocity.y);
        hasCollision = true;
      } else if (position.y > maxHeight) {
        newPosition.y = maxHeight;
        newVelocity.y = Math.min(0, newVelocity.y);
        hasCollision = true;
      }
    }
    
    // Check each direction for collisions with scene objects
    collisionDirections.forEach(dir => {
      // Adjust direction based on drone rotation for forward/backward/left/right
      let direction = dir.clone();
      if (dir.z !== 0 || dir.x !== 0) {
        const quaternion = new Quaternion().setFromEuler(new Euler(0, droneRotation.y, 0));
        direction.applyQuaternion(quaternion);
      }
      
      // Set up raycaster
      raycaster.set(position, direction.normalize());
      
      // Get intersections with all objects in the scene
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      // Check if any intersections are within our collision distance
      if (intersects.length > 0 && intersects[0].distance < collisionDistance) {
        hasCollision = true;
        
        // If in debug mode, store collision points for visualization
        if (debugMode) {
          setCollisionPoints(points => [...points, intersects[0].point]);
        }
        
        // Calculate bounce/slide direction
        const normal = intersects[0].face ? intersects[0].face.normal.clone() : direction.clone().negate();
        const dot = velocity.clone().normalize().dot(normal);
        
        if (dot < 0) {
          // Component of velocity in the direction of the normal
          const normalComponent = normal.clone().multiplyScalar(dot);
          
          // Subtract the normal component to get the tangential component
          // This creates a sliding effect along surfaces
          newVelocity.sub(normalComponent);
          
          // Apply some damping to simulate energy loss in collision
          newVelocity.multiplyScalar(0.8);
        }
      }
    });
    
    return { hasCollision, position: newPosition, velocity: newVelocity };
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
      const speed = droneVelocity.length();
      
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
  });
  
  // Update drone position and rotation on each frame
  useFrame((_, delta) => {
    if (!droneRef.current) return;
    
    // Get the current velocity and rotation
    const velocity = new Vector3(...droneVelocity.toArray());
    const rotation = new Euler(...droneRotation.toArray());
    
    // Apply rotation changes
    if (keys.current.turnLeft) rotation.y += droneTurnSpeed;
    if (keys.current.turnRight) rotation.y -= droneTurnSpeed;
    if (keys.current.pitchUp) rotation.x += droneTurnSpeed * 0.5;
    if (keys.current.pitchDown) rotation.x -= droneTurnSpeed * 0.5;
    
    // Limit pitch rotation
    rotation.x = Math.max(Math.min(rotation.x, Math.PI / 4), -Math.PI / 4);
    
    // Convert rotation to direction vector
    const direction = new Vector3(0, 0, -1);
    const quaternion = new Quaternion().setFromEuler(rotation);
    direction.applyQuaternion(quaternion);
    
    // Apply acceleration in the direction of movement
    if (keys.current.forward) {
      velocity.x += direction.x * droneAcceleration;
      velocity.z += direction.z * droneAcceleration;
    }
    if (keys.current.backward) {
      velocity.x -= direction.x * droneAcceleration;
      velocity.z -= direction.z * droneAcceleration;
    }
    
    // Strafe movement
    const rightVector = new Vector3(1, 0, 0).applyQuaternion(quaternion);
    if (keys.current.right) {
      velocity.x += rightVector.x * droneAcceleration;
      velocity.z += rightVector.z * droneAcceleration;
    }
    if (keys.current.left) {
      velocity.x -= rightVector.x * droneAcceleration;
      velocity.z -= rightVector.z * droneAcceleration;
    }
    
    // Vertical movement
    if (keys.current.up) velocity.y += droneAcceleration;
    if (keys.current.down) velocity.y -= droneAcceleration;
    
    // Apply friction/drag
    velocity.multiplyScalar(0.95);
    
    // Limit maximum speed
    const maxSpeed = droneSpeed;
    const speedSq = velocity.lengthSq();
    if (speedSq > maxSpeed * maxSpeed) {
      velocity.multiplyScalar(maxSpeed / Math.sqrt(speedSq));
    }
    
    // Calculate next position with velocity
    const nextPosition = new Vector3(...dronePosition.toArray()).add(
      velocity.clone().multiplyScalar(delta * 60)
    );
    
    // Check for collisions
    const { hasCollision, position: adjustedPosition, velocity: adjustedVelocity } = 
      checkCollisions(nextPosition, velocity);
    
    // Update state
    updateDronePosition(adjustedPosition);
    updateDroneRotation(rotation);
    updateDroneVelocity(adjustedVelocity);
    
    // Update drone mesh position and rotation
    droneRef.current.position.copy(adjustedPosition);
    droneRef.current.rotation.copy(rotation);
    
    // Update camera if in third-person mode
    if (cameraMode === 'thirdPerson' && cameraRef.current) {
      const cameraOffset = new Vector3(
        -direction.x * 8 + adjustedPosition.x,
        5 + adjustedPosition.y,
        -direction.z * 8 + adjustedPosition.z
      );
      
      // Smooth camera follow
      camera.position.lerp(cameraOffset, 0.1);
      camera.lookAt(adjustedPosition);
    } else if (cameraMode === 'firstPerson') {
      // First-person view
      camera.position.copy(adjustedPosition.clone().add(new Vector3(0, 0.5, 0)));
      camera.rotation.copy(rotation);
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
      
      {/* Reference camera for third-person view */}
      <PerspectiveCamera ref={cameraRef} makeDefault={false} position={[0, 5, 10]} />
    </group>
  );
};

export default DroneNavigation;