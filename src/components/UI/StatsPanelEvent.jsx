import React, { useEffect, useRef } from 'react';
import Stats from 'stats.js';
import { useEventSystem, EVENT_TYPES, useEventListener } from '../../systems/EventSystem';

/**
 * Event-driven StatsPanel using the centralized event system
 * instead of direct DOM manipulation and requestAnimationFrame
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
  
  // Get the emit function from event system
  const emit = useEventSystem(state => state.emit);
  
  useEffect(() => {
    // Prevent duplicate stats panels
    if (document.querySelector('.stats-panel')) {
      console.warn('StatsPanelEvent: Multiple instances detected. Only one should be used.');
    }
    
    if (!enabled) return;
    
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
          console.warn(`StatsPanelEvent: Invalid mode ${mode}. Valid modes are 0, 1, 2.`);
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
    
    // Function to gather renderer stats and emit events
    const gatherStats = () => {
      try {
        // Get renderer info if available
        let drawCalls = 0;
        let triangles = 0;
        let textures = 0;
        let geometries = 0;
        
        if (window.renderer && window.renderer.info) {
          const rendererInfo = window.renderer.info;
          drawCalls = rendererInfo.render?.calls || 0;
          triangles = rendererInfo.render?.triangles || 0;
          textures = rendererInfo.memory?.textures || 0;
          geometries = rendererInfo.memory?.geometries || 0;
          
          // Emit renderer stats event
          emit('renderer:stats', {
            drawCalls,
            triangles,
            textures,
            geometries,
            timestamp: performance.now()
          });
        }
      } catch (error) {
        console.warn('Error gathering renderer stats:', error);
      }
    };
    
    // Register to gather stats on each frame end
    const statsPanelId = 'stats-panel-updates';
    const unsubscribe = useEventSystem.getState().subscribe(
      statsPanelId,
      EVENT_TYPES.FRAME_END,
      () => {
        if (statsRef.current) {
          statsRef.current.update();
          gatherStats();
        }
      }
    );
    
    // Clean up on unmount
    return () => {
      unsubscribe();
      
      // Remove stats DOM element
      if (statsRef.current && domAddedRef.current) {
        try {
          if (statsRef.current.dom && document.body.contains(statsRef.current.dom)) {
            document.body.removeChild(statsRef.current.dom);
          }
        } catch (e) {
          console.warn('StatsPanelEvent: Error removing stats element', e);
        }
        
        domAddedRef.current = false;
      }
    };
  }, [modes, position, style, zIndex, offsetX, offsetY, enabled]);
  
  // Register event listeners for optional SpatialManager update logs
  useEventListener('spatial:metrics', (data) => {
    if (data && statsRef.current) {
      // Add stat to DOM, if you wanted to display additional custom metrics
      // This could be extended to show SpatialManager stats directly in the panel
    }
  }, { enabled });
  
  // No visible React output
  return null;
};

export default StatsPanelEvent;