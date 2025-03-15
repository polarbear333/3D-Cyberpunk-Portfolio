import React, { useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';

// This component will be rendered outside the Canvas
const DebugInfo = () => {
  const { debugMode, dronePosition, droneVelocity, cameraMode } = useStore();
  const [info, setInfo] = useState({
    fps: 0,
    dronePos: [0, 0, 0],
    droneVel: [0, 0, 0],
    cameraMode: '',
    cameraPos: [0, 0, 0]
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
      cameraMode
    }));
  }, [dronePosition, droneVelocity, cameraMode]);

  // Calculate FPS
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
        
        setInfo(prev => ({
          ...prev,
          fps
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
  }, [debugMode, frames, lastTime]);
  
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div>FPS:</div>
        <div className={info.fps < 30 ? 'text-red-500' : 'text-green-500'}>{info.fps}</div>
        
        <div>Drone:</div>
        <div>({info.dronePos[0]}, {info.dronePos[1]}, {info.dronePos[2]})</div>
        
        <div>Velocity:</div>
        <div>({info.droneVel[0]}, {info.droneVel[1]}, {info.droneVel[2]})</div>
        
        <div>Camera:</div>
        <div>({info.cameraPos[0]}, {info.cameraPos[1]}, {info.cameraPos[2]})</div>
        
        <div>Mode:</div>
        <div>{info.cameraMode}</div>
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