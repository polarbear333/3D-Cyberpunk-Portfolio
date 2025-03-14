import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Vector3, Quaternion, Euler, MathUtils } from 'three';
import { useStore } from '../../state/useStore';
import { gsap } from 'gsap';

const DroneNavigation = () => {
  const { 
    dronePosition, droneRotation, droneVelocity, cameraMode,
    droneSpeed, droneAcceleration, droneTurnSpeed,
    updateDronePosition, updateDroneRotation, updateDroneVelocity,
    setCameraMode
  } = useStore();
  
  // Debug state
  const [initialized, setInitialized] = useState(false);

  // References for the drone model and camera
  const droneRef = useRef();
  const cameraRef = useRef();
  const { camera, gl } = useThree();
  
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
  
  // Load the drone model (if needed)
  // const { scene: droneModel } = useGLTF('/models/drone.glb');
  
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
    
    // Update position
    const nextPosition = new Vector3(...dronePosition.toArray()).add(
      velocity.clone().multiplyScalar(delta * 60)
    );
    
    // Simple collision detection with ground
    if (nextPosition.y < 0.5) {
      nextPosition.y = 0.5;
      velocity.y = 0;
    }
    
    // Update state
    updateDronePosition(nextPosition);
    updateDroneRotation(rotation);
    updateDroneVelocity(velocity);
    
    // Update drone mesh position and rotation
    droneRef.current.position.copy(nextPosition);
    droneRef.current.rotation.copy(rotation);
    
    // Update camera if in third-person mode
    if (cameraMode === 'thirdPerson' && cameraRef.current) {
      const cameraOffset = new Vector3(
        -direction.x * 8 + nextPosition.x,
        5 + nextPosition.y,
        -direction.z * 8 + nextPosition.z
      );
      
      // Smooth camera follow
      camera.position.lerp(cameraOffset, 0.1);
      camera.lookAt(nextPosition);
    } else if (cameraMode === 'firstPerson') {
      // First-person view
      camera.position.copy(nextPosition.clone().add(new Vector3(0, 0.5, 0)));
      camera.rotation.copy(rotation);
    }
  });
  
  return (
    <group>
      {/* Drone mesh - simple for now, can be replaced with a detailed model */}
      <mesh ref={droneRef} castShadow>
        <boxGeometry args={[1, 0.2, 1]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
        
        {/* Drone propellers/lights */}
        <pointLight color="#00FFFF" intensity={1} distance={5} position={[0.5, 0.2, 0.5]} />
        <pointLight color="#00FFFF" intensity={1} distance={5} position={[-0.5, 0.2, 0.5]} />
        <pointLight color="#00FFFF" intensity={1} distance={5} position={[0.5, 0.2, -0.5]} />
        <pointLight color="#00FFFF" intensity={1} distance={5} position={[-0.5, 0.2, -0.5]} />
      </mesh>
      
      {/* Reference camera for third-person view */}
      <PerspectiveCamera ref={cameraRef} makeDefault={false} position={[0, 5, 10]} />
    </group>
  );
};

export default DroneNavigation;