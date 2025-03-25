import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Creates animated vehicles to fly through the cyberpunk city
 */
export const FlyingVehicles = ({ count = 10, speed = 1.0 }) => {
  const vehiclesRef = useRef();
  const { scene } = useThree();
  const vehiclesData = useRef([]);
  
  // Generate vehicles on component mount
  useEffect(() => {
    // Create container group
    const container = new THREE.Group();
    vehiclesRef.current = container;
    scene.add(container);
    
    // Clear any existing vehicles
    vehiclesData.current = [];
    
    // Vehicle colors
    const colors = [
      new THREE.Color('#00FFFF'), // Cyan
      new THREE.Color('#FF10F0'), // Pink
      new THREE.Color('#39FF14'), // Green
      new THREE.Color('#FFFF00')  // Yellow
    ];
    
    // Create vehicles
    for (let i = 0; i < count; i++) {
      // Determine if this is a drone or flying car
      const isDrone = Math.random() > 0.7;
      
      // Create vehicle mesh
      const vehicleMesh = isDrone 
        ? new THREE.Mesh(
            new THREE.ConeGeometry(0.5, 1.5, 4),
            new THREE.MeshStandardMaterial({
              color: 0x333333,
              emissive: colors[Math.floor(Math.random() * colors.length)],
              emissiveIntensity: 1.5,
              metalness: 0.8,
              roughness: 0.2
            })
          )
        : new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.6, 1),
            new THREE.MeshStandardMaterial({
              color: 0x333333,
              emissive: colors[Math.floor(Math.random() * colors.length)],
              emissiveIntensity: 1.5,
              metalness: 0.8,
              roughness: 0.2
            })
          );
      
      // Generate random path data
      const radius = 70 + Math.random() * 80; // Distance from center
      const height = 20 + Math.random() * 80; // Height
      const speed = 0.5 + Math.random() * 1.5; // Movement speed
      const startAngle = Math.random() * Math.PI * 2; // Starting position
      const direction = Math.random() > 0.5 ? 1 : -1; // Direction of travel
      
      // Add lights to vehicles
      const frontLight = new THREE.PointLight(
        vehicleMesh.material.emissive,
        0.5,
        10
      );
      frontLight.position.set(0, 0, 0.6);
      vehicleMesh.add(frontLight);
      
      // Add trail
      const trail = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, isDrone ? 2 : 4),
        new THREE.MeshBasicMaterial({
          color: vehicleMesh.material.emissive,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        })
      );
      
      trail.position.set(0, 0, -0.8);
      trail.rotation.x = Math.PI / 2;
      vehicleMesh.add(trail);
      
      // Add to container
      container.add(vehicleMesh);
      
      // Register with spatial manager as a dynamic object
      if (window.spatialManager?.initialized) {
        window.spatialManager.registerObject(vehicleMesh, {
          important: false,
          dynamic: true, // Mark as dynamically moving object
          lod: true,     // LOD can still be applied
          cullDistance: 300 // Culling distance appropriate for vehicles
        });
      }
      
      // Store reference data
      vehiclesData.current.push({
        mesh: vehicleMesh,
        trail: trail,
        radius,
        height,
        speed,
        angle: startAngle,
        direction,
        isDrone
      });
    }
    
    return () => {
      // Clean up
      vehiclesData.current.forEach(vehicle => {
        if (window.spatialManager?.initialized) {
          window.spatialManager.unregisterObject(vehicle.mesh);
        }
      });
      scene.remove(container);
    };
  }, [count, scene]);
  
  // Animate vehicles
  useFrame((state, delta) => {
    if (!vehiclesRef.current) return;
    
    // Update all vehicles
    vehiclesData.current.forEach(vehicle => {
      // Update angle
      vehicle.angle += delta * vehicle.speed * speed * vehicle.direction;
      
      // Calculate new position
      const x = Math.cos(vehicle.angle) * vehicle.radius;
      const z = Math.sin(vehicle.angle) * vehicle.radius;
      vehicle.mesh.position.set(x, vehicle.height, z);
      
      // Update rotation to face direction of travel
      const targetRotation = Math.atan2(
        Math.sin(vehicle.angle + Math.PI/2) * vehicle.direction,
        Math.cos(vehicle.angle + Math.PI/2) * vehicle.direction
      );
      vehicle.mesh.rotation.y = targetRotation;
      
      // Add some bobbing motion
      if (vehicle.isDrone) {
        vehicle.mesh.position.y += Math.sin(state.clock.elapsedTime * 2 + vehicle.angle) * 0.2;
      }
      
      // Add pulsating to the emissive intensity
      if (vehicle.mesh.material) {
        const pulseIntensity = 1.2 + Math.sin(state.clock.elapsedTime * 3 + vehicle.angle * 2) * 0.3;
        vehicle.mesh.material.emissiveIntensity = pulseIntensity;
      }
      
      // Animate trail opacity
      if (vehicle.trail.material) {
        vehicle.trail.material.opacity = 0.4 + Math.sin(state.clock.elapsedTime * 4 + vehicle.angle) * 0.3;
      }
    });
  });
  
  return null;
};

