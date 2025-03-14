import React, { useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useStore } from '../../state/useStore';

const DebugInfo = () => {
  const { debugMode, dronePosition, droneVelocity, cameraMode } = useStore();
  const [info, setInfo] = useState({
    fps: 0,
    dronePos: [0, 0, 0],
    droneVel: [0, 0, 0],
    cameraMode: '',
  });
  const { camera } = useThree();
  
  // FPS calculation
  const [frames, setFrames] = useState(0);
  const [lastTime, setLastTime] = useState(performance.now());
  
  useFrame(() => {
    // Increment frame count
    setFrames(prev => prev + 1);
    
    // Calculate FPS every second
    const now = performance.now();
    if (now - lastTime > 1000) {
      const fps = Math.round((frames * 1000) / (now - lastTime));
      
      // Update state info
      setInfo({
        fps,
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
        cameraMode,
      });
      
      setFrames(0);
      setLastTime(now);
    }
  });
  
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
        <div>({Math.round(camera.position.x)}, {Math.round(camera.position.y)}, {Math.round(camera.position.z)})</div>
        
        <div>Mode:</div>
        <div>{info.cameraMode}</div>
      </div>
      
      <div className="mt-2 text-xs text-gray-400">Press H for controls</div>
    </div>
  );
};

export default DebugInfo;