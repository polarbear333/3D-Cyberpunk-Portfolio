import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const ProjectOverlay = ({ project, onClose }) => {
  const overlayRef = useRef();
  const contentRef = useRef();
  
  // Animation for the overlay
  useEffect(() => {
    if (!overlayRef.current || !contentRef.current) return;
    
    // Initial state
    gsap.set(overlayRef.current, { 
      backgroundColor: 'rgba(5, 0, 30, 0)' 
    });
    gsap.set(contentRef.current, { 
      y: 100, 
      opacity: 0,
      scale: 0.9
    });
    
    // Animate in with a more dramatic cyberpunk style
    const tl = gsap.timeline();
    tl.to(overlayRef.current, {
      backgroundColor: 'rgba(5, 0, 30, 0.8)',
      duration: 0.4
    });
    tl.to(contentRef.current, {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.5,
      ease: 'back.out(1.2)'
    });
    
    // Animate in all tech tags with a staggered effect
    tl.fromTo('.tech-tag', {
      opacity: 0,
      y: 20
    }, {
      opacity: 1,
      y: 0,
      stagger: 0.05,
      ease: 'power2.out'
    }, "-=0.3");
    
    // Event listener to close with ESC key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Handle closing with animation
  const handleClose = () => {
    const tl = gsap.timeline({
      onComplete: onClose
    });
    tl.to(contentRef.current, {
      y: 50,
      opacity: 0,
      scale: 0.9,
      duration: 0.3
    });
    tl.to(overlayRef.current, {
      backgroundColor: 'rgba(5, 0, 30, 0)',
      duration: 0.3
    });
  };
  
  // Data lines animation for cyberpunk effect
  const DataLines = () => {
    return (
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div 
            key={i}
            className="absolute h-px bg-cyan-400"
            style={{
              left: '0',
              top: `${Math.random() * 100}%`,
              width: `${50 + Math.random() * 50}%`,
              opacity: 0.1 + Math.random() * 0.8,
              animation: `dataLine ${1 + Math.random() * 4}s linear infinite`
            }}
          ></div>
        ))}
      </div>
    );
  };
  
  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 flex items-center justify-center bg-opacity-80 backdrop-blur-md z-50 pointer-events-auto"
      style={{ backgroundColor: 'rgba(5, 0, 30, 0.8)' }}
    >
      <style jsx>{`
        @keyframes dataLine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100vw); }
        }
        @keyframes scanline {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
        .scan-effect::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(to right, transparent, #00FFFF, transparent);
          box-shadow: 0 0 10px #00FFFF;
          animation: scanline 3s linear infinite;
        }
      `}</style>
      
      <div 
        ref={contentRef}
        className="w-full max-w-3xl mx-auto scan-effect overflow-hidden relative"
      >
        {/* Cyberpunk data line animations in the background */}
        <DataLines />
        
        {/* Glitch corner elements */}
        <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-cyan-500 opacity-80"></div>
        <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-fuchsia-500 opacity-80"></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-fuchsia-500 opacity-80"></div>
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-cyan-500 opacity-80"></div>
        
        {/* Project header */}
        <div className="relative">
          <div className="h-56 bg-gradient-to-r from-fuchsia-900 to-cyan-900 flex items-end overflow-hidden">
            <div className="absolute inset-0 opacity-40 cyber-grid" style={{
              backgroundImage: `url(${project.image || '/images/placeholder.jpg'})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }} />
            
            {/* Project title with glitch effect */}
            <div className="p-6 z-10 w-full">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white glitch neon-text" data-text={project.title}>
                  {project.title}
                </h2>
                <div className="text-cyan-300 text-sm font-mono border border-cyan-600 px-2 py-1 rounded">
                  ID: PRJ-{Math.floor(Math.random() * 10000).toString().padStart(4, '0')}
                </div>
              </div>
              
              {/* Cyberpunk diagonal line */}
              <div className="h-px w-full bg-gradient-to-r from-fuchsia-500 via-cyan-500 to-transparent mt-2"></div>
            </div>
          </div>
          
          {/* Close button with cyberpunk styling */}
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full cyber-container flex items-center justify-center hover:border-red-500 transition-colors duration-300"
          >
            <span className="text-cyan-400 hover:text-red-400">✕</span>
          </button>
        </div>
        
        {/* Project content with cyberpunk styling */}
        <div className="p-6 cyber-container">
          {/* Project description with terminal-like formatting */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
              <h3 className="text-cyan-400 text-lg font-mono">[system_info.dat]</h3>
            </div>
            <div className="cyber-container bg-gray-900 bg-opacity-50 p-3 rounded font-mono text-sm">
              <p className="text-green-300 mb-2">$ cat project_description.txt</p>
              <p className="text-gray-300">{project.description}</p>
            </div>
          </div>
          
          {/* Technologies with cyberpunk styling */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <div className="h-3 w-3 rounded-full bg-fuchsia-500 mr-2"></div>
              <h3 className="text-fuchsia-400 text-lg font-mono">[tech_stack.sys]</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {project.technologies.map((tech, index) => (
                <span 
                  key={index} 
                  className="tech-tag px-3 py-1 cyber-container bg-gray-900 bg-opacity-60 text-cyan-300 text-sm rounded-md border border-cyan-800"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
          
          {/* Visit project button with cyberpunk styling */}
          <div className="flex justify-between items-center mt-8">
            <div className="text-xs text-cyan-300 font-mono">
              ACCESS_LEVEL: <span className="text-green-400">GRANTED</span>
            </div>
            <a 
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cyber-button px-6 py-3 bg-fuchsia-900 bg-opacity-50 hover:bg-fuchsia-800 hover:bg-opacity-60 font-medium rounded-md transition-all duration-300"
            >
              <span className="relative z-10">VISIT PROJECT</span>
            </a>
          </div>
          
          {/* Footer with system information */}
          <div className="mt-6 pt-3 border-t border-gray-800 flex justify-between text-xs text-gray-500 font-mono">
            <div>SYS_VERSION: 2.077.05c</div>
            <div>ENCRYPTED_CONNECTION: ACTIVE</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverlay;