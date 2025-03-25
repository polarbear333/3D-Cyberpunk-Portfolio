import * as THREE from 'three';

/**
 * Improved SpatialManager handles occlusion culling, frustum culling, and LOD management
 * with batched processing to prevent freezing during initialization
 */
export class SpatialManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    
    // Create spatial partitioning grid
    this.gridSize = 25; // Grid cell size in world units
    this.grid = new Map();
    
    // Track moving state
    this.isMoving = false;
    
    // Create frustum for culling
    this.frustum = new THREE.Frustum();
    this.frustumMatrix = new THREE.Matrix4();
    
    // Create raycaster for occlusion culling
    this.raycaster = new THREE.Raycaster();
    this.occlusionRays = [];
    this.generateOcclusionRays(6, 6); // Reduced from 8x8 to 6x6 for better performance
    
    // LOD settings
    this.lodLevels = {
      FULL: { distance: 0, scale: 1.0 },
      HIGH: { distance: 30, scale: 0.8 },
      MEDIUM: { distance: 60, scale: 0.5 },
      LOW: { distance: 100, scale: 0.3 },
      VERY_LOW: { distance: 150, scale: 0.1 }
    };
    
    // Performance monitoring
    this.culledObjects = 0;
    this.visibleObjects = 0;
    this.lodChanges = 0;
    
    // Cached objects
    this.cachedVisible = new Set();
    this.cachedOccluded = new Set();
    this.objectLODLevels = new Map();
    
    // Registered objects - with tracking for manual registration
    this.registeredObjects = new Map();
    
    // Initialize
    this.initialized = false;
    this.initializationQueue = [];
    this.processingBatch = false;
    this.batchSize = 10; // Process 10 objects per frame
    this.totalObjectsProcessed = 0;
    
    // Expose to window for global access
    window.spatialManager = this;
    
    // Console output for tracking
    console.log("SpatialManager created");
  }
  
  /**
   * Register an object for spatial management
   * @param {THREE.Object3D} object - The object to register
   * @param {Object} options - Options for managing this object
   */
  registerObject(object, options = {}) {
    if (!object) return false;
    
    try {
      const defaults = {
        important: false,     // Important objects are never fully culled
        dynamic: false,       // Dynamic objects move frequently
        lod: true,            // Whether to apply LOD to this object
        cullDistance: 500     // Distance at which to cull this object
      };
      
      // Merge options with defaults
      const settings = {...defaults, ...options};
      
      // Store registration info
      this.registeredObjects.set(object.uuid, {
        object,
        settings
      });
      
      // Add to grid if static object and we're initialized
      if (this.initialized && !settings.dynamic) {
        this._addToGrid(object);
      }
      
      return true;
    } catch (error) {
      console.warn("Error registering object:", error);
      return false;
    }
  }
  
  /**
   * Unregister an object from spatial management
   * @param {THREE.Object3D} object - The object to unregister
   */
  unregisterObject(object) {
    if (!object) return false;
    
    try {
      // Remove from registered objects
      this.registeredObjects.delete(object.uuid);
      
      // Remove from grid if needed
      if (object.userData.gridCell) {
        const cell = this.grid.get(object.userData.gridCell);
        if (cell) {
          const index = cell.indexOf(object);
          if (index !== -1) {
            cell.splice(index, 1);
          }
        }
        
        // Clean up neighbor cells
        if (object.userData.neighborCells) {
          object.userData.neighborCells.forEach(cellKey => {
            const neighborCell = this.grid.get(cellKey);
            if (neighborCell) {
              const index = neighborCell.indexOf(object);
              if (index !== -1) {
                neighborCell.splice(index, 1);
              }
            }
          });
        }
        
        // Clean up user data
        delete object.userData.gridCell;
        delete object.userData.neighborCells;
      }
      
      return true;
    } catch (error) {
      console.warn("Error unregistering object:", error);
      return false;
    }
  }
  
  /**
   * Initialize the spatial manager in batches to prevent freezing
   */
  initialize() {
    if (this.initialized) return;
    
    console.log("Starting SpatialManager initialization...");
    
    // Clear existing grid & queue
    this.grid.clear();
    this.initializationQueue = [];
    this.totalObjectsProcessed = 0;
    
    try {
      // First, quickly collect all meshes to process
      const meshes = [];
      this.scene.traverse((object) => {
        if (object.isMesh && !object.userData.excludeFromSpatialManager) {
          meshes.push(object);
        }
      });
      
      console.log(`Found ${meshes.length} meshes for spatial management`);
      
      // Add to processing queue
      this.initializationQueue = [...meshes];
      
      // Start processing the queue in batches
      this._processBatch();
      
    } catch (error) {
      console.error("Error initializing spatial manager:", error);
    }
  }
  
  /**
   * Process a batch of objects from the initialization queue
   * This is called repeatedly until all objects are processed
   * @private
   */
  _processBatch() {
    if (this.processingBatch || this.initialized) return;
    
    this.processingBatch = true;
    
    try {
      // Process a batch of objects
      const batchEndIndex = Math.min(this.initializationQueue.length, this.batchSize);
      const currentBatch = this.initializationQueue.splice(0, batchEndIndex);
      
      // Process each object in this batch
      currentBatch.forEach(object => {
        try {
          // Store original material for material swapping
          if (!object.userData.originalMaterial) {
            object.userData.originalMaterial = object.material;
          }
          
          // Create lower detail materials for LOD
          this._createLODMaterials(object);
          
          // Auto-register with default settings
          if (!this.registeredObjects.has(object.uuid)) {
            this.registerObject(object);
          }
          
          // Add to grid if not dynamic
          const registration = this.registeredObjects.get(object.uuid);
          if (registration && !registration.settings.dynamic) {
            this._addToGrid(object);
          }
          
          this.totalObjectsProcessed++;
        } catch (error) {
          console.warn(`Error processing object ${object.name}:`, error);
        }
      });
      
      // Update progress
      const totalObjects = this.totalObjectsProcessed + this.initializationQueue.length;
      const progressPercent = Math.round((this.totalObjectsProcessed / totalObjects) * 100);
      
      if (this.totalObjectsProcessed % 20 === 0) {
        console.log(`Initialization progress: ${progressPercent}% (${this.totalObjectsProcessed}/${totalObjects})`);
      }
      
      // Continue processing or finalize
      if (this.initializationQueue.length > 0) {
        // Schedule next batch with requestAnimationFrame for smoother UI
        requestAnimationFrame(() => {
          this.processingBatch = false;
          this._processBatch();
        });
      } else {
        // All done!
        console.log(`Spatial grid created with ${this.grid.size} cells (${this.totalObjectsProcessed} objects processed)`);
        this.initialized = true;
        this.processingBatch = false;
      }
    } catch (error) {
      console.error("Error in batch processing:", error);
      this.processingBatch = false;
    }
  }
  
  /**
   * Create lower detail materials for LOD with fixed properties
   * @param {THREE.Object3D} object - The object to create LOD materials for
   */
  _createLODMaterials(object) {
    if (!object || !object.material) return;
    
    // Safely access original material
    const originalMaterial = object.userData.originalMaterial;
    if (!originalMaterial) return;
    
    // Ensure we have a place to store LOD materials
    if (!object.userData.lodMaterials) {
      object.userData.lodMaterials = {};
      
      try {
        // HIGH: Similar to original but optimized
        const highMaterial = this._safeCloneMaterial(originalMaterial);
        if (highMaterial) {
          object.userData.lodMaterials.HIGH = highMaterial;
        } else {
          // Fallback to original if cloning fails
          object.userData.lodMaterials.HIGH = originalMaterial;
        }
        
        // MEDIUM: Simplified material with basic properties
        // Extract base color from original material
        const baseColor = this._getBaseColor(originalMaterial);
        const emissiveColor = this._getEmissiveColor(originalMaterial);
        
        // Use LambertMaterial which is more efficient than StandardMaterial
        const mediumMaterial = new THREE.MeshLambertMaterial({
          color: baseColor,
          emissive: emissiveColor,
          transparent: originalMaterial.transparent || false,
          opacity: originalMaterial.opacity || 1.0,
          side: originalMaterial.side || THREE.FrontSide
        });
        
        object.userData.lodMaterials.MEDIUM = mediumMaterial;
        
        // LOW: Even simpler material
        const lowMaterial = new THREE.MeshBasicMaterial({
          color: this._getBaseColor(originalMaterial),
          transparent: true,
          opacity: 0.8,
          side: THREE.FrontSide
          // Removed flatShading as it's not supported by MeshBasicMaterial
        });
        
        object.userData.lodMaterials.LOW = lowMaterial;
        
        // VERY_LOW: Wireframe for distant objects
        const veryLowMaterial = new THREE.MeshBasicMaterial({
          color: 0x555555,
          wireframe: true,
          transparent: true,
          opacity: 0.5
        });
        
        object.userData.lodMaterials.VERY_LOW = veryLowMaterial;
      } catch (error) {
        console.error("Error creating LOD materials:", error);
      }
    }
  }
  
  /**
   * Safely clone a material with fallbacks
   * @param {THREE.Material} material - Material to clone
   * @returns {THREE.Material|null} - Cloned material or null if failed
   */
  _safeCloneMaterial(material) {
    if (!material) return null;
    
    try {
      // Check if it's an array of materials
      if (Array.isArray(material)) {
        return material.map(m => this._safeCloneMaterial(m));
      }
      
      // Check if it has a clone method
      if (typeof material.clone === 'function') {
        return material.clone();
      }
      
      // If it's a basic material type without clone, create a new one
      if (material.type === 'MeshBasicMaterial') {
        return new THREE.MeshBasicMaterial({
          color: material.color || 0xcccccc,
          map: material.map || null,
          wireframe: material.wireframe || false,
          transparent: material.transparent || false,
          opacity: material.opacity || 1.0
        });
      }
      
      if (material.type === 'MeshStandardMaterial') {
        return new THREE.MeshStandardMaterial({
          color: material.color || 0xcccccc,
          roughness: material.roughness || 0.5,
          metalness: material.metalness || 0.5,
          map: material.map || null,
          transparent: material.transparent || false,
          opacity: material.opacity || 1.0
        });
      }
      
      // Fallback - create a basic material
      return new THREE.MeshBasicMaterial({
        color: this._getBaseColor(material),
        wireframe: false
      });
    } catch (error) {
      console.warn("Error cloning material:", error);
      return null;
    }
  }
  
  /**
   * Safely extract base color from material
   * @param {THREE.Material} material - Source material
   * @returns {THREE.Color} - Extracted color or default gray
   */
  _getBaseColor(material) {
    if (!material) return new THREE.Color(0xcccccc);
    
    try {
      if (material.color && material.color instanceof THREE.Color) {
        return material.color;
      }
      
      if (material.color && typeof material.color === 'number') {
        return new THREE.Color(material.color);
      }
      
      // Look for diffuse color in older materials
      if (material.diffuse && material.diffuse instanceof THREE.Color) {
        return material.diffuse;
      }
      
      // For ShaderMaterial, try to extract from uniforms
      if (material.uniforms && material.uniforms.diffuse) {
        return material.uniforms.diffuse.value;
      }
      
      // Default gray if we can't determine color
      return new THREE.Color(0xcccccc);
    } catch (error) {
      console.warn("Error getting base color:", error);
      return new THREE.Color(0xcccccc);
    }
  }
  
  /**
   * Safely extract emissive color from material
   * @param {THREE.Material} material - Source material
   * @returns {THREE.Color} - Extracted emissive color or black
   */
  _getEmissiveColor(material) {
    if (!material) return new THREE.Color(0x000000);
    
    try {
      if (material.emissive && material.emissive instanceof THREE.Color) {
        return material.emissive;
      }
      
      // For ShaderMaterial, try to extract from uniforms
      if (material.uniforms && material.uniforms.emissive) {
        return material.uniforms.emissive.value;
      }
      
      // Default black for no emission
      return new THREE.Color(0x000000);
    } catch (error) {
      console.warn("Error getting emissive color:", error);
      return new THREE.Color(0x000000);
    }
  }
  
  /**
   * Add an object to the spatial grid with improved error handling
   * @param {THREE.Object3D} object - The object to add
   */
  _addToGrid(object) {
    // Skip non-mesh objects
    if (!object.isMesh) return;
    
    try {
      // Skip objects without geometry
      if (!object.geometry) {
        return;
      }
      
      // Calculate the object's bounding box if it doesn't have one
      if (!object.geometry.boundingBox) {
        try {
          object.geometry.computeBoundingBox();
        } catch (e) {
          // If we can't compute a bounding box, skip this object
          return;
        }
      }
      
      // Get world position
      const position = new THREE.Vector3();
      object.getWorldPosition(position);
      
      // Calculate grid cell coordinates
      const cellX = Math.floor(position.x / this.gridSize);
      const cellY = Math.floor(position.y / this.gridSize);
      const cellZ = Math.floor(position.z / this.gridSize);
      
      // Create cell key
      const cellKey = `${cellX},${cellY},${cellZ}`;
      
      // Add object to the cell
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, []);
      }
      
      // Check if object is already in this cell to avoid duplicates
      if (!this.grid.get(cellKey).includes(object)) {
        this.grid.get(cellKey).push(object);
      }
      
      // Store cell key in object for quick lookup
      object.userData.gridCell = cellKey;
      
      // Also add to neighboring cells if the object spans multiple cells
      if (object.geometry.boundingBox) {
        const box = object.geometry.boundingBox.clone();
        
        // Apply matrix transform carefully
        try {
          box.applyMatrix4(object.matrixWorld);
        } catch (e) {
          // If transformation fails, just use the original box
          console.warn("Matrix transform failed, using original bounding box");
        }
        
        // Calculate the grid cells the box spans
        const minCellX = Math.floor(box.min.x / this.gridSize);
        const minCellY = Math.floor(box.min.y / this.gridSize);
        const minCellZ = Math.floor(box.min.z / this.gridSize);
        
        const maxCellX = Math.floor(box.max.x / this.gridSize);
        const maxCellY = Math.floor(box.max.y / this.gridSize);
        const maxCellZ = Math.floor(box.max.z / this.gridSize);
        
        // Limit max span to avoid hanging with huge objects
        const maxSpan = 5;
        const spanX = Math.min(maxCellX - minCellX, maxSpan);
        const spanY = Math.min(maxCellY - minCellY, maxSpan);
        const spanZ = Math.min(maxCellZ - minCellZ, maxSpan);
        
        // Add to neighboring cells if needed (with limits)
        for (let x = minCellX; x <= minCellX + spanX; x++) {
          for (let y = minCellY; y <= minCellY + spanY; y++) {
            for (let z = minCellZ; z <= minCellZ + spanZ; z++) {
              const neighborCellKey = `${x},${y},${z}`;
              
              // Skip the original cell
              if (neighborCellKey === cellKey) continue;
              
              if (!this.grid.has(neighborCellKey)) {
                this.grid.set(neighborCellKey, []);
              }
              
              // Add to cell if not already there
              if (!this.grid.get(neighborCellKey).includes(object)) {
                this.grid.get(neighborCellKey).push(object);
              }
              
              // Add neighbor cell to object's cell list
              if (!object.userData.neighborCells) {
                object.userData.neighborCells = [];
              }
              
              if (!object.userData.neighborCells.includes(neighborCellKey)) {
                object.userData.neighborCells.push(neighborCellKey);
              }
            }
          }
        }
      }
    } catch (error) {
      // More detailed error message
      console.warn(`Error adding object ${object.name || 'unnamed'} to grid:`, error);
    }
  }
  
  /**
   * Generate rays for occlusion culling (reduced number for performance)
   * @param {number} horizontalCount - Number of horizontal rays
   * @param {number} verticalCount - Number of vertical rays
   */
  generateOcclusionRays(horizontalCount, verticalCount) {
    this.occlusionRays = [];
    
    // Generate a grid of rays covering the view frustum
    for (let h = 0; h < horizontalCount; h++) {
      for (let v = 0; v < verticalCount; v++) {
        // Calculate normalized device coordinates (-1 to 1)
        const ndc = new THREE.Vector2(
          (h / (horizontalCount - 1)) * 2 - 1,
          (v / (verticalCount - 1)) * 2 - 1
        );
        
        this.occlusionRays.push(ndc);
      }
    }
  }
  
  /**
   * Update frustum culling based on current camera
   */
  updateFrustum() {
    try {
      // Update the frustum
      this.frustumMatrix.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse
      );
      this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    } catch (error) {
      console.warn("Error updating frustum:", error);
    }
  }
  
  /**
   * Determine appropriate LOD level based on distance
   * @param {number} distance - Distance from camera
   * @returns {string} LOD level key
   */
  _getLODLevel(distance) {
    if (distance < this.lodLevels.HIGH.distance) return 'FULL';
    if (distance < this.lodLevels.MEDIUM.distance) return 'HIGH';
    if (distance < this.lodLevels.LOW.distance) return 'MEDIUM';
    if (distance < this.lodLevels.VERY_LOW.distance) return 'LOW';
    return 'VERY_LOW';
  }
  
  /**
   * Apply appropriate LOD settings based on distance to camera
   * @param {THREE.Object3D} object - The object to update
   * @param {number} distance - Distance from camera
   */
  _applyLOD(object, distance) {
    if (!object.isMesh || !object.material) return;
    
    // Skip if object is not visible
    if (!object.visible) return;
    
    try {
      // Check if the object has registered settings
      const registration = this.registeredObjects.get(object.uuid);
      const options = registration ? registration.settings : { lod: true };
      
      // Skip if LOD is disabled for this object
      if (!options.lod) return;
      
      // Determine appropriate LOD level
      const lodLevel = this._getLODLevel(distance);
      
      // Only update if LOD level has changed
      if (this.objectLODLevels.get(object) !== lodLevel) {
        this.lodChanges++;
        this.objectLODLevels.set(object, lodLevel);
        
        // Apply appropriate material if available
        if (object.userData.lodMaterials && object.userData.lodMaterials[lodLevel]) {
          object.material = object.userData.lodMaterials[lodLevel];
        } else if (lodLevel === 'FULL' && object.userData.originalMaterial) {
          object.material = object.userData.originalMaterial;
        }
      }
    } catch (error) {
      console.warn("Error applying LOD:", error);
    }
  }
  
  /**
   * Check for collisions with simplified algorithm
   * @param {THREE.Vector3} position - Current position
   * @param {THREE.Vector3} velocity - Current velocity 
   * @param {number} distance - Collision distance
   * @returns {Object} Collision results
   */
  checkCollisions(position, velocity, distance = 0.5) {
    try {
      // Skip if not yet initialized
      if (!this.initialized) {
        return { hasCollision: false };
      }
      
      // Create a ray in the direction of movement
      const direction = velocity.clone().normalize();
      this.raycaster.set(position, direction);
      
      // Determine which cells to check
      const cellX = Math.floor(position.x / this.gridSize);
      const cellY = Math.floor(position.y / this.gridSize);
      const cellZ = Math.floor(position.z / this.gridSize);
      
      // Check nearby cells only
      const range = 1;
      const objectsToCheck = [];
      
      for (let x = cellX - range; x <= cellX + range; x++) {
        for (let y = cellY - range; y <= cellY + range; y++) {
          for (let z = cellZ - range; z <= cellZ + range; z++) {
            const cellKey = `${x},${y},${z}`;
            
            if (this.grid.has(cellKey)) {
              objectsToCheck.push(...this.grid.get(cellKey));
            }
          }
        }
      }
      
      // Remove duplicates
      const uniqueObjects = [...new Set(objectsToCheck)];
      
      // Filter to only objects that might be in collision path
      const potentialColliders = uniqueObjects.filter(obj => {
        if (!obj.isMesh || !obj.visible) return false;
        
        // Skip objects without geometry
        if (!obj.geometry) return false;
        
        // Calculate approximate distance
        const objPos = new THREE.Vector3();
        obj.getWorldPosition(objPos);
        
        return objPos.distanceTo(position) < distance * 5;
      });
      
      // Check for collisions
      const intersections = this.raycaster.intersectObjects(potentialColliders, false);
      
      if (intersections.length > 0 && intersections[0].distance < distance) {
        // Collision found
        const intersection = intersections[0];
        
        // Calculate collision response
        const normal = intersection.face?.normal || new THREE.Vector3(0, 1, 0);
        const worldNormal = normal.clone()
                               .transformDirection(intersection.object.matrixWorld);
        
        // Calculate reflection
        const dot = velocity.dot(worldNormal);
        const reflection = velocity.clone().sub(
          worldNormal.multiplyScalar(2 * dot)
        ).multiplyScalar(0.8); // Damping factor
        
        return {
          hasCollision: true,
          point: intersection.point,
          newPosition: position.clone().add(worldNormal.multiplyScalar(0.1)), // Push away slightly
          newVelocity: reflection
        };
      }
      
      return { hasCollision: false };
    } catch (error) {
      console.warn("Error in collision check:", error);
      return { hasCollision: false };
    }
  }
  
  /**
   * Update culling and LOD for all objects with optimized approach
   * @param {THREE.Vector3} cameraPosition - Current camera position
   */
  update(cameraPosition) {
    if (!this.initialized) {
      // If not initialized yet, make sure to start the initialization
      if (this.initializationQueue.length === 0 && !this.processingBatch) {
        this.initialize();
      }
      return;
    }
    
    try {
      // Reset counters
      this.culledObjects = 0;
      this.visibleObjects = 0;
      this.lodChanges = 0;
      
      // Update frustum for culling
      this.updateFrustum();
      
      // Get camera grid cell
      const cameraCellX = Math.floor(cameraPosition.x / this.gridSize);
      const cameraCellY = Math.floor(cameraPosition.y / this.gridSize);
      const cameraCellZ = Math.floor(cameraPosition.z / this.gridSize);
      
      // Determine visible range in cells (more when moving for smoother transitions)
      const cellRange = this.isMoving ? 3 : 2;
      
      // Process objects in nearby cells
      for (let x = cameraCellX - cellRange; x <= cameraCellX + cellRange; x++) {
        for (let y = cameraCellY - cellRange; y <= cameraCellY + cellRange; y++) {
          for (let z = cameraCellZ - cellRange; z <= cameraCellZ + cellRange; z++) {
            const cellKey = `${x},${y},${z}`;
            
            // Skip empty cells
            if (!this.grid.has(cellKey)) continue;
            
            // Process objects in this cell
            const objects = this.grid.get(cellKey);
            
            for (const object of objects) {
              // Skip objects that were already processed
              if (object.userData.processed) continue;
              
              // Mark as processed for this frame
              object.userData.processed = true;
              
              try {
                // Check registration settings
                const registration = this.registeredObjects.get(object.uuid);
                const settings = registration ? registration.settings : { important: false, cullDistance: 500 };
                
                // Skip essential objects
                if (settings.important) {
                  object.visible = true;
                  this.visibleObjects++;
                  continue;
                }
                
                // Basic frustum culling first (fast)
                if (object.geometry && object.geometry.boundingSphere) {
                  const sphere = object.geometry.boundingSphere.clone();
                  sphere.applyMatrix4(object.matrixWorld);
                  
                  if (!this.frustum.intersectsSphere(sphere)) {
                    object.visible = false;
                    this.culledObjects++;
                    continue;
                  }
                }
                
                // Distance-based LOD
                const objPos = new THREE.Vector3();
                object.getWorldPosition(objPos);
                const distance = cameraPosition.distanceTo(objPos);
                
                // Skip distant objects entirely
                if (distance > settings.cullDistance) {
                  object.visible = false;
                  this.culledObjects++;
                  continue;
                }
                
                // Apply LOD based on distance
                this._applyLOD(object, distance);
                
                // Simplified occlusion culling - only for medium to distant objects
                // and only when not moving (to avoid flickering)
                if (!this.isMoving && distance > 40) {
                  // Skip occlusion test when moving for better performance
                  if (this._isOccluded(object)) {
                    object.visible = false;
                    this.culledObjects++;
                    continue;
                  }
                }
                
                // Object is visible
                object.visible = true;
                this.visibleObjects++;
              } catch (error) {
                console.warn("Error processing object:", error);
                // Default to visible on error
                object.visible = true;
                this.visibleObjects++;
              }
            }
          }
        }
      }
      
      // Reset processed flags for next frame (only for objects we actually processed)
      const processedCellRange = cellRange + 1; // +1 to ensure all previously processed cells are cleared
      
      for (let x = cameraCellX - processedCellRange; x <= cameraCellX + processedCellRange; x++) {
        for (let y = cameraCellY - processedCellRange; y <= cameraCellY + processedCellRange; y++) {
          for (let z = cameraCellZ - processedCellRange; z <= cameraCellZ + processedCellRange; z++) {
            const cellKey = `${x},${y},${z}`;
            
            if (this.grid.has(cellKey)) {
              for (const object of this.grid.get(cellKey)) {
                object.userData.processed = false;
              }
            }
          }
        }
      }
      
      // Update moving state from camera position
      if (!this.lastCameraPosition) {
        this.lastCameraPosition = cameraPosition.clone();
      } else {
        const distance = cameraPosition.distanceTo(this.lastCameraPosition);
        this.isMoving = distance > 0.1;
        this.lastCameraPosition.copy(cameraPosition);
      }
    } catch (error) {
      console.error("Error in spatial manager update:", error);
    }
  }
  
  /**
   * Simple occlusion test with reduced complexity
   * @param {THREE.Object3D} object - The object to test
   * @returns {boolean} Whether the object is occluded
   */
  _isOccluded(object) {
    try {
      // Skip occlusion testing for small objects
      if (!object.geometry || !object.geometry.boundingSphere || 
          object.geometry.boundingSphere.radius < 1) {
        return false;
      }
      
      // Skip occlusion testing for important objects
      const registration = this.registeredObjects.get(object.uuid);
      if (registration && registration.settings.important) {
        return false;
      }
      
      // If object was recently visible, keep it visible
      if (this.cachedVisible.has(object)) return false;
      
      // If object was recently occluded and we're not moving, keep it occluded
      if (this.cachedOccluded.has(object) && !this.isMoving) return true;
      
      // Get object bounding sphere
      const sphere = object.geometry.boundingSphere.clone();
      sphere.applyMatrix4(object.matrixWorld);
      
      // Use fewer rays for better performance
      const raySubset = this.occlusionRays.filter((_, i) => i % 4 === 0); // 1/4 of the rays
      
      // Test with multiple rays
      let visiblePoints = 0;
      
      for (const ndc of raySubset) {
        // Create a ray from the camera through the NDC point
        this.raycaster.setFromCamera(ndc, this.camera);
        
        // Test for intersections
        const intersects = this.raycaster.intersectObject(object, false);
        
        if (intersects.length > 0) {
          visiblePoints++;
          
          // Early exit if enough points are visible
          if (visiblePoints >= 1) {
            this.cachedVisible.add(object);
            this.cachedOccluded.delete(object);
            return false;
          }
        }
      }
      
      // If no points are visible, object is likely occluded
      this.cachedOccluded.add(object);
      this.cachedVisible.delete(object);
      return true;
    } catch (error) {
      console.warn("Error in occlusion test:", error);
      return false; // Default to visible on error
    }
  }
  
  /**
   * Get current performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      culledObjects: this.culledObjects,
      visibleObjects: this.visibleObjects,
      lodChanges: this.lodChanges,
      totalCells: this.grid.size,
      isMoving: this.isMoving,
      initialized: this.initialized,
      initProgress: this.initializationQueue.length > 0 ? 
        `${Math.round((this.totalObjectsProcessed / (this.totalObjectsProcessed + this.initializationQueue.length)) * 100)}%` : 
        '100%'
    };
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    // Clear cached data
    this.grid.clear();
    this.cachedVisible.clear();
    this.cachedOccluded.clear();
    this.objectLODLevels.clear();
    this.registeredObjects.clear();
    this.initializationQueue = [];
    
    // Reset flags
    this.initialized = false;
    this.processingBatch = false;
    
    // Remove global reference
    if (window.spatialManager === this) {
      delete window.spatialManager;
    }
    
    console.log("SpatialManager disposed");
  }
}