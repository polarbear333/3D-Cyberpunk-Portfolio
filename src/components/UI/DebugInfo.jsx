import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';

// This component will be rendered outside the Canvas
const DebugInfo = () => {
  const { debugMode, dronePosition } = useStore();
  const infoRef = useRef({
    fps: 0,
    dronePos: [0, 0, 0],
    drawCalls: 0,
    triangles: 0,
    textures: 0,
    geometries: 0,
    cameraPos: [0, 0, 0],
    // SpatialManager metrics
    culledObjects: 0,
    visibleObjects: 0,
    lodChanges: 0
  });
  
  // Use state only for triggering renders, not for storing metrics
  const [, setUpdateTrigger] = useState(0);
  
  // FPS calculation with refs to avoid state updates
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef(null);
  const updateIntervalRef = useRef(null);
  
  // Update metrics from dronePosition when it changes
  useEffect(() => {
    if (dronePosition && typeof dronePosition.x === 'number') {
      infoRef.current.dronePos = [
        Math.round(dronePosition.x * 10) / 10,
        Math.round(dronePosition.y * 10) / 10,
        Math.round(dronePosition.z * 10) / 10
      ];
    }
  }, [dronePosition]);

  // Calculate FPS and gather performance metrics
  useEffect(() => {
    if (!debugMode) return;
    
    // Function to count frames - doesn't update state directly
    const countFrame = () => {
      framesRef.current++;
      rafIdRef.current = requestAnimationFrame(countFrame);
    };

    // Start the frame counter
    rafIdRef.current = requestAnimationFrame(countFrame);
    
    // Periodically update metrics (once per second)
    updateIntervalRef.current = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      
      if (elapsed > 0) {
        // Calculate FPS
        const fps = Math.round((framesRef.current * 1000) / elapsed);
        
        // Get renderer info if available
        let drawCalls = 0;
        let triangles = 0;
        let textures = 0;
        let geometries = 0;
        
        // Get SpatialManager metrics if available
        let culledObjects = 0;
        let visibleObjects = 0;
        let lodChanges = 0;
        
        try {
          const rendererInfo = window.renderer?.info;
          if (rendererInfo) {
            drawCalls = rendererInfo.render?.calls || 0;
            triangles = rendererInfo.render?.triangles || 0;
            textures = rendererInfo.memory?.textures || 0;
            geometries = rendererInfo.memory?.geometries || 0;
          }
          
          // Get SpatialManager metrics
          if (window.spatialManager?.initialized) {
            const spatialMetrics = window.spatialManager.getPerformanceMetrics();
            culledObjects = spatialMetrics.culledObjects || 0;
            visibleObjects = spatialMetrics.visibleObjects || 0;
            lodChanges = spatialMetrics.lodChanges || 0;
          }
        } catch (e) {
          console.warn("Could not get renderer or SpatialManager info");
        }
        
        // Update ref values instead of state
        infoRef.current = {
          ...infoRef.current,
          fps,
          drawCalls,
          triangles,
          textures,
          geometries,
          culledObjects,
          visibleObjects,
          lodChanges
        };
        
        // Reset frame counter
        framesRef.current = 0;
        lastTimeRef.current = now;
        
        // Trigger a single re-render
        setUpdateTrigger(prev => prev + 1);
      }
    }, 1000); // Update only once per second
    
    // Cleanup on unmount
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [debugMode]);
  
  // Handle camera position updates
  useEffect(() => {
    const handleCameraUpdate = (event) => {
      if (event.detail && event.detail.cameraPosition) {
        const { cameraPosition } = event.detail;
        
        infoRef.current.cameraPos = [
          Math.round(cameraPosition.x),
          Math.round(cameraPosition.y),
          Math.round(cameraPosition.z)
        ];
        
        // No need to trigger a re-render for every camera position change
        // The periodic update will show the latest values
      }
    };
    
    window.addEventListener('cameraPositionUpdate', handleCameraUpdate);
    
    return () => {
      window.removeEventListener('cameraPositionUpdate', handleCameraUpdate);
    };
  }, []);
  
  if (!debugMode) return null;
  
  // Destructure info from ref for readability
  const info = infoRef.current;
  
  return (
    <div className="fixed top-4 left-4 bg-black bg-opacity-70 p-4 rounded-lg text-white font-mono text-xs z-50 pointer-events-auto">
      <div className="flex mb-2">
        <div className="bg-cyan-900 px-2 py-1 rounded-lg mr-2">DEBUG INFO</div>
        <div className={info.fps < 30 ? 'text-red-500' : 'text-green-500'}>
          FPS: {info.fps}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div>Drone:</div>
        <div>({info.dronePos[0]}, {info.dronePos[1]}, {info.dronePos[2]})</div>
        
        <div>Camera:</div>
        <div>({info.cameraPos[0]}, {info.cameraPos[1]}, {info.cameraPos[2]})</div>
        
        <div className="mt-2 font-bold text-cyan-400 col-span-2">Spatial Manager:</div>
        
        <div>Visible Objects:</div>
        <div>{info.visibleObjects}</div>
        
        <div>Culled Objects:</div>
        <div>{info.culledObjects}</div>
        
        <div>LOD Changes:</div>
        <div>{info.lodChanges}</div>
        
        <div className="mt-2 font-bold text-cyan-400 col-span-2">Render Stats:</div>
        
        <div>Draw Calls:</div>
        <div>{info.drawCalls}</div>
        
        <div>Triangles:</div>
        <div>{(info.triangles / 1000).toFixed(1)}k</div>
        
        <div>Textures:</div>
        <div>{info.textures}</div>
      </div>
      
      <div className="mt-2 text-xs text-gray-400">Press H for controls</div>
    </div>
  );
};

// Create a separate component that will be used inside the Canvas
// This component will just emit camera position updates
export const CameraTracker = () => {
  const { camera } = useThree();
  const lastPositionRef = useRef(new THREE.Vector3());
  
  useFrame(() => {
    if (camera) {
      // Only emit events when the camera position changes significantly
      // to reduce unnecessary event dispatching
      const currentPosition = camera.position.clone();
      if (currentPosition.distanceTo(lastPositionRef.current) > 0.1) {
        window.dispatchEvent(new CustomEvent('cameraPositionUpdate', {
          detail: { cameraPosition: currentPosition }
        }));
        lastPositionRef.current.copy(currentPosition);
      }
    }
  });
  
  // This component doesn't render anything
  return null;
};

export default DebugInfo;