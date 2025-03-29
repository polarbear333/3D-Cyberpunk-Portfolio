import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';
import { Vector3, Color } from 'three';
import { Text, Billboard, Html } from '@react-three/drei';
import { gsap } from 'gsap';
import { useEventSystem, EVENT_TYPES, PRIORITY, useSystem } from '../../systems/EventSystem';

const HotspotEvent = ({ id, position, title, color, projectData, audio }) => {
  const { activeHotspotId, setActiveHotspot, showOverlay } = useStore();
  const isActive = activeHotspotId === id;
  const [hovered, setHovered] = useState(false);
  
  // Cache hovered and isActive in refs to keep the update callback stable
  const hoveredRef = useRef(hovered);
  const isActiveRef = useRef(isActive);
  useEffect(() => { hoveredRef.current = hovered; }, [hovered]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const { emit } = useEventSystem();
  const { invalidate } = useThree();

  // Refs for animations and objects
  const hotspotRef = useRef();
  const glowRef = useRef();
  const markerRef = useRef();
  const arrowRef = useRef();

  useEffect(() => {
    if (!hotspotRef.current) return;

    // Register hotspot and marker objects with the spatial manager
    emit(EVENT_TYPES.OBJECT_ADDED, {
      object: hotspotRef.current,
      options: {
        important: true,
        lod: false,
        cullDistance: Infinity,
      },
    });
    if (markerRef.current) {
      emit(EVENT_TYPES.OBJECT_ADDED, {
        object: markerRef.current,
        options: {
          important: true,
          lod: false,
          cullDistance: Infinity,
        },
      });
    }

    const hotspotPosition = position ? [...position] : [0, 0, 0];

    // Floating animation for hotspot group
    if (hotspotRef.current && hotspotRef.current.position) {
      gsap.to(hotspotRef.current.position, {
        y: hotspotPosition[1] + 1,
        duration: 2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    }
    // Pulsing animation for the glow (intensity based on active state)
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        intensity: isActive ? 3 : 1.5,
        duration: 1.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    }
    // Rotating animation for the arrow indicator
    if (arrowRef.current && arrowRef.current.rotation) {
      gsap.to(arrowRef.current.rotation, {
        y: Math.PI * 2,
        duration: 8,
        ease: 'none',
        repeat: -1,
      });
    }

    return () => {
      if (hotspotRef.current) {
        emit(EVENT_TYPES.OBJECT_REMOVED, { object: hotspotRef.current });
      }
      if (markerRef.current) {
        emit(EVENT_TYPES.OBJECT_REMOVED, { object: markerRef.current });
      }
      if (hotspotRef.current && hotspotRef.current.position) {
        gsap.killTweensOf(hotspotRef.current.position);
      }
      if (glowRef.current) {
        gsap.killTweensOf(glowRef.current);
      }
      if (arrowRef.current && arrowRef.current.rotation) {
        gsap.killTweensOf(arrowRef.current.rotation);
      }
    };
  }, [position, isActive, emit]);

  const handlePointerOver = () => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
    emit(EVENT_TYPES.HOTSPOT_HOVER, {
      id,
      position: position ? new Vector3(...position) : new Vector3(),
      action: 'enter',
    });
    if (audio?.isInitialized) {
      audio.playSound('hover', { volume: 0.2 });
    }
    invalidate();
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
    emit(EVENT_TYPES.HOTSPOT_HOVER, {
      id,
      position: position ? new Vector3(...position) : new Vector3(),
      action: 'exit',
    });
    invalidate();
  };

  const handleClick = (e) => {
    e.stopPropagation();
    setActiveHotspot(id);
    emit(EVENT_TYPES.HOTSPOT_SELECT, {
      id,
      position: position ? new Vector3(...position) : new Vector3(),
      projectData,
    });
    if (audio?.isInitialized) {
      audio.playSound('click', { volume: 0.5 });
    }
    showOverlay(projectData);
    invalidate();
  };

  // Use a stable update callback for the hotspot marker animation.
  // This callback reads the current hovered and active state from refs.
  const hotspotMarkerUpdate = useCallback(
    ({ deltaTime }) => {
      if (!markerRef.current) return;
      // Use refs so that the callback itself doesn’t depend on changing state
      const targetScale = (hoveredRef.current || isActiveRef.current) ? 1.5 : 1;
      const currentScale = markerRef.current.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * Math.min(1, deltaTime * 10);
      if (Math.abs(newScale - currentScale) > 0.01) {
        markerRef.current.scale.set(newScale, newScale, newScale);
        invalidate();
      }
    },
    [invalidate] // No other dependencies because we use refs for hovered/isActive
  );
  
  useSystem(`hotspot-marker-${id}`, hotspotMarkerUpdate, PRIORITY.LOW, true);

  const hotspotColor = new Color(color || '#00FFFF');
  if (!position) return null;

  return (
    <group name={`hotspot-${id}`}>
      <group
        ref={hotspotRef}
        position={position}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <mesh ref={markerRef}>
          <cylinderGeometry args={[0.5, 0.5, 5, 16]} />
          <meshStandardMaterial
            color={hotspotColor}
            emissive={hotspotColor}
            emissiveIntensity={hovered || isActive ? 2 : 1}
            transparent
            opacity={0.7}
          />
        </mesh>
        <mesh position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[4, 15, 16, 1, true]} />
          <meshBasicMaterial color={hotspotColor} transparent opacity={0.15} side={2} />
        </mesh>
        <pointLight ref={glowRef} color={hotspotColor} intensity={hovered || isActive ? 2 : 1} distance={hovered || isActive ? 20 : 10} />
        <group ref={arrowRef} position={[0, 4, 0]}>
          <mesh position={[0, 1, 0]}>
            <coneGeometry args={[0.5, 1, 16]} />
            <meshStandardMaterial
              color={hotspotColor}
              emissive={hotspotColor}
              emissiveIntensity={hovered || isActive ? 1 : 0.5}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
        <Billboard follow position={[0, 7, 0]}>
          <Text
            fontSize={1.2}
            maxWidth={10}
            color={hovered || isActive ? "#ffffff" : hotspotColor.getStyle()}
            outlineColor="#000000"
            outlineWidth={0.05}
            anchorX="center"
            anchorY="middle"
          >
            {title}
          </Text>
        </Billboard>
        {hovered && (
          <Billboard follow position={[0, 9, 0]}>
            <Html transform distanceFactor={10} sprite occlude>
              <div className="px-3 py-2 bg-black bg-opacity-70 rounded-md border border-cyan-500 text-white text-xs whitespace-nowrap">
                Click to explore project
              </div>
            </Html>
          </Billboard>
        )}
      </group>
    </group>
  );
};

export default HotspotEvent;
