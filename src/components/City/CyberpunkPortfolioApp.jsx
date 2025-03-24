import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader, OrbitControls } from '@react-three/drei';
import { useStore } from '../../state/useStore';

// Import our custom components
import CyberpunkCityScene from './CyberpunkCityScene';
import CyberpunkEnvironment from '../Effects/CyberpunkEnvironment';
import OptimizedRenderer from '../../utils/OptimizedRenderer';
import DroneNavigation from '../Navigation/DroneNavigation';
import HotspotManager from '../Hotspots/HotspotManager';
import DebugInfo, { CameraTracker } from '../UI/DebugInfo';
import StatsPanel from '../UI/StatsPanel';
import LoadingScreen from '../UI/LoadingScreen';
import Interface from '../UI/Interface';

// Import individual scene effects but not the rendering parts
import { 
  FlyingVehicles, 
  CyberpunkRain,
  AnimatedBillboards, 
  AtmosphericFog 
} from '../Effects/CyberpunkSceneEffects';

/**
 * Main application component integrating all cyberpunk scene elements
 * with optimized rendering pipeline
 */
function CyberpunkPortfolioApp() {
  const { isLoading, debugMode, setLoading, soundEnabled } = useStore();
  
  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      {isLoading && <LoadingScreen />}
      
      <Canvas
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
          position: [590, 450, 630] // Set initial position
        }}
        shadows={false} // Disable shadow by default for performance
      >
        {/* Create a Suspense boundary for async loading */}
        <Suspense fallback={null}>
          {/* Advanced multi-pass rendering system - replacing CyberpunkNeonEffects and PostProcessing */}
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
          
          {/* Dynamic environmental elements - these are actual 3D objects, not post-processing effects */}
          <FlyingVehicles count={15} speed={1.0} />
          <CyberpunkRain intensity={0.7} />
          <AnimatedBillboards count={8} />
          <AtmosphericFog />
          
          {/* Drone navigation and camera controls */}
          <DroneNavigation />
          
          {/* Interactive project hotspots */}
          <HotspotManager />
          
          {/* Camera controls - enhanced for cyberpunk feel */}
          <OrbitControls 
            enableDamping={true}
            dampingFactor={0.05}
            screenSpacePanning={false}
            minDistance={10}
            maxDistance={1000}
            enablePan={debugMode}
            target={[0, 10, 0]}
            // For on-demand rendering, trigger renders on camera change
            onChange={(state) => state.invalidate()}
          />
          
          {/* Camera position tracker for debug info */}
          <CameraTracker />
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
      <Interface />
      
      {/* Debug Info */}
      {debugMode && <DebugInfo />}
      
      {/* Only show stats in debug mode */}
      {debugMode && <StatsPanel mode={0} position="top-left" />}
      
      {/* Global scanline effect */}
      <div className="scanline"></div>
    </div>
  );
}

export default CyberpunkPortfolioApp;