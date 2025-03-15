import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture, useHelper, Sky, useGLTF } from '@react-three/drei';
import { PointLightHelper, DirectionalLightHelper, Color, FogExp2, MathUtils, Box3, Vector3 } from 'three';
import { useStore } from '../../state/useStore';
import { BuildingGenerator } from '../../utils';
import ResourceManager from '../../utils/resourceManager';

// Preload the city model
useGLTF.preload('/models/cybercity/scene.gltf');

// Atmospheric particles effect
const Points = ({ count = 100, size = 0.5, radius = 50 }) => {
  const pointsRef = useRef();
  
  // Generate random points within a cylindrical volume
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = Math.random() * 50; // Height distribution
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    return positions;
  }, [count, radius]);
  
  // Animate particles
  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    
    const time = clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Gentle upward movement with variation
      positions[i3 + 1] += 0.01 + 0.01 * Math.sin(time + i);
      
      // Reset position when it reaches the top
      if (positions[i3 + 1] > 50) {
        positions[i3 + 1] = 0;
      }
      
      // Small random horizontal movement
      positions[i3] += Math.sin(time * 0.5 + i) * 0.01;
      positions[i3 + 2] += Math.cos(time * 0.5 + i * 1.1) * 0.01;
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={size} 
        color="#5599FF" 
        transparent 
        opacity={0.6} 
        sizeAttenuation={true} 
      />
    </points>
  );
};

// Individual flying vehicle
const FlyingVehicle = ({ radius, height, speed, startAngle, clockwise, color }) => {
  const vehicleRef = useRef();
  const lightRef = useRef();
  
  // Animate the vehicle along a circular path
  useFrame(({ clock }) => {
    if (!vehicleRef.current) return;
    
    const time = clock.getElapsedTime();
    const angle = startAngle + (clockwise ? 1 : -1) * time * speed;
    
    // Calculate position on circular path
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    
    // Update position
    vehicleRef.current.position.set(x, height, z);
    
    // Update rotation to face direction of movement
    const tangentAngle = angle + (clockwise ? -Math.PI / 2 : Math.PI / 2);
    vehicleRef.current.rotation.y = tangentAngle;
    
    // Animate lights
    if (lightRef.current) {
      lightRef.current.intensity = 1 + 0.5 * Math.sin(time * 5 + startAngle * 10);
    }
  });
  
  return (
    <group ref={vehicleRef}>
      {/* Simple vehicle body */}
      <mesh>
        <boxGeometry args={[0.8, 0.2, 1.5]} />
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Neon lights */}
      <mesh position={[0, 0, 0.7]}>
        <boxGeometry args={[0.6, 0.1, 0.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      
      <mesh position={[0, 0, -0.7]}>
        <boxGeometry args={[0.6, 0.1, 0.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      
      {/* Light source */}
      <pointLight
        ref={lightRef}
        color={color}
        intensity={1.5}
        distance={10}
        position={[0, 0, 0]}
      />
    </group>
  );
};

// Flying vehicles/drones effect
const FlyingVehicles = ({ count = 5 }) => {
  const vehicles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      // Generate random paths
      const radius = 30 + Math.random() * 40;
      const height = 15 + Math.random() * 30;
      const speed = 0.1 + Math.random() * 0.3;
      const startAngle = Math.random() * Math.PI * 2;
      const clockwise = Math.random() > 0.5;
      
      // Choose a random neon color
      const colors = ["#00FFFF", "#FF00FF", "#FFFF00", "#FF1493", "#39FF14"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      return { radius, height, speed, startAngle, clockwise, color };
    });
  }, [count]);
  
  return (
    <>
      {vehicles.map((vehicle, i) => (
        <FlyingVehicle key={`vehicle-${i}`} {...vehicle} />
      ))}
    </>
  );
};

