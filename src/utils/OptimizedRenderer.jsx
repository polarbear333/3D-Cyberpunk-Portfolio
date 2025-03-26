import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/**
 * Optimized rendering system with bloom and anti-aliasing
 */
const OptimizedRenderer = ({ 
  bloomStrength = 0.7, 
  bloomRadius = 1.75, 
  bloomThreshold = 0,  // Set to 0 for pseudo-volumetric lighting effect
  adaptiveResolution = true 
}) => {
  const { gl, scene, camera, size, invalidate } = useThree();
  const composerRef = useRef();
  
  // Initialize composer and passes
  useEffect(() => {
    // Create the composer
    composerRef.current = new EffectComposer(gl);
    composerRef.current.setSize(size.width, size.height);
    
    // Main scene render pass
    const renderPass = new RenderPass(scene, camera);
    composerRef.current.addPass(renderPass);
    
    // Add bloom pass - similar to index.js implementation
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    composerRef.current.addPass(bloomPass);
    
    // Anti-aliasing pass
    const fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = gl.getPixelRatio();
    fxaaPass.material.uniforms.resolution.value.x = 1 / (size.width * pixelRatio);
    fxaaPass.material.uniforms.resolution.value.y = 1 / (size.height * pixelRatio);
    composerRef.current.addPass(fxaaPass);
    
    // Clean up
    return () => {
      composerRef.current.dispose();
    };
  }, [gl, scene, camera, size, bloomStrength, bloomRadius, bloomThreshold]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!composerRef.current) return;
      
      composerRef.current.setSize(size.width, size.height);
      
      // Update FXAA resolution
      const passes = composerRef.current.passes;
      const fxaaPass = passes.find(pass => 
        pass.material && 
        pass.material.uniforms && 
        pass.material.uniforms.resolution
      );
      
      if (fxaaPass) {
        const pixelRatio = gl.getPixelRatio();
        fxaaPass.material.uniforms.resolution.value.x = 1 / (size.width * pixelRatio);
        fxaaPass.material.uniforms.resolution.value.y = 1 / (size.height * pixelRatio);
      }
      
      // Trigger a render
      invalidate();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size, gl, invalidate]);
  
  // Render loop using requestAnimationFrame via useFrame
  useFrame(() => {
    if (!composerRef.current) return;
    composerRef.current.render();
  });
  
  // No visible output in the scene graph
  return null;
};

export default OptimizedRenderer;