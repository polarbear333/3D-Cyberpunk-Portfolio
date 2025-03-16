import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useHelper, Sky } from '@react-three/drei';
import { PointLightHelper, DirectionalLightHelper, Color, Box3, Vector3 } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useStore } from '../../state/useStore';

// Main CityScene component
const CityScene = () => {
  const { debugMode, setCityBounds } = useStore();
  const [cityLoaded, setCityLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Get the three.js renderer for debugging
  const { gl: renderer, scene } = useThree();
  
  // Light refs for debug helpers
  const mainLightRef = useRef();
  const spotlightRef = useRef();
  const cityRef = useRef();
  
  // Use debug helpers when in debug mode
  useHelper(debugMode && mainLightRef, DirectionalLightHelper, 5, '#ffffff');
  useHelper(debugMode && spotlightRef, PointLightHelper, 2, '#ff00ff');

  // Load the city model using direct GLTFLoader
  useEffect(() => {
    if (cityLoaded) return;
    
    console.log("Loading city model directly...");
    
    // Create loaders
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    
    // Configure Draco
    console.log("Setting Draco decoder path to /draco/");
    dracoLoader.setDecoderPath('/draco/');
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Define the model path
    const modelPath = '/models/cybercity/scene_compressed.gltf';
    
    // First check if the file exists
    fetch(modelPath)
      .then(response => {
        if (!response.ok) {
          console.error(`Model file not found: ${modelPath} (${response.status})`);
          
          // Try the non-compressed version as fallback
          const fallbackPath = '/models/cybercity/scene.gltf';
          console.log(`Trying fallback path: ${fallbackPath}`);
          return fetch(fallbackPath)
            .then(fallbackResponse => {
              if (!fallbackResponse.ok) {
                throw new Error(`Fallback model not found: ${fallbackPath} (${fallbackResponse.status})`);
              }
              return fallbackPath;
            });
        }
        return modelPath;
      })
      .then(path => {
        console.log(`Loading model from: ${path}`);
        
        // Load the model
        gltfLoader.load(
          path,
          (gltf) => {
            console.log("Model loaded successfully!", gltf);
            
            // Apply optimizations
            enhanceModel(gltf.scene);
            
            // Scale the model
            gltf.scene.scale.set(0.05, 0.05, 0.05); // Try a smaller scale
            
            // Add to scene
            if (cityRef.current) {
              cityRef.current.add(gltf.scene);
              console.log("Model added to scene");
              
              // Calculate bounds
              const boundingBox = new Box3().setFromObject(gltf.scene);
              const size = new Vector3();
              boundingBox.getSize(size);
              
              console.log("Model bounds:", {
                min: boundingBox.min.toArray(),
                max: boundingBox.max.toArray(),
                size: size.toArray()
              });
              
              // Set city bounds for navigation
              setCityBounds({
                min: boundingBox.min,
                max: boundingBox.max,
                size: size
              });
              
              // Mark as loaded
              setCityLoaded(true);
            }
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = (progress.loaded / progress.total);
              console.log(`Loading progress: ${Math.round(percent * 100)}%`);
              setLoadingProgress(percent);
            }
          },
          (error) => {
            console.error("Error loading model:", error);
          }
        );
      })
      .catch(error => {
        console.error("Failed to load model:", error);
      });
  }, [cityLoaded, setCityBounds]);
  
  // Function to enhance model materials
  const enhanceModel = (model) => {
    model.traverse((node) => {
      if (node.isMesh) {
        // Make sure it's visible
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false; // Disable culling for testing
        
        // Log mesh info
        console.log(`Mesh: ${node.name || 'unnamed'}`);
        
        // Process materials
        if (node.material) {
          // Handle array of materials
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          
          materials.forEach((material, index) => {
            // Clone to avoid affecting other meshes
            const clonedMaterial = material.clone();
            
            // Check for missing textures
            if (!clonedMaterial.map) {
              console.log(`Material has no texture: ${node.name}`);
              clonedMaterial.color = new Color(0xCCCCCC);
            }
            
            // Add emissive for certain meshes
            if (node.name.toLowerCase().includes('light') || 
                node.name.toLowerCase().includes('neon') || 
                node.name.toLowerCase().includes('glow') ||
                node.name.toLowerCase().includes('emissive')) {
                
              // Choose color based on name
              let emissiveColor;
              if (node.name.toLowerCase().includes('red')) {
                emissiveColor = new Color(0xFF0000);
              } else if (node.name.toLowerCase().includes('blue')) {
                emissiveColor = new Color(0x00FFFF);
              } else if (node.name.toLowerCase().includes('pink')) {
                emissiveColor = new Color(0xFF00FF);
              } else if (node.name.toLowerCase().includes('yellow')) {
                emissiveColor = new Color(0xFFFF00);
              } else {
                emissiveColor = new Color(0x00FFFF); // Default cyan
              }
              
              clonedMaterial.emissive = emissiveColor;
              clonedMaterial.emissiveIntensity = 1.5;
            }
            
            // Update the material
            clonedMaterial.needsUpdate = true;
            
            // Apply back to the mesh
            if (Array.isArray(node.material)) {
              node.material[index] = clonedMaterial;
            } else {
              node.material = clonedMaterial;
            }
          });
        }
      }
    });
  };
  
  // Animation for neon elements
  useFrame(({ clock }) => {
    if (!cityRef.current || !cityLoaded) return;
    
    // Pulse emissive materials
    cityRef.current.traverse((node) => {
      if (node.isMesh && node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        
        materials.forEach(material => {
          if (material.emissiveIntensity > 0) {
            const time = clock.getElapsedTime();
            const pulse = Math.sin(time * 2 + node.position.x * 0.1) * 0.3 + 0.7;
            material.emissiveIntensity = pulse;
          }
        });
      }
    });
  });
  
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
      
      {/* City model container */}
      <group ref={cityRef} />
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* Central spotlight */}
      <pointLight
        ref={spotlightRef}
        position={[0, 30, 0]}
        intensity={5}
        distance={80}
        color="#FF00FF"
        castShadow
      />
      
      {/* Origin marker for debugging */}
      {debugMode && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#FF0000" wireframe={true} />
        </mesh>
      )}
      
      {/* Loading indicator */}
      {!cityLoaded && (
        <group position={[0, 10, 0]}>
          <mesh>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#FFFF00" />
            <pointLight color="#FFFF00" intensity={2} distance={20} />
          </mesh>
          
          {/* Loading progress bar */}
          <group position={[0, 3, 0]}>
            <mesh>
              <boxGeometry args={[10, 0.5, 0.5]} />
              <meshBasicMaterial color="#333333" />
            </mesh>
            <mesh 
              position={[-5 + (5 * loadingProgress), 0, 0]} 
              scale={[loadingProgress * 10, 0.4, 0.6]}
            >
              <boxGeometry />
              <meshBasicMaterial color="#00FFFF" />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
};

export default CityScene;