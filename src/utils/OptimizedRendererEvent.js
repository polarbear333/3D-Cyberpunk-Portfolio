import React from 'react';
import { useEventSystem, EVENT_TYPES } from '../systems/EventSystem';

/**
 * Optimized Renderer that integrates with the event system
 * This is a simplified version that delegates actual rendering to RenderingSystem
 * It's provided for backward compatibility with existing code
 */
const OptimizedRendererEvent = ({ 
  bloomStrength = 0.7, 
  bloomRadius = 1.0, 
  bloomThreshold = 0,
  adaptiveResolution = true 
}) => {
  // Get event system emit function
  const emit = useEventSystem(state => state.emit);
  
  // On mount, emit an event to configure the renderer
  React.useEffect(() => {
    // Emit configuration event for RenderingSystem
    emit('renderer:configure', {
      bloomStrength,
      bloomRadius,
      bloomThreshold,
      adaptiveResolution
    });
    
    // Request an initial render
    emit(EVENT_TYPES.RENDER_NEEDED);
    
    // For backward compatibility, expose a global reference
    window.optimizedRenderer = {
      invalidate: () => emit(EVENT_TYPES.RENDER_NEEDED),
      configure: (options) => emit('renderer:configure', options)
    };
    
    return () => {
      // Clean up global reference
      if (window.optimizedRenderer) {
        delete window.optimizedRenderer;
      }
    };
  }, []);
  
  // Update settings when props change
  React.useEffect(() => {
    emit('renderer:configure', {
      bloomStrength,
      bloomRadius,
      bloomThreshold,
      adaptiveResolution
    });
    
    // Request a render with new settings
    emit(EVENT_TYPES.RENDER_NEEDED);
  }, [bloomStrength, bloomRadius, bloomThreshold, adaptiveResolution]);
  
  // This component doesn't render anything
  return null;
};

export default OptimizedRendererEvent;