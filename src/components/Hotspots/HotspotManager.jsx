import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';
import { Vector3, Raycaster, Color } from 'three';
import { Text, Billboard, Html } from '@react-three/drei';
import { gsap } from 'gsap';

// Individual Hotspot component
const Hotspot = ({ id, position, title, color, projectData, audio }) => {
  const { activeHotspotId, dronePosition, setActiveHotspot, showOverlay } = useStore();
  const isActive = activeHotspotId === id;
  const hotspotRef = useRef();
  const glowRef = useRef();
  const markerRef = useRef();
  const arrowRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Animation for the hotspot
  useEffect(() => {
    if (!hotspotRef.current) return;
    
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
  }, [position, isActive]);
  
  // Handle hover state
  const handlePointerOver = () => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
    
    // Play hover sound
    if (audio?.isInitialized) {
      audio.playSound('hover', { volume: 0.2 });
    }
  };
  
  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };
  
  // Handle click
  const handleClick = (e) => {
    e.stopPropagation();
    setActiveHotspot(id);
    
    // Play click sound
    if (audio?.isInitialized) {
      audio.playSound('click', { volume: 0.5 });
    }
    
    // When clicked, show detailed project info
    showOverlay(projectData);
  };
  
  // Handle interaction based on distance
  useFrame(() => {
    if (!hotspotRef.current) return;
    
    // Calculate distance to drone
    const distanceVector = new Vector3(...position)
      .sub(new Vector3(...dronePosition.toArray()));
    const distance = distanceVector.length();
    
    // Activate hotspot when drone is close enough
    if (distance < 15 && !isActive && !hovered) {
      // Only change the scale based on distance
      if (markerRef.current) {
        const scale = Math.max(1, Math.min(3, 15 / distance));
        markerRef.current.scale.set(scale, scale, scale);
      }
    }
    
    // Scale marker based on whether it's hovered or active
    if (markerRef.current) {
      const targetScale = hovered || isActive ? 1.5 : 1;
      markerRef.current.scale.lerp(new Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });
  
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
        
        {/* Spotlight beam - visible from top like in screenshot */}
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
            // Using a standard font instead of custom font to avoid loading errors
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

// Hotspot Manager component - handles all hotspots in the scene
const HotspotManager = ({ audio }) => {
  const { projects, loadProjects } = useStore();
  const { camera } = useThree();
  const raycaster = new Raycaster();
  
  // Load project data on component mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  
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
        <Hotspot key={hotspot.id} {...hotspot} audio={audio} />
      ))}
    </group>
  );
};

export default HotspotManager;