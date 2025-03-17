import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useHelper, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { useStore } from '../../state/useStore';

// Memory-optimized CityScene component with progressive loading
const CityScene = ({ uniformManager, spatialManager }) => {
  const { debugMode, setCityBounds, setLoading } = useStore();
  const [cityLoaded, setCityLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Emissive materials will be tracked for animation
  const emissiveMaterialsRef = useRef([]);
    
  // Use a simplified scene based on device capabilities
  const useSimplifiedScene = useRef(
    navigator.deviceMemory ? navigator.deviceMemory < 4 : 
                            navigator.userAgent.includes('Mobile')
  );
    
  // Get the three.js renderer for debugging
  const { gl: renderer, scene, camera } = useThree();
  
  // Light refs for debug helpers
  const mainLightRef = useRef();
  const spotlightRef = useRef();
  const cityRef = useRef();
  
  // Use debug helpers when in debug mode
  useHelper(debugMode && mainLightRef, THREE.DirectionalLightHelper, 5, '#ffffff');
  useHelper(debugMode && spotlightRef, THREE.PointLightHelper, 2, '#ff00ff');

  // Monitor memory usage
  const trackMemoryUsage = () => {
    if (window.performance && window.performance.memory) {
      const memoryInfo = window.performance.memory;
      const totalJSHeapSize = memoryInfo.totalJSHeapSize;
      const usedJSHeapSize = memoryInfo.usedJSHeapSize;
      const memoryLimit = memoryInfo.jsHeapSizeLimit;
      
      const usageRatio = usedJSHeapSize / memoryLimit;
      console.log(`Memory usage: ${Math.round(usageRatio * 100)}% (${Math.round(usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(memoryLimit / 1024 / 1024)}MB)`);
      
      // If memory usage is too high, use simplified scene
      if (usageRatio > 0.7 && !useSimplifiedScene.current) {
        console.warn("Memory usage is high, switching to simplified scene");
        useSimplifiedScene.current = true;
      }
      
      return usageRatio;
    }
    return 0;
  };
  
  // Load a simplified fallback model if needed
  const loadFallbackModel = () => {
    console.log("Loading simplified fallback model");
    
    // Create a simple procedural city with basic shapes
    const cityGroup = new THREE.Group();
    
    // Create a ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        color: '#111111',
        roughness: 0.8,
        metalness: 0.2
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    cityGroup.add(ground);
    
    // Create some simple buildings
    const buildingCount = 100;
    const citySize = 100;
    
    const buildingGeometries = [
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
    ];
    
    const buildingMaterials = [
      new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ 
        color: '#111111', 
        roughness: 0.5, 
        emissive: new THREE.Color('#00FFFF'),
        emissiveIntensity: 0.5
      }),
      new THREE.MeshStandardMaterial({ 
        color: '#222222', 
        roughness: 0.6, 
        emissive: new THREE.Color('#FF00FF'),
        emissiveIntensity: 0.5
      })
    ];
    
    // Track emissive materials for animation
    const emissiveMaterials = [];
    
    // Create buildings
    for (let i = 0; i < buildingCount; i++) {
      const x = Math.random() * citySize - citySize / 2;
      const z = Math.random() * citySize - citySize / 2;
      
      // Skip buildings too close to center
      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
      
      const height = Math.random() * 15 + 5;
      const width = Math.random() * 5 + 3;
      const depth = Math.random() * 5 + 3;
      
      const geometryIndex = Math.floor(Math.random() * buildingGeometries.length);
      const materialIndex = Math.floor(Math.random() * buildingMaterials.length);
      
      const geometry = buildingGeometries[geometryIndex];
      const material = buildingMaterials[materialIndex];
      
      const building = new THREE.Mesh(geometry, material);
      building.position.set(x, height / 2, z);
      building.scale.set(width, height, depth);
      
      // 20% chance for building to cast shadows
      building.castShadow = Math.random() < 0.2;
      building.receiveShadow = true;
      
      cityGroup.add(building);
      
      // Track emissive materials
      if (material.emissive) {
        emissiveMaterials.push({
          material,
          position: building.position.clone()
        });
      }
      
      // Add some windows (simple planes with emissive materials)
      if (height > 10 && Math.random() < 0.5) {
        const windowMaterial = new THREE.MeshBasicMaterial({
          color: Math.random() < 0.5 ? '#00FFFF' : '#FFFF00',
          transparent: true,
          opacity: 0.8
        });
        
        const windowSize = 0.8;
        const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
        
        // Add random windows
        const windowCount = Math.floor(Math.random() * 8) + 2;
        for (let j = 0; j < windowCount; j++) {
          const side = Math.floor(Math.random() * 4); // 0: front, 1: right, 2: back, 3: left
          const wx = (side === 1) ? width/2 : (side === 3 ? -width/2 : (Math.random() * width - width/2));
          const wz = (side === 0) ? depth/2 : (side === 2 ? -depth/2 : (Math.random() * depth - depth/2));
          const wy = Math.random() * height;
          
          const window = new THREE.Mesh(windowGeometry, windowMaterial);
          window.position.set(wx, wy, wz);
          
          // Rotate based on side
          if (side === 1) window.rotation.y = Math.PI / 2;
          if (side === 2) window.rotation.y = Math.PI;
          if (side === 3) window.rotation.y = -Math.PI / 2;
          
          building.add(window);
        }
      }
    }
    
    // Add to scene
    if (cityRef.current) {
      cityRef.current.add(cityGroup);
      
      // Calculate bounds
      const boundingBox = new THREE.Box3().setFromObject(cityGroup);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      setCityBounds({
        min: boundingBox.min,
        max: boundingBox.max,
        size: size
      });
      
      // Store emissive materials
      emissiveMaterialsRef.current = emissiveMaterials;
      
      // Mark as loaded
      setLoading(false);
      setCityLoaded(true);
    }
  };

  // Memory-optimized model loading
  const loadCityModel = () => {
    if (cityLoaded) return;
    
    console.log("Starting memory-optimized city model loading");
    setLoading(true);
    
    // Check available memory and decide whether to load actual model or fallback
    if (trackMemoryUsage() > 0.7 || useSimplifiedScene.current) {
      console.warn("Low memory detected, using fallback model");
      loadFallbackModel();
      return;
    }
    
    // Create loaders with error handling
    let gltfLoader;
    
    try {
      // Custom onload preprocessor to replace PNG texture paths with KTX2
      const texturePreprocessor = (gltf) => {
        // Original model has PNG texture references, but we have KTX2 files
        if (gltf.parser && gltf.parser.json && gltf.parser.json.images) {
          console.log("Preprocessing texture paths to use KTX2 format");
          
          gltf.parser.json.images.forEach(image => {
            if (image.uri && image.uri.endsWith('.png')) {
              // Replace PNG with KTX2
              image.uri = image.uri.replace('.png', '.ktx2');
              console.log(`Replaced texture path: ${image.uri}`);
            }
          });
        }
        return gltf;
      };
      
      // Create custom GLTFLoader with preprocessor
      gltfLoader = new GLTFLoader();
      
      // Store original parse method
      const originalParse = gltfLoader.parse;
      
      // Override parse method to preprocess textures
      gltfLoader.parse = function(data, path, onLoad, onError) {
        return originalParse.call(this, data, path, 
          gltf => {
            try {
              const processedGltf = texturePreprocessor(gltf);
              onLoad(processedGltf);
            } catch (error) {
              console.warn("Error preprocessing model:", error);
              onLoad(gltf); // Fall back to original
            }
          }, 
          onError
        );
      };
      
      // Setup KTX2 loader with proper error handling
      try {
        const ktx2Loader = new KTX2Loader();
        ktx2Loader.setTranscoderPath('/basis/');
        if (renderer) ktx2Loader.detectSupport(renderer);
        gltfLoader.setKTX2Loader(ktx2Loader);
        console.log("KTX2 loader configured");
      } catch (ktx2Error) {
        console.warn("Failed to configure KTX2 loader:", ktx2Error);
      }
      
      // Try to load Draco decoder if needed
      try {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');
        dracoLoader.setDecoderConfig({ 
          type: 'js',
          startDecoderWorkers: false,
          maxNumWorkers: 1
        });
        gltfLoader.setDRACOLoader(dracoLoader);
        console.log("Draco decoder configured");
      } catch (dracoError) {
        console.warn("Failed to configure Draco loader:", dracoError);
      }
      
      // Load the full model with robust error handling
      loadFullModel(gltfLoader);
    } catch (error) {
      console.error("Critical error setting up model loader:", error);
      loadFallbackModel();
    }
  };
  
  // Load the whole model as a single file
  const loadFullModel = (gltfLoader) => {
    // Try different paths for the model
    const modelPaths = [
      '/models/cybercity/scene_compressed.gltf',
    ];  
    
    let currentPathIndex = 0;
    
    // Create texture error handler to suppress texture loading errors
    const textureErrorHandler = (err) => {
      // Just silently ignore texture loading errors
      // console.warn("Texture loading issue (suppressed):", err);
      return;
    };
    
    // Replace default texture loading error handler in THREE.js
    THREE.TextureLoader.prototype.loadAsync = function(url, onProgress) {
      const loader = this;
      return new Promise((resolve, reject) => {
        loader.load(url, resolve, onProgress, textureErrorHandler);
      });
    };
    
    // Create material that doesn't depend on missing textures
    const createFallbackMaterial = (materialType, materialName) => {
      if (materialName.toLowerCase().includes('neon') || 
          materialName.toLowerCase().includes('light') ||
          materialName.toLowerCase().includes('glow') ||
          materialName.toLowerCase().includes('emit')) {
        // Emissive material for neons and lights
        const color = new THREE.Color();
        
        // Choose color based on name
        if (materialName.toLowerCase().includes('red')) {
          color.set('#FF0000');
        } else if (materialName.toLowerCase().includes('blue')) {
          color.set('#00FFFF');
        } else if (materialName.toLowerCase().includes('green')) {
          color.set('#00FF00');
        } else if (materialName.toLowerCase().includes('purple') || 
                  materialName.toLowerCase().includes('pink')) {
          color.set('#FF00FF');
        } else if (materialName.toLowerCase().includes('yellow') || 
                  materialName.toLowerCase().includes('orange')) {
          color.set('#FFFF00');
        } else {
          color.set('#00FFFF'); // Default cyan
        }
        
        return new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 1.0,
          metalness: 0.8,
          roughness: 0.2
        });
      }
      
      // Standard materials
      if (materialName.toLowerCase().includes('glass')) {
        return new THREE.MeshPhysicalMaterial({
          color: '#AACCFF',
          metalness: 0.9,
          roughness: 0.1,
          transparent: true,
          opacity: 0.6
        });
      }
      
      if (materialName.toLowerCase().includes('metal')) {
        return new THREE.MeshStandardMaterial({
          color: '#888888',
          metalness: 0.9,
          roughness: 0.3
        });
      }
      
      // Default material
      return new THREE.MeshStandardMaterial({
        color: '#AAAAAA',
        metalness: 0.4,
        roughness: 0.6
      });
    };
    
    // Process model materials to handle missing textures
    const processMaterials = (gltf) => {
      gltf.scene.traverse((node) => {
        if (node.isMesh && node.material) {
          try {
            // Handle array of materials
            if (Array.isArray(node.material)) {
              for (let i = 0; i < node.material.length; i++) {
                const mat = node.material[i];
                if (mat.map === null && mat.name) {
                  // Replace material that would have texture errors
                  node.material[i] = createFallbackMaterial(mat.type, mat.name);
                }
              }
            } else {
              // Handle single material
              const mat = node.material;
              if (mat.map === null && mat.name) {
                // Replace material that would have texture errors
                node.material = createFallbackMaterial(mat.type, mat.name);
              }
            }
          } catch (err) {
            console.warn("Error processing materials:", err);
          }
        }
      });
      
      return gltf;
    };
    
    const tryLoadModel = () => {
      if (currentPathIndex >= modelPaths.length) {
        console.error("All model paths failed, loading fallback model");
        loadFallbackModel();
        return;
      }
      
      const modelPath = modelPaths[currentPathIndex];
      console.log(`Trying to load model from: ${modelPath}`);
      
      // Load the model with minimal memory usage and custom error handling
      gltfLoader.load(
        modelPath,
        (gltf) => {
          try {
            console.log("Model loaded successfully!");
            
            // Process materials to handle missing textures
            processMaterials(gltf);
            
            // Optimize model aggressively for lower memory usage
            const model = optimizeModel(gltf.scene);
            
            // Use a much smaller scale if needed (adjust based on model size)
            model.scale.set(1, 1, 1); // Start with no scaling
            
            // Add to scene
            if (cityRef.current) {
              cityRef.current.add(model);
              console.log("Model added to scene");
              
              // Calculate bounds
              const boundingBox = new THREE.Box3().setFromObject(model);
              const size = new THREE.Vector3();
              boundingBox.getSize(size);
              
              // Adjust scale if the model is too large
              if (size.length() > 1000) {
                const scale = 0.01;
                model.scale.set(scale, scale, scale);
                console.log(`Model was too large, rescaling to ${scale}`);
                
                // Recalculate bounds after scaling
                boundingBox.setFromObject(model);
                boundingBox.getSize(size);
              }
              
              setCityBounds({
                min: boundingBox.min,
                max: boundingBox.max,
                size: size
              });
              
              // Mark as loaded
              setCityLoaded(true);
              setLoading(false);
            }
          } catch (error) {
            console.error("Error processing model:", error);
            // Try next path
            currentPathIndex++;
            tryLoadModel();
          }
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total);
            setLoadingProgress(percent);
          }
        },
        (error) => {
          console.error(`Error loading model from ${modelPath}:`, error);
          // Try next path
          currentPathIndex++;
          tryLoadModel();
        }
      );
    };
    
    // Start loading attempt
    tryLoadModel();
  }
  
  // Super-aggressive model optimization for memory savings
  const optimizeModel = (model) => {
    console.log("Applying aggressive memory optimization to model");
    
    try {
      // Track what we collect for animation
      const emissiveMaterials = [];
      let meshCount = 0;
      let materialCount = 0;
      let geometryCount = 0;
      
      // Create shared geometries for similar objects to reduce memory
      const geometryCache = new Map();
      const materialCache = new Map();
      
      // Safe object traversal
      const safeTraverse = (node) => {
        if (!node) return;
        
        try {
          // Process this node if it's a mesh
          if (node.isMesh) {
            processMesh(node);
          }
          
          // Process children if any
          if (node.children && node.children.length > 0) {
            for (let i = 0; i < node.children.length; i++) {
              safeTraverse(node.children[i]);
            }
          }
        } catch (error) {
          console.warn("Error processing node:", error);
        }
      };
      
      // Process individual mesh
      const processMesh = (node) => {
        meshCount++;
        
        // Skip tiny meshes for memory efficiency
        if (node.geometry && node.geometry.boundingSphere && 
            node.geometry.boundingSphere.radius < 0.5) {
          node.visible = false;
          return;
        }
        
        // Simplify geometry and material
        if (node.geometry) {
          try {
            node.geometry = simplifyGeometry(node.geometry);
          } catch (error) {
            console.warn("Error simplifying geometry for node:", error);
          }
        }
        
        if (node.material) {
          try {
            const originalMaterial = node.material;
            
            // Handle array of materials
            if (Array.isArray(originalMaterial)) {
              node.material = originalMaterial.map(mat => {
                try {
                  return simplifyMaterial(mat);
                } catch (error) {
                  console.warn("Error simplifying array material:", error);
                  return new THREE.MeshBasicMaterial({ color: 0xcccccc });
                }
              });
            } else {
              node.material = simplifyMaterial(originalMaterial);
            }
            
            // Track emissive materials - but check if it's a standard material first
            if (!Array.isArray(node.material) && 
                node.material.type === 'MeshStandardMaterial' && 
                node.material.emissive) {
              emissiveMaterials.push({
                material: node.material,
                position: node.position.clone()
              });
            }
          } catch (error) {
            console.warn("Error processing material:", error);
            // Fallback to simple material
            node.material = new THREE.MeshBasicMaterial({ color: 0xcccccc });
          }
        }
        
        // Only enable shadows for large, important objects
        try {
          const isImportant = node.geometry && node.geometry.boundingSphere && 
                            node.geometry.boundingSphere.radius > 5;
          
          node.castShadow = isImportant;
          node.receiveShadow = isImportant;
          
          // Enable frustum culling for all objects
          node.frustumCulled = true;
        } catch (error) {
          console.warn("Error setting shadow properties:", error);
        }
      };
      
      // Material merging function - creates simpler materials
      const simplifyMaterial = (material) => {
        if (!material) return new THREE.MeshBasicMaterial({ color: 0xcccccc });
        
        // Skip if already in cache
        const matKey = material.uuid;
        if (materialCache.has(matKey)) {
          return materialCache.get(matKey);
        }
        
        materialCount++;
        
        try {
          let simplified = null;
          
          // Check if it has emissive properties (only valid for MeshStandardMaterial)
          const hasEmissive = material.type === 'MeshStandardMaterial' && 
                          material.emissive && 
                          (material.emissiveIntensity > 0 || 
                            material.emissive.r > 0 || 
                            material.emissive.g > 0 || 
                            material.emissive.b > 0);
          
          if (hasEmissive) {
            // Create a simpler material but preserve emissive
            simplified = new THREE.MeshStandardMaterial({
              color: material.color || new THREE.Color(0xcccccc),
              emissive: material.emissive,
              emissiveIntensity: material.emissiveIntensity || 1.0,
              transparent: material.transparent || false,
              opacity: material.opacity || 1.0,
              side: material.side || THREE.FrontSide,
              flatShading: true, // Use flat shading for better performance
            });
          } else {
            // Even simpler material for non-emissive objects
            simplified = new THREE.MeshLambertMaterial({
              color: material.color || new THREE.Color(0xcccccc),
              transparent: material.transparent || false,
              opacity: material.opacity || 1.0,
              side: material.side || THREE.FrontSide,
            });
          }
          
          // Cache the material
          materialCache.set(matKey, simplified);
          return simplified;
        } catch (error) {
          console.warn("Error simplifying material:", error);
          // Return a basic material as fallback
          const fallback = new THREE.MeshBasicMaterial({ color: 0xcccccc });
          materialCache.set(matKey, fallback);
          return fallback;
        }
      };
      
      // Simplify geometry - reduce detail and memory usage
      const simplifyGeometry = (geometry) => {
        if (!geometry) return new THREE.BufferGeometry();
        
        try {
          // Skip processing if no position attribute
          if (!geometry.attributes || !geometry.attributes.position) {
            return geometry;
          }
          
          // Create a hash of the geometry based on vertex count
          const vertexCount = geometry.attributes.position.count;
          const hash = `${vertexCount}`;
          
          // Check if we have a similar geometry already
          if (geometryCache.has(hash)) {
            return geometryCache.get(hash);
          }
          
          geometryCount++;
          
          // Create a simplified version with fewer attributes
          const simplified = new THREE.BufferGeometry();
          
          // Only copy essential attributes
          if (geometry.attributes.position) {
            simplified.setAttribute('position', geometry.attributes.position);
          }
          if (geometry.attributes.normal) {
            simplified.setAttribute('normal', geometry.attributes.normal);
          }
          
          // Skip uv, color, and other attributes to save memory
          
          // Copy indices if present
          if (geometry.index) {
            simplified.setIndex(geometry.index);
          }
          
          // Compute bounds if needed
          simplified.computeBoundingSphere();
          simplified.computeBoundingBox();
          
          // Cache for reuse
          geometryCache.set(hash, simplified);
          return simplified;
        } catch (error) {
          console.warn("Error simplifying geometry:", error);
          return geometry; // Return original if simplification fails
        }
      };
      
      // Process the model using safe traversal
      safeTraverse(model);
      
      // Clean caches to free memory
      geometryCache.clear();
      materialCache.clear();
      
      // Store emissive materials for animation
      emissiveMaterialsRef.current = emissiveMaterials;
      
      console.log(`Optimized model: ${meshCount} meshes, ${materialCount} materials, ${geometryCount} geometries, ${emissiveMaterials.length} emissive materials`);
      
      return model;
    } catch (error) {
      console.error("Fatal error during model optimization:", error);
      return model; // Return unmodified model on error
    }
  };
  
  // Start loading the model when component mounts
  useEffect(() => {
    loadCityModel();
  }, []);
  
  // Animation for neon elements - optimized to only animate visible chunks
  useFrame(({ clock }) => {
    if (!cityRef.current || !cityLoaded) return;
    
    // Only update every 6 frames to reduce overhead
    if (Math.floor(clock.getElapsedTime() * 10) % 6 !== 0) return;
    
    // Get all emissive materials
    const emissiveMaterials = emissiveMaterialsRef.current;
    
    // Skip if no materials to animate
    if (!emissiveMaterials || emissiveMaterials.length === 0) return;
    
    // Efficiently animate in batches
    const time = clock.getElapsedTime();
    const batchSize = 50; // Process 50 materials at a time
    const totalMaterials = emissiveMaterials.length;
    
    // Only process one batch per frame
    const batchIndex = Math.floor(time) % Math.ceil(totalMaterials / batchSize);
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, totalMaterials);
    
    for (let i = startIndex; i < endIndex; i++) {
      const item = emissiveMaterials[i];
      if (item && item.material && item.position) {
        const pulse = Math.sin(time + item.position.x * 0.05) * 0.3 + 0.7;
        item.material.emissiveIntensity = pulse;
      }
    }
  });
  
  return (
    <group>
      {/* Environment */}
      <fog attach="fog" args={['#0a0a0a', 0.002]} />
      <color attach="background" args={['#0a0a0a']} />
      
      {/* Reduced lighting for better performance */}
      <ambientLight intensity={0.2} />
      <directionalLight
        ref={mainLightRef}
        position={[50, 100, 0]}
        intensity={0.3}
        color="#8080FF"
        castShadow
        shadow-mapSize-width={512} // Reduced for memory savings
        shadow-mapSize-height={512}
        shadow-camera-far={150}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
      />
      
      {/* Simplified sky */}
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
      
      {/* Only add central spotlight when the scene is simple */}
      {useSimplifiedScene.current && (
        <pointLight
          ref={spotlightRef}
          position={[0, 30, 0]}
          intensity={5}
          distance={80}
          color="#FF00FF"
          castShadow={false}
        />
      )}
      
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
          
          {/* Loading text */}
          <group position={[0, 5, 0]}>
            <mesh>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshBasicMaterial color="#00FFFF" />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
};

export default CityScene;