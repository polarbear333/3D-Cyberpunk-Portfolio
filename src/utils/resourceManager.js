import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

class ResourceManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = {
      models: {},
      textures: {},
      environments: {}
    };

    // Progress tracking
    this.totalItems = 0;
    this.loadedItems = 0;
    this.onProgress = null;
    this.onLoad = null;
    this.onError = null;

    // Loader configurations
    this.loaders = {
      texture: new THREE.TextureLoader(),
      gltf: this._initGLTFLoader(),
    };

    this.paths = {
      models: '/models/',
      textures: '/textures/',
      environments: '/environments/'
    };
  }

  _initGLTFLoader() {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    gltfLoader.setDRACOLoader(dracoLoader);
    return gltfLoader;
  }

  // Callback setters
  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  setLoadCallback(callback) {
    this.onLoad = callback;
  }

  setErrorCallback(callback) {
    this.onError = callback;
  }

  async loadModel(url, options = {}) {
    const fullPath = this.paths.models + url;
    const cacheKey = `${url}|${JSON.stringify(options)}`;
    
    if (this.cache.models[cacheKey]) {
      this._incrementLoadedCount();
      const model = this.cache.models[cacheKey].scene.clone();
      return Promise.resolve(model);
    }

    this.totalItems++;
    
    return new Promise((resolve, reject) => {
      this.loaders.gltf.load(
        fullPath,
        (gltf) => {
          this._incrementLoadedCount();
          this._processModel(gltf, options);
          this.cache.models[cacheKey] = gltf;
          resolve(gltf.scene.clone());
        },
        (xhr) => {
          if (xhr.lengthComputable) {
            const progress = xhr.loaded / xhr.total;
            this._updateProgress(progress);
          }
        },
        (error) => {
          console.error(`Error loading model ${url}:`, error);
          this._incrementLoadedCount();
          this.onError?.(error);
          reject(error);
        }
      );
    });
  }

  async loadTexture(url, options = {}) {
    const fullPath = this.paths.textures + url;
    const cacheKey = `${url}|${JSON.stringify(options)}`;
    
    if (this.cache.textures[cacheKey]) {
      this._incrementLoadedCount();
      return Promise.resolve(this.cache.textures[cacheKey].clone());
    }

    this.totalItems++;

    return new Promise((resolve, reject) => {
      this.loaders.texture.load(
        fullPath,
        (texture) => {
          this._incrementLoadedCount();
          this._processTexture(texture, options);
          this.cache.textures[cacheKey] = texture;
          resolve(texture.clone());
        },
        (xhr) => {
          if (xhr.lengthComputable) {
            const progress = xhr.loaded / xhr.total;
            this._updateProgress(progress);
          }
        },
        (error) => {
          console.error(`Error loading texture ${url}:`, error);
          this._incrementLoadedCount();
          this.onError?.(error);
          reject(error);
        }
      );
    });
  }

  _processModel(gltf, options = {}) {
    // Apply optimizations and enhancements to the model
    if (options.optimizeMaterials) {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          // Check if this mesh should have emissive properties
          const shouldGlow = options.emissiveObjects && 
            options.emissiveObjects.some(term => 
              child.name.toLowerCase().includes(term.toLowerCase())
            );
          
          // Apply material optimizations
          if (child.material) {
            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Add emissive glow to certain elements
            if (shouldGlow) {
              // Choose a color based on the object name
              let emissiveColor;
              const name = child.name.toLowerCase();
              
              if (name.includes('blue')) {
                emissiveColor = new THREE.Color('#00FFFF');
              } else if (name.includes('pink') || name.includes('red')) {
                emissiveColor = new THREE.Color('#FF10F0');
              } else if (name.includes('purple')) {
                emissiveColor = new THREE.Color('#B026FF');
              } else if (name.includes('green')) {
                emissiveColor = new THREE.Color('#39FF14');
              } else if (name.includes('yellow')) {
                emissiveColor = new THREE.Color('#FFFF00');
              } else {
                // Default to cyan
                emissiveColor = new THREE.Color('#00FFFF');
              }
              
              // Clone the material to avoid affecting other instances
              child.material = child.material.clone();
              
              // Set emissive properties
              child.material.emissive = emissiveColor;
              child.material.emissiveIntensity = 1.0;
            }
          }
        }
      });
    }
  }

  _processTexture(texture, options = {}) {
    // Configure texture settings
    texture.encoding = THREE.sRGBEncoding;
    
    if (options.repeat) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      if (options.repeat && Array.isArray(options.repeat) && options.repeat.length === 2) {
        texture.repeat.set(options.repeat[0], options.repeat[1]);
      }
    }
    
    if (options.flipY !== undefined) {
      texture.flipY = options.flipY;
    }
  }

  _incrementLoadedCount() {
    this.loadedItems++;
    this._updateProgress();
  }

  _updateProgress(itemProgress = 1) {
    // Calculate overall progress
    const progress = this.totalItems > 0 
      ? (this.loadedItems + itemProgress - 1) / this.totalItems 
      : 1;
    
    // Call progress callback
    if (this.onProgress) {
      this.onProgress(progress);
    }
    
    // Check if all items are loaded
    if (this.loadedItems >= this.totalItems && this.totalItems > 0) {
      // Reset counters
      this.totalItems = 0;
      this.loadedItems = 0;
      
      // Call completion callback
      if (this.onLoad) {
        this.onLoad();
      }
    }
  }

  clearCache(type = 'all') {
    if (type === 'all' || type === 'models') {
      Object.values(this.cache.models).forEach(model => {
        model.scene?.traverse(child => {
          if (child.isMesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      });
      this.cache.models = {};
    }
    
    if (type === 'all' || type === 'textures') {
      Object.values(this.cache.textures).forEach(texture => {
        texture.dispose();
      });
      this.cache.textures = {};
    }
    
    if (type === 'all' || type === 'environments') {
      Object.values(this.cache.environments).forEach(env => {
        env.dispose();
      });
      this.cache.environments = {};
    }
  }
}

export default ResourceManager;