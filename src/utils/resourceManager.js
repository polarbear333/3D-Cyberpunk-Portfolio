import { 
  TextureLoader,
  MeshStandardMaterial,
  Color,
  RepeatWrapping,
  sRGBEncoding
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

export class ResourceManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = {
      models: new Map(),
      textures: new Map(),
      environments: new Map()
    };

    // Progress tracking
    this.totalItems = 0;
    this.loadedItems = 0;
    this.onProgress = null;
    this.onLoad = null;
    this.onError = null;

    // Loader configurations
    this.loaders = {
      texture: new TextureLoader(),
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
    const cacheKey = `${url}|${JSON.stringify(options)}`;
    
    if (this.cache.models.has(cacheKey)) {
      return this._handleCachedResource(cacheKey, 'models');
    }

    this.totalItems++;
    
    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loaders.gltf.load(
          this.paths.models + url,
          gltf => {
            this.loadedItems++;
            this._updateProgress();
            this._processModel(gltf);
            this.cache.models.set(cacheKey, gltf.scene);
            resolve(gltf);
          },
          progress => {
            const itemProgress = progress.loaded / progress.total;
            const globalProgress = (this.loadedItems + itemProgress) / this.totalItems;
            this.onProgress?.(globalProgress);
          },
          error => {
            this.loadedItems++;
            this._updateProgress();
            reject(error);
          }
        );
      });

      return gltf.scene.clone();
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  async loadTexture(url, options = {}) {
    const cacheKey = `${url}|${JSON.stringify(options)}`;
    
    if (this.cache.textures.has(cacheKey)) {
      return this._handleCachedResource(cacheKey, 'textures');
    }

    this.totalItems++;

    try {
      const texture = await new Promise((resolve, reject) => {
        this.loaders.texture.load(
          this.paths.textures + url,
          texture => {
            this.loadedItems++;
            this._updateProgress();
            this._processTexture(texture, options);
            this.cache.textures.set(cacheKey, texture);
            resolve(texture);
          },
          undefined,
          error => {
            this.loadedItems++;
            this._updateProgress();
            reject(error);
          }
        );
      });

      return texture;
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  _processModel(gltf) {
    gltf.scene.traverse(child => {
      if (child.isMesh) {
        child.material = new MeshStandardMaterial({
          color: child.material.color,
          map: child.material.map,
          roughness: 0.7,
          metalness: 0.3,
          envMapIntensity: 0.2
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  _processTexture(texture, options) {
    texture.encoding = sRGBEncoding;
    texture.wrapS = texture.wrapT = options.repeat ? RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (options.repeat) texture.repeat.set(...options.repeat);
  }

  _handleCachedResource(cacheKey, type) {
    this.loadedItems++;
    this.totalItems++;
    this._updateProgress();
    return this.cache[type].get(cacheKey).clone();
  }

  _updateProgress() {
    const progress = this.totalItems > 0 
      ? this.loadedItems / this.totalItems 
      : 1;

    this.onProgress?.(progress);

    if (this.loadedItems >= this.totalItems && this.totalItems > 0) {
      this.onLoad?.();
      this._resetCounters();
    }
  }

  _resetCounters() {
    this.totalItems = 0;
    this.loadedItems = 0;
  }

  clearCache(type = 'all') {
    const disposers = {
      models: model => model.traverse(child => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      }),
      textures: texture => texture.dispose(),
      environments: env => env.texture.dispose()
    };

    if (type === 'all') {
      Object.keys(this.cache).forEach(t => {
        this.cache[t].forEach(disposers[t]);
        this.cache[t].clear();
      });
    } else if (disposers[type]) {
      this.cache[type].forEach(disposers[type]);
      this.cache[type].clear();
    }
  }
}

export default ResourceManager;
