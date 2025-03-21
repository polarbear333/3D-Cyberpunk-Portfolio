import React, { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './state/useStore';
import useAudio from './hooks/useAudio';
import LoadingScreen from './components/UI/LoadingScreen';
import Interface from './components/UI/Interface';
import CityScene from './components/City/CityScene';
import DroneNavigation from './components/Navigation/DroneNavigation';
import HotspotManager from './components/Hotspots/HotspotManager';
import DebugInfo, { CameraTracker } from './components/UI/DebugInfo';
import StatsPanel from './components/UI/StatsPanel';

function App() {
  const { isLoading, debugMode, setLoading, soundEnabled } = useStore();
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // References
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  
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

  // Initialize renderer
  const initRenderer = (state) => {
    if (!rendererRef.current && state.gl) {
      rendererRef.current = state.gl;
      
      // Configure renderer
      rendererRef.current.setClearColor(0x0a0a1a); // Darker blue background
      rendererRef.current.outputEncoding = THREE.sRGBEncoding;
      rendererRef.current.toneMapping = THREE.ReinhardToneMapping;
      rendererRef.current.toneMappingExposure = 2.5;
      rendererRef.current.shadowMap.enabled = true;
      
      // Expose renderer for debugging
      window.renderer = rendererRef.current;
      
      console.log("Renderer configured");
    }
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
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
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      {isLoading && <LoadingScreen />}
      
      <Canvas
        ref={canvasRef}
        gl={{ 
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true
        }}
        dpr={window.devicePixelRatio}
        camera={{
          fov: 60,
          near: 0.1,
          far: 2000
        }}
        onCreated={initRenderer}
        shadows
      >
        <Suspense fallback={null}>
          {/* Main 3D scene */}
          <CityScene />
          
          {/* Drone navigation and camera controls */}
          <DroneNavigation audio={audio} />
          
          {/* Interactive project hotspots */}
          <HotspotManager audio={audio} />
          
          {/* Camera position tracker for debug info */}
          <CameraTracker />
        </Suspense>
      </Canvas>
      
      {/* Loading indicator */}
      <Loader 
        dataInterpolation={(p) => `Loading ${p.toFixed(0)}%`}
        containerStyles={{
          background: 'rgba(0, 0, 0, 0.8)',
        }}
        barStyles={{
          background: 'cyan',
          height: '4px',
        }}
        dataStyles={{
          color: 'cyan',
          fontFamily: 'monospace',
          fontSize: '1rem',
          marginTop: '1rem',
        }}
      />
      
      {/* 2D UI overlay */}
      <Interface audio={audio} />
      
      {/* Debug Info */}
      {debugMode && <DebugInfo />}
      
      {/* Only show stats in debug mode */}
      {debugMode && <StatsPanel mode={0} position="top-left" />}
    </div>
  );
}

export default App;