import React, { useState, useEffect } from 'react';
import { useStore } from '../../state/useStore';
import * as THREE from 'three';

const NavigationHUD = () => {
  const { dronePosition, activeHotspotId } = useStore();
  const [altitude, setAltitude] = useState(0);
  const [showCompass, setShowCompass] = useState(true);
  
  // Update altitude value
  useEffect(() => {
    setAltitude(Math.floor(dronePosition.y));
  }, [dronePosition]);
  
  return (
    <div className="pointer-events-none">
      {/* Altitude indicator */}
      <div className="absolute bottom-6 left-6 text-cyan-500 font-mono">
        <div className="bg-black bg-opacity-40 backdrop-blur-sm border border-cyan-500 p-4 rounded-lg">
          <div className="flex justify-between">
            <span>ALTITUDE</span>
            <span className="text-lg">{altitude.toString().padStart(3, '0')} M</span>
          </div>
        </div>
      </div>
      
      {/* Current project indicator */}
      {activeHotspotId && (
        <div className="absolute bottom-6 right-6 text-fuchsia-500 font-mono">
          <div className="bg-black bg-opacity-40 backdrop-blur-sm border border-fuchsia-500 p-4 rounded-lg">
            <div className="text-sm opacity-70 mb-1">PROJECT DETECTED</div>
            <div className="text-lg">{activeHotspotId}</div>
            <div className="text-sm opacity-70 mt-2">APPROACH TO EXPLORE</div>
          </div>
        </div>
      )}
      
      {/* Mini-map (top-right corner) */}
      {showCompass && (
        <div className="absolute top-6 right-6 text-white">
          <div className="relative w-32 h-32 bg-black bg-opacity-40 backdrop-blur-sm border border-cyan-500 rounded-full flex items-center justify-center">
            {/* Cardinal directions */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs font-bold">N</div>
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs font-bold">S</div>
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-bold">W</div>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold">E</div>
            
            {/* Display hotspots on mini-map */}
            <div className="absolute w-full h-full">
              {/* Project 1 */}
              <div className="absolute w-2 h-2 bg-cyan-500 rounded-full" 
                style={{ 
                  left: '75%', 
                  top: '25%',
                  boxShadow: activeHotspotId === 'project1' ? '0 0 5px #00FFFF' : 'none'
                }}
              />
              
              {/* Project 2 */}
              <div className="absolute w-2 h-2 bg-fuchsia-500 rounded-full" 
                style={{ 
                  left: '25%', 
                  top: '25%',
                  boxShadow: activeHotspotId === 'project2' ? '0 0 5px #FF00FF' : 'none'
                }}
              />
              
              {/* Project 3 */}
              <div className="absolute w-2 h-2 bg-yellow-500 rounded-full" 
                style={{ 
                  left: '75%', 
                  top: '75%',
                  boxShadow: activeHotspotId === 'project3' ? '0 0 5px #FFFF00' : 'none'
                }}
              />
              
              {/* Project 4 */}
              <div className="absolute w-2 h-2 bg-pink-500 rounded-full" 
                style={{ 
                  left: '25%', 
                  top: '75%',
                  boxShadow: activeHotspotId === 'project4' ? '0 0 5px #FF1493' : 'none'
                }}
              />
              
              {/* Central hub */}
              <div className="absolute w-2 h-2 bg-green-500 rounded-full" 
                style={{ 
                  left: '50%', 
                  top: '50%',
                  boxShadow: activeHotspotId === 'project5' ? '0 0 5px #39FF14' : 'none'
                }}
              />
            </div>
            
            {/* Center dot representing the drone */}
            <div 
              className="absolute w-3 h-3 bg-white rounded-full border-2 border-cyan-500 z-10"
              style={{ 
                left: `${((dronePosition.x / 50) * 0.5 + 0.5) * 100}%`,
                top: `${((dronePosition.z / 50) * 0.5 + 0.5) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            ></div>
          </div>
        </div>
      )}
      
      {/* Instructions overlay - explain the controls */}
      <div className="fixed bottom-1/3 left-0 right-0 flex justify-center text-center pointer-events-none">
        <div className="px-4 py-2 bg-black bg-opacity-60 backdrop-blur-sm text-cyan-400 rounded-lg border border-cyan-600 max-w-md">
          <p className="text-sm">Click anywhere to navigate the drone</p>
          <p className="text-sm mt-1">Use mouse to rotate and zoom the camera view</p>
          <p className="text-xs mt-2 text-white opacity-60">Visit the glowing hotspots to explore</p>
        </div>
      </div>
    </div>
  );
};

export default NavigationHUD;