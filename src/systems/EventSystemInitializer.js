import React, { useEffect, useRef, useCallback } from 'react';
import { useEventSystem, EVENT_TYPES } from './EventSystem';

/**
 * Component that initializes the event system and registers core events
 * This should be mounted before any other components that use the event system
 */
const EventSystemInitializer = () => {
  // References to track initialization and performance
  const isInitializedRef = useRef(false);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsUpdateIntervalRef = useRef(1000); // Update FPS every second
  const lastFpsUpdateRef = useRef(performance.now());
  const rafIdRef = useRef(null);
  
  // Access event system APIs
  const initialize = useEventSystem(state => state.initialize);
  const active = useEventSystem(state => state.active);
  
  // CRITICAL FIX: Get a direct reference to emit instead of getting it from the hook each render
  const eventSystemRef = useRef();
  
  // Set up event system reference once
  useEffect(() => {
    eventSystemRef.current = useEventSystem.getState();
    
    if (!isInitializedRef.current) {
      console.log('Initializing event system');
      initialize();
      isInitializedRef.current = true;
    }
  }, [initialize]);
  
  // Set up performance monitoring in a separate effect
  useEffect(() => {
    // Start performance monitoring
    const monitorPerformance = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      frameCountRef.current++;
      
      // Update FPS counter once per second
      if (now - lastFpsUpdateRef.current > fpsUpdateIntervalRef.current) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
        
        // CRITICAL FIX: Use the saved reference instead of getting it from hook
        if (active && eventSystemRef.current) {
          eventSystemRef.current.emit('performance:metrics', {
            fps,
            delta,
            time: now
          });
        }
      }
      
      // Continue monitoring
      rafIdRef.current = requestAnimationFrame(monitorPerformance);
    };
    
    // Start monitoring
    rafIdRef.current = requestAnimationFrame(monitorPerformance);
    
    // Cleanup on unmount
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [active]);
  
  // Handle key events
  const handleKeyDown = useCallback((event) => {
    // CRITICAL FIX: Use the saved reference instead of directly accessing through hook
    if (active && eventSystemRef.current) {
      eventSystemRef.current.emit(EVENT_TYPES.KEY_PRESS, {
        key: event.key,
        code: event.code,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        timestamp: performance.now()
      });
    }
  }, [active]);
  
  // CRITICAL FIX: Separate key event handlers to break dependency chain
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  // This component doesn't render anything
  return null;
};

export default EventSystemInitializer;