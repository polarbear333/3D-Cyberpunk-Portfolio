import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Loader, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './state/useStore';
import useAudio from './hooks/useAudio';

// UI Components - Use lazy loading for non-critical components
const LoadingScreen = React.lazy(() => import('./components/UI/LoadingScreen'));
const Interface = React.lazy(() => import('./components/UI/Interface'));
const DebugInfo = React.lazy(() => import('./components/UI/DebugInfo'));
import { CameraTracker } from './components/UI/DebugInfo';
const StatsPanel = React.lazy(() => import('./components/UI/StatsPanel'));

// Scene Components - Critical components are not lazy loaded
import CyberpunkCityScene from './components/City/CyberpunkCityScene';
import CyberpunkEnvironment from './components/Effects/CyberpunkEnvironment';
import DroneNavigation from './components/Navigation/DroneNavigation';
import HotspotManager from './components/Hotspots/HotspotManager';

// Rendering System
import OptimizedRenderer from './utils/OptimizedRenderer';

// Scene Effects (individual imports instead of the wrapper)
import { 
  FlyingVehicles, 
  CyberpunkRain,
  AnimatedBillboards, 
  AtmosphericFog 
} from './components/Effects/CyberpunkSceneEffects';

// Spatial Management for optimized rendering
import { SpatialManager } from './utils/SpatialManager';

// This component helps synchronize the OrbitControls with on-demand rendering
const ControlsUpdater = React.memo(() => {
  const { controls, invalidate } = useThree();
  
  useEffect(() => {
    // Make sure controls trigger a render when they're used
    if (controls) {
      const callback = () => invalidate();
      controls.addEventListener('change', callback);
      return () => controls.removeEventListener('change', callback);
    }
  }, [controls, invalidate]);
  
  return null;
});

// Initialize the camera to look at a specific point
const CameraInitializer = React.memo(() => {
  const { camera, invalidate } = useThree();
  
  useEffect(() => {
    // Set the initial camera position and lookAt
    camera.position.set(590, 450, 630);
    camera.lookAt(0, 10, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate]);
  
  return null;
});

// Initialize the spatial manager
const SpatialManagerInitializer = React.memo(() => {
  const { scene, camera, invalidate } = useThree();
  const spatialManagerRef = useRef(null);
  const debugMode = useStore(state => state.debugMode);
  
  // Create the spatial manager
  useEffect(() => {
    if (!spatialManagerRef.current) {
      spatialManagerRef.current = new SpatialManager(scene, camera);
      spatialManagerRef.current.initialize();
      
      // Store reference globally for access by other components
      window.spatialManager = spatialManagerRef.current;
      
      console.log("Spatial Manager initialized");
      
      // Initial render
      invalidate();
    }
    
    return () => {
      if (spatialManagerRef.current) {
        spatialManagerRef.current.dispose();
        window.spatialManager = null;
      }
    };
  }, [scene, camera, invalidate]);
  
  // Update spatial manager on each frame
  useFrame(() => {
    if (spatialManagerRef.current && spatialManagerRef.current.initialized) {
      spatialManagerRef.current.update(camera.position);
      
      // Get performance metrics if needed for debugging
      if (debugMode) {
        const metrics = spatialManagerRef.current.getPerformanceMetrics();
        // Use metrics for debug display if needed
      }
    }
  });
  
  return null;
});

// Render loop manager for on-demand rendering
const RenderManager = React.memo(() => {
  const { invalidate } = useThree();
  const previousTime = useRef(0);
  const frameId = useRef(null);
  
  // Schedule periodic renders for animated content
  useEffect(() => {
    const scheduleRender = () => {
      const currentTime = performance.now();
      
      // Only invalidate if enough time has passed (e.g., ~15 FPS when idle)
      if (currentTime - previousTime.current > 66) {
        invalidate();
        previousTime.current = currentTime;
      }
      
      frameId.current = requestAnimationFrame(scheduleRender);
    };
    
    // Start the schedule
    frameId.current = requestAnimationFrame(scheduleRender);
    
    return () => {
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }
    };
  }, [invalidate]);
  
  return null;
});

