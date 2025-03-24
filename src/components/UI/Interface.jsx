import React from 'react';
import { useStore } from '../../state/useStore';
import ProjectOverlay from './ProjectOverlay';
import NavigationHUD from './NavigationHUD';
import ControlsHelp from './ControlsHelp';

const Interface = () => {
  const { isOverlayVisible, overlayContent, activeHotspotId, hideOverlay } = useStore();
  const [showControls, setShowControls] = React.useState(true);
  
  // Hide controls help after 10 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 10000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Show controls again when pressing H
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'KeyH') {
        setShowControls(prev => !prev);
      }
    };
    
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, []);
  
  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Project detail overlay */}
      {isOverlayVisible && overlayContent && (
        <ProjectOverlay 
          project={overlayContent} 
          onClose={() => hideOverlay()} 
        />
      )}
      
      {/* Navigation HUD */}
      <NavigationHUD activeHotspotId={activeHotspotId} />
      
      {/* Controls help overlay */}
      {showControls && <ControlsHelp />}
      
      {/* Logo/branding - enhanced with cyberpunk style */}
      <div className="absolute top-4 left-4 glitch neon-text-pink text-3xl font-cyberpunk" data-text="CYBER//FOLIO">
        CYBER//FOLIO
      </div>
      
      {/* FPS and debug info - styled like a cyberpunk HUD element */}
      <div className="absolute top-4 left-36 cyber-container text-xs text-cyan-400 px-2 py-1 opacity-80">
        <span className="text-cyan-300">FPS:</span> <span className="neon-text">65</span>
      </div>
      
      {/* Cyberpunk nav menu */}
      <nav className="absolute top-4 right-4 flex space-x-4 text-white">
        <button 
          className="pointer-events-auto px-4 py-2 cyber-button rounded-md"
          onClick={() => setShowControls(true)}
        >
          Controls
        </button>
        <button 
          className="pointer-events-auto px-4 py-2 cyber-button rounded-md"
          onClick={() => window.open('https://github.com/yourusername', '_blank')}
        >
          GitHub
        </button>
        <button 
          className="pointer-events-auto px-4 py-2 cyber-button rounded-md"
          onClick={() => window.open('mailto:your.email@example.com', '_blank')}
        >
          Contact
        </button>
      </nav>
      
      {/* Scanline element (additional to global scanlines) for stronger effect */}
      <div className="scanline"></div>
      
      {/* A simple HUD element to indicate connection status */}
      <div className="absolute bottom-16 left-4 text-xs cyber-container text-green-400 px-2 py-1 flex items-center">
        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
        <span>NETWORK: CONNECTED</span>
      </div>
      
      {/* Social icons */}
      <div className="absolute bottom-24 left-4 flex flex-col space-y-2">
        {/* Twitter icon */}
        <div className="w-8 h-8 cyber-container flex items-center justify-center text-cyan-400 hover:text-cyan-300 cursor-pointer pointer-events-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
          </svg>
        </div>
        {/* LinkedIn icon */}
        <div className="w-8 h-8 cyber-container flex items-center justify-center text-cyan-400 hover:text-cyan-300 cursor-pointer pointer-events-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/>
          </svg>
        </div>
      </div>
      
      {/* Compass in top right */}
      <div className="absolute top-16 right-4 w-8 h-8 cyber-container rounded-full flex items-center justify-center text-pink-400 rotate-45">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17l-4 4m0 0l-4-4m4 4V3" />
        </svg>
      </div>
    </div>
  );
};

export default Interface;