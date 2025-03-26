import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/**
 * Optimized rendering system with bloom and anti-aliasing
 * Uses RenderingManager for improved performance
 */
const OptimizedRenderer = ({ 
  bloomStrength = 0.7, 
  bloomRadius = 1.75, 
  bloomThreshold = 0,
  adaptiveResolution = true 
}) => {
  const { gl, scene, camera, size, invalidate } = useThree();
  const renderingManagerRef = useRef(null);
  const isInitializedRef = useRef(false);
  
  // Event-based rendering system
  useEffect(() => {
    // Store reference to renderer globally for debugging
    window.renderer = gl;
    
    // Create a custom rendering manager for better performance
    if (!renderingManagerRef.current) {
      // Check if we can use the utility class
      if (window.RenderingManager) {
        console.log('Using RenderingManager for optimized rendering');
        renderingManagerRef.current = new window.RenderingManager(gl, scene, camera);
        renderingManagerRef.current.adaptiveResolution = adaptiveResolution;
      } else {
        // Fallback to manual EffectComposer setup
        console.log('RenderingManager not found, using fallback EffectComposer');
        setupComposer();
      }
    }
    
    // Set up event listeners for render triggers
    const handleBeforeRender = () => {
      if (renderingManagerRef.current) {
        renderingManagerRef.current.render();
      } else if (window.composer) {
        window.composer.render();
      }
    };
    
    // Add event listeners to rendering pipeline
    gl.domElement.addEventListener('webglcontextrestored', setupComposer);
    scene.addEventListener('beforeRender', handleBeforeRender);
    
    // Clean up on component unmount
    return () => {
      gl.domElement.removeEventListener('webglcontextrestored', setupComposer);
      scene.removeEventListener('beforeRender', handleBeforeRender);
      
      if (renderingManagerRef.current) {
        renderingManagerRef.current.dispose();
        renderingManagerRef.current = null;
      }
      
      if (window.composer) {
        window.composer.dispose();
        window.composer = null;
      }
    };
  }, [gl, scene, camera]);
  
  // Handle size changes
  useEffect(() => {
    if (renderingManagerRef.current) {
      renderingManagerRef.current.resize();
    } else if (window.composer) {
      window.composer.setSize(size.width, size.height);
      
      // Update FXAA pass resolution
      const passes = window.composer.passes;
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
    }
  }, [size, gl]);
  
  // Handle props changes
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    if (renderingManagerRef.current) {
      // Update RenderingManager settings if available
      // This assumes RenderingManager has an updateSettings method
      if (renderingManagerRef.current.updateSettings) {
        renderingManagerRef.current.updateSettings({
          bloomStrength,
          bloomRadius,
          bloomThreshold,
          adaptiveResolution
        });
      }
    } else if (window.composer) {
      // Update bloom pass settings directly
      const bloomPass = window.composer.passes.find(pass => pass instanceof UnrealBloomPass);
      if (bloomPass) {
        bloomPass.strength = bloomStrength;
        bloomPass.radius = bloomRadius;
        bloomPass.threshold = bloomThreshold;
      }
    }
  }, [bloomStrength, bloomRadius, bloomThreshold, adaptiveResolution]);
  
  // Fallback setup function for when RenderingManager is not available
  const setupComposer = () => {
    // Create composer
    const composer = new EffectComposer(gl);
    composer.setSize(size.width, size.height);
    
    // Add render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Add bloom pass
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    composer.addPass(bloomPass);
    
    // Add FXAA pass
    const fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = gl.getPixelRatio();
    fxaaPass.material.uniforms.resolution.value.x = 1 / (size.width * pixelRatio);
    fxaaPass.material.uniforms.resolution.value.y = 1 / (size.height * pixelRatio);
    composer.addPass(fxaaPass);
    
    // Store globally
    window.composer = composer;
    isInitializedRef.current = true;
    
    return composer;
  };
  
  // This component doesn't render anything
  return null;
};

export default OptimizedRenderer;