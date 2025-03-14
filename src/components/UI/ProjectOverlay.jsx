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
      backgroundColor: 'rgba(0, 0, 0, 0)' 
    });
    gsap.set(contentRef.current, { 
      y: 50, 
      opacity: 0 
    });
    
    // Animate in
    const tl = gsap.timeline();
    tl.to(overlayRef.current, {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      duration: 0.5
    });
    tl.to(contentRef.current, {
      y: 0,
      opacity: 1,
      duration: 0.5,
      ease: 'power2.out'
    });
    
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
      duration: 0.3
    });
    tl.to(overlayRef.current, {
      backgroundColor: 'rgba(0, 0, 0, 0)',
      duration: 0.3
    });
  };
  
  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm z-50 pointer-events-auto"
    >
      <div 
        ref={contentRef}
        className="w-full max-w-2xl mx-auto bg-gray-900 bg-opacity-90 border border-cyan-500 shadow-lg rounded-lg overflow-hidden"
      >
        {/* Project header */}
        <div className="relative">
          <div className="h-48 bg-gradient-to-r from-fuchsia-900 to-cyan-900 flex items-end">
            <div className="absolute inset-0 opacity-40" style={{
              backgroundImage: `url(${project.image || '/images/placeholder.jpg'})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }} />
            <h2 className="text-3xl font-bold text-white p-6 z-10 drop-shadow-lg">
              {project.title}
            </h2>
          </div>
          
          {/* Close button */}
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black bg-opacity-50 text-white flex items-center justify-center hover:bg-opacity-70 transition"
          >
            ✕
          </button>
        </div>
        
        {/* Project content */}
        <div className="p-6">
          <p className="text-gray-300 mb-6">{project.description}</p>
          
          {/* Technologies */}
          <div className="mb-6">
            <h3 className="text-cyan-400 text-lg mb-2">Technologies</h3>
            <div className="flex flex-wrap gap-2">
              {project.technologies.map((tech, index) => (
                <span 
                  key={index} 
                  className="px-3 py-1 bg-gray-800 text-cyan-300 text-sm rounded-full border border-cyan-700"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
          
          {/* Visit project button */}
          <div className="flex justify-end mt-6">
            <a 
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-medium rounded-md transition-colors duration-200 inline-flex items-center"
            >
              Visit Project
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverlay;