import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Loader, OrthographicCamera } from '@react-three/drei';
import { useStore } from './state/useStore';
import useAudio from './hooks/useAudio';
import LoadingScreen from './components/UI/LoadingScreen';
import Interface from './components/UI/Interface';
import CityScene from './components/City/CityScene';
import DroneNavigation from './components/Navigation/DroneNavigation';
import HotspotManager from './components/Hotspots/HotspotManager';
import PostProcessing from './components/Effects/PostProcessing';
import DebugInfo, { CameraTracker } from './components/UI/DebugInfo';
import StatsPanel from './components/UI/StatsPanel';

function App() {
  const { isLoading, debugMode, setLoading, soundEnabled, cameraMode } = useStore();
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // Initialize audio using our custom hook
  const audio = useAudio({ 
    autoplay: false, 
    volume: 0.5, 
    loop: true 
  });

  // Handle audio initialization on first user interaction
  const initAudio = () => {
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
  };
  
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
  }, []);
  
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
  }, [soundEnabled, audioInitialized]);

  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      {isLoading && <LoadingScreen />}
      
      <Canvas
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
        dpr={window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio}
        // Set default camera with proper lookAt method
        camera={{
          position: [-30, 50, -30],
          fov: 75,
          near: 0.1,
          far: 1000
        }}
      >
        {/* Removed drei Stats component in favor of our custom StatsPanel */}
        <Suspense fallback={null}>
          {/* Main 3D scene */}
          <CityScene />
          
          {/* Drone navigation and camera controls */}
          <DroneNavigation audio={audio} />
          
          {/* Interactive project hotspots */}
          <HotspotManager audio={audio} />
          
          {/* Cyberpunk visual effects */}
          <PostProcessing />
          
          {/* Camera position tracker for debug info */}
          <CameraTracker />
          
          {/* Orthographic camera as a component, not default */}
          {cameraMode === 'orthoAngled' && (
            <OrthographicCamera
              makeDefault
              position={[-30, 50, -30]}
              zoom={15}
              near={1}
              far={1000}
              left={-window.innerWidth / window.innerHeight * 10}
              right={window.innerWidth / window.innerHeight * 10}
              top={10}
              bottom={-10}
            />
          )}
        </Suspense>
        
        {/* Only enable OrbitControls in debug mode */}
        {debugMode && <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />}
      </Canvas>
      
      {/* Loading indicator for 3D assets */}
      <Loader 
        dataInterpolation={(p) => `Loading Cyberpunk City ${p.toFixed(0)}%`}
        containerStyles={{
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)'
        }}
        barStyles={{
          background: 'linear-gradient(90deg, #FF00FF, #00FFFF)',
          height: '4px',
        }}
        dataStyles={{
          color: '#00FFFF',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '1rem',
          marginTop: '1rem',
        }}
      />
      
      {/* 2D UI overlay */}
      <Interface audio={audio} />
      
      {/* Debug Info - now outside the Canvas */}
      <DebugInfo />
      
      {/* Performance monitoring using stats.js */}
      {debugMode && <StatsPanel mode={0} position="top-left" />}
    </div>
  );
}

export default App;