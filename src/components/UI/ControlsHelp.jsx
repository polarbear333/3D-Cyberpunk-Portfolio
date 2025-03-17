import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { useStore } from '../../state/useStore';

const ControlsHelp = ({ audio }) => {
  const overlayRef = useRef();
  const { soundEnabled, toggleSound } = useStore();
  
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
  
  // Play click sound on button presses
  const handleButtonClick = () => {
    if (audio?.isInitialized && soundEnabled) {
      audio.playSound('click', { volume: 0.5 });
    }
  };
  
  return (
    <div 
      ref={overlayRef}
      className="absolute bottom-1/4 left-1/2 transform -translate-x-1/2 max-w-lg w-full p-6 bg-black bg-opacity-70 backdrop-blur-sm rounded-lg border border-cyan-500 shadow-lg pointer-events-auto"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-cyan-400 text-xl">DRONE CONTROLS</h3>
        <div className="flex items-center">
          <button 
            onClick={() => {
              toggleSound();
              handleButtonClick();
            }}
            className="text-white bg-gray-800 hover:bg-gray-700 rounded-md p-2 mr-3 transition-colors"
          >
            {soundEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
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
              <span className="key-highlight w-8 h-8 bg-gray-800 flex items-center justify-center rounded-md mr-3 border border-cyan-600">H</span>
              <span>Toggle This Help</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="flex items-center justify-center mt-6">
        <div className="text-center text-sm text-cyan-300 bg-gray-900 p-3 rounded-lg border border-cyan-800">
          <p>Fly your drone close to the glowing markers to explore projects</p>
          <p className="text-xs mt-1 text-gray-400">Press ESC to close project details when viewing</p>
        </div>
      </div>
    </div>
  );
};

export default ControlsHelp;