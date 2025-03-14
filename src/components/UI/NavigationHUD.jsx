import React, { useState, useEffect } from 'react';
import { useStore } from '../../state/useStore';

const NavigationHUD = () => {
  const { dronePosition, droneVelocity, activeHotspotId } = useStore();
  const [speed, setSpeed] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [showCompass, setShowCompass] = useState(true);
  
  // Update HUD values
  useEffect(() => {
    const velocity = new THREE.Vector3(...droneVelocity.toArray());
    const speed = velocity.length() * 100; // Scale for display
    setSpeed(Math.floor(speed));
    setAltitude(Math.floor(dronePosition.y));
  }, [dronePosition, droneVelocity]);
  
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
      
      {/* Compass/mini-map (simplified) */}
      {showCompass && (
        <div className="absolute top-6 right-6 text-white">
          <div className="relative w-32 h-32 bg-black bg-opacity-40 backdrop-blur-sm border border-cyan-500 rounded-full flex items-center justify-center">
            {/* Cardinal directions */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs font-bold">N</div>
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs font-bold">S</div>
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-bold">W</div>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold">E</div>
            
            {/* Center dot representing the drone */}
            <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
            
            {/* Direction needle */}
            <div 
              className="absolute w-0.5 h-14 bg-cyan-500 origin-bottom"
              style={{ 
                transform: `translateY(-50%) rotate(${-dronePosition.z * 0.01}rad)` 
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavigationHUD;