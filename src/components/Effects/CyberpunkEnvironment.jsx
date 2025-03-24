import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Creates a procedural cyberpunk environment map for reflections
 */
const CyberpunkEnvironment = ({ intensity = 0.3 }) => {
  const { scene, gl } = useThree();
  const envMapRef = useRef();
  
  // Create and apply environment map on component mount
  useEffect(() => {
    // Generate a procedural cubemap texture
    const envMap = createProceduralCyberpunkEnvMap(gl);
    envMapRef.current = envMap;
    
    // Apply to scene
    if (envMap) {
      scene.environment = envMap;
      
      // Apply to all materials in the scene
      scene.traverse((object) => {
        if (object.isMesh && object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => {
              if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
                material.envMap = envMap;
                material.envMapIntensity = intensity;
                material.needsUpdate = true;
              }
            });
          } else if (object.material.isMeshStandardMaterial || object.material.isMeshPhysicalMaterial) {
            object.material.envMap = envMap;
            object.material.envMapIntensity = intensity;
            object.material.needsUpdate = true;
          }
        }
      });
    }
    
    return () => {
      // Clean up on unmount
      if (envMapRef.current) {
        // Reset scene environment
        if (scene.environment === envMapRef.current) {
          scene.environment = null;
        }
        
        // Reset material envMaps
        scene.traverse((object) => {
          if (object.isMesh && object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => {
                if (material.envMap === envMapRef.current) {
                  material.envMap = null;
                  material.needsUpdate = true;
                }
              });
            } else if (object.material.envMap === envMapRef.current) {
              object.material.envMap = null;
              object.material.needsUpdate = true;
            }
          }
        });
        
        // Dispose of texture
        envMapRef.current.dispose();
      }
    };
  }, [scene, gl, intensity]);
  
  // Return null as this is a utility component
  return null;
};

/**
 * Create a procedural environment map for a cyberpunk city
 * 
 * @param {WebGLRenderer} renderer - Three.js renderer 
 * @returns {THREE.CubeTexture} Environment map texture
 */
