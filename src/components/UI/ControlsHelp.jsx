import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

const ControlsHelp = () => {
  const overlayRef = useRef();
  
  useEffect(() => {
    if (!overlayRef.current) return;
    
    // Animate in
    gsap.fromTo(
      overlayRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5 }
    );
    
    // Pulse animation for key highlights
    gsap.to(
      '.key-highlight',
      {
        boxShadow: '0 0 10px #00FFFF',
        repeat: -1,
        yoyo: true,
        duration: 1
      }
    );
    
    return () => {
      gsap.killTweensOf('.key-highlight');
    };
  }, []);
  
  return (
    <div 
      ref={overlayRef}
      className="absolute bottom-1/4 left-1/2 transform -translate-x-1/2 max-w-lg w-full p-6 bg-black bg-opacity-70 backdrop-blur-sm rounded-lg border border-cyan-500 shadow-lg pointer-events-auto"
    >
      <h3 className="text-cyan-400 text-xl mb-4 text-center">DRONE CONTROLS</h3>
      
      <div className="grid grid-cols-2 gap-6 text-white">
        <div>
          <h4 className="text-fuchsia-400 mb-2">Movement</h4>
          <ul className="space-y-2">
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">W</span>
              <span>Forward</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">S</span>
              <span>Backward</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">A</span>
              <span>Strafe Left</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">D</span>
              <span>Strafe Right</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">SPACE</span>
              <span>Ascend</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">SHIFT</span>
              <span>Descend</span>
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-fuchsia-400 mb-2">Camera Control</h4>
          <ul className="space-y-2">
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">←</span>
              <span>Turn Left</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">→</span>
              <span>Turn Right</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">↑</span>
              <span>Pitch Up</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">↓</span>
              <span>Pitch Down</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">C</span>
              <span>Toggle Camera View</span>
            </li>
            <li className="flex items-center">
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">H</span>
              <span>Toggle This Help</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="text-center mt-6 text-sm text-cyan-300">
        Fly your drone close to the glowing markers to explore projects
      </div>
    </div>
  );
};

export default ControlsHelp;