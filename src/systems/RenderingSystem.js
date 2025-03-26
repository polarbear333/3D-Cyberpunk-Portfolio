import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

import { useEventSystem, EVENT_TYPES, PRIORITY } from './EventSystem';

// RenderingSystem component - manages the rendering pipeline
const RenderingSystem = ({ 
  enabled = true,
  bloomStrength = 0.7, 
  bloomRadius = 1.0, 
  bloomThreshold = 0,
  adaptiveResolution = true 
}) => {
  const { gl, scene, camera, size, invalidate } = useThree();
  const composerRef = useRef(null);
  const bloomPassRef = useRef(null);
  const fxaaPassRef = useRef(null);
  const lastRenderTimeRef = useRef(0);
  const framesPendingRef = useRef(0);
  const isMovingRef = useRef(false);
  const qualityLevelRef = useRef(1.0); // 1.0 = full quality, 0.5 = half res, etc.
  
  // Get event system
  const { 
    subscribe, 
    unsubscribe, 
    emit, 
    registerSystem,
    unregisterSystem 
  } = useEventSystem(state => ({
    subscribe: state.subscribe,
    unsubscribe: state.unsubscribe,
    emit: state.emit,
    registerSystem: state.registerSystem,
    unregisterSystem: state.unregisterSystem
  }));
  
  // Initialize compositor on mount
  useEffect(() => {
    if (!enabled) return;
    
    // Setup post-processing pipeline
    setupComposer();
    
    // Register with EventSystem
    const renderSystemId = 'system:rendering';
    const unregister = registerSystem(
      renderSystemId,
      performRender,
      PRIORITY.CRITICAL
    );
    
    // Event listeners
    const listenerId = 'rendering-events';
    const unsubscribeEvents = subscribe(listenerId, EVENT_TYPES.RENDER_NEEDED, () => {
      queueRender();
    });
    
    const cameraListenerId = 'rendering-camera';
    const unsubscribeCameraMove = subscribe(cameraListenerId, EVENT_TYPES.CAMERA_MOVE, (data) => {
      // Flag that we're moving - used for adaptive quality
      isMovingRef.current = true;
      // Reset the "not moving" timer
      if (moveTimerRef.current) {
        clearTimeout(moveTimerRef.current);
      }
      moveTimerRef.current = setTimeout(() => {
        isMovingRef.current = false;
        // Restore quality and request a high-quality render
        if (qualityLevelRef.current < 1.0) {
          qualityLevelRef.current = 1.0;
          updateQuality();
          queueRender();
        }
      }, 500); // Consider not moving after 500ms of no movement
      
      // Always render when camera moves
      queueRender();
    });
    
    // Cleanup on unmount
    return () => {
      unregister();
      unsubscribeEvents();
      unsubscribeCameraMove();
      
      if (moveTimerRef.current) {
        clearTimeout(moveTimerRef.current);
      }
      
      // Dispose of composer and passes
      if (composerRef.current) {
        composerRef.current.dispose();
      }
    };
  }, [enabled, camera, scene, gl, size]);
  
  // Handle resize
  useEffect(() => {
    if (!composerRef.current || !fxaaPassRef.current) return;
    
    composerRef.current.setSize(size.width, size.height);
    
    // Update FXAA resolution uniforms
    const pixelRatio = gl.getPixelRatio();
    fxaaPassRef.current.material.uniforms.resolution.value.x = 1 / (size.width * pixelRatio);
    fxaaPassRef.current.material.uniforms.resolution.value.y = 1 / (size.height * pixelRatio);
    
    // Queue a render after resize
    queueRender();
  }, [size, gl]);
  
  // Handle bloom settings changes
  useEffect(() => {
    if (!bloomPassRef.current) return;
    
    bloomPassRef.current.strength = bloomStrength;
    bloomPassRef.current.radius = bloomRadius;
    bloomPassRef.current.threshold = bloomThreshold;
    
    // Queue a render with new settings
    queueRender();
  }, [bloomStrength, bloomRadius, bloomThreshold]);
  
  // Timer reference for detecting when movement stops
  const moveTimerRef = useRef(null);
  
  // Setup effect composer
  const setupComposer = () => {
    // Create composer
    const composer = new EffectComposer(gl);
    composerRef.current = composer;
    
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
    bloomPassRef.current = bloomPass;
    composer.addPass(bloomPass);
    
    // Add FXAA pass
    const fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = gl.getPixelRatio();
    fxaaPass.material.uniforms.resolution.value.x = 1 / (size.width * pixelRatio);
    fxaaPass.material.uniforms.resolution.value.y = 1 / (size.height * pixelRatio);
    fxaaPassRef.current = fxaaPass;
    composer.addPass(fxaaPass);
    
    // Store globally for debugging
    window.composer = composer;
    
    return composer;
  };
  
  // Update rendering quality based on performance
  const updateQuality = () => {
    if (!adaptiveResolution || !composerRef.current) return;
    
    // Get current resolution
    const width = size.width * qualityLevelRef.current;
    const height = size.height * qualityLevelRef.current;
    
    // Update composer and passes
    composerRef.current.setSize(width, height);
    
    // Only emit quality change event if significant
    if (Math.abs(qualityLevelRef.current - qualityLevelRef.current) > 0.05) {
      emit(EVENT_TYPES.QUALITY_ADJUST, { 
        quality: qualityLevelRef.current,
        isMoving: isMovingRef.current
      });
    }
  };
  
  // Queue a render
  const queueRender = () => {
    // Multiple render requests are common - we'll batch them
    framesPendingRef.current += 1;
    
    // Cap pending frames to prevent perpetual rendering
    framesPendingRef.current = Math.min(framesPendingRef.current, 3);
    
    // Always call invalidate to let R3F know we need a render
    invalidate();
  };
  
  // Perform the actual render - this is called by EventSystem
  const performRender = ({ time, deltaTime }) => {
    if (!composerRef.current || !enabled || framesPendingRef.current <= 0) return;
    
    // Emit frame start event
    emit(EVENT_TYPES.FRAME_START, { time, deltaTime });
    
    // Check if we need to adjust quality based on movement
    if (adaptiveResolution && isMovingRef.current) {
      // Lower quality during movement for better performance
      const targetQuality = 0.75; // 75% resolution during movement
      if (Math.abs(qualityLevelRef.current - targetQuality) > 0.05) {
        qualityLevelRef.current = targetQuality;
        updateQuality();
      }
    }
    
    // Only render if we have pending frames
    if (framesPendingRef.current > 0) {
      try {
        // Render with composer
        composerRef.current.render();
        
        // Track performance
        const renderTime = performance.now() - lastRenderTimeRef.current;
        lastRenderTimeRef.current = performance.now();
        
        // Update quality if performance is suffering
        if (renderTime > 33 && adaptiveResolution) { // 33ms = ~30fps
          qualityLevelRef.current = Math.max(0.5, qualityLevelRef.current - 0.05);
          updateQuality();
        }
        
        // Decrement pending frame count
        framesPendingRef.current--;
      } catch (error) {
        console.error('Render error:', error);
        framesPendingRef.current = 0;
      }
    }
    
    // Emit frame end event
    emit(EVENT_TYPES.FRAME_END, { 
      renderTime: performance.now() - lastRenderTimeRef.current,
      quality: qualityLevelRef.current
    });
  };
  
  // Connect to R3F's frame loop for compatibility
  useFrame((state, delta) => {
    // Emit a frame event so that systems can update
    emit(EVENT_TYPES.FRAME_START, { 
      time: state.clock.elapsedTime, 
      deltaTime: delta
    });
    
    // If we have pending frames, trigger the rendering system
    if (framesPendingRef.current > 0) {
      performRender({ 
        time: state.clock.elapsedTime, 
        deltaTime: delta 
      });
    }
    
    // Always emit frame end
    emit(EVENT_TYPES.FRAME_END, { 
      time: state.clock.elapsedTime, 
      deltaTime: delta,
      renderTime: performance.now() - lastRenderTimeRef.current
    });
  });
  
  // Render nothing - this is just a system component
  return null;
};

export default RenderingSystem;