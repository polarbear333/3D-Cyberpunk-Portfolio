import React from 'react';
import { useEventSystem, EVENT_TYPES } from '../systems/EventSystem';

const OptimizedRendererEvent = ({
  bloomStrength = 0.7,
  bloomRadius = 1.0,
  bloomThreshold = 0,
  adaptiveResolution = true,
}) => {
  const emit = useEventSystem((state) => state.emit);

  React.useEffect(() => {
    if (emit) {
      emit('renderer:configure', {
        bloomStrength,
        bloomRadius,
        bloomThreshold,
        adaptiveResolution,
      });
      emit(EVENT_TYPES.RENDER_NEEDED);
      // Expose a global reference for backward compatibility
      window.optimizedRenderer = {
        invalidate: () => emit(EVENT_TYPES.RENDER_NEEDED),
        configure: (options) => emit('renderer:configure', options),
      };
    }
    return () => {
      if (window.optimizedRenderer) {
        delete window.optimizedRenderer;
      }
    };
  }, []);

  React.useEffect(() => {
    if (emit) {
      emit('renderer:configure', {
        bloomStrength,
        bloomRadius,
        bloomThreshold,
        adaptiveResolution,
      });
      emit(EVENT_TYPES.RENDER_NEEDED);
    }
  }, [bloomStrength, bloomRadius, bloomThreshold, adaptiveResolution, emit]);

  return null;
};

export default OptimizedRendererEvent;
