import React, { useEffect } from 'react';
import { useEventSystem, EVENT_TYPES } from './EventSystem';

/**
 * Component that initializes the event system and registers core events
 * This should be mounted before any other components that use the event system
 */
const EventSystemInitializer = () => {
  const { initialize, active } = useEventSystem(state => ({
    initialize: state.initialize,
    active: state.active
  }));
  
  // Initialize the event system on mount
  useEffect(() => {
    if (!active) {
      console.log('Initializing event system');
      initialize();
    }
    
    // Register performance monitor
    let rafId;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsUpdateInterval = 1000; // Update FPS every second
    let lastFpsUpdate = lastTime;
    let fps = 60;
    
    const monitorPerformance = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      frameCount++;
      
      // Update FPS counter once per second
      if (now - lastFpsUpdate > fpsUpdateInterval) {
        fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;
        
        // Dispatch performance metrics
        useEventSystem.getState().emit('performance:metrics', {
          fps,
          delta,
          time: now
        });
      }
      
      rafId = requestAnimationFrame(monitorPerformance);
    };
    
    // Start performance monitoring
    monitorPerformance();
    
    // Clean up on unmount
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [initialize, active]);
  
  // This component doesn't render anything
  return null;
};

export default EventSystemInitializer;