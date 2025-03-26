/**
 * Simple implementation of resourceUtils for compatibility
 */

// Create a simplified resource manager that doesn't actually try to load files
export const createResourceManager = (renderer) => {
  console.log('Creating simplified resource manager');
  
  return {
    manager: {
      setProgressCallback: (callback) => {
        console.log('Progress callback set');
      },
      setLoadCallback: (callback) => {
        console.log('Load callback set');
        // Call the callback to signal completion
        setTimeout(() => {
          callback();
        }, 100);
      },
      setErrorCallback: (callback) => {
        console.log('Error callback set');
      },
      loadModel: (url, options) => {
        console.log(`Loading model from ${url} (simplified)`);
        // Return a promise that resolves to a dummy group
        return Promise.resolve({ 
          scene: { 
            clone: () => { 
              console.log('Creating dummy model');
              const THREE = window.THREE || require('three');
              const group = new THREE.Group();
              return group;
            }
          }
        });
      }
    },
    options: {
      optimizeMaterials: true,
      emissiveObjects: ['neon', 'light', 'glow', 'sign', 'led', 'emit', 'window']
    }
  };
};

// Provide empty implementations for other exports
export const setupAssetPaths = () => ({
  basePaths: {
    models: '/models/',
    textures: '/textures/',
    audio: '/audio/'
  },
  modelPaths: {
    cityModel: 'cybercity/scene.gltf',
    droneModel: 'cyberdrone/drone.glb'
  }
});

export const enhanceSceneObjects = (scene) => scene;

export default {
  setupAssetPaths,
  createResourceManager,
  enhanceSceneObjects
};