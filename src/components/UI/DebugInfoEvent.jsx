import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';
import { useEventSystem, EVENT_TYPES, useEventListener } from '../../systems/EventSystem';

// This component will be rendered outside the Canvas
const DebugInfoEvent = () => {
  const { debugMode, dronePosition } = useStore();
  
  // Use state for rendering - but only update it when we receive events
  const [debugInfo, setDebugInfo] = useState({
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
  
  // Listen to performance metrics events
  useEventListener('performance:metrics', (data) => {
    setDebugInfo(prev => ({
      ...prev,
      fps: data.fps || prev.fps
    }));
  });
  
  // Listen to drone position events
  useEventListener('drone:position', (data) => {
    if (data.newPosition) {
      setDebugInfo(prev => ({
        ...prev,
        dronePos: [
          Math.round(data.newPosition.x * 10) / 10,
          Math.round(data.newPosition.y * 10) / 10,
          Math.round(data.newPosition.z * 10) / 10
        ]
      }));
    }
  });
  
  // Listen to camera position events
  useEventListener('camera:position', (data) => {
    if (data.position) {
      setDebugInfo(prev => ({
        ...prev,
        cameraPos: [
          Math.round(data.position.x),
          Math.round(data.position.y),
          Math.round(data.position.z)
        ]
      }));
    }
  });
  
  // Listen to renderer stats events
  useEventListener('renderer:stats', (data) => {
    setDebugInfo(prev => ({
      ...prev,
      drawCalls: data.drawCalls || prev.drawCalls,
      triangles: data.triangles || prev.triangles,
      textures: data.textures || prev.textures,
      geometries: data.geometries || prev.geometries
    }));
  });
  
  // Listen to spatial system metrics
  useEventListener('spatial:metrics', (data) => {
    setDebugInfo(prev => ({
      ...prev,
      culledObjects: data.culledObjects || prev.culledObjects,
      visibleObjects: data.visibleObjects || prev.visibleObjects,
      lodChanges: data.lodChanges || prev.lodChanges
    }));
  });
  
  // Listen to frame events to update time-sensitive info
  useEventListener(EVENT_TYPES.FRAME_END, () => {
    // For future frame-dependent updates
    // This only triggers a re-render when the frame actually completes
  });
  
  // Update from dronePosition when it changes (for initial state from store)
  useEffect(() => {
    if (dronePosition && typeof dronePosition.x === 'number') {
      setDebugInfo(prev => ({
        ...prev,
        dronePos: [
          Math.round(dronePosition.x * 10) / 10,
          Math.round(dronePosition.y * 10) / 10,
          Math.round(dronePosition.z * 10) / 10
        ]
      }));
    }
  }, [dronePosition]);
  
  if (!debugMode) return null;
  
  return (
    <div className="fixed top-4 left-4 bg-black bg-opacity-70 p-4 rounded-lg text-white font-mono text-xs z-50 pointer-events-auto">
      <div className="flex mb-2">
        <div className="bg-cyan-900 px-2 py-1 rounded-lg mr-2">DEBUG INFO</div>
        <div className={debugInfo.fps < 30 ? 'text-red-500' : 'text-green-500'}>
          FPS: {debugInfo.fps}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div>Drone:</div>
        <div>({debugInfo.dronePos[0]}, {debugInfo.dronePos[1]}, {debugInfo.dronePos[2]})</div>
        
        <div>Camera:</div>
        <div>({debugInfo.cameraPos[0]}, {debugInfo.cameraPos[1]}, {debugInfo.cameraPos[2]})</div>
        
        <div className="mt-2 font-bold text-cyan-400 col-span-2">Spatial Manager:</div>
        
        <div>Visible Objects:</div>
        <div>{debugInfo.visibleObjects}</div>
        
        <div>Culled Objects:</div>
        <div>{debugInfo.culledObjects}</div>
        
        <div>LOD Changes:</div>
        <div>{debugInfo.lodChanges}</div>
        
        <div className="mt-2 font-bold text-cyan-400 col-span-2">Render Stats:</div>
        
        <div>Draw Calls:</div>
        <div>{debugInfo.drawCalls}</div>
        
        <div>Triangles:</div>
        <div>{(debugInfo.triangles / 1000).toFixed(1)}k</div>
        
        <div>Textures:</div>
        <div>{debugInfo.textures}</div>
      </div>
      
      <div className="mt-2 text-xs text-gray-400">Press H for controls</div>
    </div>
  );
};

// Create a separate component that emits camera position updates
export const CameraTrackerEvent = () => {
  const { camera } = useThree();
  const lastPositionRef = useRef(new THREE.Vector3());
  const emitEventRef = useRef(useEventSystem.getState().emit);
  
  // Use useEventListener for frame updates
  useEventListener(EVENT_TYPES.FRAME_START, () => {
    if (camera) {
      // Only emit events when the camera position changes significantly
      // to reduce unnecessary event dispatching
      const currentPosition = camera.position.clone();
      if (currentPosition.distanceTo(lastPositionRef.current) > 0.1) {
        emitEventRef.current('camera:position', {
          position: currentPosition,
          time: performance.now()
        });
        lastPositionRef.current.copy(currentPosition);
      }
    }
  });
  
  // This component doesn't render anything
  return null;
};

export default DebugInfoEvent;