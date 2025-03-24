import * as THREE from 'three';

/**
 * CyberpunkEnhancer provides utilities for enhancing 3D models with a cyberpunk aesthetic
 */
class CyberpunkEnhancer {
  constructor() {
    // Define cyberpunk color palette with bright neon colors
    this.colors = {
      // Neon Colors - bright and saturated
      neonPink: new THREE.Color('#FF10F0').convertSRGBToLinear(), // Hot pink
      neonBlue: new THREE.Color('#00FFFF').convertSRGBToLinear(), // Cyan
      neonPurple: new THREE.Color('#B026FF').convertSRGBToLinear(), // Electric purple
      neonGreen: new THREE.Color('#39FF14').convertSRGBToLinear(), // Electric green
      neonOrange: new THREE.Color('#FF9700').convertSRGBToLinear(), // Vibrant orange
      neonYellow: new THREE.Color('#FFFF00').convertSRGBToLinear(), // Pure yellow
      neonRed: new THREE.Color('#FF3131').convertSRGBToLinear(), // Bright red
      
      // Dark base colors for buildings and structures
      darkBlue: new THREE.Color('#050033').convertSRGBToLinear(), // Dark blue base for buildings
      darkPurple: new THREE.Color('#1A0038').convertSRGBToLinear(), // Dark purple for buildings
      
      // Environment colors
      roadColor: new THREE.Color('#1A1A2E').convertSRGBToLinear(), // Dark blue-gray for streets
      terrainColor: new THREE.Color('#0F172A').convertSRGBToLinear(), // Blueish slate for terrain
      sidewalkColor: new THREE.Color('#132043').convertSRGBToLinear() // Medium blue for sidewalks
    };

    // Material type mapping based on naming patterns found in the GLTF file
    this.materialTypes = [
      // Buildings
      { patterns: ['building', 'build_', 'skyscraper', 'tower'], type: 'building' },
      
      // Streets & Roads
      { patterns: ['street', 'road', 'highway', 'bridge_base'], type: 'street' },
      
      // Terrain & Ground
      { patterns: ['terrain', 'ground', 'soil', 'dirt'], type: 'terrain' },
      
      // Sidewalks & Walkways
      { patterns: ['sidewalk', 'pavement', 'walkway', 'path'], type: 'sidewalk' },
      
      // Windows
      { patterns: ['window', 'glass', 'ilum_', 'ilum.'], type: 'window' },
      
      // Neon Signs & Lights
      { patterns: ['neon', 'sign', 'light', 'glow', 'led', 'emit'], type: 'neon' },
      
      // Holographic elements
      { patterns: ['holo', 'hologram', 'projection'], type: 'hologram' },
      
      // Vehicles
      { patterns: ['car', 'vehicle', 'drone', 'hover'], type: 'vehicle' },
      
      // Billboards & Advertisements
      { patterns: ['billboard', 'advert', 'screen', 'display'], type: 'billboard' }
    ];
    
    // Track materials we've processed to avoid duplicates
    this.processedMaterials = new Set();
    
    // Animation settings
    this.animatedMaterials = [];
  }

  /**
   * Determine material type based on name matching
   * 
   * @param {Object} object - The 3D object to analyze
   * @returns {string} Material type identifier
   */
  determineMaterialType(object) {
    // Get the lowercase name for better pattern matching
    const name = (object.name || '').toLowerCase();
    const materialName = (object.material?.name || '').toLowerCase();
    
    // Check all patterns for a match in object name or material name
    for (const { patterns, type } of this.materialTypes) {
      for (const pattern of patterns) {
        if (name.includes(pattern) || materialName.includes(pattern)) {
          return type;
        }
      }
    }
    
    // Use parent object name as fallback
    if (object.parent && object.parent.name) {
      const parentName = object.parent.name.toLowerCase();
      for (const { patterns, type } of this.materialTypes) {
        for (const pattern of patterns) {
          if (parentName.includes(pattern)) {
            return type;
          }
        }
      }
    }
    
    // Default type based on geometry size if available
    if (object.geometry) {
      if (object.geometry.boundingBox) {
        const size = new THREE.Vector3();
        object.geometry.boundingBox.getSize(size);
        
        // Very tall objects are likely buildings
        if (size.y > size.x * 3 && size.y > size.z * 3) {
          return 'building';
        }
        
        // Flat horizontal objects are likely streets/terrain
        if (size.y < size.x * 0.1 && size.y < size.z * 0.1) {
          return object.position.y < 1 ? 'terrain' : 'street';
        }
      }
    }
    
    // Fallback to generic
    return 'generic';
  }