// Helper function to generate a procedural building
const Building = ({ position, width, depth, height, emissiveColor, hasAntenna = false }) => {
  return (
    <group position={position}>
      {/* Main building structure */}
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color="#111111" 
          roughness={0.3} 
          metalness={0.8}
          emissive={emissiveColor || "#000000"}
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Building windows */}
      {Array.from({ length: Math.floor(height / 2) }).map((_, i) => (
        <React.Fragment key={`windows-row-${i}`}>
          {Array.from({ length: Math.floor(width) + 1 }).map((_, j) => (
            <mesh 
              key={`window-${i}-${j}`} 
              position={[
                j * 1.2 - width / 2 + 0.5, 
                i * 2 + 1, 
                depth / 2 + 0.1
              ]}
            >
              <planeGeometry args={[0.7, 0.5]} />
              <meshStandardMaterial 
                color={Math.random() > 0.3 ? emissiveColor || "#FFFF99" : "#333333"} 
                emissive={emissiveColor || "#FFFF99"} 
                emissiveIntensity={Math.random() * 0.5 + 0.5}
                transparent
                opacity={0.9}
              />
            </mesh>
          ))}
        </React.Fragment>
      ))}
      
      {/* Building antenna or spire */}
      {hasAntenna && (
        <mesh position={[0, height + 3, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 6, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
          
          {/* Antenna light */}
          <pointLight 
            color={emissiveColor || "#FF0000"} 
            intensity={2} 
            distance={10} 
            position={[0, 3.5, 0]} 
          />
          <mesh position={[0, 3, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial 
              color={emissiveColor || "#FF0000"} 
              emissive={emissiveColor || "#FF0000"} 
              emissiveIntensity={1}
            />
          </mesh>
        </mesh>
      )}
    </group>
  );
};

// Road with neon strips
const Road = ({ start, end, width = 8, color = "#00FFFF" }) => {
  const direction = [end[0] - start[0], end[2] - start[2]];
  const length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
  const angle = Math.atan2(direction[1], direction[0]);
  
  return (
    <group position={[start[0] + direction[0] / 2, 0.01, start[2] + direction[1] / 2]} rotation={[0, angle, 0]}>
      {/* Road surface */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, width]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* Neon strips on road edges */}
      <mesh position={[0, 0.02, width / 2 - 0.5]}>
        <boxGeometry args={[length, 0.05, 0.3]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={1}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      <mesh position={[0, 0.02, -width / 2 + 0.5]}>
        <boxGeometry args={[length, 0.05, 0.3]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={1}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Road markings - broken lines in middle */}
      {Array.from({ length: Math.floor(length / 5) }).map((_, i) => (
        <mesh 
          key={`road-mark-${i}`} 
          position={[i * 5 - length / 2 + 2.5, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[2, 0.2]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      ))}
    </group>
  );
};

const CityScene = () => {
  const { debugMode, setCityBounds } = useStore();
  const [cityLoaded, setCityLoaded] = useState(false);
  const [resourceManager, setResourceManager] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Get the three.js renderer for resource manager
  const { gl: renderer } = useThree();
  
  // Light refs for debug helpers
  const mainLightRef = useRef();
  const spotlightRef = useRef();
  const cityRef = useRef();
  
  // Use debug helpers when in debug mode
  useHelper(debugMode && mainLightRef, DirectionalLightHelper, 5, '#ffffff');
  useHelper(debugMode && spotlightRef, PointLightHelper, 2, '#ff00ff');
  
  // Initialize resource manager
  useEffect(() => {
    if (renderer && !resourceManager) {
      const manager = new ResourceManager(renderer);
      
      // Set up callbacks
      manager.setProgressCallback((progress) => {
        setLoadingProgress(progress);
      });
      
      manager.setLoadCallback(() => {
        console.log('All city resources loaded');
      });
      
      manager.setErrorCallback((error) => {
        console.error('Error loading city resources:', error);
      });
      
      setResourceManager(manager);
    }
  }, [renderer, resourceManager]);
  
  // Load city model using resource manager
  useEffect(() => {
    if (resourceManager && !cityLoaded && cityRef.current) {
      resourceManager.loadModel('/models/cybercity/scene.gltf', {
        optimizeMaterials: true,
        emissiveObjects: ['neon', 'light', 'glow', 'sign', 'screen', 'window'],
        debugName: 'cybercity'
      }).then(cityModel => {
        // Scale and position adjustment if needed
        cityModel.scale.set(1, 1, 1); // Adjust scale as needed
        cityModel.position.set(0, 0, 0); // Adjust position as needed
        
        // Add the model to the scene
        cityRef.current.add(cityModel);
        
        // Calculate city bounds for navigation constraints
        const boundingBox = new Box3().setFromObject(cityModel);
        const size = new Vector3();
        boundingBox.getSize(size);
        
        // Set bounding box in global state for collision detection
        setCityBounds({
          min: boundingBox.min,
          max: boundingBox.max,
          size: size
        });
        
        setCityLoaded(true);
      })
      .catch(error => {
        console.error('Failed to load city model:', error);
      });
    }
  }, [resourceManager, cityLoaded, setCityBounds]);
  
  // Loading animation for emissive elements
  useFrame(({ clock }) => {
    if (cityRef.current && cityLoaded) {
      // Animate neon elements
      cityRef.current.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
          // Create subtle pulsing for emissive materials
          const timeFactor = clock.getElapsedTime();
          // Use object position for variation in the pulsing
          const offset = (child.position.x + child.position.z) * 0.1;
          const pulse = Math.sin(timeFactor + offset) * 0.3 + 0.7;
          
          // Apply pulse to emissive intensity
          child.material.emissiveIntensity = pulse;
          
          // Occasionally add a flicker effect to some elements
          if (child.name.includes('flicker') && Math.random() > 0.95) {
            child.material.emissiveIntensity *= Math.random() * 0.5 + 0.5;
          }
        }
      });
    }
  });

  // Generate procedural buildings to supplement the city model
  const buildings = useMemo(() => {
    // Create a cyberpunk building generator
    const buildingGenerator = new BuildingGenerator({
      citySize: 150,
      centerClearRadius: 30, // Keep buildings away from city center
      minHeight: 15,
      maxHeight: 60,
    });
    
    // Generate a number of random buildings
    return buildingGenerator.generateBuildings(30);
  }, []);

  // Create neon roads to connect areas of the city
  const roads = useMemo(() => {
    return [
      { start: [-70, 0, 0], end: [70, 0, 0], width: 10, color: "#00FFFF" },
      { start: [0, 0, -70], end: [0, 0, 70], width: 10, color: "#FF00FF" },
      { start: [-50, 0, -50], end: [50, 0, 50], width: 8, color: "#FFFF00" },
      { start: [-50, 0, 50], end: [50, 0, -50], width: 8, color: "#FF1493" },
      { start: [40, 0, -20], end: [80, 0, 30], width: 6, color: "#39FF14" },
      { start: [-40, 0, 20], end: [-80, 0, -30], width: 6, color: "#39FF14" },
    ];
  }, []);
  
  return (
    <group>
      {/* Environment */}
      <fog attach="fog" args={['#0a0a0a', 0.002]} />
      <color attach="background" args={['#0a0a0a']} />
      
      {/* Basic lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight
        ref={mainLightRef}
        position={[50, 100, 0]}
        intensity={0.3}
        color="#8080FF"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={150}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
      />
      
      {/* Night sky with stars */}
      <Sky
        distance={450000}
        sunPosition={[0, -1, 0]} 
        inclination={0}
        azimuth={180}
        turbidity={10}
        rayleigh={0.5}
      />
      
      {/* GLTF City Model Container */}
      <group ref={cityRef} />
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* Procedural buildings to supplement the city */}
      {buildings.map((building, index) => (
        <Building key={`building-${index}`} {...building} />
      ))}
      
      {/* Neon roads connecting city areas */}
      {roads.map((road, index) => (
        <Road key={`road-${index}`} {...road} />
      ))}
      
      {/* Central spotlight/beacon as navigation reference point */}
      <pointLight
        ref={spotlightRef}
        position={[0, 30, 0]}
        intensity={5}
        distance={80}
        color="#FF00FF"
        castShadow
      />
      
      {/* Add volumetric light beam from central beacon */}
      <mesh position={[0, 15, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.5, 10, 30, 16, 1, true]} />
        <meshBasicMaterial color="#FF00FF" transparent opacity={0.15} side={2} />
      </mesh>
      
      {/* Add atmospheric floating particles */}
      <Points count={500} size={0.5} radius={100} />
      
      {/* Add flying drones/vehicles in the background */}
      <FlyingVehicles count={12} />
      
      {/* Loading progress indicator */}
      {!cityLoaded && debugMode && (
        <mesh position={[0, 20, 0]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#FFFF00" />
          <pointLight color="#FFFF00" intensity={2} distance={10} />
        </mesh>
      )}
    </group>
  );
};

export default CityScene;