import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Loader, OrbitControls } from '@react-three/drei';
import useAudio from './hooks/useAudio';
import { useStore } from './state/useStore';

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

// Individual scene effects
import { 
  FlyingVehicles, 
  CyberpunkRain,
  AnimatedBillboards, 
  CityLights,
  AtmosphericFog 
} from './components/Effects/CyberpunkSceneEffects';

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

function App() {
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
        audio.playAmbient('ambient', { volume: 0.3 });
      } else {
        audio.stopSound('ambient');
      }
    }
  }, [soundEnabled, audioInitialized, audio]);

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
          {/* Initialize camera with lookAt */}
          <CameraInitializer />
          
          {/* Advanced multi-pass rendering system with bloom */}
          <OptimizedRenderer 
            bloomStrength={0.7}  // Higher bloom for better neon effect
            bloomRadius={1.0}
            bloomThreshold={0}   // Zero threshold for pseudo-volumetric lighting
            adaptiveResolution={true}
          />
          
          {/* Cyberpunk environment (skybox, fog, lighting) */}
          <CyberpunkEnvironment intensity={0.3} />
          
          {/* Main cyberpunk city scene */}
          <CyberpunkCityScene />
          
          {/* Dynamic environmental elements with procedural city lights */}
          <FlyingVehicles count={15} speed={1.0} />
          <CyberpunkRain intensity={0.7} />
          <AnimatedBillboards count={8} />
          <CityLights count={5} intensity={0.5} />
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