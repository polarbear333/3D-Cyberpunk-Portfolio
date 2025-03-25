import React, { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/**
 * Optimized rendering system using stable shaders and performance optimizations
 */
const OptimizedRenderer = React.memo(({ 
  bloomStrength = 1.5, 
  bloomRadius = 0.75, 
  bloomThreshold = 0.2,
  adaptiveResolution = true 
}) => {
  const { gl, scene, camera, size, invalidate } = useThree();
  const composerRef = useRef();
  const bloomPassRef = useRef();
  
  // Performance tracking
  const performanceRef = useRef({
    fps: 60,
    frameTimeHistory: [],
    lastFrameTime: performance.now(),
    isMoving: false,
    resolutionScale: 1.0,
    drawCalls: 0
  });

  // Initialize composer and passes
  useEffect(() => {
    // Create the composer with proper pixel ratio
    const pixelRatio = Math.min(window.devicePixelRatio, 2) * performanceRef.current.resolutionScale;
    composerRef.current = new EffectComposer(gl);
    composerRef.current.setPixelRatio(pixelRatio);
    composerRef.current.setSize(size.width, size.height);
    
    // Main scene render pass
    const renderPass = new RenderPass(scene, camera);
    composerRef.current.addPass(renderPass);
    
    // Bloom pass
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    bloomPassRef.current = bloomPass;
    composerRef.current.addPass(bloomPass);
    
    // Anti-aliasing pass
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms.resolution.value.x = 1 / (size.width * pixelRatio);
    fxaaPass.material.uniforms.resolution.value.y = 1 / (size.height * pixelRatio);
    composerRef.current.addPass(fxaaPass);
    
    // Gamma correction pass for proper color rendering
    const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
    composerRef.current.addPass(gammaCorrectionPass);
    
    // Clean up
    return () => {
      composerRef.current.dispose();
      bloomPassRef.current = null;
    };
  }, [gl, scene, camera, size, bloomStrength, bloomRadius, bloomThreshold]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!composerRef.current) return;
      
      const pixelRatio = Math.min(window.devicePixelRatio, 2) * performanceRef.current.resolutionScale;
      composerRef.current.setSize(size.width, size.height);
      composerRef.current.setPixelRatio(pixelRatio);
      
      // Update FXAA resolution
      const passes = composerRef.current.passes;
      const fxaaPass = passes.find(pass => pass.material && pass.material.uniforms && pass.material.uniforms.resolution);
      
      if (fxaaPass) {
        fxaaPass.material.uniforms.resolution.value.x = 1 / (size.width * pixelRatio);
        fxaaPass.material.uniforms.resolution.value.y = 1 / (size.height * pixelRatio);
      }
      
      // Trigger a render
      invalidate();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size, invalidate]);
  
  // Update performance metrics
  const updatePerformance = useCallback(() => {
    const perf = performanceRef.current;
    const now = performance.now();
    const frameTime = now - perf.lastFrameTime;
    perf.lastFrameTime = now;
    
    // Calculate FPS
    perf.frameTimeHistory.push(frameTime);
    if (perf.frameTimeHistory.length > 60) {
      perf.frameTimeHistory.shift();
    }
    
    const avgFrameTime = perf.frameTimeHistory.reduce((a, b) => a + b, 0) / perf.frameTimeHistory.length;
    perf.fps = Math.round(1000 / avgFrameTime);
    
    // Adaptive resolution when moving
    if (adaptiveResolution && composerRef.current) {
      if (perf.fps < 30 && perf.resolutionScale > 0.5) {
        // Decrease resolution
        perf.resolutionScale = Math.max(0.5, perf.resolutionScale - 0.05);
        const pixelRatio = Math.min(window.devicePixelRatio, 2) * perf.resolutionScale;
        composerRef.current.setPixelRatio(pixelRatio);
      } else if (perf.fps > 55 && perf.resolutionScale < 0.9) {
        // Increase resolution
        perf.resolutionScale = Math.min(0.9, perf.resolutionScale + 0.05);
        const pixelRatio = Math.min(window.devicePixelRatio, 2) * perf.resolutionScale;
        composerRef.current.setPixelRatio(pixelRatio);
      }
    }
    
    // Get render stats
    perf.drawCalls = gl.info.render?.calls || 0;
    
    // Reset renderer stats
    if (gl.info && typeof gl.info.reset === 'function') {
      gl.info.reset();
    }
  }, [gl, adaptiveResolution]);
  
  // Update bloom intensity based on performance
  const updateBloom = useCallback(() => {
    if (!bloomPassRef.current) return;
    
    const perf = performanceRef.current;
    
    // Reduce bloom intensity during movement for better performance
    if (perf.isMoving) {
      bloomPassRef.current.strength = bloomStrength * 0.8;
    } else {
      bloomPassRef.current.strength = bloomStrength;
    }
  }, [bloomStrength]);
  
  // Update camera movement state
  const updateMovingState = useCallback((position) => {
    const perf = performanceRef.current;
    
    if (!perf.lastPosition) {
      perf.lastPosition = position.clone();
      return;
    }
    
    const distance = position.distanceTo(perf.lastPosition);
    perf.isMoving = distance > 0.01;
    perf.lastPosition = position.clone();
  }, []);
  
  // Render loop
  useFrame((state) => {
    if (!composerRef.current) return;
    
    // Update performance stats
    updatePerformance();
    
    // Update movement state from camera
    updateMovingState(camera.position);
    
    // Update bloom based on performance
    updateBloom();
    
    // Render with the composer
    composerRef.current.render();
  });
  
  // No visible output in the scene graph
  return null;
});

export default OptimizedRenderer;