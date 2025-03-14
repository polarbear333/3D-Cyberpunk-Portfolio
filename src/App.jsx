import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, OrbitControls } from '@react-three/drei';
import { useStore } from './state/useStore';
import LoadingScreen from './components/UI/LoadingScreen';
import Interface from './components/UI/Interface';
import CityScene from './components/City/CityScene';
import DroneNavigation from './components/Navigation/DroneNavigation';
import HotspotManager from './components/Hotspots/HotspotManager';
import PostProcessing from './components/Effects/PostProcessing';

function App() {
  const { isLoading, debugMode } = useStore();

  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      {isLoading && <LoadingScreen />}
      
      <Canvas
        shadows
        camera={{ position: [0, 15, 30], fov: 60 }}
        gl={{ antialias: true }}
      >
        {debugMode && <Stats />}
        <Suspense fallback={null}>
          {/* Main 3D scene */}
          <CityScene />
          
          {/* Drone navigation and camera controls */}
          <DroneNavigation />
          
          {/* Interactive project hotspots */}
          <HotspotManager />
          
          {/* Cyberpunk visual effects */}
          <PostProcessing />
        </Suspense>
        
        {debugMode && <OrbitControls />}
      </Canvas>
      
      {/* 2D UI overlay */}
      <Interface />
    </div>
  );
}

export default App;