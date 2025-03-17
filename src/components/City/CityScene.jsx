import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useHelper, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useStore } from '../../state/useStore';

// Memory-optimized CityScene component with progressive loading
const CityScene = ({ uniformManager, spatialManager }) => {
  const { debugMode, setCityBounds, setLoading } = useStore();
  const [cityLoaded, setCityLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Track which city chunks have been loaded
  const [loadedChunks, setLoadedChunks] = useState([]);
  const maxConcurrentChunks = 3; // Maximum number of chunks to load at once
  
  // Define chunk configuration at component level
  const chunkConfig = useRef([
    { name: 'center', path: '/models/cybercity/chunks/center.gltf', priority: 1 },
    { name: 'north', path: '/models/cybercity/chunks/north.gltf', priority: 2 },
    { name: 'east', path: '/models/cybercity/chunks/east.gltf', priority: 2 },
    { name: 'south', path: '/models/cybercity/chunks/south.gltf', priority: 2 },
    { name: 'west', path: '/models/cybercity/chunks/west.gltf', priority: 2 },
    { name: 'details', path: '/models/cybercity/chunks/details.gltf', priority: 3 }
  ]);
  
  // Emissive materials will be tracked per chunk
  const emissiveMaterialsRef = useRef({});
  
  // Use a simplified scene
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

  // Memory usage monitoring
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
      emissiveMaterialsRef.current['fallback'] = emissiveMaterials;
      
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
    if (trackMemoryUsage() > 0.5 || useSimplifiedScene.current) {
      loadFallbackModel();
      return;
    }
    
    // Create loaders
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    
    // Configure Draco with minimal memory usage
    dracoLoader.setDecoderPath('/draco/');
    dracoLoader.setDecoderConfig({ 
      type: 'js',
      startDecoderWorkers: false, // Disable workers for memory conservation
      maxNumWorkers: 1
    });
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Check if chunked models exist
    fetch(chunkConfig.current[0].path)
      .then(response => {
        if (!response.ok) {
          console.log("Chunked models not found, trying single model");
          loadSingleModel(gltfLoader);
        } else {
          console.log("Chunked models found, loading progressively");
          loadChunkedModels(gltfLoader);
        }
      })
      .catch(error => {
        console.error("Error checking for chunked models:", error);
        loadSingleModel(gltfLoader);
      });
  };
  
  // Load all chunks progressively
  const loadChunkedModels = (gltfLoader) => {
    console.log("Chunked models found, loading progressively");
    // Sort chunks by priority
    const sortedChunks = [...chunkConfig.current].sort((a, b) => a.priority - b.priority);
    
    // Start loading highest priority chunks
    const loadNextChunks = () => {
      // Find chunks that haven't been loaded yet
      const remainingChunks = sortedChunks.filter(
        chunk => !loadedChunks.includes(chunk.name)
      );
      
      if (remainingChunks.length === 0) {
        console.log("All chunks loaded!");
        setLoading(false);
        setCityLoaded(true);
        return;
      }
      
      // Take the next batch of chunks to load
      const chunksToLoad = remainingChunks.slice(0, maxConcurrentChunks);
      
      // Load each chunk
      Promise.all(chunksToLoad.map(chunk => loadChunk(gltfLoader, chunk)))
        .then(() => {
          // Update loaded chunks
          setLoadedChunks(prev => [...prev, ...chunksToLoad.map(c => c.name)]);
          
          // Check memory and continue if safe
          if (trackMemoryUsage() < 0.8) {
            // Wait a moment for garbage collection before loading more chunks
            setTimeout(loadNextChunks, 500);
          } else {
            console.warn("Memory usage too high, stopping chunk loading");
            setLoading(false);
            setCityLoaded(true);
          }
        })
        .catch(error => {
          console.error("Error loading chunks:", error);
          setLoading(false);
          
          // If central chunk failed, try fallback
          if (loadedChunks.length === 0) {
            loadFallbackModel();
          } else {
            // Otherwise, consider it done with what we have
            setCityLoaded(true);
          }
        });
    };
    
    // Start loading process
    loadNextChunks();
  };
  
  // Load a single chunk
  const loadChunk = (gltfLoader, chunk) => {
    return new Promise((resolve, reject) => {
      console.log(`Loading chunk: ${chunk.name}`);
      
      gltfLoader.load(
        chunk.path,
        (gltf) => {
          try {
            // Optimize the chunk
            const optimizedModel = optimizeChunk(gltf.scene, chunk.name);
            
            // Add to scene
            if (cityRef.current) {
              cityRef.current.add(optimizedModel);
              console.log(`Chunk ${chunk.name} added to scene`);
              
              // Calculate bounds if this is the first chunk
              if (loadedChunks.length === 0) {
                const boundingBox = new THREE.Box3().setFromObject(optimizedModel);
                const size = new THREE.Vector3();
                boundingBox.getSize(size);
                
                // Set initial bounds, will be expanded as more chunks load
                setCityBounds({
                  min: boundingBox.min,
                  max: boundingBox.max,
                  size: size
                });
              } else if (cityRef.current.children.length > 1) {
                // Update bounds to include all loaded chunks
                const boundingBox = new THREE.Box3().setFromObject(cityRef.current);
                const size = new THREE.Vector3();
                boundingBox.getSize(size);
                
                setCityBounds({
                  min: boundingBox.min,
                  max: boundingBox.max,
                  size: size
                });
              }
              
              // Update progress based on how many chunks we've loaded
              setLoadingProgress((loadedChunks.length + 1) / chunkConfig.current.length);
              
              resolve();
            } else {
              reject(new Error("City ref not available"));
            }
          } catch (error) {
            console.error(`Error processing chunk ${chunk.name}:`, error);
            reject(error);
          }
        },
        (progress) => {
          // Update loading progress for this specific chunk
          if (progress.total > 0) {
            const chunkProgress = progress.loaded / progress.total;
            // Weight the progress by the number of chunks
            const overallProgress = (loadedChunks.length + chunkProgress) / chunkConfig.current.length;
            setLoadingProgress(overallProgress);
          }
        },
        (error) => {
          console.error(`Error loading chunk ${chunk.name}:`, error);
          reject(error);
        }
      );
    });
  };
  
  // Load the whole model as a single file if chunks aren't available
  const loadSingleModel = (gltfLoader) => {
    // Try compressed version first, then fallback
    fetch('/models/cybercity/scene_compressed.gltf')
      .then(response => {
        const modelPath = response.ok ? 
          '/models/cybercity/scene_compressed.gltf' : 
          '/models/cybercity/scene.gltf';
        
        console.log(`Loading single model from: ${modelPath}`);
        
        // Load the model with minimal memory usage
        gltfLoader.load(
          modelPath,
          (gltf) => {
            try {
              console.log("Model loaded successfully!");
              
              // Optimize model aggressively for lower memory usage
              const model = optimizeModel(gltf.scene);
              
              // Use a much smaller scale
              model.scale.set(0.03, 0.03, 0.03);
              
              // Add to scene
              if (cityRef.current) {
                cityRef.current.add(model);
                console.log("Model added to scene");
                
                // Calculate bounds
                const boundingBox = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                boundingBox.getSize(size);
                
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
              loadFallbackModel();
            }
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = (progress.loaded / progress.total);
              setLoadingProgress(percent);
            }
          },
          (error) => {
            console.error("Error loading model:", error);
            loadFallbackModel();
          }
        );
      })
      .catch(error => {
        console.error("Failed to check for model:", error);
        loadFallbackModel();
      });
  };
  
  // Super-aggressive model optimization for memory savings
  const optimizeModel = (model) => {
    console.log("Applying aggressive memory optimization to model");
    
    // Track what we collect for animation
    const emissiveMaterials = [];
    let meshCount = 0;
    let materialCount = 0;
    let geometryCount = 0;
    
    // Create shared geometries for similar objects to reduce memory
    const geometryCache = new Map();
    const materialCache = new Map();
    
    // Material merging function - creates simpler materials
    const simplifyMaterial = (material) => {
      if (!material) return null;
      
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
        
        // Don't use any textures for memory efficiency
        
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
      if (!geometry) return null;
      
      try {
        // Create a hash of the geometry based on vertex count and bounds
        const vertexCount = geometry.attributes.position.count;
        const bounds = geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const hash = `${vertexCount}_${size.x.toFixed(1)}_${size.y.toFixed(1)}_${size.z.toFixed(1)}`;
        
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
        
        // Set bounding sphere and box
        if (geometry.boundingSphere) {
          simplified.boundingSphere = geometry.boundingSphere.clone();
        } else {
          simplified.computeBoundingSphere();
        }
        if (geometry.boundingBox) {
          simplified.boundingBox = geometry.boundingBox.clone();
        } else {
          simplified.computeBoundingBox();
        }
        
        // Cache for reuse
        geometryCache.set(hash, simplified);
        return simplified;
      } catch (error) {
        console.warn("Error simplifying geometry:", error);
        return geometry; // Return original if simplification fails
      }
    };
    
    // Process the model
    model.traverse((node) => {
      if (node.isMesh) {
        meshCount++;
        
        // Skip tiny meshes for memory efficiency
        if (node.geometry && node.geometry.boundingSphere && 
            node.geometry.boundingSphere.radius < 0.5) {
          node.visible = false;
          return;
        }
        
        // Simplify geometry and material
        if (node.geometry) {
          node.geometry = simplifyGeometry(node.geometry);
        }
        
        if (node.material) {
          const originalMaterial = node.material;
          
          // Handle array of materials
          if (Array.isArray(originalMaterial)) {
            node.material = originalMaterial.map(mat => simplifyMaterial(mat));
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
        }
        
        // Only enable shadows for large, important objects
        const isImportant = node.geometry && node.geometry.boundingSphere && 
                          node.geometry.boundingSphere.radius > 5;
        
        node.castShadow = isImportant;
        node.receiveShadow = isImportant;
        
        // Enable frustum culling for all objects
        node.frustumCulled = true;
      }
    });
    
    // Clean caches to free memory
    geometryCache.clear();
    materialCache.clear();
    
    // Store emissive materials for animation
    emissiveMaterialsRef.current['model'] = emissiveMaterials;
    
    console.log(`Optimized model: ${meshCount} meshes, ${materialCount} materials, ${geometryCount} geometries, ${emissiveMaterials.length} emissive materials`);
    
    return model;
  };
  
  // Optimize a single chunk
  const optimizeChunk = (chunk, chunkName) => {
    console.log(`Optimizing chunk: ${chunkName}`);
    
    // Collect emissive materials for this chunk
    const chunkEmissiveMaterials = [];
    
    // Apply same optimization but track per chunk
    const optimized = optimizeModel(chunk);
    
    // Find emissive materials in this chunk
    optimized.traverse((node) => {
      if (node.isMesh && node.material && !Array.isArray(node.material) && 
          node.material.type === 'MeshStandardMaterial' && node.material.emissive) {
        chunkEmissiveMaterials.push({
          material: node.material,
          position: node.position.clone()
        });
      }
    });
    
    // Store emissive materials for this chunk
    emissiveMaterialsRef.current[chunkName] = chunkEmissiveMaterials;
    
    return optimized;
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
    const allEmissiveMaterials = [];
    
    // Only animate materials from loaded chunks
    Object.keys(emissiveMaterialsRef.current).forEach(chunkName => {
      if (chunkName === 'fallback' || loadedChunks.includes(chunkName) || chunkName === 'model') {
        if (emissiveMaterialsRef.current[chunkName]) {
          allEmissiveMaterials.push(...emissiveMaterialsRef.current[chunkName]);
        }
      }
    });
    
    // Skip if no materials to animate
    if (allEmissiveMaterials.length === 0) return;
    
    // Efficiently animate in batches
    const time = clock.getElapsedTime();
    const batchSize = 50; // Process 50 materials at a time
    const totalMaterials = allEmissiveMaterials.length;
    
    // Only process one batch per frame
    const batchIndex = Math.floor(time) % Math.ceil(totalMaterials / batchSize);
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, totalMaterials);
    
    for (let i = startIndex; i < endIndex; i++) {
      const item = allEmissiveMaterials[i];
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