function App() {
  const { isLoading, debugMode, setLoading, soundEnabled } = useStore();
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // References
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  
  // Initialize audio using our custom hook - memoized
  const audio = useAudio({ 
    autoplay: false, 
    volume: 0.5, 
    loop: true 
  });

  // Handle audio initialization on first user interaction - memoized callback
  const initAudio = useCallback(() => {
    if (!audioInitialized && audio) {
      audio.initialize();
      
      // Load and play ambient background music
      const loadAndPlayAmbient = async () => {
        try {
          // Try to load audio files if they exist
          try {
            await audio.loadSound('ambient', '/audio/cyberpunk-ambient.mp3');
            await audio.loadSound('drone', '/audio/drone-engine.mp3');
            await audio.loadSound('click', '/audio/click.mp3');
            await audio.loadSound('hover', '/audio/hover.mp3');
          } catch (e) {
            console.warn("Audio files not found. Audio will be disabled.");
          }
          
          // Play ambient music at lower volume
          if (soundEnabled) {
            try {
              audio.playAmbient('ambient', { volume: 0.3 });
            } catch (e) {
              console.warn("Could not play ambient audio:", e);
            }
          }
          
          setAudioInitialized(true);
        } catch (error) {
          console.error('Failed to initialize audio:', error);
          setAudioInitialized(false);
        }
      };
      
      loadAndPlayAmbient();
    }
  }, [audioInitialized, audio, soundEnabled]);
  
  // Initialize audio on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      // Remove event listeners after initialization
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [initAudio]);
  
  // Monitor sound enabled/disabled state
  useEffect(() => {
    if (audioInitialized) {
      if (soundEnabled) {
        try {
          audio.playAmbient('ambient', { volume: 0.3 });
        } catch (e) {
          console.warn("Could not play ambient audio:", e);
        }
      } else {
        try {
          audio.stopSound('ambient');
        } catch (e) {
          console.warn("Could not stop ambient audio:", e);
        }
      }
    }
  }, [soundEnabled, audioInitialized, audio]);

  // Initialize renderer with optimized settings - memoized callback
  const initRenderer = useCallback((state) => {
    if (!rendererRef.current && state.gl) {
      rendererRef.current = state.gl;
      
      // Configure renderer
      rendererRef.current.setClearColor(0x0a0a1a); // Darker blue background
      rendererRef.current.outputColorSpace = THREE.SRGBColorSpace; // Modern replacement for outputEncoding
      rendererRef.current.toneMapping = THREE.ReinhardToneMapping;
      rendererRef.current.toneMappingExposure = 2.5;
      
      // Only enable shadows if not on a low-power device
      const isLowPowerDevice = 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
        (window.devicePixelRatio < 1.5) ||
        (navigator.deviceMemory && navigator.deviceMemory < 4);
      
      rendererRef.current.shadowMap.enabled = !isLowPowerDevice;
      rendererRef.current.shadowMap.type = THREE.BasicShadowMap; // Most efficient shadow type
      
      // Expose renderer for debugging
      window.renderer = rendererRef.current;
      
      console.log("Renderer configured");
    }
  }, []);

  // Handle window resize - memoized callback
  const handleResize = useCallback(() => {
    if (rendererRef.current) {
      // Make sure canvas dimensions are correct
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      
      // Update camera aspect ratio
      if (canvasRef.current) {
        const camera = canvasRef.current.__r3f?.camera;
        if (camera) {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
        }
      }
      
      // Make sure a render happens after resize
      if (canvasRef.current && canvasRef.current.__r3f) {
        canvasRef.current.__r3f.invalidate();
      }
    }
  }, []);
  
  // Set up resize listener
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      <Suspense fallback={null}>
        {isLoading && <LoadingScreen />}
      </Suspense>
      
      <Canvas
        ref={canvasRef}
        frameloop="demand" // On-demand rendering for better performance
        gl={{ 
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: "default", // Use default instead of "high-performance" to save battery
          stencil: true, // Needed for some post-processing effects
          depth: true
        }}
        dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio} // Cap pixel ratio at 2 for performance
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000,
          position: [590, 450, 630] // Set initial position - lookAt will be called separately
        }}
        onCreated={(state) => {
          initRenderer(state);
          // Initial render
          state.invalidate();
        }}
        shadows={false} // Disable shadow by default for performance
      >
        <Suspense fallback={null}>
          {/* Initialize camera with lookAt */}
          <CameraInitializer />
          
          {/* Initialize spatial manager */}
          <SpatialManagerInitializer />
          
          {/* Manages on-demand rendering with OrbitControls */}
          <ControlsUpdater />
          
          {/* Handles periodic renders for animations */}
          <RenderManager />
          
          {/* Advanced multi-pass rendering system */}
          <OptimizedRenderer 
            bloomStrength={1.2}
            bloomRadius={0.8}
            bloomThreshold={0.3}
            adaptiveResolution={true}
          />
          
          {/* Layered cyberpunk environment with skybox, fog and lighting */}
          <CyberpunkEnvironment intensity={0.3} />
          
          {/* Main enhanced cyberpunk city scene */}
          <CyberpunkCityScene />
          
          {/* Dynamic environmental elements - now individual components */}
          <FlyingVehicles count={15} speed={1.0} />
          <CyberpunkRain intensity={0.7} />
          <AnimatedBillboards count={8} />
          <AtmosphericFog />
          
          {/* Drone navigation and camera controls */}
          <DroneNavigation audio={audio} />
          
          {/* Interactive project hotspots */}
          <HotspotManager audio={audio} />
          
          {/* Camera controls - enhanced for cyberpunk feel */}
          <OrbitControls 
            enableDamping={true}
            dampingFactor={0.05}
            screenSpacePanning={false}
            minDistance={10}
            maxDistance={1000}
            enablePan={debugMode}
            target={[0, 10, 0]}
          />
          
          {/* Camera position tracker for debug info */}
          <Suspense fallback={null}>
            <CameraTracker />
          </Suspense>
        </Suspense>
      </Canvas>
      
      {/* Loading indicator */}
      <Loader 
        dataInterpolation={(p) => `INITIALIZING NEURAL INTERFACE: ${p.toFixed(0)}%`}
        containerStyles={{
          background: 'rgba(5, 0, 30, 0.8)',
          backdropFilter: 'blur(10px)'
        }}
        barStyles={{
          background: 'linear-gradient(to right, #00FFFF, #FF10F0)',
          height: '4px',
          boxShadow: '0 0 10px #00FFFF'
        }}
        dataStyles={{
          color: '#00FFFF',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '1rem',
          marginTop: '1rem',
          textShadow: '0 0 5px #00FFFF'
        }}
      />
      
      {/* 2D UI overlay with cyberpunk styling */}
      <Suspense fallback={null}>
        <Interface audio={audio} />
      </Suspense>
      
      {/* Debug Info */}
      {debugMode && (
        <Suspense fallback={null}>
          <DebugInfo />
        </Suspense>
      )}
      
      {/* Only show stats in debug mode */}
      {debugMode && (
        <Suspense fallback={null}>
          <StatsPanel mode={0} position="top-left" />
        </Suspense>
      )}
      
      {/* Global scanline effect */}
      <div className="scanline"></div>
    </div>
  );
}

export default App;