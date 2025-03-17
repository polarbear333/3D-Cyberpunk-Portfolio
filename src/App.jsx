import React, { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Loader } from '@react-three/drei';
import * as THREE from 'three'; // Add missing THREE import
import { useStore } from './state/useStore';
import useAudio from './hooks/useAudio';
import LoadingScreen from './components/UI/LoadingScreen';
import Interface from './components/UI/Interface';
import CityScene from './components/City/CityScene';
import DroneNavigation from './components/Navigation/DroneNavigation';
import HotspotManager from './components/Hotspots/HotspotManager';
import DebugInfo, { CameraTracker } from './components/UI/DebugInfo';
import StatsPanel from './components/UI/StatsPanel';

// Custom component to handle optimized render loop
function RenderLoop({ customRender }) {
  const state = useThree();
  
  useFrame(() => {
    // Call our custom render function
    customRender(state);
    // Request another frame
    state.invalidate();
  });
  
  return null;
}

function App() {
  const { isLoading, debugMode, setLoading, soundEnabled } = useStore();
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // Low memory mode
  const lowMemoryMode = useRef(
    navigator.deviceMemory ? navigator.deviceMemory < 4 : 
                          navigator.userAgent.includes('Mobile')
  );
  
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

  // Initialize renderer with memory-optimized settings
  const initRenderer = (state) => {
    if (!rendererRef.current && state.gl) {
      rendererRef.current = state.gl;
      
      // Configure renderer for memory efficiency
      rendererRef.current.setClearColor(0x000000);
      
      // Lower precision for better performance
      rendererRef.current.outputEncoding = THREE.LinearEncoding; // Using THREE from import
      
      // Reduce shadow map size
      rendererRef.current.shadowMap.type = THREE.BasicShadowMap; // Using THREE from import
      
      // Expose renderer for debugging
      window.renderer = rendererRef.current;
      
      console.log("Renderer configured for memory efficiency");
    }
  };
  
  // Basic render loop that just renders the scene
  const basicRenderLoop = (state) => {
    // Initialize renderer if needed
    if (!rendererRef.current) {
      initRenderer(state);
    }
    
    // Simple render that just renders the scene directly
    state.gl.render(state.scene, state.camera);
  };

  // Handle memory issues
  useEffect(() => {
    // Function to detect low memory conditions
    const checkMemory = () => {
      // Check if performance.memory is available (Chrome only)
      if (window.performance && window.performance.memory) {
        const memoryInfo = window.performance.memory;
        const usedJSHeapSize = memoryInfo.usedJSHeapSize;
        const jsHeapSizeLimit = memoryInfo.jsHeapSizeLimit;
        const memoryUsage = usedJSHeapSize / jsHeapSizeLimit;
        
        // If memory usage is over 80%, enable low memory mode
        if (memoryUsage > 0.8) {
          console.warn("High memory usage detected, enabling low memory mode");
          lowMemoryMode.current = true;
          
          // Force a garbage collection if possible
          if (window.gc) {
            try {
              window.gc();
            } catch (e) {
              console.warn("Failed to force garbage collection");
            }
          }
        }
        
        return memoryUsage;
      }
      return null;
    };
    
    // Check memory periodically
    const memoryCheckInterval = setInterval(checkMemory, 10000);
    
    return () => {
      clearInterval(memoryCheckInterval);
    };
  }, []);

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
  
  // Emergency memory cleanup
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, clean up resources
        if (window.gc) {
          try {
            window.gc();
          } catch (e) {
            console.warn("Failed to force garbage collection");
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      {isLoading && <LoadingScreen />}
      
      <Canvas
        ref={canvasRef}
        gl={{ 
          antialias: false, // Disable antialiasing for performance
          alpha: false,
          powerPreference: "default", // Use default instead of high-performance
          stencil: false,
          depth: true,
          precision: "lowp", // Use low precision for better performance
        }}
        dpr={lowMemoryMode.current ? 1 : (window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio)}
        // Set initial camera position for the angled perspective view
        camera={{
          position: [-30, 50, -30],
          fov: 45,
          near: 1, // Increased near plane for better depth precision
          far: 1000 // Reduced far plane
        }}
        // Use simple render loop
        frameloop="never"
        onCreated={initRenderer}
        shadows={false} // Disable shadows in low memory mode
      >
        <Suspense fallback={null}>
          {/* Add a render loop component */}
          <RenderLoop customRender={basicRenderLoop} />
          
          {/* Main 3D scene */}
          <CityScene />
          
          {/* Drone navigation and camera controls */}
          <DroneNavigation audio={audio} />
          
          {/* Interactive project hotspots */}
          <HotspotManager audio={audio} />
          
          {/* Camera position tracker for debug info */}
          <CameraTracker />
        </Suspense>
        
        {/* Only enable OrbitControls in debug mode */}
        {debugMode && <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />}
      </Canvas>
      
      {/* Simplified loading indicator */}
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
      
      {/* Debug Info - simplified in low memory mode */}
      {debugMode && <DebugInfo lowMemoryMode={lowMemoryMode.current} />}
      
      {/* Only show stats in debug mode and not in low memory mode */}
      {debugMode && !lowMemoryMode.current && <StatsPanel mode={0} position="top-left" />}
    </div>
  );
}

export default App;