/**
 * Creates scattered rain effects for a cyberpunk mood
 */
export const CyberpunkRain = ({ intensity = 1.0 }) => {
  const rainRef = useRef();
  const rainDropsData = useRef([]);
  const { scene, camera } = useThree();
  
  // Maximum raindrops at a time
  const maxRaindrops = 300 * intensity;
  
  // Create raindrop particle system
  useEffect(() => {
    // Create container
    const container = new THREE.Group();
    rainRef.current = container;
    scene.add(container);
    
    // Create raindrop material
    const rainMaterial = new THREE.MeshBasicMaterial({
      color: 0x88CCFF,
      transparent: true,
      opacity: 0.3
    });
    
    // Create raindrop geometry - elongated to simulate motion blur
    const rainGeometry = new THREE.BoxGeometry(0.05, 0.8, 0.05);
    
    // Initialize raindrops
    for (let i = 0; i < maxRaindrops; i++) {
      // Create raindrop mesh
      const raindrop = new THREE.Mesh(rainGeometry, rainMaterial);
      
      // Position randomly in a cylinder around the camera
      resetRaindrop(raindrop, camera.position, true);
      
      // Add to container
      container.add(raindrop);
      
      // Store reference data with random speed
      rainDropsData.current.push({
        mesh: raindrop,
        speed: 15 + Math.random() * 15, // Units per second
        horizontalSpeed: (Math.random() - 0.5) * 2 // Some sideways motion for wind effect
      });
    }
    
    // Register the rain container with SpatialManager for optimization
    if (window.spatialManager?.initialized) {
      window.spatialManager.registerObject(container, {
        important: false, 
        dynamic: true,   // Rain moves around with camera
        lod: true,
        cullDistance: Infinity // Don't cull rain completely
      });
    }
    
    return () => {
      // Clean up
      if (window.spatialManager?.initialized) {
        window.spatialManager.unregisterObject(container);
      }
      scene.remove(container);
    };
  }, [scene, camera, maxRaindrops, intensity]);
  
  // Reset a raindrop to a new position when it goes out of bounds
  const resetRaindrop = (raindrop, cameraPosition, initial = false) => {
    // Radius around camera
    const radius = 60;
    
    // Random angle
    const angle = Math.random() * Math.PI * 2;
    
    // Random distance from camera
    const distance = Math.random() * radius;
    
    // Height above camera
    const heightOffset = initial 
      ? Math.random() * 60 // Initial distribution across all heights
      : 30 + Math.random() * 10; // New raindrops spawn above camera
    
    // Set position
    raindrop.position.set(
      cameraPosition.x + Math.cos(angle) * distance,
      cameraPosition.y + heightOffset,
      cameraPosition.z + Math.sin(angle) * distance
    );
    
    // Random slight tilt
    raindrop.rotation.set(
      0.1 * (Math.random() - 0.5),
      0,
      0.1 * (Math.random() - 0.5)
    );
  };
  
  // Animate raindrops
  useFrame((state, delta) => {
    if (!rainRef.current) return;
    
    // Current camera position
    const cameraPosition = camera.position.clone();
    
    // Update all raindrops
    rainDropsData.current.forEach(raindrop => {
      // Move down based on speed
      raindrop.mesh.position.y -= raindrop.speed * delta;
      
      // Add horizontal movement for wind effect
      raindrop.mesh.position.x += raindrop.horizontalSpeed * delta;
      
      // If raindrop is below ground or too far from camera, reset it
      if (raindrop.mesh.position.y < -10 || 
          raindrop.mesh.position.distanceTo(cameraPosition) > 100) {
        resetRaindrop(raindrop.mesh, cameraPosition);
      }
    });
  });
  
  return null;
};

/**
 * Creates animated neon billboards with text that changes over time
 */
