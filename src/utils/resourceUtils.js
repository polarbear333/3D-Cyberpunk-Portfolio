import ResourceManager from './resourceManager';

/**
 * Setup resource loading paths for 3D models and textures
 */
export const setupAssetPaths = () => {
  // Define base directories for different asset types
  const basePaths = {
    models: '/models/',
    textures: '/textures/',
    audio: '/audio/',
  };
  
  // Define model paths
  const modelPaths = {
    cityModel: `${basePaths.models}cybercity/scene.gltf`,
    droneModel: `${basePaths.models}cyberdrone/drone.glb`,
    buildings: `${basePaths.models}buildings/`, // Folder containing building models
  };
  
  // Define texture paths
  const texturePaths = {
    ground: `${basePaths.textures}ground.jpg`,
    sky: `${basePaths.textures}sky.jpg`,
    neon: `${basePaths.textures}neon.jpg`,
  };
  
  // Define audio paths
  const audioPaths = {
    ambient: `${basePaths.audio}cyberpunk-ambient.mp3`,
    drone: `${basePaths.audio}drone-engine.mp3`,
    hover: `${basePaths.audio}hover.mp3`,
    click: `${basePaths.audio}click.mp3`,
  };
  
  return {
    basePaths,
    modelPaths,
    texturePaths,
    audioPaths,
  };
};

/**
 * Create and configure the resource manager
 * 
 * @param {WebGLRenderer} renderer - The Three.js renderer
 * @returns {ResourceManager} Configured resource manager
 */
export const createResourceManager = (renderer) => {
  const manager = new ResourceManager(renderer);
  
  // Configure loading priorities and options
  const options = {
    optimizeMaterials: true,
    emissiveObjects: ['neon', 'light', 'glow', 'sign', 'led', 'lamp', 'screen', 'window'],
  };
  
  return {
    manager,
    options,
    
    /**
     * Preload essential resources
     * 
     * @param {Function} onProgress - Progress callback
     * @param {Function} onComplete - Completion callback
     */
    preloadEssentialResources: (onProgress, onComplete) => {
      const { modelPaths } = setupAssetPaths();
      
      // Set callbacks
      manager.setProgressCallback(onProgress);
      manager.setLoadCallback(onComplete);
      
      // Start loading essential models
      manager.loadModel(modelPaths.cityModel, {
        ...options,
        debugName: 'cybercity',
      });
    },
    
    /**
     * Load drone model
     * 
     * @returns {Promise} Promise that resolves when the drone is loaded
     */
    loadDroneModel: () => {
      const { modelPaths } = setupAssetPaths();
      
      return manager.loadModel(modelPaths.droneModel, {
        optimizeMaterials: true,
        debugName: 'drone',
      });
    },
  };
};

/**
 * Optimize and enhance scene objects
 * 
 * @param {Group} scene - The Three.js scene object
 * @param {Object} options - Enhancement options
 */
export const enhanceSceneObjects = (scene, options = {}) => {
  const {
    emissiveColors = {
      blue: '#00FFFF',
      pink: '#FF00FF',
      yellow: '#FFFF00',
      green: '#39FF14',
    },
    defaultEmissiveColor = '#00FFFF',
    emissiveIntensity = 1.5,
  } = options;
  
  // Traverse scene and enhance emissive materials
  scene.traverse((child) => {
    if (child.isMesh) {
      // Optimize meshes
      child.castShadow = true;
      child.receiveShadow = true;
      
      // Add emissive properties to materials that should glow
      if (child.material) {
        const name = child.name.toLowerCase();
        
        // Check if this object should glow
        if (name.includes('neon') || 
            name.includes('light') || 
            name.includes('glow') ||
            name.includes('sign') ||
            name.includes('screen')) {
          
          // Clone the material to avoid affecting other instances
          child.material = child.material.clone();
          
          // Set emissive properties based on object name
          if (name.includes('blue')) {
            child.material.emissive.set(emissiveColors.blue);
          } else if (name.includes('pink') || name.includes('red')) {
            child.material.emissive.set(emissiveColors.pink);
          } else if (name.includes('yellow')) {
            child.material.emissive.set(emissiveColors.yellow);
          } else if (name.includes('green')) {
            child.material.emissive.set(emissiveColors.green);
          } else {
            // Default emissive color
            child.material.emissive.set(defaultEmissiveColor);
          }
          
          child.material.emissiveIntensity = emissiveIntensity;
        }
      }
    }
  });
  
  return scene;
};

export default {
  setupAssetPaths,
  createResourceManager,
  enhanceSceneObjects,
};