function createProceduralCyberpunkEnvMap(renderer) {
  if (!renderer) return null;
  
  // Size of each face of the cubemap
  const size = 256;
  
  // Create a cube camera to render the environment
  const renderTarget = new THREE.WebGLCubeRenderTarget(size, {
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter
  });
  
  // Create camera
  const cubeCamera = new THREE.CubeCamera(0.1, 1000, renderTarget);
  
  // Create scene for the cubemap
  const cubeScene = new THREE.Scene();
  
  // Define gradients for each face of the cube (right, left, top, bottom, front, back)
  const gradients = [
    { top: '#050038', bottom: '#5000FF' }, // Right face
    { top: '#050038', bottom: '#FF00FF' }, // Left face
    { top: '#000033', bottom: '#00AAFF' }, // Top face
    { top: '#120030', bottom: '#000000' }, // Bottom face
    { top: '#050038', bottom: '#FF10F0' }, // Front face
    { top: '#050038', bottom: '#00FFFF' }  // Back face
  ];
  
  // Create materials for the skybox
  const skyboxMaterials = gradients.map((gradient, index) => {
    // Create canvas for this face
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Create gradient
    const grd = ctx.createLinearGradient(0, 0, 0, size);
    grd.addColorStop(0, gradient.top);
    grd.addColorStop(1, gradient.bottom);
    
    // Fill background with gradient
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    
    // Add grid lines for cyberpunk aesthetic
    ctx.strokeStyle = index % 2 === 0 ? '#00FFFF44' : '#FF10F044';
    ctx.lineWidth = 1;
    
    // Draw grid
    const gridSize = 16;
    for (let i = 0; i <= size; i += size / gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }
    
    // Add random cyberpunk city skyline silhouette
    ctx.fillStyle = '#000000';
    
    // Only draw skyline on side faces (not top or bottom)
    if (index !== 2 && index !== 3) {
      // Draw city skyline at the bottom of the gradient
      const skylineHeight = size * 0.3; // 30% of height
      const baseY = size * 0.8; // Start at 80% down
      
      const buildingCount = 15;
      const buildingWidth = size / buildingCount;
      
      for (let i = 0; i < buildingCount; i++) {
        const x = i * buildingWidth;
        const maxHeight = skylineHeight * 0.9;
        const minHeight = skylineHeight * 0.3;
        const height = minHeight + Math.random() * (maxHeight - minHeight);
        
        ctx.fillRect(x, baseY - height, buildingWidth, height);
        
        // 30% chance to add a taller antenna/spire
        if (Math.random() > 0.7) {
          const spireWidth = buildingWidth * 0.2;
          const spireHeight = height * 0.5;
          const spireX = x + (buildingWidth - spireWidth) / 2;
          
          ctx.fillRect(spireX, baseY - height - spireHeight, spireWidth, spireHeight);
        }
      }
    }
    
    // Add random light dots for distant windows and neon signs
    ctx.fillStyle = index % 2 === 0 ? '#00FFFF' : '#FF10F0';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * size;
      const y = Math.random() * (size * 0.6) + (size * 0.4); // More dots in bottom half
      const dotSize = Math.random() * 2 + 1;
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    });
  });
  
  // Create skybox mesh
  const skyboxGeo = new THREE.BoxGeometry(900, 900, 900);
  const skybox = new THREE.Mesh(skyboxGeo, skyboxMaterials);
  cubeScene.add(skybox);
  
  // Add some distant lights to the environment
  const colors = [
    new THREE.Color('#FF10F0'), // Pink
    new THREE.Color('#00FFFF'), // Cyan
    new THREE.Color('#39FF14'), // Green
    new THREE.Color('#FFFF00'), // Yellow
    new THREE.Color('#B026FF')  // Purple
  ];
  
  // Add distant point lights around the environment
  for (let i = 0; i < 50; i++) {
    const phi = Math.random() * Math.PI * 2; // Full circle in xz plane
    const theta = Math.random() * Math.PI; // Half-circle in y
    
    const radius = 400 + Math.random() * 200; // Distance
    
    // Convert spherical to cartesian coordinates
    const x = radius * Math.sin(theta) * Math.cos(phi);
    const y = radius * Math.cos(theta);
    const z = radius * Math.sin(theta) * Math.sin(phi);
    
    // Create a small emissive sphere to act as a light source
    const lightMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5, 8, 8),
      new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        emissive: colors[Math.floor(Math.random() * colors.length)],
        emissiveIntensity: 2.0
      })
    );
    
    lightMesh.position.set(x, y, z);
    cubeScene.add(lightMesh);
  }
  
  // Render the cubemap
  cubeCamera.update(renderer, cubeScene);
  
  // Clean up
  skyboxMaterials.forEach(material => {
    if (material.map) {
      material.map.dispose();
    }
    material.dispose();
  });
  
  skyboxGeo.dispose();
  
  return renderTarget.texture;
}

/**
 * A simpler version that uses a predefined cubemap texture if available
 */
export const SimpleCyberpunkEnvironment = ({ intensity = 0.3 }) => {
  const { scene } = useThree();
  
  useEffect(() => {
    // Try to load predefined cubemap textures
    const loader = new THREE.CubeTextureLoader();
    
    // Use path to your cubemap textures if available
    const paths = [
      '/textures/cyberpunk/px.jpg', // positive x
      '/textures/cyberpunk/nx.jpg', // negative x
      '/textures/cyberpunk/py.jpg', // positive y
      '/textures/cyberpunk/ny.jpg', // negative y
      '/textures/cyberpunk/pz.jpg', // positive z
      '/textures/cyberpunk/nz.jpg'  // negative z
    ];
    
    let envMap = null;
    
    // Try to load the textures
    try {
      envMap = loader.load(paths, 
        () => console.log('Environment map loaded successfully'),
        undefined,
        (error) => console.error('Error loading environment map:', error)
      );
      
      if (envMap) {
        // Apply to scene
        scene.environment = envMap;
        
        // Apply to all materials
        scene.traverse((object) => {
          if (object.isMesh && object.material) {
            if (object.material.isMeshStandardMaterial || object.material.isMeshPhysicalMaterial) {
              object.material.envMap = envMap;
              object.material.envMapIntensity = intensity;
              object.material.needsUpdate = true;
            }
          }
        });
      }
    } catch (error) {
      console.error('Error setting up environment map:', error);
    }
    
    return () => {
      // Clean up
      if (envMap) {
        envMap.dispose();
      }
    };
  }, [scene, intensity]);
  
  return null;
};

export default CyberpunkEnvironment;