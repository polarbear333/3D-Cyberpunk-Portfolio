import React, { useEffect, useRef } from 'react';
import Stats from 'stats.js';
import { useEventSystem, EVENT_TYPES } from '../../systems/EventSystem';

/**
 * Event-driven StatsPanel using the centralized event system
 */
const StatsPanelEvent = ({
  modes = [0], // Default to FPS panel (0)
  position = 'top-left',
  style = {},
  zIndex = 1000,
  offsetX = 0,
  offsetY = 0,
  enabled = true
}) => {
  const statsRef = useRef(null);
  const domAddedRef = useRef(false);
  
  // CRITICAL FIX: Store these IDs and functions in refs to prevent recreating them
  const statsPanelIdRef = useRef('stats-panel-updates-' + Math.random().toString(36).slice(2, 9));
  const unsubscribeFnRef = useRef(null);
  
  // Setup the panel
  useEffect(() => {
    if (!enabled) return;
    
    // Create stats instance if needed
    if (!statsRef.current) {
      const stats = new Stats();
      stats.dom.classList.add('stats-panel');
      
      // Configure panels
      modes.forEach((mode) => {
        if (mode >= 0 && mode <= 2) { // Only valid modes: 0 = FPS, 1 = MS, 2 = MB
          stats.showPanel(mode);
        }
      });
      
      // Apply styling
      Object.assign(stats.dom.style, {
        position: 'fixed',
        zIndex: zIndex,
        ...style,
      });
      
      // Set position
      switch (position) {
        case 'top-left':
          stats.dom.style.top = `${offsetY}px`;
          stats.dom.style.left = `${offsetX}px`;
          break;
        case 'top-right':
          stats.dom.style.top = `${offsetY}px`;
          stats.dom.style.right = `${offsetX}px`;
          break;
        case 'bottom-left':
          stats.dom.style.bottom = `${offsetY}px`;
          stats.dom.style.left = `${offsetX}px`;
          break;
        case 'bottom-right':
          stats.dom.style.bottom = `${offsetY}px`;
          stats.dom.style.right = `${offsetX}px`;
          break;
        default:
          stats.dom.style.top = `${offsetY}px`;
          stats.dom.style.left = `${offsetX}px`;
      }
      
      // Store reference
      statsRef.current = stats;
      
      // Add to DOM
      if (!domAddedRef.current) {
        document.body.appendChild(stats.dom);
        domAddedRef.current = true;
      }
    }
    
    // Handler function to update stats
    const updateHandler = () => {
      if (statsRef.current) {
        statsRef.current.update();
      }
    };
    
    // CRITICAL FIX: Store the direct state reference
    const eventSystem = useEventSystem.getState();
    
    // CRITICAL FIX: Store the unsubscribe function directly
    unsubscribeFnRef.current = eventSystem.subscribe(
      statsPanelIdRef.current,
      EVENT_TYPES.FRAME_END,
      updateHandler
    );
    
    // Clean up
    return () => {
      // CRITICAL FIX: Use the stored reference directly
      if (unsubscribeFnRef.current) {
        unsubscribeFnRef.current();
      }
      
      if (statsRef.current && domAddedRef.current) {
        try {
          if (document.body.contains(statsRef.current.dom)) {
            document.body.removeChild(statsRef.current.dom);
          }
        } catch (e) {
          console.warn('Error removing stats element');
        }
        domAddedRef.current = false;
      }
    };
  }, [enabled, modes.toString(), position, offsetX, offsetY, zIndex, JSON.stringify(style)]);
  
  return null;
};

export default StatsPanelEvent;