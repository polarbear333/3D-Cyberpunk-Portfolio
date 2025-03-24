import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Optimized rendering system combining multi-pass rendering with efficient bloom
 */
const OptimizedRenderer = ({ 
  bloomStrength = 1.5, 
  bloomRadius = 0.75, 
  bloomThreshold = 0.2,
  adaptiveResolution = true 
}) => {
  const { gl, scene, camera, size, invalidate } = useThree();
  
  // Create refs for render targets and composer
  const composerRef = useRef();
  const sceneTargetRef = useRef();
  const bloomTargetRef = useRef();
  const blurTargetARef = useRef();
  const blurTargetBRef = useRef();
  
  // Performance monitoring
  const performanceRef = useRef({
    fps: 60,
    frameTimeHistory: [],
    lastFrameTime: performance.now(),
    isMoving: false,
    resolutionScale: 1.0,
    uniformCache: new Map(),
    drawCalls: 0
  });
  
  // Define shaders for efficient bloom using minimal passes
  const luminosityHighPassShader = useMemo(() => {
    return {
      uniforms: {
        "tDiffuse": { value: null },
        "luminosityThreshold": { value: bloomThreshold },
        "smoothWidth": { value: 0.01 },
        "defaultColor": { value: new THREE.Color(0x000000) },
        "defaultOpacity": { value: 0.0 }
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
        uniform vec3 defaultColor;
        uniform float defaultOpacity;
        uniform float luminosityThreshold;
        uniform float smoothWidth;
        varying vec2 vUv;
        
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 luma = vec3(0.299, 0.587, 0.114);
          float v = dot(texel.xyz, luma);
          vec4 outputColor = vec4(defaultColor.rgb, defaultOpacity);
          float alpha = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v);
          gl_FragColor = mix(outputColor, texel, alpha);
        }
      `
    };
  }, [bloomThreshold]);
  
  // Optimized gaussian blur shader
  const optimizedBlurShader = useMemo(() => {
    return {
      uniforms: {
        "tDiffuse": { value: null },
        "resolution": { value: new THREE.Vector2(size.width, size.height) },
        "direction": { value: new THREE.Vector2(1.0, 0.0) }
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
        uniform vec2 resolution;
        uniform vec2 direction;
        varying vec2 vUv;
        
        void main() {
          vec2 texelSize = 1.0 / resolution;
          vec2 texelStep = texelSize * direction;
          
          // 9-tap gaussian blur
          vec4 color = vec4(0.0);
          color += texture2D(tDiffuse, vUv - texelStep * 4.0) * 0.051;
          color += texture2D(tDiffuse, vUv - texelStep * 3.0) * 0.0918;
          color += texture2D(tDiffuse, vUv - texelStep * 2.0) * 0.12245;
          color += texture2D(tDiffuse, vUv - texelStep * 1.0) * 0.1531;
          color += texture2D(tDiffuse, vUv) * 0.1633;
          color += texture2D(tDiffuse, vUv + texelStep * 1.0) * 0.1531;
          color += texture2D(tDiffuse, vUv + texelStep * 2.0) * 0.12245;
          color += texture2D(tDiffuse, vUv + texelStep * 3.0) * 0.0918;
          color += texture2D(tDiffuse, vUv + texelStep * 4.0) * 0.051;
          
          gl_FragColor = color;
        }
      `
    };
  }, [size]);
  
  // Final composition shader for tone mapping and vignette
  const compositeShader = useMemo(() => {
    return {
      uniforms: {
        "tScene": { value: null },
        "tBloom": { value: null },
        "bloomStrength": { value: bloomStrength },
        "toneMappingExposure": { value: 1.0 },
        "vignetteAmount": { value: 0.7 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float bloomStrength;
        uniform float toneMappingExposure;
        uniform float vignetteAmount;
        varying vec2 vUv;
        
        void main() {
          vec4 sceneColor = texture2D(tScene, vUv);
          vec4 bloomColor = texture2D(tBloom, vUv);
          
          // Apply bloom effect
          vec3 color = sceneColor.rgb + bloomColor.rgb * bloomStrength;
          
          // Apply vignette
          vec2 uv = vUv * 2.0 - 1.0;
          float vignette = 1.0 - dot(uv, uv) * vignetteAmount;
          color *= vignette;
          
          // Apply exposure tone mapping
          color = vec3(1.0) - exp(-color * toneMappingExposure);
          
          // Apply gamma correction
          color = pow(color, vec3(1.0 / 2.2));
          
          gl_FragColor = vec4(color, sceneColor.a);
        }
      `
    };
  }, [bloomStrength]);
  
  // Initialize render targets
  useEffect(() => {
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const perf = performanceRef.current;
    
    // Shared parameters
    const parameters = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      depthBuffer: true,
      type: THREE.HalfFloatType
    };
    
    // Create main render target
    sceneTargetRef.current = new THREE.WebGLRenderTarget(
      size.width * pixelRatio * perf.resolutionScale, 
      size.height * pixelRatio * perf.resolutionScale,
      parameters
    );
    
    // Create half-resolution bloom target
    bloomTargetRef.current = new THREE.WebGLRenderTarget(
      Math.floor(size.width * pixelRatio * 0.5), 
      Math.floor(size.height * pixelRatio * 0.5),
      parameters
    );
    
    // Create quarter-resolution blur targets
    blurTargetARef.current = new THREE.WebGLRenderTarget(
      Math.floor(size.width * pixelRatio * 0.25), 
      Math.floor(size.height * pixelRatio * 0.25),
      parameters
    );
    
    blurTargetBRef.current = new THREE.WebGLRenderTarget(
      Math.floor(size.width * pixelRatio * 0.25), 
      Math.floor(size.height * pixelRatio * 0.25),
      parameters
    );
    
    return () => {
      // Clean up render targets
      if (sceneTargetRef.current) sceneTargetRef.current.dispose();
      if (bloomTargetRef.current) bloomTargetRef.current.dispose();
      if (blurTargetARef.current) blurTargetARef.current.dispose();
      if (blurTargetBRef.current) blurTargetBRef.current.dispose();
    };
  }, [gl, scene, camera, size]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!sceneTargetRef.current) return;
      
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      const perf = performanceRef.current;
      
      // Resize render targets
      sceneTargetRef.current.setSize(
        size.width * pixelRatio * perf.resolutionScale, 
        size.height * pixelRatio * perf.resolutionScale
      );
      
      bloomTargetRef.current.setSize(
        Math.floor(size.width * pixelRatio * 0.5), 
        Math.floor(size.height * pixelRatio * 0.5)
      );
      
      blurTargetARef.current.setSize(
        Math.floor(size.width * pixelRatio * 0.25), 
        Math.floor(size.height * pixelRatio * 0.25)
      );
      
      blurTargetBRef.current.setSize(
        Math.floor(size.width * pixelRatio * 0.25), 
        Math.floor(size.height * pixelRatio * 0.25)
      );
      
      // Update blur pass resolutions
      if (composerRef.current) {
        if (composerRef.current.horizontalBlurPass) {
          composerRef.current.horizontalBlurPass.uniforms.resolution.value.set(
            Math.floor(size.width * pixelRatio * 0.25),
            Math.floor(size.height * pixelRatio * 0.25)
          );
        }
        
        if (composerRef.current.verticalBlurPass) {
          composerRef.current.verticalBlurPass.uniforms.resolution.value.set(
            Math.floor(size.width * pixelRatio * 0.25),
            Math.floor(size.height * pixelRatio * 0.25)
          );
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size]);
  
  // Update performance metrics and adapt resolution
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
    if (adaptiveResolution && perf.isMoving) {
      if (perf.fps < 30 && perf.resolutionScale > 0.5) {
        // Decrease resolution
        perf.resolutionScale = Math.max(0.5, perf.resolutionScale - 0.05);
        
        // Resize render targets
        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        sceneTargetRef.current.setSize(
          size.width * pixelRatio * perf.resolutionScale, 
          size.height * pixelRatio * perf.resolutionScale
        );
      } else if (perf.fps > 55 && perf.resolutionScale < 0.9) {
        // Increase resolution
        perf.resolutionScale = Math.min(0.9, perf.resolutionScale + 0.05);
        
        // Resize render targets
        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        sceneTargetRef.current.setSize(
          size.width * pixelRatio * perf.resolutionScale, 
          size.height * pixelRatio * perf.resolutionScale
        );
      }
    } else if (adaptiveResolution && !perf.isMoving && perf.resolutionScale < 1.0) {
      // Gradually restore full resolution when not moving
      perf.resolutionScale = Math.min(1.0, perf.resolutionScale + 0.02);
      
      // Resize render targets
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      sceneTargetRef.current.setSize(
        size.width * pixelRatio * perf.resolutionScale, 
        size.height * pixelRatio * perf.resolutionScale
      );
    }
    
    // Get render stats
    perf.drawCalls = gl.info.render.calls;
    
    // Reset renderer stats
    gl.info.reset();
  }, [gl, size, adaptiveResolution]);
  
  // Update moving state based on camera position changes
  const updateMovingState = useCallback((position) => {
    if (!performanceRef.current.lastPosition) {
      performanceRef.current.lastPosition = position.clone();
      return;
    }
    
    const distance = position.distanceTo(performanceRef.current.lastPosition);
    performanceRef.current.isMoving = distance > 0.01;
    performanceRef.current.lastPosition = position.clone();
  }, []);
  
  // Execute multi-pass rendering pipeline
  useFrame((state) => {
    if (!sceneTargetRef.current || !bloomTargetRef.current || 
        !blurTargetARef.current || !blurTargetBRef.current) return;
    
    // Update performance metrics
    updatePerformance();
    
    // Update movement state based on camera
    updateMovingState(camera.position);
    
    const perf = performanceRef.current;
    
    // Store original renderer properties
    const originalRenderTarget = gl.getRenderTarget();
    const originalClearColor = gl.getClearColor(new THREE.Color());
    const originalClearAlpha = gl.getClearAlpha();
    
    // 1. Render scene to main target
    gl.setRenderTarget(sceneTargetRef.current);
    gl.clear();
    gl.render(scene, camera);
    
    // 2. Extract bright areas using threshold pass
    gl.setRenderTarget(bloomTargetRef.current);
    gl.clear();
    
    // Create a custom shader material for the luminosity pass
    const thresholdMaterial = new THREE.ShaderMaterial(luminosityHighPassShader);
    thresholdMaterial.uniforms.tDiffuse.value = sceneTargetRef.current.texture;
    
    // Render with the threshold material
    renderPass(gl, thresholdMaterial, bloomTargetRef.current);
    
    // 3. Apply blur using ping-pong rendering
    // Horizontal blur pass
    gl.setRenderTarget(blurTargetARef.current);
    gl.clear();
    
    // Create a custom shader material for the horizontal blur
    const horizontalBlurMaterial = new THREE.ShaderMaterial(optimizedBlurShader);
    horizontalBlurMaterial.uniforms.tDiffuse.value = bloomTargetRef.current.texture;
    horizontalBlurMaterial.uniforms.direction.value.set(1.0, 0.0);
    
    // Render with the horizontal blur material
    renderPass(gl, horizontalBlurMaterial, blurTargetARef.current);
    
    // Vertical blur pass
    gl.setRenderTarget(blurTargetBRef.current);
    gl.clear();
    
    // Create a custom shader material for the vertical blur
    const verticalBlurMaterial = new THREE.ShaderMaterial(optimizedBlurShader);
    verticalBlurMaterial.uniforms.tDiffuse.value = blurTargetARef.current.texture;
    verticalBlurMaterial.uniforms.direction.value.set(0.0, 1.0);
    
    // Render with the vertical blur material
    renderPass(gl, verticalBlurMaterial, blurTargetBRef.current);
    
    // 4. Final composite to screen
    gl.setRenderTarget(null);
    gl.clear();
    
    // Create a custom shader material for the final composite
    const compositeMaterial = new THREE.ShaderMaterial(compositeShader);
    compositeMaterial.uniforms.tScene.value = sceneTargetRef.current.texture;
    compositeMaterial.uniforms.tBloom.value = blurTargetBRef.current.texture;
    compositeMaterial.uniforms.bloomStrength.value = perf.isMoving ? bloomStrength * 0.8 : bloomStrength;
    compositeMaterial.uniforms.toneMappingExposure.value = 1.0;
    compositeMaterial.uniforms.vignetteAmount.value = perf.isMoving ? 0.8 : 0.7;
    
    // Render final composite
    renderPass(gl, compositeMaterial, null);
    
    // Restore original renderer state
    gl.setRenderTarget(originalRenderTarget);
    gl.setClearColor(originalClearColor, originalClearAlpha);
  });
  
  // Helper function to render a full-screen quad with a given material
  const renderPass = (renderer, material, renderTarget) => {
    // Create a full-screen quad
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    
    const scene = new THREE.Scene();
    scene.add(mesh);
    
    // Render
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
  };
  
  // No visible output in the scene graph
  return null;
};

export default OptimizedRenderer;