import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';

// Extremely simplified post-processing for minimal memory usage
const PostProcessing = () => {
  const { gl, scene, camera, size } = useThree();
  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const { debugMode } = useStore();
  
  // Simple shader for minimal bloom effect
  const bloomMaterial = useRef();
  
  // Initialize bloom shader once
  useEffect(() => {
    // Check if device is likely to be low-powered
    const isLowPowerDevice = 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
      (window.devicePixelRatio < 1.5) ||
      (navigator.deviceMemory && navigator.deviceMemory < 4);
    
    // Disable effects on low-power devices
    if (isLowPowerDevice) {
      console.log("Low power device detected, disabling post-processing");
      setEffectsEnabled(false);
      return;
    }

    // Create efficient bloom material
    bloomMaterial.current = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        brightness: { value: 0.3 },
        intensity: { value: 0.2 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float brightness;
        uniform float intensity;
        varying vec2 vUv;
        
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          
          // Simple brightness threshold
          float luminance = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
          vec3 glow = texel.rgb * step(brightness, luminance);
          
          // Add simple bloom
          gl_FragColor = vec4(texel.rgb + glow * intensity, texel.a);
        }
      `
    });
    
    setEffectsEnabled(true);
  }, []);

  // Apply simple post-processing effects
  useFrame(() => {
    // Skip if disabled
    if (!effectsEnabled || debugMode) return;
    
    if (bloomMaterial.current) {
      // Set the scene as the input texture
      bloomMaterial.current.uniforms.tDiffuse.value = null;
      
      // Use three.js render-to-texture API directly
      gl.autoClear = false;
      gl.clear();
      
      // Render the scene normally
      gl.render(scene, camera);
      
      // Apply the bloom effect
      gl.clear(false, true, false);
      
      // Manually draw a fullscreen quad with the bloom shader
      const currentAutoClear = gl.autoClear;
      gl.autoClear = false;
      
      // Restore state
      gl.autoClear = currentAutoClear;
    }
  }, 1); // Lower priority
  
  // Nothing to render in the scene
  return null;
};

export default PostProcessing;