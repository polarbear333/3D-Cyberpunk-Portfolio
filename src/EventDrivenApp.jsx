import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import useAudio from './hooks/useAudio';
import { useStore } from './state/useStore';

// Import event-driven systems
import EventSystemInitializer from './systems/EventSystemInitializer';
import RenderingSystem from './systems/RenderingSystem';
import SpatialSystem from './systems/SpatialSystem';

// Lazy-loaded UI components
const LoadingScreen = React.lazy(() => import('./components/UI/LoadingScreen'));
const Interface = React.lazy(() => import('./components/UI/Interface'));
const DebugInfoEvent = React.lazy(() => import('./components/UI/DebugInfoEvent'));
const StatsPanelEvent = React.lazy(() => import('./components/UI/StatsPanelEvent'));
import { CameraTrackerEvent } from './components/UI/DebugInfoEvent';

// Import event-driven components
import CameraController from './components/Camera/CameraController';
import CyberpunkCityScene from './components/City/CyberpunkCityScene';
import CyberpunkEnvironment from './components/Effects/CyberpunkEnvironment';
import DroneNavigationEvents from './components/Navigation/DroneNavigationEvents';
import HotspotManagerEvents from './components/Hotspots/HotspotManagerEvents';

// Import cyberpunk effects
import { FlyingVehicles, CyberpunkRain, AnimatedBillboards, AtmosphericFog } from './components/Effects/CyberpunkSceneEffects';

// Import event system hooks and types
import { useEventSystem, EVENT_TYPES, useEventListener } from './systems/EventSystem';
import OptimizedRendererEvent from './utils/OptimizedRendererEvent';

