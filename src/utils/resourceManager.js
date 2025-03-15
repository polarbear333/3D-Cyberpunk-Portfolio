import { 
  TextureLoader, 
  MeshStandardMaterial, 
  MeshBasicMaterial, 
  Color, 
  RepeatWrapping,
  LinearFilter,
  sRGBEncoding
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';

/**
 * Resource Manager for optimized loading of 3D assets
 */
class ResourceManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = {
      models: {},
      textures: {}
    };
    
    // Texture loader
    this.textureLoader = new TextureLoader();
    
    // GLTF loader with Draco compression
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('/draco/'); // Path to draco decoder
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    
    // KTX2 loader for compressed textures
    this.ktx2Loader = new KTX2Loader();
    this.ktx2Loader.setTranscoderPath('/basis/'); // Path to KTX2 transcoder
    if (renderer) {
      this.ktx2Loader.detectSupport(renderer);
    }
    
    // Event callbacks
    this.onProgress = null;
    this.onLoad = null;
    this.onError = null;
    
    // Loading state
    this.totalItems = 0;
    this.loadedItems = 0;
  }
  
  /**
   * Load a GLTF model with optimization
   * 
   * @param {string} url - Path to the model file
   * @param {Object} options - Loading options
   * @returns {Promise} Promise that resolves with the loaded model
   */
  loadModel(url, options = {}) {
    const {
      optimizeMaterials = true,
      useInstancing = false,
      debugName = null
    } = options;
    
    // Check cache first
    if (this.cache.models[url]) {
      return Promise.resolve(this.cache.models[url].scene.clone());
    }
    
    // Increment total items to load
    this.totalItems++;
    
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          // Process and optimize the model
          if (optimizeMaterials) {
            this._optimizeModel(gltf, options);
          }
          
          // Cache the result
          this.cache.models[url] = gltf;
          
          // Update loading progress
          this.loadedItems++;
          if (this.onProgress) {
            this.onProgress(this.loadedItems / this.totalItems);
          }
          
          // Resolve with cloned scene to avoid modifying the cached version
          resolve(gltf.scene.clone());
          
          // Call onLoad when everything is loaded
          if (this.loadedItems === this.totalItems && this.onLoad) {
            this.onLoad();
          }
        },
        (progress) => {
          // Loading progress for this specific model
          if (this.onProgress) {
            // Scale the progress to the overall loading
            const scaledProgress = progress.loaded / progress.total * (1 / this.totalItems);
            this.onProgress(scaledProgress);
          }
        },
        (error) => {
          console.error(`Error loading model ${url}:`, error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        }
      );
    });
  }
  
  /**
   * Load a texture with optimization
   * 
   * @param {string} url - Path to the texture file
   * @param {Object} options - Texture options
   * @returns {Promise} Promise that resolves with the loaded texture
   */
  loadTexture(url, options = {}) {
    const {
      repeat = [1, 1],
      anisotropy = null,
      encoding = sRGBEncoding,
      flipY = false
    } = options;
    
    // Check cache first
    if (this.cache.textures[url]) {
      return Promise.resolve(this.cache.textures[url]);
    }
    
    // Check if it's a KTX2 texture
    if (url.endsWith('.ktx2')) {
      return this._loadCompressedTexture(url, options);
    }
    
    // Increment total items to load
    this.totalItems++;
    
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          // Apply texture settings
          texture.wrapS = RepeatWrapping;
          texture.wrapT = RepeatWrapping;
          texture.repeat.set(repeat[0], repeat[1]);
          texture.encoding = encoding;
          texture.flipY = flipY;
          
          // Set anisotropy for better quality at angles
          if (anisotropy !== null) {
            texture.anisotropy = anisotropy;
          } else if (this.renderer) {
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          }
          
          // Cache the texture
          this.cache.textures[url] = texture;
          
          // Update loading progress
          this.loadedItems++;
          if (this.onProgress) {
            this.onProgress(this.loadedItems / this.totalItems);
          }
          
          resolve(texture);
          
          // Call onLoad when everything is loaded
          if (this.loadedItems === this.totalItems && this.onLoad) {
            this.onLoad();
          }
        },
        (progress) => {
          // Loading progress for this specific texture
          if (this.onProgress) {
            // Scale the progress to the overall loading
            const scaledProgress = progress.loaded / progress.total * (1 / this.totalItems);
            this.onProgress(scaledProgress);
          }
        },
        (error) => {
          console.error(`Error loading texture ${url}:`, error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        }
      );
    });
  }
  
  /**
   * Load a compressed KTX2 texture
   * 
   * @param {string} url - Path to the KTX2 texture file
   * @param {Object} options - Texture options
   * @returns {Promise} Promise that resolves with the loaded texture
   */
  _loadCompressedTexture(url, options = {}) {
    const {
      repeat = [1, 1],
      encoding = sRGBEncoding,
      flipY = false
    } = options;
    
    // Increment total items to load
    this.totalItems++;
    
    return new Promise((resolve, reject) => {
      this.ktx2Loader.load(
        url,
        (texture) => {
          // Apply texture settings
          texture.wrapS = RepeatWrapping;
          texture.wrapT = RepeatWrapping;
          texture.repeat.set(repeat[0], repeat[1]);
          texture.encoding = encoding;
          texture.flipY = flipY;
          
          // Cache the texture
          this.cache.textures[url] = texture;
          
          // Update loading progress
          this.loadedItems++;
          if (this.onProgress) {
            this.onProgress(this.loadedItems / this.totalItems);
          }
          
          resolve(texture);
          
          // Call onLoad when everything is loaded
          if (this.loadedItems === this.totalItems && this.onLoad) {
            this.onLoad();
          }
        },
        (progress) => {
          // Loading progress for this specific texture
          if (this.onProgress) {
            // Scale the progress to the overall loading
            const scaledProgress = progress.loaded / progress.total * (1 / this.totalItems);
            this.onProgress(scaledProgress);
          }
        },
        (error) => {
          console.error(`Error loading KTX2 texture ${url}:`, error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        }
      );
    });
  }
  
  /**
   * Optimize a loaded GLTF model
   * 
   * @param {Object} gltf - Loaded GLTF model
   * @param {Object} options - Optimization options
   */
  _optimizeModel(gltf, options = {}) {
    const {
      emissiveObjects = [],
      useBasicMaterials = false
    } = options;
    
    // Apply optimizations to the model
    gltf.scene.traverse((node) => {
      if (node.isMesh) {
        // Enable shadows
        node.castShadow = true;
        node.receiveShadow = true;
        
        // Optimize materials
        if (node.material) {
          // Create a new material to avoid affecting other meshes
          const originalMaterial = node.material;
          
          // Use MeshBasicMaterial for static objects to improve performance
          if (useBasicMaterials) {
            const newMaterial = new MeshBasicMaterial({
              map: originalMaterial.map,
              color: originalMaterial.color ? originalMaterial.color : new Color(0xffffff),
              wireframe: originalMaterial.wireframe,
              transparent: originalMaterial.transparent,
              opacity: originalMaterial.opacity
            });
            
            node.material = newMaterial;
          } 
          // Otherwise, clone the material to make it unique
          else {
            node.material = originalMaterial.clone();
          }
          
          // Apply emissive properties to objects that should glow
          if (emissiveObjects.some(name => node.name.includes(name))) {
            const emissiveColor = new Color(0x00FFFF); // Default cyan
            
            // Choose color based on object name
            if (node.name.includes('red') || node.name.includes('pink')) {
              emissiveColor.set(0xFF00FF); // Magenta
            } else if (node.name.includes('yellow')) {
              emissiveColor.set(0xFFFF00); // Yellow
            } else if (node.name.includes('blue')) {
              emissiveColor.set(0x00FFFF); // Cyan
            } else if (node.name.includes('green')) {
              emissiveColor.set(0x39FF14); // Neon green
            }
            
            if (node.material.isMeshStandardMaterial) {
              node.material.emissive = emissiveColor;
              node.material.emissiveIntensity = 1.5;
            }
          }
        }
      }
    });
  }
  
  /**
   * Set a callback function for loading progress
   * 
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }
  
  /**
   * Set a callback function for when all items are loaded
   * 
   * @param {Function} callback - Load complete callback function
   */
  setLoadCallback(callback) {
    this.onLoad = callback;
  }
  
  /**
   * Set a callback function for loading errors
   * 
   * @param {Function} callback - Error callback function
   */
  setErrorCallback(callback) {
    this.onError = callback;
  }
  
  /**
   * Clear cached resources
   * 
   * @param {string} type - Type of resources to clear ('models', 'textures', or null for all)
   */
  clearCache(type = null) {
    if (type === 'models' || type === null) {
      this.cache.models = {};
    }
    
    if (type === 'textures' || type === null) {
      // Dispose textures to free GPU memory
      Object.values(this.cache.textures).forEach(texture => {
        texture.dispose();
      });
      
      this.cache.textures = {};
    }
  }
  
  /**
   * Reset loading progress
   */
  resetProgress() {
    this.totalItems = 0;
    this.loadedItems = 0;
  }
}

export default ResourceManager;