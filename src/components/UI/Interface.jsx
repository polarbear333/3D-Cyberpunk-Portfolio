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
      
      {/* Logo/branding */}
      <div className="absolute top-4 left-4 text-cyan-500 text-3xl font-cyberpunk">
        CYBER//FOLIO
      </div>
      
      {/* Navigation menu */}
      <nav className="absolute top-4 right-4 flex space-x-6 text-white">
        <button 
          className="pointer-events-auto px-4 py-2 bg-fuchsia-900 bg-opacity-50 hover:bg-opacity-70 transition border border-fuchsia-500 rounded-md"
          onClick={() => setShowControls(true)}
        >
          Controls
        </button>
        <button 
          className="pointer-events-auto px-4 py-2 bg-cyan-900 bg-opacity-50 hover:bg-opacity-70 transition border border-cyan-500 rounded-md"
          onClick={() => window.open('https://github.com/yourusername', '_blank')}
        >
          GitHub
        </button>
        <button 
          className="pointer-events-auto px-4 py-2 bg-yellow-900 bg-opacity-50 hover:bg-opacity-70 transition border border-yellow-500 rounded-md"
          onClick={() => window.open('mailto:your.email@example.com', '_blank')}
        >
          Contact
        </button>
      </nav>
    </div>
  );
};

export default Interface;