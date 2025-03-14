import { MathUtils, Vector3, Color } from 'three';

/**
 * Creates procedural cyberpunk building configurations
 */
class BuildingGenerator {
  constructor(options = {}) {
    this.options = {
      minWidth: options.minWidth || 5,
      maxWidth: options.maxWidth || 15,
      minDepth: options.minDepth || 5,
      maxDepth: options.maxDepth || 15,
      minHeight: options.minHeight || 10,
      maxHeight: options.maxHeight || 40,
      citySize: options.citySize || 100,
      centerClearRadius: options.centerClearRadius || 15,
      ...options
    };
    
    this.neonColors = [
      '#FF00FF', // Magenta
      '#00FFFF', // Cyan
      '#FF1493', // Deep Pink
      '#7B68EE', // Medium Slate Blue
      '#1E90FF', // Dodger Blue
      '#39FF14', // Neon Green
      '#FFFF00', // Yellow
    ];
  }
  
  /**
   * Generate a single building configuration
   * 
   * @param {Object} overrides - Override default building parameters
   * @returns {Object} Building configuration
   */
  generateBuilding(overrides = {}) {
    // Generate random position
    let x, z;
    do {
      x = MathUtils.randFloatSpread(this.options.citySize);
      z = MathUtils.randFloatSpread(this.options.citySize);
    } while (Math.sqrt(x * x + z * z) < this.options.centerClearRadius);
    
    // Basic building properties
    const width = overrides.width || MathUtils.randFloat(this.options.minWidth, this.options.maxWidth);
    const depth = overrides.depth || MathUtils.randFloat(this.options.minDepth, this.options.maxDepth);
    const height = overrides.height || MathUtils.randFloat(this.options.minHeight, this.options.maxHeight);
    
    // Select colors and features
    const emissiveColor = overrides.emissiveColor || 
                          (Math.random() > 0.2 ? this.neonColors[Math.floor(Math.random() * this.neonColors.length)] : null);
    const hasAntenna = overrides.hasAntenna !== undefined ? overrides.hasAntenna : Math.random() > 0.7;
    const hasLogo = overrides.hasLogo !== undefined ? overrides.hasLogo : Math.random() > 0.6;
    const hasBillboard = overrides.hasBillboard !== undefined ? overrides.hasBillboard : Math.random() > 0.8;
    
    // Building type/style
    const buildingTypes = ['corporate', 'residential', 'industrial', 'commercial', 'mixedUse'];
    const buildingType = overrides.type || buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
    
    // Generate windows configuration
    const windowRows = Math.floor(height / 2);
    const windowCols = Math.floor(width) + 1;
    
    // Generate window array with random lighting
    const windows = Array.from({ length: windowRows }).map((_, row) => {
      return Array.from({ length: windowCols }).map((_, col) => {
        return {
          lit: Math.random() > 0.3,
          color: this.getRandomWindowColor(buildingType),
          flicker: Math.random() > 0.8,
        };
      });
    });
    
    // Building features based on type
    let features = [];
    
    switch (buildingType) {
      case 'corporate':
        if (hasLogo) {
          features.push({
            type: 'logo',
            position: [0, height - 2, depth / 2 + 0.1],
            size: Math.min(width, depth) * 0.4,
            color: emissiveColor || '#00FFFF',
            text: this.generateLogoText()
          });
        }
        break;
        
      case 'commercial':
        if (hasBillboard) {
          features.push({
            type: 'billboard',
            position: [0, height * 0.7, depth / 2 + 0.1],
            width: width * 0.8,
            height: height * 0.2,
            color: emissiveColor || '#FF00FF',
            text: this.generateAdvertText()
          });
        }
        break;
        
      case 'industrial':
        features.push({
          type: 'pipes',
          count: Math.floor(Math.random() * 5) + 2
        });
        
        features.push({
          type: 'smokestacks',
          count: Math.floor(Math.random() * 3) + 1
        });
        break;
        
      case 'residential':
        features.push({
          type: 'balconies',
          rows: Math.floor(windowRows * 0.7),
          cols: Math.floor(windowCols * 0.5)
        });
        break;
    }
    
    // Add antenna if needed
    if (hasAntenna) {
      features.push({
        type: 'antenna',
        height: MathUtils.randFloat(2, 6),
        position: [MathUtils.randFloatSpread(width * 0.3), height, MathUtils.randFloatSpread(depth * 0.3)],
        color: emissiveColor || '#FF0000'
      });
    }
    
    // Return complete building configuration
    return {
      position: [x, 0, z],
      width,
      depth,
      height,
      emissiveColor,
      hasAntenna,
      buildingType,
      windows,
      features
    };
  }
  
  /**
   * Generate multiple buildings
   * 
   * @param {number} count - Number of buildings to generate
   * @returns {Array} Array of building configurations
   */
  generateBuildings(count) {
    const buildings = [];
    
    for (let i = 0; i < count; i++) {
      buildings.push(this.generateBuilding());
    }
    
    return buildings;
  }
  
  /**
   * Generate random window color based on building type
   * 
   * @param {string} buildingType - Type of building
   * @returns {string} Color in hex format
   */
  getRandomWindowColor(buildingType) {
    switch (buildingType) {
      case 'corporate':
        return Math.random() > 0.7 ? '#00FFFF' : '#FFFFFF';
      case 'residential':
        const colors = ['#FFFF99', '#FFFFFF', '#FF9900', '#FF00FF'];
        return colors[Math.floor(Math.random() * colors.length)];
      case 'industrial':
        return Math.random() > 0.5 ? '#FFFF00' : '#FF0000';
      case 'commercial':
        return Math.random() > 0.6 ? '#FF00FF' : '#00FFFF';
      default:
        return '#FFFFFF';
    }
  }
  
  /**
   * Generate random cyberpunk corporation name for logos
   * 
   * @returns {string} Corporation name
   */
  generateLogoText() {
    const prefixes = ['Cyber', 'Neuro', 'Synth', 'Digi', 'Quantum', 'Tech', 'Data', 'Nexus', 'Omni', 'Meta'];
    const suffixes = ['Corp', 'Tek', 'Sys', 'Net', 'Ware', 'Soft', 'Dyne', 'Gen', 'Link', 'Tronics'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    return `${prefix}${suffix}`;
  }
  
  /**
   * Generate random advertisement text for billboards
   * 
   * @returns {string} Advertisement text
   */
  generateAdvertText() {
    const products = ['Neural Implants', 'Cybernetic Enhancements', 'Memory Chips', 'Synthetic Organs', 'VR Experience', 'AI Assistants'];
    const slogans = ['The Future Is Now', 'Upgrade Yourself', 'Beyond Human', 'Think Better', 'Live Enhanced', 'Feel The Power'];
    
    const product = products[Math.floor(Math.random() * products.length)];
    const slogan = slogans[Math.floor(Math.random() * slogans.length)];
    
    return Math.random() > 0.5 ? product : slogan;
  }
}

export default BuildingGenerator;