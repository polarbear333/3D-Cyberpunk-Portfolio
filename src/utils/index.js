// Export utility functions and classes
export * from './mathUtils';
export { default as mathUtils } from './mathUtils';
export { default as BuildingGenerator } from './buildingGenerator';
export { default as ResourceManager } from './resourceManager';
export { 
  setupAssetPaths, 
  createResourceManager, 
  enhanceSceneObjects 
} from './resourceUtils';