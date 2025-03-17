import * as THREE from 'three';

/**
 * UniformManager optimizes shader uniform updates by tracking changes
 * and only updating uniforms when necessary
 */
class UniformManager {
  constructor() {
    // Cache for storing previous uniform values
    this.uniformCache = new Map();
    
    // Material usage count for efficient batch updates
    this.materialUsageCount = new Map();
    
    // Shared uniforms across multiple materials
    this.sharedUniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      cameraPosition: { value: new THREE.Vector3() }
    };
    
    // Track performance metrics
    this.updatesThisFrame = 0;
    this.skippedUpdatesThisFrame = 0;
    this.totalMaterialsTracked = 0;
    
    // Bind methods
    this.updateUniform = this.updateUniform.bind(this);
    this.updateSharedUniforms = this.updateSharedUniforms.bind(this);
    this.resetFrameStats = this.resetFrameStats.bind(this);
  }
  
  /**
   * Register a material for uniform tracking
   * @param {THREE.Material} material - Material to track
   * @param {Array} uniformNames - Array of uniform names to track (if empty, track all)
   * @returns {boolean} Success state
   */
  registerMaterial(material, uniformNames = []) {
    // Skip if material doesn't have uniforms
    if (!material || !material.uniforms) return false;
    
    // Generate unique ID for this material if not already present
    if (!material.uuid) {
      material.uuid = THREE.MathUtils.generateUUID();
    }
    
    // Track usage count
    this.materialUsageCount.set(
      material.uuid, 
      (this.materialUsageCount.get(material.uuid) || 0) + 1
    );
    
    // Initialize cache for this material's uniforms
    if (!this.uniformCache.has(material.uuid)) {
      this.uniformCache.set(material.uuid, new Map());
      this.totalMaterialsTracked++;
      
      // Add shared uniforms if material doesn't already have them
      for (const [name, uniform] of Object.entries(this.sharedUniforms)) {
        if (!material.uniforms[name]) {
          material.uniforms[name] = { value: uniform.value };
        }
      }
    }
    
    // Determine which uniforms to track
    const uniformsToTrack = uniformNames.length > 0
      ? uniformNames
      : Object.keys(material.uniforms);
    
    // Initialize cache for each uniform
    const cache = this.uniformCache.get(material.uuid);
    
    uniformsToTrack.forEach(name => {
      if (material.uniforms[name] && material.uniforms[name].value !== undefined) {
        // Deep clone the current value to store in cache
        cache.set(name, this._cloneUniformValue(material.uniforms[name].value));
      }
    });
    
    return true;
  }
  
  /**
   * Unregister a material to stop tracking its uniforms
   * @param {THREE.Material} material - Material to unregister
   */
  unregisterMaterial(material) {
    if (!material || !material.uuid) return;
    
    // Decrease usage count
    const currentCount = this.materialUsageCount.get(material.uuid) || 0;
    
    if (currentCount <= 1) {
      // Remove material completely if no longer used
      this.uniformCache.delete(material.uuid);
      this.materialUsageCount.delete(material.uuid);
      this.totalMaterialsTracked--;
    } else {
      // Just decrease the count
      this.materialUsageCount.set(material.uuid, currentCount - 1);
    }
  }
  
  /**
   * Update a specific uniform if its value has changed
   * @param {THREE.Material} material - Material containing the uniform
   * @param {string} name - Name of the uniform
   * @param {*} value - New value for the uniform
   * @returns {boolean} Whether the uniform was updated
   */
  updateUniform(material, name, value) {
    if (!material || !material.uniforms || !material.uniforms[name]) {
      return false;
    }
    
    // Register material if not already tracked
    if (!this.uniformCache.has(material.uuid)) {
      this.registerMaterial(material, [name]);
    }
    
    const cache = this.uniformCache.get(material.uuid);
    const cachedValue = cache.get(name);
    
    // Check if value has changed using deep comparison
    if (!this._uniformValueChanged(cachedValue, value)) {
      this.skippedUpdatesThisFrame++;
      return false;
    }
    
    // Update the uniform
    material.uniforms[name].value = value;
    
    // Update cache with a deep clone of the new value
    cache.set(name, this._cloneUniformValue(value));
    
    // Set needsUpdate flag if the material has a shader
    if (material.type === 'ShaderMaterial' || material.type === 'RawShaderMaterial') {
      material.needsUpdate = true;
    }
    
    this.updatesThisFrame++;
    return true;
  }
  
  /**
   * Update shared uniforms for all registered materials
   * @param {Object} updates - Object containing uniform name/value pairs
   */
  updateSharedUniforms(updates) {
    for (const [name, value] of Object.entries(updates)) {
      if (this.sharedUniforms[name] !== undefined) {
        // Update the shared uniform value
        const oldValue = this.sharedUniforms[name].value;
        
        // Only update if changed
        if (this._uniformValueChanged(oldValue, value)) {
          this.sharedUniforms[name].value = value;
          
          // Apply to all registered materials
          this.uniformCache.forEach((cache, materialUuid) => {
            const material = THREE.MaterialLibrary?.getByUUID(materialUuid) ||
                           this._findMaterialInScene(materialUuid);
            
            if (material && material.uniforms && material.uniforms[name]) {
              material.uniforms[name].value = value;
              cache.set(name, this._cloneUniformValue(value));
              this.updatesThisFrame++;
              
              // Set needsUpdate flag if the material has a shader
              if (material.type === 'ShaderMaterial' || material.type === 'RawShaderMaterial') {
                material.needsUpdate = true;
              }
            }
          });
        } else {
          this.skippedUpdatesThisFrame += this.uniformCache.size;
        }
      }
    }
  }
  
  /**
   * Update global time uniform
   * @param {number} time - Current time
   */
  updateTime(time) {
    this.updateSharedUniforms({ time });
  }
  
  /**
   * Update camera position uniform
   * @param {THREE.Vector3} position - Camera position
   */
  updateCameraPosition(position) {
    this.updateSharedUniforms({ cameraPosition: position });
  }
  
  /**
   * Update resolution uniform
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   */
  updateResolution(width, height) {
    this.sharedUniforms.resolution.value.set(width, height);
    this.updateSharedUniforms({ 
      resolution: this.sharedUniforms.resolution.value 
    });
  }
  
  /**
   * Reset frame statistics
   */
  resetFrameStats() {
    this.updatesThisFrame = 0;
    this.skippedUpdatesThisFrame = 0;
  }
  
  /**
   * Get performance statistics
   * @returns {Object} Statistics about uniform updates
   */
  getStats() {
    return {
      updatesThisFrame: this.updatesThisFrame,
      skippedUpdatesThisFrame: this.skippedUpdatesThisFrame,
      totalMaterialsTracked: this.totalMaterialsTracked,
      efficiency: this.updatesThisFrame > 0 
        ? (this.skippedUpdatesThisFrame / (this.skippedUpdatesThisFrame + this.updatesThisFrame)).toFixed(2)
        : 1.0
    };
  }
  
  /**
   * Deep clone a uniform value
   * @param {*} value - Value to clone
   * @returns {*} Cloned value
   * @private
   */
  _cloneUniformValue(value) {
    // Handle different types of uniform values
    if (value === null || value === undefined) {
      return value;
    }
    
    // THREE.js objects with .clone() method
    if (value.clone && typeof value.clone === 'function') {
      return value.clone();
    }
    
    // Arrays (including typed arrays)
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      return value.slice();
    }
    
    // Objects (deep clone)
    if (typeof value === 'object') {
      return JSON.parse(JSON.stringify(value));
    }
    
    // Primitive values (pass-by-value)
    return value;
  }
  
  /**
   * Check if a uniform value has changed
   * @param {*} oldValue - Previous value
   * @param {*} newValue - New value
   * @returns {boolean} Whether the value has changed
   * @private
   */
  _uniformValueChanged(oldValue, newValue) {
    // Handle null/undefined
    if (oldValue === null || oldValue === undefined || 
        newValue === null || newValue === undefined) {
      return oldValue !== newValue;
    }
    
    // THREE.js vectors, matrices, colors
    if (oldValue.equals && typeof oldValue.equals === 'function') {
      return !oldValue.equals(newValue);
    }
    
    // Arrays and typed arrays
    if ((Array.isArray(oldValue) || ArrayBuffer.isView(oldValue)) &&
        (Array.isArray(newValue) || ArrayBuffer.isView(newValue))) {
        
      if (oldValue.length !== newValue.length) {
        return true;
      }
      
      for (let i = 0; i < oldValue.length; i++) {
        if (oldValue[i] !== newValue[i]) {
          return true;
        }
      }
      
      return false;
    }
    
    // Objects
    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      // Simple comparison using JSON
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }
    
    // Simple value comparison
    return oldValue !== newValue;
  }
  
  /**
   * Find a material in the scene by UUID (fallback method)
   * @param {string} uuid - Material UUID
   * @returns {THREE.Material|null} Found material or null
   * @private
   */
  _findMaterialInScene(uuid) {
    // This is a fallback method that's inefficient
    // In practice, you should keep references to materials
    // or use a material management system
    return null;
  }
  
  /**
   * Apply a set of uniforms to many materials at once
   * @param {Array} materials - Array of materials
   * @param {Object} uniformValues - Object containing uniform name/value pairs
   */
  batchUpdateUniforms(materials, uniformValues) {
    // Skip if no values to update
    if (!uniformValues || Object.keys(uniformValues).length === 0) {
      return;
    }
    
    // Update each material
    materials.forEach(material => {
      if (!material || !material.uniforms) return;
      
      // Register if not tracked
      if (!this.uniformCache.has(material.uuid)) {
        this.registerMaterial(material, Object.keys(uniformValues));
      }
      
      // Apply each uniform
      for (const [name, value] of Object.entries(uniformValues)) {
        this.updateUniform(material, name, value);
      }
    });
  }
  
  /**
   * Custom uniform update for emissive animation
   * @param {Array} emissiveMaterials - Array of materials with emissive properties
   * @param {number} time - Current time
   * @param {number} pulseSpeed - Speed of pulsing effect
   */
  updateEmissiveAnimation(emissiveMaterials, time, pulseSpeed = 1.0) {
    // Skip if no materials to update
    if (!emissiveMaterials || emissiveMaterials.length === 0) {
      return;
    }
    
    // Process in batches for better performance
    const batchSize = 50;
    const batches = Math.ceil(emissiveMaterials.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, emissiveMaterials.length);
      
      // Process this batch
      for (let i = start; i < end; i++) {
        const { material, position } = emissiveMaterials[i];
        
        // Calculate pulse value
        const pulse = Math.sin(time * pulseSpeed + position.x * 0.05) * 0.3 + 0.7;
        
        // Skip update if value is almost the same
        if (Math.abs(material.emissiveIntensity - pulse) < 0.01) {
          this.skippedUpdatesThisFrame++;
          continue;
        }
        
        // Apply update
        material.emissiveIntensity = pulse;
        this.updatesThisFrame++;
      }
    }
  }
  
  /**
   * Dispose and clean up resources
   */
  dispose() {
    this.uniformCache.clear();
    this.materialUsageCount.clear();
  }
}

export default UniformManager;