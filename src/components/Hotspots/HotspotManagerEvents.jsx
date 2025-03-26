import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';
import { Vector3, Color } from 'three';
import { Text, Billboard, Html } from '@react-three/drei';
import { gsap } from 'gsap';
import { useEventSystem, EVENT_TYPES, PRIORITY, useSystem } from '../../systems/EventSystem';

// Individual Hotspot component with event system integration
const HotspotEvent = ({ id, position, title, color, projectData, audio }) => {
  const { activeHotspotId, setActiveHotspot, showOverlay } = useStore();
  const isActive = activeHotspotId === id;
  
  // Refs for animations and update
  const hotspotRef = useRef();
  const glowRef = useRef();
  const markerRef = useRef();
  const arrowRef = useRef();
  
  // Local state
  const [hovered, setHovered] = useState(false);
  
  // Get event system and Three.js context
  const { emit } = useEventSystem();
  const { invalidate } = useThree();
  
  // Setup animations and register with spatial manager
  useEffect(() => {
    if (!hotspotRef.current) return;
    
    // Register with SpatialManager via event system
    emit(EVENT_TYPES.OBJECT_ADDED, {
      object: hotspotRef.current,
      options: {
        important: true, // Hotspots are important interactive elements
        lod: false,      // No LOD for interactive elements 
        cullDistance: Infinity // Never completely cull interactive hotspots
      }
    });
    
    // Also register the marker if it exists
    if (markerRef.current) {
      emit(EVENT_TYPES.OBJECT_ADDED, {
        object: markerRef.current,
        options: {
          important: true,
          lod: false,
          cullDistance: Infinity
        }
      });
    }
    
    // Floating animation
    gsap.to(hotspotRef.current.position, {
      y: position[1] + 1,
      duration: 2,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });
    
    // Pulsing animation for the glow
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        intensity: isActive ? 3 : 1.5,
        duration: 1.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    }
    
    // Rotating animation for the arrow
    if (arrowRef.current) {
      gsap.to(arrowRef.current.rotation, {
        y: Math.PI * 2,
        duration: 8,
        ease: 'none',
        repeat: -1
      });
    }
    
    // Clean up on unmount
    return () => {
      // Unregister from SpatialManager when unmounted
      emit(EVENT_TYPES.OBJECT_REMOVED, { object: hotspotRef.current });
      
      if (markerRef.current) {
        emit(EVENT_TYPES.OBJECT_REMOVED, { object: markerRef.current });
      }
      
      // Kill GSAP animations
      gsap.killTweensOf(hotspotRef.current.position);
      if (glowRef.current) gsap.killTweensOf(glowRef.current);
      if (arrowRef.current) gsap.killTweensOf(arrowRef.current.rotation);
    };
  }, [position, isActive]);
  
  // Handle hover state
  const handlePointerOver = () => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
    
    // Emit hover event
    emit(EVENT_TYPES.HOTSPOT_HOVER, {
      id,
      position: new Vector3(...position),
      action: 'enter'
    });
    
    // Play hover sound
    if (audio?.isInitialized) {
      audio.playSound('hover', { volume: 0.2 });
    }
    
    // Request render
    invalidate();
  };
  
  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
    
    // Emit hover end event
    emit(EVENT_TYPES.HOTSPOT_HOVER, {
      id,
      position: new Vector3(...position),
      action: 'exit'
    });
    
    // Request render
    invalidate();
  };
  
  // Handle click
  const handleClick = (e) => {
    e.stopPropagation();
    
    // Update store state
    setActiveHotspot(id);
    
    // Emit selection event
    emit(EVENT_TYPES.HOTSPOT_SELECT, {
      id,
      position: new Vector3(...position),
      projectData
    });
    
    // Play click sound
    if (audio?.isInitialized) {
      audio.playSound('click', { volume: 0.5 });
    }
    
    // Show overlay with project data
    showOverlay(projectData);
    
    // Request render
    invalidate();
  };
  
  // Register system to update hotspot marker animation based on state
  useSystem(
    `hotspot-marker-${id}`, 
    ({ deltaTime }) => {
      if (!markerRef.current) return;
      
      // Calculate target scale based on state
      const targetScale = hovered || isActive ? 1.5 : 1;
      
      // Smoothly interpolate scale
      const currentScale = markerRef.current.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * Math.min(1, deltaTime * 10);
      
      // Only update if change is significant
      if (Math.abs(newScale - currentScale) > 0.01) {
        markerRef.current.scale.set(newScale, newScale, newScale);
        invalidate();
      }
    },
    PRIORITY.LOW,
    true
  );
  
  // Create a stylized cyberpunk color
  const hotspotColor = new Color(color);
  
  return (
    <group name={`hotspot-${id}`}>
      {/* Hotspot marker */}
      <group 
        ref={hotspotRef} 
        position={position}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        {/* Main hotspot beacon */}
        <mesh ref={markerRef}>
          <cylinderGeometry args={[0.5, 0.5, 5, 16]} />
          <meshStandardMaterial 
            color={hotspotColor} 
            emissive={hotspotColor} 
            emissiveIntensity={isActive || hovered ? 2 : 1}
            transparent
            opacity={0.7}
          />
        </mesh>
        
        {/* Spotlight beam */}
        <mesh position={[0, 8, 0]} rotation={[Math.PI/2, 0, 0]}>
          <coneGeometry args={[4, 15, 16, 1, true]} />
          <meshBasicMaterial 
            color={hotspotColor} 
            transparent 
            opacity={0.15} 
            side={2} 
          />
        </mesh>
        
        {/* Light source */}
        <pointLight 
          ref={glowRef}
          color={hotspotColor} 
          intensity={isActive || hovered ? 2 : 1} 
          distance={isActive || hovered ? 20 : 10}
        />
        
        {/* Arrow indicator that rotates */}
        <group ref={arrowRef} position={[0, 4, 0]}>
          <mesh position={[0, 1, 0]}>
            <coneGeometry args={[0.5, 1, 16]} />
            <meshStandardMaterial 
              color={hotspotColor} 
              emissive={hotspotColor} 
              emissiveIntensity={isActive || hovered ? 1 : 0.5}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
        
        {/* Project title */}
        <Billboard
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
          position={[0, 7, 0]}
        >
          <Text
            fontSize={1.2}
            maxWidth={10}
            color={isActive || hovered ? "#ffffff" : hotspotColor.getStyle()}
            outlineColor="#000000"
            outlineWidth={0.05}
            anchorX="center"
            anchorY="middle"
          >
            {title}
          </Text>
        </Billboard>
        
        {/* Info indicator - only shown when hovering */}
        {hovered && (
          <Billboard
            follow={true}
            position={[0, 9, 0]}
          >
            <Html
              transform
              distanceFactor={10}
              sprite
              occlude
            >
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

// The main HotspotManager component
const HotspotManagerEvents = ({ audio }) => {
  const { projects, loadProjects } = useStore();
  const { emit } = useEventSystem();
  
  // Load project data on component mount
  useEffect(() => {
    loadProjects();
    
    // Emit event when projects are loaded
    emit(EVENT_TYPES.ASSET_LOAD_START, { type: 'projects' });
    
    // When projects change, emit loaded event
    if (projects.length > 0) {
      emit(EVENT_TYPES.ASSET_LOAD_COMPLETE, { 
        type: 'projects',
        count: projects.length
      });
    }
  }, [loadProjects, projects.length]);
  
  // Sample hotspot data (in a real app, this would come from your CMS or JSON)
  const hotspots = [
    {
      id: 'project1',
      position: [25, 1, 25],
      title: 'Web Development',
      color: '#00FFFF',
      projectData: {
        title: 'Web Development',
        description: 'Frontend and backend development using modern frameworks',
        technologies: ['React', 'Node.js', 'Three.js'],
        image: '/images/project1.jpg',
        url: 'https://example.com/project1'
      }
    },
    {
      id: 'project2',
      position: [-25, 1, 25],
      title: 'Mobile App',
      color: '#FF00FF',
      projectData: {
        title: 'Mobile App Development',
        description: 'Cross-platform mobile applications',
        technologies: ['React Native', 'Flutter', 'Firebase'],
        image: '/images/project2.jpg',
        url: 'https://example.com/project2'
      }
    },
    {
      id: 'project3',
      position: [25, 1, -25],
      title: '3D Modeling',
      color: '#FFFF00',
      projectData: {
        title: '3D Modeling & Animation',
        description: 'Creating immersive 3D experiences',
        technologies: ['Blender', 'Three.js', 'WebGL'],
        image: '/images/project3.jpg',
        url: 'https://example.com/project3'
      }
    },
    {
      id: 'project4',
      position: [-25, 1, -25],
      title: 'AI Projects',
      color: '#FF1493',
      projectData: {
        title: 'AI & Machine Learning',
        description: 'Intelligent solutions using machine learning',
        technologies: ['TensorFlow', 'PyTorch', 'OpenAI'],
        image: '/images/project4.jpg',
        url: 'https://example.com/project4'
      }
    },
    {
      id: 'project5',
      position: [0, 1, 0],
      title: 'Central Hub',
      color: '#39FF14', // Bright green
      projectData: {
        title: 'Project Hub',
        description: 'Central showcase of all available projects and capabilities',
        technologies: ['Three.js', 'React', 'GSAP', 'WebGL'],
        image: '/images/central.jpg',
        url: 'https://example.com/hub'
      }
    }
  ];
  
  return (
    <group>
      {hotspots.map((hotspot) => (
        <HotspotEvent key={hotspot.id} {...hotspot} audio={audio} />
      ))}
    </group>
  );
};

export default HotspotManagerEvents;