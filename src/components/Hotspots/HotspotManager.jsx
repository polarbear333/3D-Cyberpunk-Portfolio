import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';
import { Vector3, Raycaster } from 'three';
import { Text, Billboard } from '@react-three/drei';
import { gsap } from 'gsap';

// Individual Hotspot component
const Hotspot = ({ id, position, title, color, projectData }) => {
  const { activeHotspotId, dronePosition, setActiveHotspot, showOverlay } = useStore();
  const isActive = activeHotspotId === id;
  const hotspotRef = useRef();
  const glowRef = useRef();
  const markerRef = useRef();
  
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
  }, [position, isActive]);
  
  // Handle interaction
  useFrame(() => {
    if (!hotspotRef.current) return;
    
    // Calculate distance to drone
    const distanceVector = new Vector3(...position)
      .sub(new Vector3(...dronePosition.toArray()));
    const distance = distanceVector.length();
    
    // Activate hotspot when drone is close enough
    if (distance < 15 && !isActive) {
      setActiveHotspot(id);
    } else if (distance >= 15 && isActive) {
      setActiveHotspot(null);
    }
    
    // When very close, show detailed project info
    if (distance < 8 && isActive) {
      showOverlay(projectData);
    }
    
    // Scale marker based on distance (for better visibility)
    if (markerRef.current) {
      const scale = Math.max(1, Math.min(3, distance / 10));
      markerRef.current.scale.set(scale, scale, scale);
    }
  });
  
  return (
    <group>
      {/* Hotspot marker */}
      <group ref={hotspotRef} position={position}>
        {/* Main hotspot beacon */}
        <mesh ref={markerRef}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial 
            color={color} 
            emissive={color} 
            emissiveIntensity={isActive ? 1 : 0.5}
            transparent
            opacity={0.8}
          />
        </mesh>
        
        {/* Light source */}
        <pointLight 
          ref={glowRef}
          color={color} 
          intensity={isActive ? 2 : 1} 
          distance={isActive ? 20 : 10}
        />
        
        {/* Directional marker/arrow pointing up */}
        <mesh position={[0, 2, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.5, 1, 16]} />
          <meshStandardMaterial 
            color={color} 
            emissive={color} 
            emissiveIntensity={isActive ? 1 : 0.5}
            transparent
            opacity={0.8}
          />
        </mesh>
        
        {/* Project title */}
        <Billboard
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
          position={[0, 4, 0]}
        >
          <Text
            fontSize={1}
            color={isActive ? "#ffffff" : color}
            outlineColor="#000000"
            outlineWidth={0.05}
            anchorX="center"
            anchorY="middle"
          >
            {title}
          </Text>
        </Billboard>
      </group>
    </group>
  );
};

// Hotspot Manager component - handles all hotspots in the scene
const HotspotManager = () => {
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
      position: [25, 5, 25],
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
      position: [-25, 5, 25],
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
      position: [25, 5, -25],
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
      position: [-25, 5, -25],
      title: 'AI Projects',
      color: '#FF1493',
      projectData: {
        title: 'AI & Machine Learning',
        description: 'Intelligent solutions using machine learning',
        technologies: ['TensorFlow', 'PyTorch', 'OpenAI'],
        image: '/images/project4.jpg',
        url: 'https://example.com/project4'
      }
    }
  ];
  
  return (
    <group>
      {hotspots.map((hotspot) => (
        <Hotspot key={hotspot.id} {...hotspot} />
      ))}
    </group>
  );
};

export default HotspotManager;