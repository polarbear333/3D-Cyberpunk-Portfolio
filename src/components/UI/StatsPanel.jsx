import React, { useEffect, useRef } from 'react';
import Stats from 'stats.js';

/**
 * Performance-optimized StatsPanel using event-driven updates
 * and efficient DOM management
 */
const StatsPanel = ({
  modes = [0], // Default to FPS panel (0)
  position = 'top-left',
  style = {},
  zIndex = 1000,
  offsetX = 0,
  offsetY = 0,
  enableMemory = true,
  updateInterval = 100 // ms between stats updates (lower = more accurate but higher CPU)
}) => {
  const statsRef = useRef(null);
  const intervalRef = useRef(null);
  const domAddedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate stats panels
    if (document.querySelector('.stats-panel')) {
      console.warn('StatsPanel: Multiple instances detected. Only one should be used.');
    }
    
    // Create stats instance if needed
    if (!statsRef.current) {
      const stats = new Stats();
      
      // Add custom class for easier identification
      stats.dom.classList.add('stats-panel');
      
      // Configure panels
      modes.forEach((mode) => {
        if (mode >= 0 && mode <= 2) { // Only valid modes: 0 = FPS, 1 = MS, 2 = MB
          stats.showPanel(mode);
        } else {
          console.warn(`StatsPanel: Invalid mode ${mode}. Valid modes are 0, 1, 2.`);
        }
      });
      
      // Apply custom styling
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
      
      // Add to body only once
      if (!domAddedRef.current) {
        document.body.appendChild(stats.dom);
        domAddedRef.current = true;
      }
    }
    
    // Use the SpatialManager's update cycle if available
    if (window.spatialManager?.initialized) {
      console.log('Using SpatialManager for stats updates');
      
      // Add update callback to SpatialManager if it supports it
      if (typeof window.spatialManager.addUpdateCallback === 'function') {
        window.spatialManager.addUpdateCallback(() => {
          if (statsRef.current) {
            statsRef.current.update();
          }
        });
      } else {
        // Fallback to interval-based updates
        setupIntervalUpdates();
      }
    } else if (window.composer || window.renderer) {
      console.log('Using renderer events for stats updates');
      
      // Try to hook into render events if composer or renderer is available
      const target = window.composer || window.renderer;
      
      if (target) {
        const originalRender = target.render;
        
        // Patch render method to include stats update
        target.render = function(...args) {
          const result = originalRender.apply(this, args);
          if (statsRef.current) {
            statsRef.current.update();
          }
          return result;
        };
      } else {
        // Fallback to interval-based updates
        setupIntervalUpdates();
      }
    } else {
      // Fallback to interval-based updates if no other system is available
      setupIntervalUpdates();
    }
    
    // Interval-based update function
    function setupIntervalUpdates() {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Create new update interval
      intervalRef.current = setInterval(() => {
        if (statsRef.current) {
          statsRef.current.update();
        }
      }, updateInterval);
    }

    // Clean up on unmount
    return () => {
      // Clear interval if it exists
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Remove stats DOM element
      if (statsRef.current && domAddedRef.current) {
        try {
          if (statsRef.current.dom && document.body.contains(statsRef.current.dom)) {
            document.body.removeChild(statsRef.current.dom);
          }
        } catch (e) {
          console.warn('StatsPanel: Error removing stats element', e);
        }
        
        domAddedRef.current = false;
      }
      
      // Restore original render method if patched
      if (window.composer && window.composer._patchedByStatsPanel) {
        window.composer.render = window.composer._originalRender;
        delete window.composer._patchedByStatsPanel;
        delete window.composer._originalRender;
      }
    };
  }, [modes, position, style, zIndex, offsetX, offsetY, enableMemory, updateInterval]);

  // No visible React output 
  return null;
};

export default StatsPanel;