export const AnimatedBillboards = ({ count = 5 }) => {
  const billboardsRef = useRef();
  const { scene } = useThree();
  const billboardsData = useRef([]);
  
  // Sample cyberpunk-themed advertisements
  const adTexts = [
    'NEURAL IMPLANTS',
    'CYBER ENHANCEMENTS',
    'MEMORY BOOST',
    'SYNTHETIC ORGANS',
    'VR ESCAPE',
    'AI ASSISTANTS',
    'BIOHACKING',
    'QUANTUM TECH',
    'NANOBOT REPAIR',
    'GENETIC MODS',
    'CRYPTO EXCHANGE',
    'SYNTH FOOD',
    'DRONE DELIVERY',
    'DIGITAL DREAMS',
    'MIND UPLOAD'
  ];
  
  // Slogans that can appear with advertisements
  const slogans = [
    'THE FUTURE IS NOW',
    'UPGRADE YOURSELF',
    'BEYOND HUMAN',
    'THINK BETTER',
    'LIVE ENHANCED',
    'FEEL THE POWER',
    'BE MORE',
    'EVOLVE TODAY',
    'NEXT LEVEL',
    'NO LIMITS'
  ];
  
  // Generate billboards on component mount
  useEffect(() => {
    // Create container group
    const container = new THREE.Group();
    billboardsRef.current = container;
    scene.add(container);
    
    // Clear any existing billboards
    billboardsData.current = [];
    
    // Billboard colors
    const colors = [
      new THREE.Color('#00FFFF'), // Cyan
      new THREE.Color('#FF10F0'), // Pink
      new THREE.Color('#39FF14'), // Green
      new THREE.Color('#FFFF00'), // Yellow
      new THREE.Color('#B026FF')  // Purple
    ];
    
    // Create billboards
    for (let i = 0; i < count; i++) {
      // Choose random color
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      // Choose random position at the top of a building
      const radius = 30 + Math.random() * 70;
      const angle = Math.random() * Math.PI * 2;
      const height = 20 + Math.random() * 40;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      // Determine billboard size
      const width = 5 + Math.random() * 8;
      const height3d = 2 + Math.random() * 3;
      
      // Create billboard backing
      const billboard = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height3d),
        new THREE.MeshStandardMaterial({
          color: 0x111111,
          emissive: color,
          emissiveIntensity: 1.0,
          roughness: 0.4,
          metalness: 0.6
        })
      );
      
      // Position the billboard
      billboard.position.set(x, height, z);
      
      // Face toward center
      billboard.lookAt(0, height, 0);
      
      // Add to container
      container.add(billboard);
      
      // Register billboard with SpatialManager
      if (window.spatialManager?.initialized) {
        window.spatialManager.registerObject(billboard, {
          important: false,
          lod: true,
          cullDistance: 400 // Billboards should be visible from far away
        });
      }
      
      // Create canvas for dynamic text
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      
      // Create material with the texture
      const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.FrontSide
      });
      
      // Create text plane slightly in front of billboard
      const textPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.9, height3d * 0.9),
        textMaterial
      );
      
      // Position slightly in front
      textPlane.position.copy(billboard.position);
      textPlane.rotation.copy(billboard.rotation);
      textPlane.translateZ(0.05); // Move forward slightly
      
      // Add to container
      container.add(textPlane);
      
      // Add glow
      const glowIntensity = 2;
      const glowLight = new THREE.PointLight(color, glowIntensity, 10);
      glowLight.position.copy(billboard.position);
      glowLight.position.z += 2; // Move light forward for better glow
      container.add(glowLight);
      
      // Select content
      const adText = adTexts[Math.floor(Math.random() * adTexts.length)];
      const slogan = Math.random() > 0.5 ? slogans[Math.floor(Math.random() * slogans.length)] : null;
      
      // Store reference data
      billboardsData.current.push({
        billboard,
        textPlane,
        texture,
        canvas,
        ctx,
        color: color.getStyle(),
        adText,
        slogan,
        changeTime: 10 + Math.random() * 10, // Seconds between content changes
        lastChangeTime: 0,
        glowLight
      });
    }
    
    return () => {
      // Clean up
      if (window.spatialManager?.initialized) {
        billboardsData.current.forEach(data => {
          window.spatialManager.unregisterObject(data.billboard);
          window.spatialManager.unregisterObject(data.textPlane);
        });
      }
      scene.remove(container);
    };
  }, [count, scene, adTexts, slogans]);
  
  // Draw text to canvas
  const updateBillboardText = (billboard, time) => {
    const { ctx, canvas, color, adText, slogan } = billboard;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill with darker version of glow color for background
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
    
    // Add noise/static effect
    if (Math.random() > 0.95) {
      // Occasional glitch effect
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const width = Math.random() * 100 + 50;
        const height = Math.random() * 10 + 2;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, width, height);
      }
      ctx.globalAlpha = 1.0;
    }
    
    // Draw main advertisement text
    ctx.fillStyle = color;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add glow effect to text
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    
    // Handle text wrapping if needed
    if (adText.length > 10) {
      ctx.fillText(adText, canvas.width / 2, canvas.height / 2 - 30);
    } else {
      ctx.fillText(adText, canvas.width / 2, canvas.height / 2);
    }
    
    // Draw slogan if present
    if (slogan) {
      ctx.font = '24px Arial';
      ctx.fillText(slogan, canvas.width / 2, canvas.height / 2 + 50);
    }
    
    // Reset shadow
    ctx.shadowBlur = 0;
    
    // Add scan line effect
    const scanLineY = (time * 100) % canvas.height;
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, scanLineY, canvas.width, 2);
    ctx.globalAlpha = 1.0;
    
    // Update texture
    billboard.texture.needsUpdate = true;
  };
  
  // Animate billboards
  useFrame((state, delta) => {
    if (!billboardsRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Update all billboards
    billboardsData.current.forEach(billboard => {
      // Check if it's time to update content
      if (time - billboard.lastChangeTime > billboard.changeTime) {
        // Update advertisement text
        billboard.adText = adTexts[Math.floor(Math.random() * adTexts.length)];
        
        // 50% chance to change slogan
        if (Math.random() > 0.5) {
          billboard.slogan = Math.random() > 0.3 ? 
            slogans[Math.floor(Math.random() * slogans.length)] : null;
        }
        
        billboard.lastChangeTime = time;
      }
      
      // Update billboard animation
      updateBillboardText(billboard, time);
      
      // Animate glow intensity
      if (billboard.glowLight) {
        billboard.glowLight.intensity = 1.5 + Math.sin(time * 2 + Math.random()) * 0.5;
      }
      
      // Add subtle movement to the billboard
      if (billboard.billboard) {
        billboard.billboard.rotation.z = Math.sin(time * 0.5) * 0.01;
        billboard.textPlane.rotation.z = billboard.billboard.rotation.z;
      }
      
      // Update emissive intensity
      if (billboard.billboard.material) {
        billboard.billboard.material.emissiveIntensity = 1.0 + Math.sin(time * 2) * 0.3;
      }
    });
  });
  
  return null;
};

