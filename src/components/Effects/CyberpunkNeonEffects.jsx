import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { KernelSize } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';

/**
 * Advanced neon glow effects for cyberpunk aesthetic
 * Provides bloom, chromatic aberration, and other visual enhancements
 */
const CyberpunkNeonEffects = ({
  enableGlow = true,
  enableBloom = true,
  bloomStrength = 1.0,
  bloomRadius = 0.5,
  bloomThreshold = 0.2,
  glowIntensity = 1.0,
  enableNoise = true,
  enableVignette = true,
  enableChromaticAberration = true
}) => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const { debugMode } = useStore();
  
  // Get current device pixel ratio with a safety cap for performance
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  
  // Dynamic quality adjustment based on screen size
  const [quality, setQuality] = useState('high');
  
  // Adjust quality settings based on screen size for performance
  useEffect(() => {
    // Determine quality based on screen dimensions and pixel ratio
    const totalPixels = size.width * size.height * pixelRatio;
    
    if (totalPixels > 4000000) {
      // High-end devices
      setQuality('high');
    } else if (totalPixels > 2000000) {
      // Mid-range devices
      setQuality('medium');
    } else {
      // Low-end devices
      setQuality('low');
    }
  }, [size, pixelRatio]);
  
  // Get quality-dependent settings
  const getQualitySettings = () => {
    switch (quality) {
      case 'high':
        return {
          bloomKernelSize: KernelSize.LARGE,
          noiseIntensity: 0.15,
          bloomResolution: 512
        };
      case 'medium':
        return {
          bloomKernelSize: KernelSize.MEDIUM,
          noiseIntensity: 0.12,
          bloomResolution: 256
        };
      default: // 'low'
        return {
          bloomKernelSize: KernelSize.SMALL,
          noiseIntensity: 0.1,
          bloomResolution: 128
        };
    }
  };
  
  // Get current quality settings
  const qualitySettings = getQualitySettings();
  
  // Store intensity value in a ref to modify it in useFrame
  const bloomIntensityRef = useRef(bloomStrength * glowIntensity);
  
  // Update bloom parameters over time for subtle animation
  useFrame((state) => {
    if (!enableGlow || !composerRef.current) return;
    
    // Add subtle oscillation to bloom intensity for a more dynamic effect
    const time = state.clock.getElapsedTime();
    
    // Calculate pulsing effect
    const pulseAmount = Math.sin(time * 0.5) * 0.1 + 1.0;
    bloomIntensityRef.current = bloomStrength * pulseAmount * glowIntensity;
  });
  
  if (!enableGlow) return null;
  
  return (
    <EffectComposer 
      ref={composerRef}
      enabled={enableGlow}
    >
      {enableBloom && (
        <Bloom 
          intensity={bloomIntensityRef.current}
          luminanceThreshold={bloomThreshold}
          luminanceSmoothing={0.9}
          kernelSize={qualitySettings.bloomKernelSize}
        />
      )}
      
      {enableChromaticAberration && (
        <ChromaticAberration
          offset={new THREE.Vector2(0.002, 0.002)}
          blendFunction={BlendFunction.NORMAL}
        />
      )}
      
      {enableNoise && (
        <Noise 
          intensity={qualitySettings.noiseIntensity}
          blendFunction={BlendFunction.OVERLAY}
        />
      )}
      
      {enableVignette && (
        <Vignette
          offset={0.3}
          darkness={0.7}
          blendFunction={BlendFunction.NORMAL}
        />
      )}
    </EffectComposer>
  );
};

export default CyberpunkNeonEffects;