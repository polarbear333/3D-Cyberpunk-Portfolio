import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, useHelper, Sky } from '@react-three/drei';
import { PointLightHelper, DirectionalLightHelper, Color, FogExp2, MathUtils } from 'three';
import { useStore } from '../../state/useStore';

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

// Neon sign component
const NeonSign = ({ position, rotation, text, color, width = 5 }) => {
  const textRef = useRef();
  
  useFrame(({ clock }) => {
    if (textRef.current) {
      // Flicker effect
      textRef.current.material.emissiveIntensity = 
        (Math.sin(clock.getElapsedTime() * 10) * 0.2 + 0.8) * 
        (Math.random() > 0.97 ? 0.5 : 1);
    }
  });
  
  return (
    <group position={position} rotation={rotation}>
      <mesh ref={textRef}>
        <textGeometry args={[text, { size: 1, height: 0.1, width: 0.1 }]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={1} 
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>
      <pointLight color={color} intensity={1} distance={5} />
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
    </group>
  );
};

const CityScene = () => {
  const { debugMode } = useStore();
  
  // Light refs for debug helpers
  const mainLightRef = useRef();
  const spotlightRef = useRef();
  
  // Use debug helpers when in debug mode
  useHelper(debugMode && mainLightRef, DirectionalLightHelper, 5, '#ffffff');
  useHelper(debugMode && spotlightRef, PointLightHelper, 2, '#ff00ff');
  
  // Generate procedural buildings
  const buildings = useMemo(() => {
    const buildingData = [];
    const citySize = 100;
    const buildingCount = 50;
    
    // Generate random buildings
    for (let i = 0; i < buildingCount; i++) {
      const x = MathUtils.randFloatSpread(citySize);
      const z = MathUtils.randFloatSpread(citySize);
      
      // Keep buildings away from the center (drone starting area)
      if (Math.sqrt(x * x + z * z) < 15) continue;
      
      const width = MathUtils.randFloat(5, 15);
      const depth = MathUtils.randFloat(5, 15);
      const height = MathUtils.randFloat(10, 40);
      
      // Randomly choose an emissive color for the building
      const colorOptions = [
        "#FF00FF", // Magenta
        "#00FFFF", // Cyan
        "#FF1493", // Deep Pink
        "#7B68EE", // Medium Slate Blue
        "#1E90FF", // Dodger Blue
        null, // Some buildings don't glow
      ];
      
      const emissiveColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      const hasAntenna = Math.random() > 0.7;
      
      buildingData.push({
        position: [x, 0, z],
        width,
        depth,
        height,
        emissiveColor,
        hasAntenna,
      });
    }
    
    return buildingData;
  }, []);
  
  // Generate roads
  const roads = useMemo(() => {
    return [
      { start: [-50, 0, 0], end: [50, 0, 0], color: "#00FFFF" },
      { start: [0, 0, -50], end: [0, 0, 50], color: "#FF00FF" },
      { start: [-30, 0, -30], end: [30, 0, 30], color: "#FFFF00" },
      { start: [-30, 0, 30], end: [30, 0, -30], color: "#FF1493" },
    ];
  }, []);
  
  return (
    <group>
      {/* Environment */}
      <fog attach="fog" args={['#0a0a0a', 0.002]} />
      <color attach="background" args={['#0a0a0a']} />
      
      {/* Add some basic lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={0.5} />
      
      {/* Debug sphere to ensure something renders */}
      <mesh position={[0, 5, 0]}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Night sky with stars */}
      <Sky
        distance={450000}
        sunPosition={[0, -1, 0]} 
        inclination={0}
        azimuth={180}
      />
      
      {/* Main directional light (moonlight) */}
      <directionalLight
        ref={mainLightRef}
        position={[50, 100, 0]}
        intensity={0.3}
        color="#8080FF"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={150}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      
      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.1} />
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* Buildings */}
      {buildings.map((building, index) => (
        <Building key={`building-${index}`} {...building} />
      ))}
      
      {/* Roads */}
      {roads.map((road, index) => (
        <Road key={`road-${index}`} {...road} />
      ))}
      
      {/* Central spotlight/beacon */}
      <pointLight
        ref={spotlightRef}
        position={[0, 20, 0]}
        intensity={5}
        distance={50}
        color="#FF00FF"
        castShadow
      />
      
      {/* Fog particles/volumetric lights will be implemented in PostProcessing component */}
    </group>
  );
};

export default CityScene;