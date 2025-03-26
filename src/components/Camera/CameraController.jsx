import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';
import { useEventSystem, EVENT_TYPES, PRIORITY, useSystem } from '../../systems/EventSystem';

const CameraController = ({ 
  minDistance = 10,
  maxDistance = 1000,
  dampingFactor = 0.05,
  enablePan = false,
  lookAt = [0, 10, 0]
}) => {
  const { camera, invalidate } = useThree();
  const { debugMode } = useStore();
  const controlsRef = useRef();
  const targetRef = useRef(new THREE.Vector3(...lookAt));
  const isAnimatingRef = useRef(false);
  const animationDurationRef = useRef(0);
  const animationProgressRef = useRef(0);
  const startPositionRef = useRef(new THREE.Vector3());
  const endPositionRef = useRef(new THREE.Vector3());
  const startTargetRef = useRef(new THREE.Vector3());
  const endTargetRef = useRef(new THREE.Vector3());
  
  // Access the event system
  const { emit, subscribe, unsubscribe } = useEventSystem();
  
  // Set up event listeners on mount
  useEffect(() => {
    // Subscribe to camera target events
    const cameraTargetId = 'camera-target-events';
    const unsubscribeCamera = subscribe(cameraTargetId, EVENT_TYPES.CAMERA_TARGET, (data) => {
      if (data.target) {
        // If position is also specified, we do a camera move
        if (data.position) {
          moveCamera(data.position, data.target, data.duration || 1.5);
        } else {
          // Just look at the target
          lookAtTarget(data.target);
        }
      }
    });
    
    // Subscribe to drone movement to update camera when drone moves
    const droneMovementId = 'camera-drone-events';
    const unsubscribeDrone = subscribe(droneMovementId, EVENT_TYPES.DRONE_MOVE, (data) => {
      if (data.targetPosition) {
        // Look at where the drone is heading
        endTargetRef.current.copy(data.targetPosition);
      }
    });
    
    // Subscribe to drone arrived event
    const droneArrivedId = 'camera-drone-arrived';
    const unsubscribeDroneArrived = subscribe(droneArrivedId, EVENT_TYPES.DRONE_ARRIVED, (data) => {
      // If drone arrived at a hotspot (triggered by hotspot selection), focus on it
      if (data.hotspotId) {
        emit(EVENT_TYPES.CAMERA_TARGET, {
          target: data.position,
          duration: 1.0
        });
      }
    });
    
    // Clean up on unmount
    return () => {
      unsubscribeCamera();
      unsubscribeDrone();
      unsubscribeDroneArrived();
    };
  }, []);
  
  // Look at a specific target
  const lookAtTarget = (target, duration = 0) => {
    const targetVector = target instanceof THREE.Vector3 ? target : new THREE.Vector3(...target);
    
    if (duration <= 0) {
      // Immediate look-at
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetVector);
        targetRef.current.copy(targetVector);
      }
      invalidate();
    } else {
      // Animated look-at
      startTargetRef.current.copy(controlsRef.current.target);
      endTargetRef.current.copy(targetVector);
      
      // Preserve current position
      startPositionRef.current.copy(camera.position);
      endPositionRef.current.copy(camera.position);
      
      // Set up animation
      animationDurationRef.current = duration;
      animationProgressRef.current = 0;
      isAnimatingRef.current = true;
      
      invalidate();
    }
  };
  
  // Move camera to a position while looking at a target
  const moveCamera = (position, target, duration = 1.5) => {
    const positionVector = position instanceof THREE.Vector3 ? position : new THREE.Vector3(...position);
    const targetVector = target instanceof THREE.Vector3 ? target : new THREE.Vector3(...target);
    
    if (duration <= 0) {
      // Immediate move
      camera.position.copy(positionVector);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetVector);
        targetRef.current.copy(targetVector);
      }
      invalidate();
    } else {
      // Set up animation
      startPositionRef.current.copy(camera.position);
      endPositionRef.current.copy(positionVector);
      
      startTargetRef.current.copy(controlsRef.current.target);
      endTargetRef.current.copy(targetVector);
      
      animationDurationRef.current = duration;
      animationProgressRef.current = 0;
      isAnimatingRef.current = true;
      
      // Emit event that camera is moving
      emit(EVENT_TYPES.CAMERA_MOVE, {
        startPosition: startPositionRef.current.clone(),
        endPosition: endPositionRef.current.clone(),
        startTarget: startTargetRef.current.clone(),
        endTarget: endTargetRef.current.clone(),
        duration
      });
      
      invalidate();
    }
  };
  
  // Register camera animation system
  useSystem('camera-animation', ({ deltaTime }) => {
    if (!isAnimatingRef.current || !controlsRef.current) return;
    
    // Update progress
    animationProgressRef.current += deltaTime / animationDurationRef.current;
    
    // Check if animation is complete
    if (animationProgressRef.current >= 1.0) {
      // Finish animation exactly at end position/target
      camera.position.copy(endPositionRef.current);
      controlsRef.current.target.copy(endTargetRef.current);
      
      // Reset animation state
      isAnimatingRef.current = false;
      animationProgressRef.current = 0;
      
      // Emit event that camera completed moving
      emit(EVENT_TYPES.CAMERA_MOVE, {
        complete: true,
        position: endPositionRef.current.clone(),
        target: endTargetRef.current.clone()
      });
      
      invalidate();
      return;
    }
    
    // Apply easing to make animation smooth
    const t = easeInOutCubic(animationProgressRef.current);
    
    // Interpolate position and target
    camera.position.lerpVectors(startPositionRef.current, endPositionRef.current, t);
    controlsRef.current.target.lerpVectors(startTargetRef.current, endTargetRef.current, t);
    
    // Ensure orbit controls update
    controlsRef.current.update();
    
    // Request another render
    invalidate();
  }, PRIORITY.HIGH, true);
  
  // Handle camera position updates to track performance
  useSystem('camera-tracking', ({ deltaTime }) => {
    // Skip if not in debug mode
    if (!debugMode) return;
    
    // This is just for debugging/monitoring - dispatch camera position updates
    // for the UI to display in debug mode
    emit('camera:position', {
      position: camera.position.clone(),
      target: controlsRef.current?.target.clone() || new THREE.Vector3(...lookAt)
    });
  }, PRIORITY.LOW, true);
  
  // Cubic easing function for smooth camera movement
  const easeInOutCubic = (t) => {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  
  return (
    <OrbitControls
      ref={controlsRef}
      args={[camera]}
      enableDamping={true}
      dampingFactor={dampingFactor}
      screenSpacePanning={false}
      minDistance={minDistance}
      maxDistance={maxDistance}
      enablePan={debugMode && enablePan}
      target={targetRef.current}
      // For on-demand rendering, trigger renders on camera change
      onChange={() => {
        invalidate();
        emit(EVENT_TYPES.CAMERA_MOVE, {
          position: camera.position.clone(),
          target: controlsRef.current?.target.clone()
        });
      }}
    />
  );
};

export default CameraController;