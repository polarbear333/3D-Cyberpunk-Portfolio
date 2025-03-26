import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEventSystem, EVENT_TYPES, PRIORITY } from './EventSystem';

// Spatial management system - handles culling, LOD, and spatial queries
const SpatialSystem = ({ enabled = true }) => {
  const { scene, camera } = useThree();
  const isInitializedRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  const updateIntervalRef = useRef(200); // ms between spatial updates
  const objectsMapRef = useRef(new Map());
  const lastCameraPositionRef = useRef(new THREE.Vector3());
  const frameCountRef = useRef(0);
  
  // Frustum for culling
  const frustumRef = useRef(new THREE.Frustum());
  const frustumMatrixRef = useRef(new THREE.Matrix4());
  
  // Performance metrics
  const metricsRef = useRef({
    culledObjects: 0,
    visibleObjects: 0,
    lodChanges: 0,
    lastUpdateTime: 0,
  });
  
  // LOD settings
  const lodLevelsRef = useRef({
    FULL: { distance: 0, scale: 1.0 },
    HIGH: { distance: 50, scale: 0.8 },
    MEDIUM: { distance: 100, scale: 0.5 },
    LOW: { distance: 200, scale: 0.3 },
    VERY_LOW: { distance: 300, scale: 0.1 }
  });
  
  // Get event system
  const { 
    subscribe, 
    unsubscribe, 
    emit, 
    registerSystem,
    unregisterSystem 
  } = useEventSystem(state => ({
    subscribe: state.subscribe,
    unsubscribe: state.unsubscribe,
    emit: state.emit,
    registerSystem: state.registerSystem,
    unregisterSystem: state.unregisterSystem
  }));
  
  // Initialize the system
  useEffect(() => {
    if (!enabled) return;
    
    // Register with EventSystem
    const spatialSystemId = 'system:spatial';
    const unregister = registerSystem(
      spatialSystemId,
      updateSpatial,
      PRIORITY.HIGH // High priority but after rendering
    );
    
    // Event listeners
    const objectsListenerId = 'spatial-objects';
    const unsubscribeObjectAdded = subscribe(objectsListenerId, EVENT_TYPES.OBJECT_ADDED, (data) => {
      if (data.object) {
        registerObject(data.object, data.options);
      }
    });
    
    const unsubscribeObjectRemoved = subscribe(objectsListenerId, EVENT_TYPES.OBJECT_REMOVED, (data) => {
      if (data.object) {
        unregisterObject(data.object);
      }
    });
    
    // Initialize
    scanScene();
    isInitializedRef.current = true;
    
    // Expose API globally for compatibility with existing code
    exposeGlobalAPI();
    
    // Clean up on unmount
    return () => {
      unregister();
      unsubscribeObjectAdded();
      unsubscribeObjectRemoved();
      
      // Clean up global reference
      if (window.spatialManager === globalAPI) {
        delete window.spatialManager;
      }
    };
  }, [enabled, scene, camera]);
  
  // Scan the scene for objects to manage
  const scanScene = () => {
    console.log('Scanning scene for objects to manage');
    
    // Clear existing objects
    objectsMapRef.current.clear();
    
    // Traverse the scene
    scene.traverse((object) => {
      if (object.isMesh && !object.userData.excludeFromSpatialManager) {
        // Auto-register with default settings
        registerObject(object);
      }
    });
    
    console.log(`Found ${objectsMapRef.current.size} objects to manage`);
  };
  
  // Register an object for spatial management
  const registerObject = (object, options = {}) => {
    if (!object || !object.uuid) return false;
    
    try {
      const defaults = {
        important: false,     // Important objects are never fully culled
        dynamic: false,       // Dynamic objects move frequently
        lod: true,            // Whether to apply LOD to this object
        cullDistance: 500,    // Distance at which to cull this object
        active: true          // Currently active for processing
      };
      
      // Merge options with defaults
      const settings = { ...defaults, ...options };
      
      // Store original material for LOD
      if (object.material && !object.userData.originalMaterial) {
        object.userData.originalMaterial = object.material;
      }
      
      // Store object with settings
      objectsMapRef.current.set(object.uuid, {
        object,
        settings,
        visible: true,
        lodLevel: 'FULL',
        lastLodCheck: 0,
        distanceToCamera: 0
      });
      
      return true;
    } catch (error) {
      console.warn('Error registering object:', error);
      return false;
    }
  };
  
  // Unregister an object
  const unregisterObject = (object) => {
    if (!object || !object.uuid) return false;
    
    try {
      // Restore original material if exists
      if (object.userData.originalMaterial) {
        object.material = object.userData.originalMaterial;
      }
      
      // Remove from map
      const result = objectsMapRef.current.delete(object.uuid);
      return result;
    } catch (error) {
      console.warn('Error unregistering object:', error);
      return false;
    }
  };
  
  // Update spatial management (called by EventSystem)
  const updateSpatial = ({ time, deltaTime }) => {
    if (!isInitializedRef.current || !enabled) return;
    
    // Increment frame counter
    frameCountRef.current++;
    
    // Check if we need to update based on time interval
    const now = performance.now();
    if (now - lastUpdateTimeRef.current < updateIntervalRef.current) {
      return; // Skip update this frame
    }
    
    // Get camera position
    const cameraPosition = camera.position.clone();
    
    // Calculate distance moved since last update
    const cameraMovement = cameraPosition.distanceTo(lastCameraPositionRef.current);
    const significantMovement = cameraMovement > 1.0;
    
    // Skip update if camera hasn't moved much and we're not forcing update
    if (!significantMovement && frameCountRef.current % 10 !== 0) {
      return;
    }
    
    // Reset metrics
    metricsRef.current.culledObjects = 0;
    metricsRef.current.visibleObjects = 0;
    metricsRef.current.lodChanges = 0;
    metricsRef.current.lastUpdateTime = now;
    
    // Update frustum for culling
    updateFrustum();
    
    // Process all managed objects
    processSpatialObjects(cameraPosition);
    
    // Store camera position for next update
    lastCameraPositionRef.current.copy(cameraPosition);
    lastUpdateTimeRef.current = now;
    
    // Request a render if we made changes
    if (metricsRef.current.lodChanges > 0 || metricsRef.current.culledObjects > 0) {
      emit(EVENT_TYPES.RENDER_NEEDED);
    }
    
    // Emit metrics update
    emit('spatial:metrics', metricsRef.current);
  };
  
  // Update frustum for culling
  const updateFrustum = () => {
    frustumMatrixRef.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustumRef.current.setFromProjectionMatrix(frustumMatrixRef.current);
  };
  
  // Process all spatial objects
  const processSpatialObjects = (cameraPosition) => {
    // First, handle frustum culling (fast)
    objectsMapRef.current.forEach((data, uuid) => {
      const { object, settings } = data;
      
      // Skip inactive objects
      if (!settings.active) return;
      
      // Important objects are always visible
      if (settings.important) {
        if (!object.visible) object.visible = true;
        metricsRef.current.visibleObjects++;
        return;
      }
      
      // Simple distance check
      const objectPosition = getObjectPosition(object);
      const distance = objectPosition.distanceTo(cameraPosition);
      data.distanceToCamera = distance;
      
      // Cull distant objects
      if (distance > settings.cullDistance) {
        if (object.visible) {
          object.visible = false;
          metricsRef.current.culledObjects++;
        }
        return;
      }
      
      // Frustum culling when object has geometry
      if (object.geometry && object.geometry.boundingSphere) {
        const sphere = object.geometry.boundingSphere.clone();
        sphere.applyMatrix4(object.matrixWorld);
        
        if (!frustumRef.current.intersectsSphere(sphere)) {
          if (object.visible) {
            object.visible = false;
            metricsRef.current.culledObjects++;
          }
          return;
        }
      }
      
      // If we got here, object is potentially visible
      if (!object.visible) {
        object.visible = true;
      }
      
      // Apply LOD if enabled
      if (settings.lod) {
        applyLOD(object, distance);
      }
      
      metricsRef.current.visibleObjects++;
    });
  };
  
  // Helper to get object position
  const getObjectPosition = (object) => {
    const position = new THREE.Vector3();
    object.getWorldPosition(position);
    return position;
  };
  
  // Determine LOD level based on distance
  const getLODLevel = (distance) => {
    const levels = lodLevelsRef.current;
    if (distance < levels.HIGH.distance) return 'FULL';
    if (distance < levels.MEDIUM.distance) return 'HIGH';
    if (distance < levels.LOW.distance) return 'MEDIUM';
    if (distance < levels.VERY_LOW.distance) return 'LOW';
    return 'VERY_LOW';
  };
  
  // Apply LOD based on distance
  const applyLOD = (object, distance) => {
    const data = objectsMapRef.current.get(object.uuid);
    if (!data) return;
    
    // Determine appropriate LOD level
    const lodLevel = getLODLevel(distance);
    
    // Skip if LOD level hasn't changed
    if (data.lodLevel === lodLevel) return;
    
    // LOD level has changed
    data.lodLevel = lodLevel;
    metricsRef.current.lodChanges++;
    
    // Apply LOD changes here
    // This could involve changing materials, geometries, etc.
    // For compatibility with existing code, we'll check for 
    // userData.lodMaterials and use those if available
    
    if (object.userData.lodMaterials && object.userData.lodMaterials[lodLevel]) {
      object.material = object.userData.lodMaterials[lodLevel];
    } else if (lodLevel === 'FULL' && object.userData.originalMaterial) {
      object.material = object.userData.originalMaterial;
    }
  };
  
  // Create global API for compatibility with existing code
  const globalAPI = {
    initialized: true,
    registerObject: (object, options) => registerObject(object, options),
    unregisterObject: (object) => unregisterObject(object),
    getPerformanceMetrics: () => ({ ...metricsRef.current }),
    checkCollisions: (position, velocity, distance = 0.5) => {
      // Simplified collision detection
      return { hasCollision: false };
    },
    addUpdateCallback: (callback) => {
      // Not implemented in this version
      return () => {};
    }
  };
  
  // Expose API globally for compatibility with existing code
  const exposeGlobalAPI = () => {
    window.spatialManager = globalAPI;
  };
  
  // This component doesn't render anything
  return null;
};

export default SpatialSystem;