import React, { useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';

// This component will be rendered outside the Canvas
const DebugInfo = ({ renderManager, spatialManager, uniformManager }) => {
  const { debugMode, dronePosition, droneVelocity } = useStore();
  const [info, setInfo] = useState({
    fps: 0,
    dronePos: [0, 0, 0],
    droneVel: [0, 0, 0],
    drawCalls: 0,
    triangles: 0,
    textures: 0,
    geometries: 0,
    culledObjects: 0,
    visibleObjects: 0,
    uniformUpdates: 0,
    skipRatio: 0,
    resolutionScale: 1.0
  });
  
  // FPS calculation
  const [frames, setFrames] = useState(0);
  const [lastTime, setLastTime] = useState(performance.now());
  
  // Update info from store values
  useEffect(() => {
    // Update state info with values from the store
    setInfo(prev => ({
      ...prev,
      dronePos: [
        Math.round(dronePosition.x * 10) / 10,
        Math.round(dronePosition.y * 10) / 10,
        Math.round(dronePosition.z * 10) / 10
      ],
      droneVel: [
        Math.round(droneVelocity.x * 100) / 100,
        Math.round(droneVelocity.y * 100) / 100,
        Math.round(droneVelocity.z * 100) / 100
      ],
    }));
  }, [dronePosition, droneVelocity]);

  // Calculate FPS and gather performance metrics
  useEffect(() => {
    // Only do this if debug mode is on
    if (!debugMode) return;
    
    const frameCounter = () => {
      // Increment frame count
      setFrames(prev => prev + 1);
      
      // Calculate FPS every second
      const now = performance.now();
      if (now - lastTime > 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTime));
        
        // Get renderer info if available
        let drawCalls = 0;
        let triangles = 0;
        let textures = 0;
        let geometries = 0;
        
        try {
          const rendererInfo = window.renderer?.info;
          if (rendererInfo) {
            drawCalls = rendererInfo.render?.calls || 0;
            triangles = rendererInfo.render?.triangles || 0;
            textures = rendererInfo.memory?.textures || 0;
            geometries = rendererInfo.memory?.geometries || 0;
          }
        } catch (e) {
          console.warn("Could not get renderer info");
        }
        
        // Get optimization manager info if available
        let culledObjects = 0;
        let visibleObjects = 0;
        let uniformUpdates = 0;
        let skipRatio = 0;
        let resolutionScale = 1.0;
        
        if (spatialManager) {
          const spatialMetrics = spatialManager.getPerformanceMetrics();
          culledObjects = spatialMetrics.culledObjects || 0;
          visibleObjects = spatialMetrics.visibleObjects || 0;
        }
        
        if (uniformManager) {
          const uniformMetrics = uniformManager.getStats();
          uniformUpdates = uniformMetrics.updatesThisFrame || 0;
          skipRatio = uniformMetrics.efficiency || 0;
        }
        
        if (renderManager) {
          resolutionScale = renderManager.resolutionScale || 1.0;
        }
        
        setInfo(prev => ({
          ...prev,
          fps,
          drawCalls,
          triangles,
          textures,
          geometries,
          culledObjects,
          visibleObjects,
          uniformUpdates,
          skipRatio,
          resolutionScale
        }));
        
        setFrames(0);
        setLastTime(now);
      }
      
      // Schedule next frame
      requestAnimationFrame(frameCounter);
    };

    // Start counting frames
    const frameId = requestAnimationFrame(frameCounter);
    
    // Clean up
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [debugMode, frames, lastTime, renderManager, spatialManager, uniformManager]);
  
  // Listen for camera position updates from the Canvas via a custom event
  useEffect(() => {
    const handleCameraUpdate = (event) => {
      const { cameraPosition } = event.detail;
      
      setInfo(prev => ({
        ...prev,
        cameraPos: [
          Math.round(cameraPosition.x),
          Math.round(cameraPosition.y),
          Math.round(cameraPosition.z)
        ]
      }));
    };
    
    window.addEventListener('cameraPositionUpdate', handleCameraUpdate);
    
    return () => {
      window.removeEventListener('cameraPositionUpdate', handleCameraUpdate);
    };
  }, []);
  
  if (!debugMode) return null;
  
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
        
        <div>Velocity:</div>
        <div>({info.droneVel[0]}, {info.droneVel[1]}, {info.droneVel[2]})</div>
        
        <div>Speed:</div>
        <div>{Math.sqrt(info.droneVel[0]**2 + info.droneVel[1]**2 + info.droneVel[2]**2).toFixed(2)}</div>
        
        <div className="mt-2 font-bold text-cyan-400 col-span-2">Render Stats:</div>
        
        <div>Draw Calls:</div>
        <div>{info.drawCalls}</div>
        
        <div>Triangles:</div>
        <div>{(info.triangles / 1000).toFixed(1)}k</div>
        
        <div>Textures:</div>
        <div>{info.textures}</div>
        
        <div>Resolution:</div>
        <div>{(info.resolutionScale * 100).toFixed(0)}%</div>
        
        <div className="mt-2 font-bold text-purple-400 col-span-2">Culling Stats:</div>
        
        <div>Visible:</div>
        <div>{info.visibleObjects}</div>
        
        <div>Culled:</div>
        <div>{info.culledObjects}</div>
        
        <div>Uniform Updates:</div>
        <div>{info.uniformUpdates}</div>
        
        <div>Skip Ratio:</div>
        <div>{(info.skipRatio * 100).toFixed(0)}%</div>
      </div>
      
      <div className="mt-2 text-xs text-gray-400">Press H for controls</div>
    </div>
  );
};

// Create a separate component that will be used inside the Canvas
// This component will just emit camera position updates
export const CameraTracker = () => {
  const { camera } = useThree();
  
  useFrame(() => {
    // Dispatch custom event with camera position
    window.dispatchEvent(new CustomEvent('cameraPositionUpdate', {
      detail: { cameraPosition: camera.position }
    }));
  });
  
  // This component doesn't render anything
  return null;
};

export default DebugInfo;