  /**
   * Create a custom environment map for reflections
   * 
   * @returns {THREE.CubeTexture} Environment map texture
   */
  createCyberpunkEnvMap() {
    // Create a procedural cubemap texture
    const size = 256;
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(size, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });
    
    // Generate each face of the cubemap with appropriate cyberpunk gradients and elements
    // This is a simplified version - in production you might want to create more detailed textures
    const loader = new THREE.CubeTextureLoader();
    const paths = [
      // Create paths to 6 images for the 6 faces of the cube
      // Right, Left, Top, Bottom, Front, Back
      '/textures/cyberpunk/px.jpg',
      '/textures/cyberpunk/nx.jpg',
      '/textures/cyberpunk/py.jpg',
      '/textures/cyberpunk/ny.jpg',
      '/textures/cyberpunk/pz.jpg',
      '/textures/cyberpunk/nz.jpg'
    ];
    
    // Create a fallback procedural texture in case image loading fails
    const envMap = this.createProceduralEnvMap(size);
    
    // Try to load images first
    try {
      return loader.load(paths, () => {
        console.log("Environment map loaded successfully");
      }, undefined, () => {
        console.warn("Environment map loading failed, using procedural fallback");
        return envMap;
      });
    } catch (error) {
      console.warn("Environment map creation error:", error);
      return envMap;
    }
  }

  /**
   * Create a procedural environment map for fallback
   * 
   * @param {number} size - Size of the environment map
   * @returns {THREE.Texture} Procedural environment map
   */
  createProceduralEnvMap(size = 256) {
    // Create a scene to render
    const scene = new THREE.Scene();
    
    // Create a skybox geometry
    const skyGeometry = new THREE.BoxGeometry(10, 10, 10);
    
    // Create materials for each side with cyberpunk gradients
    const materialArray = [];
    
    // Define color gradients for each face of the cube
    const gradients = [
      { top: '#050038', bottom: '#5000FF' }, // Right face
      { top: '#050038', bottom: '#FF00FF' }, // Left face
      { top: '#000033', bottom: '#00AAFF' }, // Top face
      { top: '#120030', bottom: '#000000' }, // Bottom face
      { top: '#050038', bottom: '#FF10F0' }, // Front face
      { top: '#050038', bottom: '#00FFFF' }  // Back face
    ];
    
    // Create materials with canvas-generated gradients
    for (let i = 0; i < 6; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      // Create gradient
      const grd = ctx.createLinearGradient(0, 0, 0, size);
      grd.addColorStop(0, gradients[i].top);
      grd.addColorStop(1, gradients[i].bottom);
      
      // Fill with gradient
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);
      
      // Add grid lines for cyberpunk feel
      ctx.strokeStyle = i % 2 === 0 ? '#00FFFF44' : '#FF10F044';
      ctx.lineWidth = 1;
      
      // Draw grid
      const gridSize = 16;
      for (let j = 0; j <= size; j += size / gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(size, j);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(j, 0);
        ctx.lineTo(j, size);
        ctx.stroke();
      }
      
      // Add random light dots
      ctx.fillStyle = i % 2 === 0 ? '#00FFFF' : '#FF10F0';
      for (let j = 0; j < 50; j++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      
      materialArray.push(new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide
      }));
    }
    
    // Create skybox mesh
    const skybox = new THREE.Mesh(skyGeometry, materialArray);
    scene.add(skybox);
    
    // Set up camera and renderer
    const camera = new THREE.CubeCamera(0.1, 10, cubeRenderTarget);
    camera.renderTarget.texture.encoding = THREE.sRGBEncoding;
    
    // Position cube camera in the scene
    camera.position.set(0, 0, 0);
    camera.update(renderer, scene);
    
    return cubeRenderTarget.texture;
  }

  /**
   * Enhance materials based on determined type
   * 
   * @param {THREE.Material} material - Material to enhance
   * @param {string} type - Material type
   * @param {Object} object - The 3D object
   * @returns {THREE.Material} Enhanced material
   */
  enhanceMaterial(material, type, object) {
    // Skip if we've already processed this material
    if (this.processedMaterials.has(material.uuid)) {
      return material;
    }
    
    // Create a clone to avoid affecting other objects
    const enhancedMaterial = material.clone();
    this.processedMaterials.add(enhancedMaterial.uuid);
    
    // Apply type-specific enhancements
    switch (type) {
      case 'building':
        this.enhanceBuildingMaterial(enhancedMaterial, object);
        break;
      case 'street':
        this.enhanceStreetMaterial(enhancedMaterial, object);
        break;
      case 'terrain':
        this.enhanceTerrainMaterial(enhancedMaterial, object);
        break;
      case 'sidewalk':
        this.enhanceSidewalkMaterial(enhancedMaterial, object);
        break;
      case 'window':
        this.enhanceWindowMaterial(enhancedMaterial, object);
        break;
      case 'neon':
        this.enhanceNeonMaterial(enhancedMaterial, object);
        break;
      case 'hologram':
        this.enhanceHologramMaterial(enhancedMaterial, object);
        break;
      case 'vehicle':
        this.enhanceVehicleMaterial(enhancedMaterial, object);
        break;
      case 'billboard':
        this.enhanceBillboardMaterial(enhancedMaterial, object);
        break;
      default:
        this.enhanceGenericMaterial(enhancedMaterial, object);
    }
    
    // Mark material as needing update
    enhancedMaterial.needsUpdate = true;
    
    return enhancedMaterial;
  }

  /**
   * Apply building-specific enhancements
   */
  enhanceBuildingMaterial(material, object) {
    // Choose between dark blue and dark purple for variation
    const color = Math.random() > 0.5 ? this.colors.darkBlue : this.colors.darkPurple;
    
    if (material.color) {
      // Adjust color keeping some of the original color for variety
      material.color.lerp(color, 0.7);
    }
    
    // Adjust material properties for a more metallic look
    if (material.roughness !== undefined) {
      material.roughness = Math.max(0.4, material.roughness - 0.2);
    }
    
    if (material.metalness !== undefined) {
      material.metalness = Math.min(0.7, material.metalness + 0.3);
    }
    
    // Add subtle emissive for dark parts of buildings - cyberpunk often has subtle glow
    if (material.emissive && object.position.y > 10) {
      // Taller buildings get subtle window highlights
      const baseEmissive = Math.random() > 0.7 ? this.colors.neonBlue : this.colors.neonPurple;
      material.emissive.lerp(baseEmissive, 0.02); // Very subtle
      material.emissiveIntensity = 0.05;
    }
  }

  /**
   * Apply street-specific enhancements
   */
  enhanceStreetMaterial(material, object) {
    if (material.color) {
      material.color.copy(this.colors.roadColor);
    }
    
    // Streets are somewhat reflective when wet (cyberpunk aesthetic often has wet streets)
    if (material.roughness !== undefined) {
      material.roughness = 0.7; // Semi-glossy for wet look
    }
    
    if (material.metalness !== undefined) {
      material.metalness = 0.4; // Slightly reflective
    }
    
    // Add subtle emissive for street lights reflection
    if (material.emissive) {
      material.emissive.set(0.01, 0.01, 0.03); // Very subtle blue
      material.emissiveIntensity = 0.05;
    }
  }

  /**
   * Apply terrain-specific enhancements
   */
  enhanceTerrainMaterial(material, object) {
    if (material.color) {
      material.color.copy(this.colors.terrainColor);
    }
    
    // Natural terrain is less reflective
    if (material.roughness !== undefined) {
      material.roughness = 0.8;
    }
    
    if (material.metalness !== undefined) {
      material.metalness = 0.2;
    }
  }

  /**
   * Apply sidewalk-specific enhancements
   */
  enhanceSidewalkMaterial(material, object) {
    if (material.color) {
      material.color.copy(this.colors.sidewalkColor);
    }
    
    // Sidewalks have some reflection from puddles
    if (material.roughness !== undefined) {
      material.roughness = 0.75;
    }
    
    if (material.metalness !== undefined) {
      material.metalness = 0.3;
    }
    
    // Add subtle glow from nearby neon
    if (material.emissive) {
      material.emissive.set(0.01, 0.01, 0.02);
      material.emissiveIntensity = 0.05;
    }
  }

  /**
   * Apply window-specific enhancements
   */
  enhanceWindowMaterial(material, object) {
    // Determine which color scheme to use for this window
    const neonColors = [
      this.colors.neonBlue,
      this.colors.neonPink,
      this.colors.neonPurple,
      this.colors.neonYellow,
      this.colors.neonGreen
    ];
    
    // Select color based on object name or random choice
    let emissiveColor;
    const name = object.name.toLowerCase();
    
    if (name.includes('blue')) {
      emissiveColor = this.colors.neonBlue;
    } else if (name.includes('pink') || name.includes('red')) {
      emissiveColor = this.colors.neonPink;
    } else if (name.includes('purple')) {
      emissiveColor = this.colors.neonPurple;
    } else if (name.includes('yellow')) {
      emissiveColor = this.colors.neonYellow;
    } else if (name.includes('green')) {
      emissiveColor = this.colors.neonGreen;
    } else {
      // Random color
      emissiveColor = neonColors[Math.floor(Math.random() * neonColors.length)];
    }
    
    // Windows should be bright but not overwhelming
    if (material.emissive) {
      material.emissive.copy(emissiveColor);
      material.emissiveIntensity = 1.8;
    }
    
    // Add to animated materials
    this.animatedMaterials.push({
      material: material,
      position: [object.position.x, object.position.y, object.position.z],
      phase: Math.random() * Math.PI * 2,
      baseIntensity: 1.8,
      color: emissiveColor.clone()
    });
    
    // Make sure windows look glassy
    if (material.roughness !== undefined) {
      material.roughness = 0.4;
    }
    
    if (material.metalness !== undefined) {
      material.metalness = 0.8;
    }
    
    // Windows may have some transparency
    if (Math.random() > 0.7) {
      material.transparent = true;
      material.opacity = 0.7;
    }
  }

  /**
   * Apply neon-specific enhancements
   */
  enhanceNeonMaterial(material, object) {
    // Neon signs and lights should be extremely bright
    const name = object.name.toLowerCase();
    let neonColor;
    
    // Color selection based on name or pattern
    if (name.includes('blue')) {
      neonColor = this.colors.neonBlue;
    } else if (name.includes('pink') || name.includes('red')) {
      neonColor = this.colors.neonPink;
    } else if (name.includes('purple')) {
      neonColor = this.colors.neonPurple;
    } else if (name.includes('yellow')) {
      neonColor = this.colors.neonYellow;
    } else if (name.includes('green')) {
      neonColor = this.colors.neonGreen;
    } else if (name.includes('orange')) {
      neonColor = this.colors.neonOrange;
    } else {
      // Random neon color for variety
      const neonColors = [
        this.colors.neonBlue,
        this.colors.neonPink,
        this.colors.neonPurple,
        this.colors.neonGreen,
        this.colors.neonYellow,
        this.colors.neonOrange
      ];
      neonColor = neonColors[Math.floor(Math.random() * neonColors.length)];
    }
    
    // Set material properties
    if (material.color) {
      material.color.copy(neonColor);
    }
    
    if (material.emissive) {
      material.emissive.copy(neonColor);
      material.emissiveIntensity = 2.5; // Very bright
    }
    
    // Most neon signs are glossy
    if (material.roughness !== undefined) {
      material.roughness = 0.3;
    }
    
    if (material.metalness !== undefined) {
      material.metalness = 0.7;
    }
    
    // Add to animated materials with dynamic pulsing
    this.animatedMaterials.push({
      material: material,
      position: [object.position.x, object.position.y, object.position.z],
      phase: Math.random() * Math.PI * 2,
      baseIntensity: 2.5,
      color: neonColor.clone(),
      // Add special animation behavior flag
      isNeon: true
    });
  }

  /**
   * Apply hologram-specific enhancements
   */
  enhanceHologramMaterial(material, object) {
    // Holograms should be transparent and glowing
    material.transparent = true;
    material.opacity = 0.7;
    
    const hologramColor = this.colors.neonBlue.clone().lerp(this.colors.neonPurple, 0.5);
    
    if (material.color) {
      material.color.copy(hologramColor);
    }
    
    if (material.emissive) {
      material.emissive.copy(hologramColor);
      material.emissiveIntensity = 1.2;
    }
    
    // Holograms have no roughness or metalness
    if (material.roughness !== undefined) {
      material.roughness = 0.1;
    }
    
    if (material.metalness !== undefined) {
      material.metalness = 0.9;
    }
    
    // Add to animated materials with special hologram-specific animation
    this.animatedMaterials.push({
      material: material,
      position: [object.position.x, object.position.y, object.position.z],
      phase: Math.random() * Math.PI * 2,
      baseIntensity: 1.2,
      color: hologramColor.clone(),
      isHologram: true
    });
  }

  /**
   * Apply vehicle-specific enhancements
   */
  enhanceVehicleMaterial(material, object) {
    // Vehicles in cyberpunk are often sleek and metallic with neon lights
    if (material.roughness !== undefined) {
      material.roughness = 0.3; // Glossy
    }
    
    if (material.metalness !== undefined) {
      material.metalness = 0.8; // Very metallic
    }
    
    // Add neon accents to vehicles
    if (material.emissive && Math.random() > 0.6) {
      const vehicleColors = [
        this.colors.neonBlue,
        this.colors.neonPink,
        this.colors.neonGreen,
        this.colors.neonOrange
      ];
      
      const vehicleColor = vehicleColors[Math.floor(Math.random() * vehicleColors.length)];
      material.emissive.copy(vehicleColor);
      material.emissiveIntensity = 1.5;
      
      // Add to animated materials
      this.animatedMaterials.push({
        material: material,
        position: [object.position.x, object.position.y, object.position.z],
        phase: Math.random() * Math.PI * 2,
        baseIntensity: 1.5,
        color: vehicleColor.clone(),
        isVehicle: true
      });
    }
  }

  /**
   * Apply billboard-specific enhancements
   */
  enhanceBillboardMaterial(material, object) {
    // Billboards should be bright and attention-grabbing
    // Alternate between different neon colors for variety
    const billboardColors = [
      this.colors.neonPink,
      this.colors.neonBlue,
      this.colors.neonGreen,
      this.colors.neonYellow,
      this.colors.neonPurple
    ];
    
    const billboardColor = billboardColors[Math.floor(Math.random() * billboardColors.length)];
    
    if (material.color) {
      material.color.copy(billboardColor);
    }
    
    if (material.emissive) {
      material.emissive.copy(billboardColor);
      material.emissiveIntensity = 2.0;
    }
    
    // Add to animated materials with billboard-specific animation
    this.animatedMaterials.push({
      material: material,
      position: [object.position.x, object.position.y, object.position.z],
      phase: Math.random() * Math.PI * 2,
      baseIntensity: 2.0,
      color: billboardColor.clone(),
      isBillboard: true
    });
  }

  /**
   * Apply enhancements to generic materials
   */
  enhanceGenericMaterial(material, object) {
    // Apply generic cyberpunk enhancements to unidentified materials
    
    // Slightly improve reflectivity
    if (material.roughness !== undefined) {
      material.roughness = Math.max(0.3, material.roughness - 0.2);
    }
    
    if (material.metalness !== undefined) {
      material.metalness = Math.min(0.7, material.metalness + 0.2);
    }
    
    // Add subtle emissive effect to some objects
    if (material.emissive && Math.random() > 0.7) {
      const genericColors = [
        this.colors.neonBlue,
        this.colors.neonPink,
        this.colors.neonPurple,
        this.colors.neonGreen
      ];
      
      const emissiveColor = genericColors[Math.floor(Math.random() * genericColors.length)];
      material.emissive.lerp(emissiveColor, 0.3);
      material.emissiveIntensity = 0.5;
      
      // Add to animated materials with subtle animation
      this.animatedMaterials.push({
        material: material,
        position: [object.position.x, object.position.y, object.position.z],
        phase: Math.random() * Math.PI * 2,
        baseIntensity: 0.5,
        color: emissiveColor.clone()
      });
    }
  }

  /**
   * Process an entire model and enhance all materials
   * 
   * @param {THREE.Object3D} model - The model to enhance
   * @returns {Object} Enhanced materials and animation data
   */
  enhanceModel(model) {
    // Reset lists
    this.processedMaterials = new Set();
    this.animatedMaterials = [];
    
    // Process all meshes in the model
    model.traverse((object) => {
      if (object.isMesh && object.material) {
        // Determine material type based on object characteristics
        const materialType = this.determineMaterialType(object);
        
        // Store original material if not already done
        if (!object.userData.originalMaterial) {
          object.userData.originalMaterial = object.material;
        }
        
        // Handle arrays of materials
        if (Array.isArray(object.material)) {
          // Process each material in the array
          object.material = object.material.map((mat) => {
            return this.enhanceMaterial(mat, materialType, object);
          });
        } else {
          // Process single material
          object.material = this.enhanceMaterial(object.material, materialType, object);
        }
      }
    });
    
    return {
      model,
      animatedMaterials: this.animatedMaterials
    };
  }

  /**
   * Add environment maps to all materials in a model
   * 
   * @param {THREE.Object3D} model - The model to enhance
   * @param {THREE.CubeTexture} envMap - Environment map to apply
   */
  applyEnvironmentMap(model, envMap) {
    if (!envMap) return;
    
    model.traverse((object) => {
      if (object.isMesh && object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            material.envMap = envMap;
            material.envMapIntensity = 0.3;
            material.needsUpdate = true;
          });
        } else {
          object.material.envMap = envMap;
          object.material.envMapIntensity = 0.3;
          object.material.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Update animations for all tracked materials
   * 
   * @param {number} time - Current time in seconds
   * @param {boolean} forceContinuousAnimation - Whether to force continuous animation
   * @returns {boolean} True if any materials were updated
   */
  updateAnimations(time, forceContinuousAnimation = false) {
    if (this.animatedMaterials.length === 0) return false;
    
    let anyChanges = false;
    
    // Process all animated materials
    this.animatedMaterials.forEach((item) => {
      if (!item || !item.material) return;
      
      let pulse = 1.0;
      
      // Different animation patterns based on material type
      if (item.isNeon) {
        // Neon signs get more dramatic pulsing with occasional flicker
        const mainPulse = Math.sin(time * 1.5 + item.phase) * 0.3 + 0.9;
        const flicker = Math.random() > 0.8 ? Math.random() * 0.4 + 0.8 : 1.0;
        pulse = item.baseIntensity * mainPulse * flicker;
      } else if (item.isHologram) {
        // Holograms get a glitchy, interference pattern
        const noise = Math.random() > 0.95 ? 0.5 : 1.0;
        const wave = Math.sin(time * 3.0 + item.phase) * 0.2 + 0.8;
        pulse = item.baseIntensity * wave * noise;
      } else if (item.isVehicle) {
        // Vehicles get a smoother pulsing
        pulse = item.baseIntensity * (Math.sin(time * 1.2 + item.phase) * 0.2 + 0.9);
      } else if (item.isBillboard) {
        // Billboards get a faster pulsing
        pulse = item.baseIntensity * (Math.sin(time * 2.0 + item.phase) * 0.3 + 0.8);
      } else {
        // Default subtle pulsing for windows and other elements
        pulse = item.baseIntensity * (Math.sin(time * 2.5 + item.phase) * 0.2 + 0.9);
      }
      
      // Only update if the change is significant or forced
      if (forceContinuousAnimation || Math.abs(item.material.emissiveIntensity - pulse) > 0.05) {
        item.material.emissiveIntensity = pulse;
        anyChanges = true;
      }
    });
    
    return anyChanges;
  }
}

export default CyberpunkEnhancer;