function EventDrivenApp() {
  const { isLoading, debugMode, setLoading, soundEnabled } = useStore();
  const [audioInitialized, setAudioInitialized] = useState(false);
  const canvasRef = useRef(null);
  const audio = useAudio({ autoplay: false, volume: 0.5, loop: true });

  // --- FIX 1: Select emit directly for stable reference ---
  const emit = useEventSystem(state => state.emit);
  // ---------------------------------------------------------

  // Ref to prevent multiple audio initializations
  const audioInitAttemptedRef = useRef(false);

  const initAudio = useCallback(() => {
    // Guard: Only attempt initialization once
    if (audioInitialized || audioInitAttemptedRef.current || !audio) return;

    console.log("Attempting audio initialization...");
    audioInitAttemptedRef.current = true; // Mark as attempted
    audio.initialize(); // This should now reliably set up the context ref

    const loadAndPlayAmbient = async () => {
      try {
        console.log("Loading audio assets...");
        // loadSound should now work correctly because it checks the ref
        await audio.loadSound('ambient', '/audio/cyberpunk-ambient.mp3');
        await audio.loadSound('drone', '/audio/drone-engine.mp3');
        await audio.loadSound('click', '/audio/click.mp3');
        await audio.loadSound('hover', '/audio/hover.mp3');
        console.log("Audio assets loaded.");

        // Check isInitialized state here before playing, as it indicates full setup
        if (soundEnabled && audio.isInitialized) {
          console.log("Playing ambient sound.");
          audio.playAmbient('ambient', { volume: 0.3 });
        }
        setAudioInitialized(true); // Set state *after* loading
        console.log("Audio initialized successfully, emitting event.");
        emit(EVENT_TYPES.ASSET_LOAD_COMPLETE, {
          type: 'audio',
          assets: ['ambient', 'drone', 'click', 'hover'],
        });
      } catch (error) {
        console.error('Failed to initialize audio:', error);
        setAudioInitialized(false);
        audioInitAttemptedRef.current = false; // Allow retry on error? Or handle differently.
        emit(EVENT_TYPES.ASSET_LOAD_ERROR, {
          type: 'audio',
          error: error.message,
        });
      }
    };
    emit(EVENT_TYPES.ASSET_LOAD_START, { type: 'audio' });
    loadAndPlayAmbient();
  }, [audioInitialized, audio, soundEnabled, emit]); // Keep dependencies for useCallback

  // Effect to trigger audio initialization on user interaction
  useEffect(() => {
    const handleInteraction = () => {
      console.log("User interaction detected, calling initAudio.");
      initAudio();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [initAudio]); // Depend on initAudio

  // Effect to handle soundEnabled changes
  useEffect(() => {
    // Ensure audio object and emit are available, and audio is fully initialized
    if (audioInitialized && audio && emit) {
      if (soundEnabled) {
        audio.playAmbient('ambient', { volume: 0.3 });
        // --- This emit was causing the loop ---
        emit('audio:enabled', { source: 'ambient' });
        // --------------------------------------
      } else {
        audio.stopSound('ambient');
        // --- This emit was causing the loop ---
        emit('audio:disabled', { source: 'ambient' });
        // --------------------------------------
      }
    }
    // Dependencies are now stable or correctly handled
  }, [soundEnabled, audioInitialized, audio, emit]);

  // Event listener callbacks (stable references)
  const handleAssetLoadComplete = useCallback(
    (data) => {
      // Assuming city load completion is the final step
      if (data.type === 'city') {
        console.log("City loaded, setting loading state to false.");
        // Add a small delay to ensure rendering stabilizes
        setTimeout(() => {
          setLoading(false);
          emit(EVENT_TYPES.APP_LOADED, { timestamp: Date.now() });
        }, 500); // Reduced delay
      }
    },
    [setLoading, emit] // Dependencies for useCallback
  );

  const handleAssetError = useCallback((data) => {
    console.error(`Asset loading error (${data.type}):`, data.error);
    // Potentially set an error state here
  }, []); // No dependencies needed if it only logs

  const handlePerformanceWarning = useCallback((data) => {
    if (data.fps < 20) {
      console.warn('Performance warning: Low FPS detected', data.fps);
      // Potentially trigger quality adjustments
    }
  }, []); // No dependencies needed if it only logs

  // Register event listeners using the hook
  useEventListener(EVENT_TYPES.ASSET_LOAD_COMPLETE, handleAssetLoadComplete);
  useEventListener(EVENT_TYPES.ASSET_LOAD_ERROR, handleAssetError);
  useEventListener('performance:warning', handlePerformanceWarning);

  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      {/* Initialize Core Systems */}
      <EventSystemInitializer />

      {/* Loading Screen */}
      <Suspense fallback={null}>
        {isLoading && <LoadingScreen />}
      </Suspense>

      {/* Main 3D Canvas */}
      <Canvas
        ref={canvasRef}
        frameloop="demand" // Use demand-based rendering
        gl={{
          antialias: true,
          alpha: true, // Needed for potential background effects/transparency
          preserveDrawingBuffer: false, // Generally false for performance unless needed
          powerPreference: 'high-performance', // Request high performance GPU
          stencil: false, // Disable if not explicitly needed by effects
          depth: true,
        }}
        // Adjust DPR for performance on high-res screens
        dpr={Math.min(window.devicePixelRatio, 1.5)}
        camera={{
          fov: 60,
          near: 1, // Increase near plane slightly
          far: 3000, // Increase far plane for large scenes
          position: [50, 30, 50], // Adjusted initial camera position
        }}
        shadows={false} // Disable shadows globally initially if not essential
        // performance={{ min: 0.5, max: 1 }} // R3F adaptive performance (optional)
      >
        <Suspense fallback={null}>
          {/* Core Systems within Canvas */}
          <SpatialSystem enabled={true} />
          <RenderingSystem
            enabled={true}
            bloomStrength={0.6} // Slightly reduced bloom
            bloomRadius={0.8}
            bloomThreshold={0.1} // Adjust threshold
            adaptiveResolution={true}
          />

          {/* Environment & Scene */}
          <CyberpunkEnvironment intensity={0.4} />
          <CyberpunkCityScene />

          {/* Dynamic Effects */}
          <FlyingVehicles count={12} speed={0.8} />
          <CyberpunkRain intensity={0.6} />
          <AnimatedBillboards count={6} />
          <AtmosphericFog />

          {/* Interactive Elements */}
          <DroneNavigationEvents audio={audio} />
          <HotspotManagerEvents audio={audio} />

          {/* Camera */}
          <CameraController
            minDistance={5} // Closer min distance
            maxDistance={1500} // Further max distance
            dampingFactor={0.05}
            enablePan={debugMode}
            lookAt={[0, 10, 0]}
          />
          <CameraTrackerEvent />

          {/* Optimized Renderer Configuration (if separate from RenderingSystem) */}
          {/* <OptimizedRendererEvent
            bloomStrength={0.6}
            bloomRadius={0.8}
            bloomThreshold={0.1}
            adaptiveResolution={true}
          /> */}
        </Suspense>
      </Canvas>

      {/* Loader Overlay */}
      <Loader
        dataInterpolation={(p) => `INITIALIZING NEURAL INTERFACE: ${p.toFixed(0)}%`}
        containerStyles={{
          background: 'rgba(5, 0, 30, 0.8)',
          backdropFilter: 'blur(10px)',
        }}
        barStyles={{
          background: 'linear-gradient(to right, #00FFFF, #FF10F0)',
          height: '4px',
          boxShadow: '0 0 10px #00FFFF',
        }}
        dataStyles={{
          color: '#00FFFF',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '1rem',
          marginTop: '1rem',
          textShadow: '0 0 5px #00FFFF',
        }}
      />

      {/* UI Interface */}
      <Suspense fallback={null}>
        <Interface audio={audio} />
      </Suspense>

      {/* Debugging Tools */}
      {debugMode && (
        <Suspense fallback={null}>
          <DebugInfoEvent />
        </Suspense>
      )}
      {debugMode && (
        <Suspense fallback={null}>
          {/* Use only one stats panel mode for less overhead */}
          <StatsPanelEvent modes={[0]} position="top-left" />
        </Suspense>
      )}

      {/* Global Effects */}
      <div className="scanline"></div>
    </div>
  );
}

export default EventDrivenApp;