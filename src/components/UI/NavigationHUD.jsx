import React, { useState, useEffect } from 'react';
import { useStore } from '../../state/useStore';
import * as THREE from 'three';

const NavigationHUD = () => {
  const { dronePosition, activeHotspotId } = useStore();
  const [altitude, setAltitude] = useState(0);
  const [showCompass, setShowCompass] = useState(true);
  const [time, setTime] = useState(new Date());
  
  // Update altitude value
  useEffect(() => {
    setAltitude(Math.floor(dronePosition.y));
  }, [dronePosition]);
  
  // Update time every second for the cyberpunk clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Format time for display in cyberpunk style
  const formatTime = () => {
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };
  
  return (
    <div className="pointer-events-none">
      {/* Altitude indicator - cyberpunk styled */}
      <div className="absolute bottom-6 left-6 text-cyan-500 font-mono">
        <div className="cyber-container p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs opacity-70">ALTITUDE</span>
            <div className="h-px flex-grow mx-2 bg-cyan-500 opacity-30"></div>
            <span className="neon-text text-lg">{altitude.toString().padStart(3, '0')} M</span>
          </div>
          
          {/* Add more cyberpunk UI elements */}
          <div className="flex justify-between items-center">
            <span className="text-xs opacity-70">SECTOR</span>
            <div className="h-px flex-grow mx-2 bg-cyan-500 opacity-30"></div>
            <span className="text-cyan-400">NEO-TOKYO</span>
          </div>
          
          {/* Coordinates in hexadecimal for cyberpunk feel */}
          <div className="mt-2 text-xs text-cyan-400 flex justify-between">
            <span>X: 0x{Math.abs(Math.floor(dronePosition.x)).toString(16).toUpperCase().padStart(4, '0')}</span>
            <span>Z: 0x{Math.abs(Math.floor(dronePosition.z)).toString(16).toUpperCase().padStart(4, '0')}</span>
          </div>
          
          {/* Time display */}
          <div className="mt-2 text-xs border-t border-cyan-900 pt-1 flex justify-between items-center">
            <span className="text-cyan-300 opacity-70">SYS_TIME</span>
            <span className="neon-text">{formatTime()}</span>
          </div>
          
          {/* Battery indicator */}
          <div className="mt-2 text-xs flex items-center">
            <span className="text-cyan-300 opacity-70 mr-2">POWER</span>
            <div className="h-2 flex-grow bg-cyan-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full" style={{ width: '87%' }}></div>
            </div>
            <span className="ml-2 text-cyan-400">87%</span>
          </div>
        </div>
      </div>
      
      {/* Current project indicator - with enhanced cyberpunk styling */}
      {activeHotspotId && (
        <div className="absolute bottom-6 right-6 text-fuchsia-500 font-mono">
          <div className="cyber-container-pink p-4 rounded-lg max-w-xs">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-fuchsia-300 opacity-70 uppercase">Target Identified</span>
              <div className="h-px flex-grow mx-2 bg-fuchsia-500 opacity-30"></div>
              <span className="animate-pulse">⦿</span>
            </div>
            
            <div className="neon-text-pink text-lg mb-2">{activeHotspotId}</div>
            
            {/* Cyberpunk style status indicators */}
            <div className="grid grid-cols-2 gap-1 text-xs mt-3">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-fuchsia-500 animate-pulse rounded-full mr-1"></div>
                <span className="text-fuchsia-300">STATUS: ACTIVE</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                <span className="text-green-300">ACCESS: GRANTED</span>
              </div>
            </div>
            
            <div className="text-xs text-fuchsia-400 mt-2 border-t border-fuchsia-900 pt-2">
              <p>APPROACH TO DOCK CONNECTION</p>
              <div className="cyber-loading-bar mt-1 h-1"></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Mini-map (top-right corner) - enhanced with cyberpunk styling */}
      {showCompass && (
        <div className="absolute top-24 right-6 text-white">
          <div className="relative w-36 h-36 cyber-container rounded-full flex items-center justify-center">
            {/* Animated radar sweep effect */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div 
                className="origin-bottom-right absolute bottom-1/2 right-1/2 bg-cyan-500 opacity-30 w-1/2 h-1/2" 
                style={{ 
                  transform: `rotate(${time.getSeconds() * 6}deg)`,
                  transformOrigin: 'bottom left',
                  boxShadow: '0 0 20px 0 #00FFFF'
                }}
              ></div>
            </div>
            
            {/* Cardinal directions with neon styling */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs font-bold neon-text">N</div>
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs font-bold text-cyan-500">S</div>
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-cyan-500">W</div>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-cyan-500">E</div>
            
            {/* Grid lines for cyberpunk feel */}
            <div className="absolute inset-4 rounded-full border border-cyan-800 opacity-50"></div>
            <div className="absolute inset-8 rounded-full border border-cyan-800 opacity-30"></div>
            <div className="absolute h-full w-px bg-cyan-800 opacity-50"></div>
            <div className="absolute h-px w-full bg-cyan-800 opacity-50"></div>
            
            {/* Display hotspots on mini-map */}
            <div className="absolute w-full h-full">
              {/* Project 1 */}
              <div className="absolute w-2 h-2 bg-cyan-500 rounded-full" 
                style={{ 
                  left: '75%', 
                  top: '25%',
                  boxShadow: activeHotspotId === 'project1' ? '0 0 10px #00FFFF' : 'none'
                }}
              />
              
              {/* Project 2 */}
              <div className="absolute w-2 h-2 bg-fuchsia-500 rounded-full" 
                style={{ 
                  left: '25%', 
                  top: '25%',
                  boxShadow: activeHotspotId === 'project2' ? '0 0 10px #FF00FF' : 'none'
                }}
              />
              
              {/* Project 3 */}
              <div className="absolute w-2 h-2 bg-yellow-500 rounded-full" 
                style={{ 
                  left: '75%', 
                  top: '75%',
                  boxShadow: activeHotspotId === 'project3' ? '0 0 10px #FFFF00' : 'none'
                }}
              />
              
              {/* Project 4 */}
              <div className="absolute w-2 h-2 bg-pink-500 rounded-full" 
                style={{ 
                  left: '25%', 
                  top: '75%',
                  boxShadow: activeHotspotId === 'project4' ? '0 0 10px #FF1493' : 'none'
                }}
              />
              
              {/* Central hub */}
              <div className="absolute w-2 h-2 bg-green-500 rounded-full" 
                style={{ 
                  left: '50%', 
                  top: '50%',
                  boxShadow: activeHotspotId === 'project5' ? '0 0 10px #39FF14' : 'none'
                }}
              />
            </div>
            
            {/* Center dot representing the drone */}
            <div 
              className="absolute w-3 h-3 bg-white rounded-full border-2 border-cyan-500 z-10 animate-pulse"
              style={{ 
                left: `${((dronePosition.x / 50) * 0.5 + 0.5) * 100}%`,
                top: `${((dronePosition.z / 50) * 0.5 + 0.5) * 100}%`,
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 5px #00FFFF'
              }}
            ></div>
          </div>
          
          {/* Map label */}
          <div className="text-center text-xs text-cyan-500 mt-1 font-mono">RADAR_SCAN v2.4</div>
        </div>
      )}
      
      {/* Instructions overlay - cyberpunk styled */}
      <div className="fixed bottom-1/3 left-0 right-0 flex justify-center text-center pointer-events-none">
        <div className="cyber-container px-6 py-3 rounded-lg border border-cyan-600 max-w-md">
          <p className="text-sm neon-text">Click anywhere to navigate the drone</p>
          <p className="text-sm text-cyan-400 mt-1">Use mouse to rotate and zoom the camera view</p>
          <div className="mt-2 text-xs text-white opacity-60 flex items-center justify-center">
            <span className="animate-pulse mr-2">⟁</span>
            <span>Visit the glowing hotspots to explore projects</span>
            <span className="animate-pulse ml-2">⟁</span>
          </div>
        </div>
      </div>
      
      {/* Decorative corner elements */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-cyan-500 opacity-60"></div>
      <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-cyan-500 opacity-60"></div>
      <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-cyan-500 opacity-60"></div>
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-cyan-500 opacity-60"></div>
    </div>
  );
};

export default NavigationHUD;