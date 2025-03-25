import React, { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from './state/useStore';

// Direct imports instead of lazy loading
import CyberpunkEnvironment from './components/Effects/CyberpunkEnvironment';
// Import the SpatialManager class but don't initialize it yet
import { SpatialManager } from './utils/SpatialManager';

// Error boundary to catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container p-4 bg-red-900 text-white">
          <h2>Something went wrong</h2>
          <div className="error-message p-2 bg-black">
            <pre>{this.state.error?.toString()}</pre>
          </div>
          <div className="error-stack mt-2 p-2 bg-black text-xs">
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Simple debug indicator component
const DebugControls = ({ debugLevel, setDebugLevel }) => {
  return (
    <div className="fixed top-0 left-0 z-50 bg-black bg-opacity-70 p-4 text-white">
      <div className="mb-2">Debug Level: {debugLevel}</div>
      <div className="flex gap-2">
        <button 
          className="px-2 py-1 bg-blue-700 rounded"
          onClick={() => setDebugLevel(1)}>
          Base Scene
        </button>
        <button 
          className="px-2 py-1 bg-blue-700 rounded"
          onClick={() => setDebugLevel(2)}>
          + Environment
        </button>
        <button 
          className="px-2 py-1 bg-blue-700 rounded"
          onClick={() => setDebugLevel(3)}>
          + Simplified City
        </button>
        <button 
          className="px-2 py-1 bg-blue-700 rounded"
          onClick={() => setDebugLevel(4)}>
          + SpatialManager
        </button>
      </div>
    </div>
  );
};

// Simple debug scene
const SimpleBox = () => {
  return (
    <mesh>
      <boxGeometry args={[10, 10, 10]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
};

// Simple city scene replacement for debugging
const SimplifiedCity = () => {
  // Create a simple city with a few buildings
  return (
    <group>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial color="skyblue" />
      </mesh>
      <mesh position={[15, 7.5, 15]}>
        <boxGeometry args={[5, 15, 5]} />
        <meshStandardMaterial color="lightgreen" />
      </mesh>
      <mesh position={[-15, 10, -15]}>
        <boxGeometry args={[5, 20, 5]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      <mesh position={[-15, 7.5, 15]}>
        <boxGeometry args={[7, 15, 7]} />
        <meshStandardMaterial color="purple" />
      </mesh>
      <mesh position={[15, 12.5, -15]}>
        <boxGeometry args={[7, 25, 7]} />
        <meshStandardMaterial color="pink" />
      </mesh>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="darkgreen" />
      </mesh>
    </group>
  );
};

// Custom SpatialManager initializer with logging
const LimitedSpatialManager = ({ enable }) => {
  const spatialManagerRef = useRef(null);
  const { scene, camera } = useThree();
  
  useEffect(() => {
    if (!enable) return;
    
    console.log("Debug: Starting SpatialManager initialization");
    
    try {
      spatialManagerRef.current = new SpatialManager(scene, camera);
      
      // Override the initialize method to log progress
      const originalInitialize = spatialManagerRef.current.initialize;
      spatialManagerRef.current.initialize = function() {
        console.log("Debug: Calling SpatialManager initialize");
        try {
          originalInitialize.call(this);
          console.log("Debug: SpatialManager initialized successfully");
        } catch (error) {
          console.error("Debug: Error in SpatialManager initialize", error);
        }
      };
      
      // Apply the override and initialize
      spatialManagerRef.current.initialize();
      
      // Store reference globally but limit functionality
      window.spatialManager = spatialManagerRef.current;
      console.log("Debug: SpatialManager reference stored globally");
    } catch (error) {
      console.error("Debug: Failed to create SpatialManager", error);
    }
    
    return () => {
      console.log("Debug: Cleaning up SpatialManager");
      
      if (spatialManagerRef.current) {
        try {
          spatialManagerRef.current.dispose();
          window.spatialManager = null;
          console.log("Debug: SpatialManager disposed");
        } catch (error) {
          console.error("Debug: Error disposing SpatialManager", error);
        }
      }
    };
  }, [scene, camera, enable]);
  
  return null;
};

function ProgressiveDebugApp() {
  const [debugLevel, setDebugLevel] = useState(1);
  const { setLoading } = useStore();
  
  // Set loading state to false
  useEffect(() => {
    setLoading(false);
  }, [setLoading]);
  
  return (
    <div className="w-screen h-screen bg-slate-900 overflow-hidden">
      <DebugControls debugLevel={debugLevel} setDebugLevel={setDebugLevel} />
      
      <ErrorBoundary>
        <Canvas
          frameloop="demand" // On-demand rendering for better performance
          gl={{ 
            antialias: true,
            powerPreference: "default",
            depth: true
          }}
          camera={{
            fov: 60,
            near: 0.1,
            far: 2000,
            position: [50, 50, 50]
          }}
        >
          <ErrorBoundary>
            {/* Always include basic lighting */}
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            
            {/* Level 1: Just a simple box */}
            {debugLevel === 1 && (
              <SimpleBox />
            )}
            
            {/* Level 2: Add environment */}
            {debugLevel >= 2 && (
              <CyberpunkEnvironment intensity={0.3} />
            )}
            
            {/* Level 3: Add simplified city (not using the full CyberpunkCityScene) */}
            {debugLevel >= 3 && (
              <SimplifiedCity />
            )}
            
            {/* Level 4: Add spatial manager */}
            {debugLevel >= 4 && (
              <LimitedSpatialManager enable={true} />
            )}
          </ErrorBoundary>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}

export default ProgressiveDebugApp;