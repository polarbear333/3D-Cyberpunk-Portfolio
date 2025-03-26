import React, { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import useAudio from './hooks/useAudio';
import { useStore } from './state/useStore';

// Import our new event-driven systems
import EventSystemInitializer from './systems/EventSystemInitializer';
import RenderingSystem from './systems/RenderingSystem';
import SpatialSystem from './systems/SpatialSystem';

// UI Components - with event-driven versions
const LoadingScreen = React.lazy(() => import('./components/UI/LoadingScreen'));
const Interface = React.lazy(() => import('./components/UI/Interface'));
const DebugInfoEvent = React.lazy(() => import('./components/UI/DebugInfoEvent'));
const StatsPanelEvent = React.lazy(() => import('./components/UI/StatsPanelEvent'));

// Import CameraTracker separately to avoid issues with dynamic imports
import { CameraTrackerEvent } from './components/UI/DebugInfoEvent';

// Import our event-driven components
import CameraController from './components/Camera/CameraController';
import CyberpunkCityScene from './components/City/CyberpunkCityScene';
import CyberpunkEnvironment from './components/Effects/CyberpunkEnvironment';
import DroneNavigationEvents from './components/Navigation/DroneNavigationEvents';
import HotspotManagerEvents from './components/Hotspots/HotspotManagerEvents';

// Import cyberpunk effects
import { 
  FlyingVehicles, 
  CyberpunkRain,
  AnimatedBillboards, 
  AtmosphericFog 
} from './components/Effects/CyberpunkSceneEffects';

// Import event types for initialization
import { useEventSystem, EVENT_TYPES, useEventListener } from './systems/EventSystem';
import OptimizedRendererEvent from './utils/OptimizedRendererEvent';

function EventDrivenApp() {
  const { isLoading, debugMode, setLoading, soundEnabled } = useStore();
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // References
  const canvasRef = useRef(null);
  
  // Initialize audio using our custom hook
  const audio = useAudio({ 
    autoplay: false, 
    volume: 0.5, 
    loop: true 
  });

  // Access event system
  const { emit } = useEventSystem(state => ({ emit: state.emit }));
  
  // Handle audio initialization on first user interaction
  const initAudio = React.useCallback(() => {
    if (!audioInitialized && audio) {
      audio.initialize();
      
      // Load and play ambient background music
      const loadAndPlayAmbient = async () => {
        try {
          await audio.loadSound('ambient', '/audio/cyberpunk-ambient.mp3');
          await audio.loadSound('drone', '/audio/drone-engine.mp3');
          await audio.loadSound('click', '/audio/click.mp3');
          await audio.loadSound('hover', '/audio/hover.mp3');
          
          // Play ambient music at lower volume
          if (soundEnabled) {
            audio.playAmbient('ambient', { volume: 0.3 });
          }
          
          setAudioInitialized(true);
          
          // Emit audio loaded event
          emit(EVENT_TYPES.ASSET_LOAD_COMPLETE, {
            type: 'audio',
            assets: ['ambient', 'drone', 'click', 'hover']
          });
        } catch (error) {
          console.error('Failed to initialize audio:', error);
          setAudioInitialized(false);
          
          // Emit error event
          emit(EVENT_TYPES.ASSET_LOAD_ERROR, {
            type: 'audio',
            error: error.message
          });
        }
      };
      
      // Emit loading event
      emit(EVENT_TYPES.ASSET_LOAD_START, { type: 'audio' });
      
      loadAndPlayAmbient();
    }
  }, [audioInitialized, audio, soundEnabled, emit]);
  
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
        audio.playAmbient('ambient', { volume: 0.3 });
        
        // Emit sound enabled event
        emit('audio:enabled', { source: 'ambient' });
      } else {
        audio.stopSound('ambient');
        
        // Emit sound disabled event
        emit('audio:disabled', { source: 'ambient' });
      }
    }
  }, [soundEnabled, audioInitialized, audio, emit]);
  
  // Listen for city load completion event to hide loading screen
  useEventListener(EVENT_TYPES.ASSET_LOAD_COMPLETE, (data) => {
    if (data.type === 'city') {
      // A small delay for visual effect
      setTimeout(() => {
        setLoading(false);
        
        // Emit app loaded event
        emit(EVENT_TYPES.APP_LOADED, {
          timestamp: Date.now()
        });
      }, 1000);
    }
  });
  
  // Listen for errors to handle them centrally
  useEventListener(EVENT_TYPES.ASSET_LOAD_ERROR, (data) => {
    console.error(`Asset loading error (${data.type}):`, data.error);
    // Could add more sophisticated error handling here
  });
  
  // Listen for performance warnings to potentially adjust quality
  useEventListener('performance:warning', (data) => {
    if (data.fps < 20) {
      // Could auto-adjust quality settings here
      console.warn('Performance warning: Low FPS detected', data.fps);
    }
  });

  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      {/* Initialize event system before any other components */}
      <EventSystemInitializer />
      
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
          powerPreference: "default",
          stencil: true,
          depth: true
        }}
        dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio}
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000,
          position: [590, 450, 630]
        }}
        shadows={false}
      >
        <Suspense fallback={null}>
          {/* Core systems */}
          <SpatialSystem enabled={true} />
          <RenderingSystem 
            enabled={true}
            bloomStrength={0.7}
            bloomRadius={1.0}
            bloomThreshold={0}
            adaptiveResolution={true}
          />
          
          {/* Environment and scene */}
          <CyberpunkEnvironment intensity={0.3} />
          <CyberpunkCityScene />
          
          {/* Dynamic effects */}
          <FlyingVehicles count={15} speed={1.0} />
          <CyberpunkRain intensity={0.7} />
          <AnimatedBillboards count={8} />
          <AtmosphericFog />
          
          {/* Interactive elements */}
          <DroneNavigationEvents audio={audio} />
          <HotspotManagerEvents audio={audio} />
          
          {/* Camera controller */}
          <CameraController 
            minDistance={10}
            maxDistance={1000}
            dampingFactor={0.05}
            enablePan={debugMode}
            lookAt={[0, 10, 0]}
          />
          
          {/* Camera tracker for debug info */}
          <Suspense fallback={null}>
            <CameraTrackerEvent />
          </Suspense>
          
          {/* Legacy compatibility */}
          <OptimizedRendererEvent 
            bloomStrength={0.7}
            bloomRadius={1.0}
            bloomThreshold={0}
            adaptiveResolution={true}
          />
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
      
      <Suspense fallback={null}>
        <Interface audio={audio} />
      </Suspense>
      
      {debugMode && (
        <Suspense fallback={null}>
          <DebugInfoEvent />
        </Suspense>
      )}
      
      {debugMode && (
        <Suspense fallback={null}>
          <StatsPanelEvent mode={0} position="top-left" />
        </Suspense>
      )}
      
      <div className="scanline"></div>
    </div>
  );
}
export default EventDrivenApp();