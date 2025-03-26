import * as THREE from 'three';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Advanced Rendering Manager class for multi-pass rendering, framebuffer management,
 * and optimized texture operations.
 */
class RenderingManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    // Initialize properties
    this.pixelRatio = window.devicePixelRatio;
    this.moving = false;
    this.adaptiveResolution = true;
    this.lastFrameTime = performance.now();
    this.frameTimeHistory = [];
    this.resolutionScale = 1.0;
    this.initialized = false;
    
    // Performance monitoring
    this.drawCallsPerFrame = 0;
    this.trianglesPerFrame = 0;
    this.fps = 60;
    
    // Uniform cache for efficient updates
    this.uniformCache = new Map();
    
    // Set up framebuffers, render targets, and passes
    this._setupRenderTargets();
    this._setupPasses();
    
    // Bind methods
    this.render = this.render.bind(this);
    this.updateMovingState = this.updateMovingState.bind(this);
    this.resize = this.resize.bind(this);
    
    // Mark as initialized
    this.initialized = true;
  }
  
  /**
   * Set up render targets and framebuffers for various passes
   */
  _setupRenderTargets() {
    // Calculate size
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Shared parameters for render targets
    const parameters = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      depthBuffer: true,
      type: THREE.HalfFloatType // More efficient than full float
    };
    
    // Create render targets for multi-pass rendering
    // Main scene target
    this.sceneTarget = new THREE.WebGLRenderTarget(
      width * this.pixelRatio * this.resolutionScale, 
      height * this.pixelRatio * this.resolutionScale,
      parameters
    );
    
    // Depth pre-pass target (for optimizing deferred operations)
    this.depthTarget = new THREE.WebGLRenderTarget(
      width * this.pixelRatio * this.resolutionScale, 
      height * this.pixelRatio * this.resolutionScale,
      {
        ...parameters,
        depthTexture: new THREE.DepthTexture(
          width * this.pixelRatio * this.resolutionScale,
          height * this.pixelRatio * this.resolutionScale
        )
      }
    );
    
    // Lower resolution targets for post-processing
    // Half-res bloom target
    this.bloomTargetHalfRes = new THREE.WebGLRenderTarget(
      Math.floor(width * this.pixelRatio * 0.5), 
      Math.floor(height * this.pixelRatio * 0.5),
      parameters
    );
    
    // Quarter-res blur targets for ping-pong rendering
    this.blurTargetA = new THREE.WebGLRenderTarget(
      Math.floor(width * this.pixelRatio * 0.25), 
      Math.floor(height * this.pixelRatio * 0.25),
      parameters
    );
    
    this.blurTargetB = new THREE.WebGLRenderTarget(
      Math.floor(width * this.pixelRatio * 0.25), 
      Math.floor(height * this.pixelRatio * 0.25),
      parameters
    );
    
    // Final composition target
    this.finalTarget = new THREE.WebGLRenderTarget(
      width * this.pixelRatio,
      height * this.pixelRatio,
      parameters
    );
  }
  
  /**
   * Set up rendering passes for multi-pass pipeline
   */
  _setupPasses() {
    // Scene render pass
    this.scenePass = new RenderPass(this.scene, this.camera);
    
    // Load shaders for custom passes
    this.luminosityHighPass = {
      uniforms: {
        "tDiffuse": { value: null },
        "luminosityThreshold": { value: 0.25 },
        "smoothWidth": { value: 0.01 },
        "defaultColor": { value: new THREE.Color(0x000000) },
        "defaultOpacity": { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
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
          vec4 texel = texture2D( tDiffuse, vUv );
          vec3 luma = vec3( 0.299, 0.587, 0.114 );
          float v = dot( texel.xyz, luma );
          vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );
          float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );
          gl_FragColor = mix( outputColor, texel, alpha );
        }
      `
    };
    
    // Create passes
    this.thresholdPass = new ShaderPass({
      uniforms: this.luminosityHighPass.uniforms,
      vertexShader: this.luminosityHighPass.vertexShader,
      fragmentShader: this.luminosityHighPass.fragmentShader
    });
    
    // Create bloom pass
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.7, // strength
      0.5, // radius
      0.4  // threshold
    );
    
    // Create custom horizontal and vertical blur passes for efficient Gaussian blur
    this.horizontalBlurPass = new ShaderPass({
      uniforms: {
        "tDiffuse": { value: null },
        "h": { value: 1.0 / (window.innerWidth * this.pixelRatio * 0.25) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float h;
        varying vec2 vUv;
        
        void main() {
          vec4 sum = vec4(0.0);
          sum += texture2D(tDiffuse, vec2(vUv.x - 4.0*h, vUv.y)) * 0.051;
          sum += texture2D(tDiffuse, vec2(vUv.x - 3.0*h, vUv.y)) * 0.0918;
          sum += texture2D(tDiffuse, vec2(vUv.x - 2.0*h, vUv.y)) * 0.12245;
          sum += texture2D(tDiffuse, vec2(vUv.x - 1.0*h, vUv.y)) * 0.1531;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.1633;
          sum += texture2D(tDiffuse, vec2(vUv.x + 1.0*h, vUv.y)) * 0.1531;
          sum += texture2D(tDiffuse, vec2(vUv.x + 2.0*h, vUv.y)) * 0.12245;
          sum += texture2D(tDiffuse, vec2(vUv.x + 3.0*h, vUv.y)) * 0.0918;
          sum += texture2D(tDiffuse, vec2(vUv.x + 4.0*h, vUv.y)) * 0.051;
          gl_FragColor = sum;
        }
      `
    });
    
    this.verticalBlurPass = new ShaderPass({
      uniforms: {
        "tDiffuse": { value: null },
        "v": { value: 1.0 / (window.innerHeight * this.pixelRatio * 0.25) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float v;
        varying vec2 vUv;
        
        void main() {
          vec4 sum = vec4(0.0);
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 4.0*v)) * 0.051;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0*v)) * 0.0918;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0*v)) * 0.12245;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0*v)) * 0.1531;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.1633;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0*v)) * 0.1531;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0*v)) * 0.12245;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0*v)) * 0.0918;
          sum += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 4.0*v)) * 0.051;
          gl_FragColor = sum;
        }
      `
    });
    
    // Final composition pass
    this.compositePass = new ShaderPass({
      uniforms: {
        "tScene": { value: this.sceneTarget.texture },
        "tBloom": { value: this.bloomTargetHalfRes.texture },
        "bloomStrength": { value: 1.0 },
        "toneMappingExposure": { value: 1.0 },
        "vignetteAmount": { value: 0.7 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
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
          
          gl_FragColor = vec4(color, sceneColor.a);
        }
      `
    });
  }
  
  /**
   * Handle window resize events
   */
  resize() {
    if (!this.initialized) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Update camera
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    
    // Update renderer
    this.renderer.setSize(width, height);
    
    // Resize render targets with current resolution scale
    this.sceneTarget.setSize(
      width * this.pixelRatio * this.resolutionScale, 
      height * this.pixelRatio * this.resolutionScale
    );
    
    this.depthTarget.setSize(
      width * this.pixelRatio * this.resolutionScale, 
      height * this.pixelRatio * this.resolutionScale
    );
    
    // Resize depth texture
    this.depthTarget.depthTexture.image.width = width * this.pixelRatio * this.resolutionScale;
    this.depthTarget.depthTexture.image.height = height * this.pixelRatio * this.resolutionScale;
    
    // Resize bloom target
    this.bloomTargetHalfRes.setSize(
      Math.floor(width * this.pixelRatio * 0.5), 
      Math.floor(height * this.pixelRatio * 0.5)
    );
    
    // Resize blur targets
    this.blurTargetA.setSize(
      Math.floor(width * this.pixelRatio * 0.25), 
      Math.floor(height * this.pixelRatio * 0.25)
    );
    
    this.blurTargetB.setSize(
      Math.floor(width * this.pixelRatio * 0.25), 
      Math.floor(height * this.pixelRatio * 0.25)
    );
    
    // Resize final target
    this.finalTarget.setSize(
      width * this.pixelRatio,
      height * this.pixelRatio
    );
    
    // Update blur pass uniforms with new dimensions
    this.horizontalBlurPass.uniforms.h.value = 1.0 / (width * this.pixelRatio * 0.25);
    this.verticalBlurPass.uniforms.v.value = 1.0 / (height * this.pixelRatio * 0.25);
    
    // Notify any extensions
    if (this.onResize) this.onResize(width, height);
  }
  
  /**
   * Update the moving state based on velocity
   * @param {THREE.Vector3} velocity - Current velocity
   */
  updateMovingState(velocity) {
    // Consider moving if velocity magnitude is above threshold
    const isNowMoving = velocity.lengthSq() > 0.01;
    
    // Only update if state has changed
    if (isNowMoving !== this.moving) {
      this.moving = isNowMoving;
      
      // Adjust resolution scale based on movement for adaptive resolution
      if (this.adaptiveResolution) {
        this.resolutionScale = this.moving ? 0.7 : 1.0;
        this.resize();
      }
    }
  }
  
  /**
   * Perform a depth pre-pass for optimized rendering
   */
  renderDepthPrePass() {
    // Set render target
    this.renderer.setRenderTarget(this.depthTarget);
    
    // Clear depth buffer
    this.renderer.clearDepth();
    
    // Create a copy of the scene with only objects that cast shadows
    const depthScene = new THREE.Scene();
    this.scene.traverse((object) => {
      if (object.isMesh && object.castShadow) {
        depthScene.add(object.clone());
      }
    });
    
    // Set material override for depth rendering
    const depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      side: THREE.DoubleSide
    });
    
    depthScene.overrideMaterial = depthMaterial;
    
    // Render depth only
    this.renderer.render(depthScene, this.camera);
    
    // Reset render target
    this.renderer.setRenderTarget(null);
  }
  
  /**
   * Update cache of uniforms that should only be updated when needed
   * @param {Object} material - Material to update
   * @param {String} name - Uniform name
   * @param {*} value - Uniform value
   */
  updateUniform(material, name, value) {
    if (!material.uniforms[name]) return;
    
    // Create unique key for this material/uniform pair
    const key = `${material.uuid}_${name}`;
    
    // Check if value has changed
    if (!this.uniformCache.has(key) || 
        JSON.stringify(this.uniformCache.get(key)) !== JSON.stringify(value)) {
      
      // Update the uniform
      material.uniforms[name].value = value;
      
      // Cache the new value
      this.uniformCache.set(key, JSON.parse(JSON.stringify(value)));
    }
  }
  
  /**
   * Run automatic performance monitoring and adaptive quality
   */
  _monitorPerformance() {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    // Calculate FPS
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }
    
    // Calculate average FPS from recent frames
    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    this.fps = Math.round(1000 / avgFrameTime);
    
    // Apply adaptive resolution if enabled and performance is suffering
    if (this.adaptiveResolution && this.moving) {
      if (this.fps < 30 && this.resolutionScale > 0.5) {
        // Decrease resolution scale
        this.resolutionScale = Math.max(0.5, this.resolutionScale - 0.05);
        this.resize();
      } else if (this.fps > 50 && this.resolutionScale < 0.7) {
        // Increase resolution scale
        this.resolutionScale = Math.min(0.7, this.resolutionScale + 0.05);
        this.resize();
      }
    } else if (this.adaptiveResolution && !this.moving && this.resolutionScale < 1.0) {
      // When not moving, gradually restore full resolution
      this.resolutionScale = Math.min(1.0, this.resolutionScale + 0.02);
      this.resize();
    }
    
    // Get draw call stats
    this.drawCallsPerFrame = this.renderer.info.render.calls;
    this.trianglesPerFrame = this.renderer.info.render.triangles;
    
    // Reset renderer stats for next frame
    this.renderer.info.reset();
  }
  
  /**
   * Main render function that manages the multi-pass rendering pipeline
   */
  render() {
    if (!this.initialized) return;
    
    // Monitor performance
    this._monitorPerformance();
    
    // Store original clear color
    const originalClearColor = this.renderer.getClearColor(new THREE.Color());
    const originalClearAlpha = this.renderer.getClearAlpha();
    
    // 1. Optional: Depth pre-pass for complex scenes
    // Uncomment if needed for optimization
    // this.renderDepthPrePass();
    
    // 2. Render scene to main render target
    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.setClearColor(0x000000, 1.0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    
    // 3. Extract bright areas for bloom using the threshold pass
    this.renderer.setRenderTarget(this.bloomTargetHalfRes);
    this.renderer.clear();
    
    // Set uniforms for threshold pass
    this.thresholdPass.uniforms.tDiffuse.value = this.sceneTarget.texture;
    this.thresholdPass.uniforms.luminosityThreshold.value = 0.25;
    this.thresholdPass.uniforms.smoothWidth.value = 0.01;
    
    // Render threshold pass
    this.thresholdPass.render(this.renderer, this.bloomTargetHalfRes);
    
    // 4. Apply ping-pong Gaussian blur for bloom effect
    // Horizontal blur: bloomTargetHalfRes -> blurTargetA
    this.renderer.setRenderTarget(this.blurTargetA);
    this.renderer.clear();
    this.horizontalBlurPass.uniforms.tDiffuse.value = this.bloomTargetHalfRes.texture;
    this.horizontalBlurPass.render(this.renderer, this.blurTargetA);
    
    // Vertical blur: blurTargetA -> blurTargetB
    this.renderer.setRenderTarget(this.blurTargetB);
    this.renderer.clear();
    this.verticalBlurPass.uniforms.tDiffuse.value = this.blurTargetA.texture;
    this.verticalBlurPass.render(this.renderer, this.blurTargetB);
    
    // Another pass of blur for better quality
    this.renderer.setRenderTarget(this.blurTargetA);
    this.renderer.clear();
    this.horizontalBlurPass.uniforms.tDiffuse.value = this.blurTargetB.texture;
    this.horizontalBlurPass.render(this.renderer, this.blurTargetA);
    
    this.renderer.setRenderTarget(this.bloomTargetHalfRes);
    this.renderer.clear();
    this.verticalBlurPass.uniforms.tDiffuse.value = this.blurTargetA.texture;
    this.verticalBlurPass.render(this.renderer, this.bloomTargetHalfRes);
    
    // 5. Final composition pass
    this.renderer.setRenderTarget(null); // Render to screen
    this.renderer.clear();
    
    // Set uniforms for final composition
    this.compositePass.uniforms.tScene.value = this.sceneTarget.texture;
    this.compositePass.uniforms.tBloom.value = this.bloomTargetHalfRes.texture;
    this.compositePass.uniforms.bloomStrength.value = this.moving ? 0.8 : 1.0; // Reduce bloom when moving
    this.compositePass.uniforms.toneMappingExposure.value = 1.0;
    this.compositePass.uniforms.vignetteAmount.value = this.moving ? 0.8 : 0.7; // Enhance vignette when moving
    
    // Render to screen
    this.compositePass.render(this.renderer, null);
    
    // Restore original clear color
    this.renderer.setClearColor(originalClearColor, originalClearAlpha);
  }
  
  /**
   * Clean up and dispose of resources
   */
  dispose() {
    // Dispose render targets
    this.sceneTarget.dispose();
    this.depthTarget.dispose();
    this.bloomTargetHalfRes.dispose();
    this.blurTargetA.dispose();
    this.blurTargetB.dispose();
    this.finalTarget.dispose();
    
    // Clear cache
    this.uniformCache.clear();
  }
}

export default RenderingManager;