import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky } from '@react-three/drei';
import { useStore } from '../../state/useStore';

const CyberpunkEnvironment = ({ intensity = 1.0 }) => {
  const { scene } = useThree();
  const { assets } = useStore(); // Get assets from global store

  useEffect(() => {
    // Index.js-style environment configuration
    const environment = {
      name: 'night',
      sky: 'sky_night',
      fog: {
        color: 0x12122a,
        start: 0,
        end: 2700
      },
      sun: {
        color: 0x8b79ff,
        intensity: 0.1 * intensity,
        position: [1, 0.5, 0.25]
      },
      ambient: {
        color: 0x1b2c80,
        intensity: 0.5 * intensity
      }
    };

    // Index.js-style texture loading with fallback
    if (assets && assets.getTexture) {
      const skyTexture = assets.getTexture(environment.sky);
      if (skyTexture) {
        skyTexture.encoding = THREE.sRGBEncoding;
        scene.background = skyTexture;
      } else {
        console.warn('Sky texture not found in assets, using fallback');
        scene.background = new THREE.Color(environment.fog.color);
      }
    }

    // Set fog exactly like index.js
    scene.fog = new THREE.Fog(
      environment.fog.color,
      environment.fog.start,
      environment.fog.end
    );

    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, assets, intensity]);

  return (
    <group>
      {/* Matching index.js directional light configuration */}
      <directionalLight
        position={[1, 0.5, 0.25]}
        intensity={0.1 * intensity}
        color="#8b79ff"
        castShadow={false}
      />
      
      {/* Ambient light matching index.js values */}
      <ambientLight 
        intensity={0.5 * intensity}
        color="#1b2c80"
      />

      {/* Index.js-style accent lights */}
      <pointLight position={[10, 25, 10]} intensity={0.8} color="#00FFFF" distance={90} />
      <pointLight position={[-10, 20, -10]} intensity={0.7} color="#FF10F0" distance={90} />
    </group>
  );
};

export default CyberpunkEnvironment;