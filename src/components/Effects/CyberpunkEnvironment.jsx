import React, { useRef, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky } from '@react-three/drei';

/**
 * Creates a layered cyberpunk environment with procedural elements
 */
const CyberpunkEnvironment = () => {
  const { scene } = useThree();
  const envRef = useRef();
  
  // Set up fog and background on component mount
  React.useEffect(() => {
    // Store original scene properties
    const originalBackground = scene.background;
    const originalFog = scene.fog;
    
    // Set cyberpunk scene background color
    scene.background = new THREE.Color("#05001E");
    
    // Add atmospheric fog with cyberpunk color
    scene.fog = new THREE.FogExp2("#050023", 0.0012);
    
    return () => {
      // Restore original scene properties on unmount
      scene.background = originalBackground;
      scene.fog = originalFog;
    };
  }, [scene]);
  
  // Create a procedural environment map for reflections
  const environmentMap = useMemo(() => createProceduralEnvironment(), []);
  
  // Apply environment map to scene
  React.useEffect(() => {
    if (environmentMap) {
      scene.environment = environmentMap;
      
      // Apply to reflective materials in the scene
      scene.traverse((object) => {
        if (object.isMesh && object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => {
              if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
                material.envMap = environmentMap;
                material.envMapIntensity = 0.5;
                material.needsUpdate = true;
              }
            });
          } else if (object.material.isMeshStandardMaterial || object.material.isMeshPhysicalMaterial) {
            object.material.envMap = environmentMap;
            object.material.envMapIntensity = 0.5;
            object.material.needsUpdate = true;
          }
        }
      });
    }
    
    return () => {
      if (environmentMap) {
        // Reset environment map on unmount
        if (scene.environment === environmentMap) {
          scene.environment = null;
        }
      }
    };
  }, [scene, environmentMap]);
  
  return (
    <group ref={envRef}>
      {/* Cyberpunk sky with custom parameters */}
      <Sky
        distance={450000}
        sunPosition={[0, -1, 0]} 
        inclination={0}
        azimuth={180}
        turbidity={30} 
        rayleigh={0.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.7}
      />
      
      {/* Ambient cyberpunk lighting */}
      <ambientLight intensity={0.3} color="#2211AA" />
      
      {/* Main directional light */}
      <directionalLight position={[5, 30, 5]} intensity={0.5} color="#7040FF" castShadow />
      
      {/* Accent lighting for cyberpunk mood */}
      <pointLight position={[10, 25, 10]} intensity={0.8} color="#00FFFF" distance={90} />
      <pointLight position={[-10, 20, -10]} intensity={0.7} color="#FF10F0" distance={90} />
      <pointLight position={[0, 15, -15]} intensity={0.6} color="#39FF14" distance={90} />
      <pointLight position={[-15, 10, 5]} intensity={0.5} color="#B026FF" distance={90} />
      <pointLight position={[15, 5, 15]} intensity={0.4} color="#FFFF00" distance={90} />
      
      {/* Background environment elements */}
      <mesh scale={100}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color="#050023" side={THREE.BackSide} />
      </mesh>
      
      {/* Distant neon lights in the skybox */}
      {Array.from({ length: 50 }).map((_, i) => (
        <mesh 
          key={i} 
          position={[
            Math.sin(i * 0.5) * 20, 
            Math.abs(Math.cos(i * 0.3) * 10) + 5, 
            Math.cos(i * 0.4) * 20
          ]}
        >
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial 
            color={
              i % 5 === 0 ? "#FF10F0" : 
              i % 5 === 1 ? "#00FFFF" : 
              i % 5 === 2 ? "#39FF14" : 
              i % 5 === 3 ? "#FFFF00" :
              "#B026FF"
            }
          />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Creates a procedural environment map for reflections
 */
function createProceduralEnvironment() {
  // Create a cubemap renderer
  const renderer = new THREE.WebGLCubeRenderTarget(256, {
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter
  });
  
  // Create a scene to render into the cubemap
  const scene = new THREE.Scene();
  
  // Create a cubemap camera
  const cubeCamera = new THREE.CubeCamera(0.1, 1000, renderer);
  
  // Define color gradients for each face
  const gradients = [
    { top: '#050038', bottom: '#5000FF' }, // Right face
    { top: '#050038', bottom: '#FF00FF' }, // Left face
    { top: '#000033', bottom: '#00AAFF' }, // Top face
    { top: '#120030', bottom: '#000000' }, // Bottom face
    { top: '#050038', bottom: '#FF10F0' }, // Front face
    { top: '#050038', bottom: '#00FFFF' }  // Back face
  ];
  
  // Create skybox with procedural textures
  const skyboxGeo = new THREE.BoxGeometry(900, 900, 900);
  const skyboxMats = gradients.map((gradient, i) => {
    // Create canvas for each face
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Create gradient
    const grd = ctx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, gradient.top);
    grd.addColorStop(1, gradient.bottom);
    
    // Fill background
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    });
  });
  
  // Create skybox mesh
  const skybox = new THREE.Mesh(skyboxGeo, skyboxMats);
  scene.add(skybox);
  
  return renderer.texture;
}

export default CyberpunkEnvironment;