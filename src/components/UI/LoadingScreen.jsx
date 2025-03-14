import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useStore } from '../../state/useStore';

const LoadingScreen = () => {
  const { setLoading } = useStore();
  const containerRef = useRef();
  const progressRef = useRef();
  const textRef = useRef();
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Simulate loading time with animated progress bar
    const tl = gsap.timeline({
      onComplete: () => {
        // Fade out loading screen when done
        gsap.to(containerRef.current, {
          opacity: 0,
          duration: 0.5,
          onComplete: () => setLoading(false)
        });
      }
    });
    
    // Glitch effect for text
    const glitchText = () => {
      if (!textRef.current) return;
      
      const originalText = "CYBER//FOLIO";
      const glitchChars = "!<>-_\\/[]{}—=+*^?#________";
      
      let iterations = 0;
      const maxIterations = 10;
      
      const interval = setInterval(() => {
        textRef.current.innerText = originalText
          .split("")
          .map((char, index) => {
            if (iterations >= maxIterations) return char;
            if (index < iterations) return char;
            return glitchChars[Math.floor(Math.random() * glitchChars.length)];
          })
          .join("");
        
        if (iterations >= maxIterations) clearInterval(interval);
        iterations += 1 / 3;
      }, 50);
      
      return () => clearInterval(interval);
    };
    
    // Loading animation sequence
    tl.to(progressRef.current, {
      width: "30%",
      duration: 0.5,
      ease: "power1.inOut"
    })
    .call(glitchText)
    .to(progressRef.current, {
      width: "60%",
      duration: 1,
      ease: "power1.inOut",
      delay: 0.3
    })
    .to(progressRef.current, {
      width: "100%",
      duration: 0.8,
      ease: "power1.inOut",
      delay: 0.3
    });
    
    return () => {
      tl.kill();
    };
  }, [setLoading]);
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
    >
      <h1 
        ref={textRef}
        className="text-5xl font-bold text-cyan-500 mb-8"
      >
        CYBER//FOLIO
      </h1>
      
      <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div 
          ref={progressRef}
          className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500"
          style={{ width: "0%" }}
        ></div>
      </div>
      
      <div className="mt-8 text-gray-400 flex flex-col items-center">
        <p className="mb-2">INITIALIZING CYBERPUNK ENVIRONMENT</p>
        <div className="text-xs text-cyan-300 animate-pulse">PRESS ANY KEY TO SKIP</div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-r from-transparent via-cyan-900 to-transparent opacity-20"></div>
      <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-r from-transparent via-fuchsia-900 to-transparent opacity-20"></div>
    </div>
  );
};

export default LoadingScreen;