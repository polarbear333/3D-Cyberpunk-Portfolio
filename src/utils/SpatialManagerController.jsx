import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Component that integrates with SpatialManager to optimize scene performance
 * This hooks into the Three.js render loop and efficiently manages spatial operations
 */
const SpatialManagerController = ({ enabled = true }) => {
  const { scene, camera } = useThree();
  const spatialManagerRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const cameraPositionRef = useRef(new THREE.Vector3());
  const frameCountRef = useRef(0);
  const updateCallbacksRef = useRef([]);
  
  // Setup spatial manager
  useEffect(() => {
    if (!enabled) return;
    
    // Check if SpatialManager is available globally
    if (window.SpatialManager) {
      console.log('Initializing SpatialManager');
      
      try {
        // Create instance if it doesn't exist
        if (!window.spatialManager) {
          spatialManagerRef.current = new window.SpatialManager(scene, camera);
          window.spatialManager = spatialManagerRef.current;
        } else {
          spatialManagerRef.current = window.spatialManager;
        }
        
        // Initialize spatial manager
        if (!spatialManagerRef.current.initialized) {
          spatialManagerRef.current.initialize();
        }
        
        // Add callback registration functionality if not already present
        if (!spatialManagerRef.current.addUpdateCallback) {
          spatialManagerRef.current.addUpdateCallback = (callback) => {
            if (typeof callback === 'function' && !updateCallbacksRef.current.includes(callback)) {
              updateCallbacksRef.current.push(callback);
              return true;
            }
            return false;
          };
          
          spatialManagerRef.current.removeUpdateCallback = (callback) => {
            const index = updateCallbacksRef.current.indexOf(callback);
            if (index !== -1) {
              updateCallbacksRef.current.splice(index, 1);
              return true;
            }
            return false;
          };
        }
        
        console.log(`SpatialManager initialized. Objects tracked: ${scene.children.length}`);
      } catch (error) {
        console.error('Error initializing SpatialManager:', error);
      }
    } else {
      console.warn('SpatialManager not found. Performance optimizations disabled.');
    }
    
    return () => {
      // Clean up on unmount, but don't dispose the global instance
      // Just unregister callbacks that we added
      updateCallbacksRef.current = [];
    };
  }, [enabled, scene, camera]);
  
  // Efficiently update the spatial manager during the render loop
  useFrame(() => {
    if (!enabled || !spatialManagerRef.current) return;
    
    // Only process every few frames for better performance
    if (frameCountRef.current++ % 2 !== 0) return;
    
    try {
      // Get current camera position
      camera.getWorldPosition(cameraPositionRef.current);
      
      // Update spatial data only if camera moved enough or enough time has passed
      const now = performance.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;
      const shouldForceUpdate = timeSinceLastUpdate > 500; // Force update every 500ms
      
      if (shouldForceUpdate || cameraPositionRef.current.distanceToSquared(camera.position) > 0.25) {
        // Update the spatial manager
        spatialManagerRef.current.update(cameraPositionRef.current);
        
        // Run registered callbacks
        updateCallbacksRef.current.forEach(callback => {
          try {
            callback();
          } catch (e) {
            console.warn('Error in SpatialManager callback:', e);
          }
        });
        
        // Update last position and time
        cameraPositionRef.current.copy(camera.position);
        lastUpdateRef.current = now;
      }
    } catch (error) {
      // Prevent errors from breaking the render loop
      console.warn('Error updating SpatialManager:', error);
    }
  });
  
  // Component doesn't render anything
  return null;
};

export default SpatialManagerController;