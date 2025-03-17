import React, { useState, useEffect } from 'react';
import { useStore } from '../../state/useStore';
import * as THREE from 'three';

const NavigationHUD = () => {
  const { dronePosition, droneVelocity, activeHotspotId, isMovingToTarget, targetPosition } = useStore();
  const [speed, setSpeed] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [showCompass, setShowCompass] = useState(true);
  const [currentDestination, setCurrentDestination] = useState(null);
  const [distance, setDistance] = useState(null);
  
  // Update HUD values
  useEffect(() => {
    const velocity = new THREE.Vector3(...droneVelocity.toArray());
    const speed = velocity.length() * 100; // Scale for display
    setSpeed(Math.floor(speed));
    setAltitude(Math.floor(dronePosition.y));
    
    // Calculate distance to target if one exists
    if (isMovingToTarget && targetPosition) {
      const dist = new THREE.Vector3(...dronePosition.toArray())
        .distanceTo(new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z));
      setDistance(Math.floor(dist));
    } else {
      setDistance(null);
    }
  }, [dronePosition, droneVelocity, isMovingToTarget, targetPosition]);
  
  // Set current destination
  useEffect(() => {
    if (activeHotspotId) {
      setCurrentDestination(activeHotspotId);
    } else {
      setCurrentDestination(null);
    }
  }, [activeHotspotId]);
  
  return (
    <div className="pointer-events-none">
      {/* Speed and altitude indicator */}
      <div className="absolute bottom-6 left-6 text-cyan-500 font-mono">
        <div className="bg-black bg-opacity-40 backdrop-blur-sm border border-cyan-500 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span>SPEED</span>
            <span className="text-lg">{speed.toString().padStart(3, '0')} KM/H</span>
          </div>
          <div className="flex justify-between">
            <span>ALTITUDE</span>
            <span className="text-lg">{altitude.toString().padStart(3, '0')} M</span>
          </div>
          
          {/* Target information - only show when moving to a target */}
          {distance !== null && (
            <div className="mt-2 pt-2 border-t border-cyan-800">
              <div className="flex justify-between text-fuchsia-500">
                <span>TARGET</span>
                <span className="text-lg">{distance.toString().padStart(3, '0')} M</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Current project indicator */}
      {activeHotspotId && (
        <div className="absolute bottom-6 right-6 text-fuchsia-500 font-mono">
          <div className="bg-black bg-opacity-40 backdrop-blur-sm border border-fuchsia-500 p-4 rounded-lg">
            <div className="text-sm opacity-70 mb-1">PROJECT DETECTED</div>
            <div className="text-lg">{activeHotspotId}</div>
            
            {distance !== null ? (
              <div className="text-sm opacity-70 mt-2">
                {distance < 10 ? 
                  "NEAR ENOUGH TO EXPLORE" : 
                  `DISTANCE: ${distance.toString().padStart(3, '0')} M`}
              </div>
            ) : (
              <div className="text-sm opacity-70 mt-2">APPROACH TO EXPLORE</div>
            )}
          </div>
        </div>
      )}
      
      {/* Cyberpunk-style direction indicators - arrows pointing to selected hotspot */}
      {isMovingToTarget && targetPosition && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Calculate direction */}
            {(() => {
              const targetDir = new THREE.Vector3(
                targetPosition.x - dronePosition.x,
                0,
                targetPosition.z - dronePosition.z
              ).normalize();
              
              // Only show if target is not directly in view (some distance away)
              if (distance > 15) {
                // Convert to angle in degrees
                const angle = Math.atan2(targetDir.x, targetDir.z) * (180 / Math.PI);
                
                // Position around edge of screen
                const radius = Math.min(window.innerWidth, window.innerHeight) * 0.4;
                const indicatorX = Math.sin(angle * Math.PI / 180) * radius;
                const indicatorY = Math.cos(angle * Math.PI / 180) * radius;
                
                return (
                  <div 
                    className="absolute w-12 h-12 flex items-center justify-center"
                    style={{
                      left: `calc(50% + ${indicatorX}px)`,
                      top: `calc(50% - ${indicatorY}px)`,
                      transform: `rotate(${angle}deg)`,
                    }}
                  >
                    <div className="w-8 h-8 text-fuchsia-500 animate-pulse">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L4 12h5v8h6v-8h5L12 2z" />
                      </svg>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
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
            
            {/* Direction needle */}
            <div 
              className="absolute w-0.5 h-14 bg-cyan-500 origin-bottom"
              style={{ 
                transform: `rotate(${Math.atan2(droneVelocity.x, droneVelocity.z)}rad)` 
              }}
            ></div>
          </div>
        </div>
      )}
      
      {/* Instructions overlay - only shown initially */}
      <div className="fixed bottom-1/3 left-0 right-0 flex justify-center text-center pointer-events-none">
        <div className="px-4 py-2 bg-black bg-opacity-60 backdrop-blur-sm text-cyan-400 rounded-lg border border-cyan-600 max-w-md">
          <p className="text-sm">Click on any location to fly there</p>
          <p className="text-sm mt-1">Visit the glowing hotspots to explore projects</p>
          <p className="text-xs mt-2 text-white opacity-60">Press H for controls</p>
        </div>
      </div>
    </div>
  );
};

export default NavigationHUD;