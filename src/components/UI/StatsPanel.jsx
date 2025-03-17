import React, { useEffect, useRef } from 'react';
import Stats from 'stats.js';

const StatsPanel = ({
  modes = [1], // Array of panel indices (e.g., [0, 1] for FPS and MS)
  position = 'top-left',
  style = {},
  zIndex = 1000,
  offsetX = 0,
  offsetY = 0,
  enableMemory = true,
}) => {
  const statsRef = useRef(null);

  useEffect(() => {
    const stats = new Stats();

    // Show specified panels
    modes.forEach((mode) => stats.showPanel(mode));

    document.body.appendChild(stats.dom);

    // Apply custom styling
    Object.assign(stats.dom.style, {
      position: 'fixed',
      zIndex: zIndex,
      ...style,
    });

    // Set position based on props
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

    statsRef.current = stats;

    let animationFrameId;
    const animate = () => {
      statsRef.current.update();
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (stats.dom && document.body.contains(stats.dom)) {
        document.body.removeChild(stats.dom);
      }
    };
  }, [modes, position, style, zIndex, offsetX, offsetY, enableMemory]);

  return null;
};

export default StatsPanel;