/**
 * Creates atmospheric fog that changes color subtly over time
 */
export const AtmosphericFog = () => {
  const { scene } = useThree();
  
  // Base fog colors
  const fogColors = {
    nightBlue: new THREE.Color('#050023'),
    purple: new THREE.Color('#0F0035'),
    cyan: new THREE.Color('#002038')
  };
  
  // Set initial fog
  useEffect(() => {
    // Create fog
    scene.fog = new THREE.FogExp2(fogColors.nightBlue, 0.0012);
    
    return () => {
      // Remove fog on unmount
      scene.fog = null;
    };
  }, [scene]);
  
  // Animate fog color
  useFrame((state) => {
    if (!scene.fog) return;
    
    const time = state.clock.elapsedTime;
    
    // Create a cycling animation between colors
    const t1 = (Math.sin(time * 0.05) + 1) * 0.5; // 0-1 cycling value (very slow)
    const t2 = (Math.sin(time * 0.07 + 2) + 1) * 0.5; // 0-1 cycling value (different phase)
    
    // Blend between nightBlue and purple based on t1
    const color1 = fogColors.nightBlue.clone().lerp(fogColors.purple, t1);
    
    // Blend result with cyan based on t2
    const finalColor = color1.lerp(fogColors.cyan, t2 * 0.3); // Only blend 30% to keep it subtle
    
    // Apply to fog
    scene.fog.color = finalColor;
  });
  
  return null;
};

/**
 * Creates a complete set of cyberpunk environmental effects
 */
export const CyberpunkEffects = ({ 
  rain = true,
  rainIntensity = 0.7,
  vehicles = true,
  vehicleCount = 15,
  billboards = true,
  billboardCount = 8,
  atmosphericFog = true
}) => {
  return (
    <>
      {vehicles && <FlyingVehicles count={vehicleCount} />}
      {rain && <CyberpunkRain intensity={rainIntensity} />}
      {billboards && <AnimatedBillboards count={billboardCount} />}
      {atmosphericFog && <AtmosphericFog />}
    </>
  );
};

export default CyberpunkEffects;