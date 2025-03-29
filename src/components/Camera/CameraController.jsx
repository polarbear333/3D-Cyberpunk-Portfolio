import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';
import { EVENT_TYPES, PRIORITY } from '../../systems/EventSystem';

// Direct import of the store to avoid subscription re-renders
import useEventSystem from '../../systems/EventSystem';

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
  const lastCameraTrackTimeRef = useRef(0);
  
  // Track event handlers to prevent duplicates
  const handlersRegisteredRef = useRef(false);
  
  // Look at a specific target immediately or animate if duration > 0
  const lookAtTarget = (target, duration = 0) => {
    const targetVector = target instanceof THREE.Vector3 ? target : new THREE.Vector3(...target);
    
    if (duration <= 0) {
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetVector);
        targetRef.current.copy(targetVector);
      }
      invalidate();
      return;
    }
    
    startTargetRef.current.copy(controlsRef.current.target);
    endTargetRef.current.copy(targetVector);
    startPositionRef.current.copy(camera.position);
    endPositionRef.current.copy(camera.position);
    animationDurationRef.current = duration;
    animationProgressRef.current = 0;
    isAnimatingRef.current = true;
    invalidate();
  };
  
  // Move camera to a new position and look at a target, with optional animation
  const moveCamera = (position, target, duration = 1.5) => {
    const positionVector = position instanceof THREE.Vector3 ? position : new THREE.Vector3(...position);
    const targetVector = target instanceof THREE.Vector3 ? target : new THREE.Vector3(...target);
    
    if (duration <= 0) {
      camera.position.copy(positionVector);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetVector);
        targetRef.current.copy(targetVector);
      }
      invalidate();
      return;
    }
    
    startPositionRef.current.copy(camera.position);
    endPositionRef.current.copy(positionVector);
    startTargetRef.current.copy(controlsRef.current.target);
    endTargetRef.current.copy(targetVector);
    animationDurationRef.current = duration;
    animationProgressRef.current = 0;
    isAnimatingRef.current = true;
    invalidate();
  };
  
  // Cubic easing function for smooth animation
  const easeInOutCubic = (t) => {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  
  // Set up event listeners and animation frame once on mount
  useEffect(() => {
    if (handlersRegisteredRef.current) return;
    
    // Register systems directly without hooks to avoid re-renders
    const eventSystem = useEventSystem.getState();
    let unregisterFns = [];
    
    // Register camera animation system
    const unregisterAnimation = () => {
      const systems = [...eventSystem.updateQueue];
      const index = systems.findIndex(sys => sys.id === 'camera-animation-direct');
      if (index >= 0) {
        systems.splice(index, 1);
        eventSystem.updateQueue = systems;
      }
    };
    
    // Camera animation system without hook dependency
    const cameraAnimationSystem = {
      id: 'camera-animation-direct',
      updateFn: (context) => {
        const { deltaTime } = context;
        
        // Skip if not animating
        if (!isAnimatingRef.current || !controlsRef.current) return;
        
        animationProgressRef.current += deltaTime / animationDurationRef.current;
        
        if (animationProgressRef.current >= 1.0) {
          camera.position.copy(endPositionRef.current);
          controlsRef.current.target.copy(endTargetRef.current);
          isAnimatingRef.current = false;
          animationProgressRef.current = 0;
          invalidate();
          return;
        }
        
        const t = easeInOutCubic(animationProgressRef.current);
        camera.position.lerpVectors(startPositionRef.current, endPositionRef.current, t);
        controlsRef.current.target.lerpVectors(startTargetRef.current, endTargetRef.current, t);
        controlsRef.current.update();
        invalidate();
      },
      priority: PRIORITY.HIGH,
      active: true
    };
    
    // Camera debug tracking system without hook dependency
    const cameraTrackingSystem = {
      id: 'camera-tracking-direct',
      updateFn: (context) => {
        if (!debugMode) return;
        
        const now = performance.now();
        if (now - lastCameraTrackTimeRef.current < 500) return;
        lastCameraTrackTimeRef.current = now;
      },
      priority: PRIORITY.LOW,
      active: true
    };
    
    // Add systems manually
    const systemsCopy = [...eventSystem.updateQueue];
    systemsCopy.push(cameraAnimationSystem);
    systemsCopy.push(cameraTrackingSystem);
    systemsCopy.sort((a, b) => a.priority - b.priority);
    eventSystem.updateQueue = systemsCopy;
    
    unregisterFns.push(unregisterAnimation);
    
    // Set up camera target event listener manually
    const handleCameraTarget = (data) => {
      if (data.target) {
        if (data.position) {
          moveCamera(data.position, data.target, data.duration || 1.5);
        } else {
          lookAtTarget(data.target, data.duration || 0);
        }
      }
    };
    
    const handleDroneMove = (data) => {
      if (data.targetPosition) {
        endTargetRef.current.copy(data.targetPosition);
      }
    };
    
    // Update the listeners manually
    const listenersMap = new Map(eventSystem.listeners);
    const cameraTargetListenerId = 'camera-target-direct';
    const droneMoveListenerId = 'drone-move-direct';
    
    listenersMap.set(cameraTargetListenerId, {
      id: cameraTargetListenerId,
      eventType: EVENT_TYPES.CAMERA_TARGET,
      callback: handleCameraTarget,
      priority: PRIORITY.MEDIUM,
      active: true
    });
    
    listenersMap.set(droneMoveListenerId, {
      id: droneMoveListenerId,
      eventType: EVENT_TYPES.DRONE_MOVE,
      callback: handleDroneMove,
      priority: PRIORITY.MEDIUM,
      active: true
    });
    
    eventSystem.listeners = listenersMap;
    
    handlersRegisteredRef.current = true;
    
    return () => {
      // Cleanup listeners manually
      const currentListeners = new Map(useEventSystem.getState().listeners);
      currentListeners.delete(cameraTargetListenerId);
      currentListeners.delete(droneMoveListenerId);
      useEventSystem.setState({ listeners: currentListeners });
      
      // Cleanup systems
      unregisterFns.forEach(fn => fn());
    };
  }, [camera, debugMode, invalidate]);
  
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
      onChange={() => {
        invalidate();
      }}
    />
  );
};

export default CameraController;