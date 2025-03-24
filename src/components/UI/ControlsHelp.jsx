import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useStore } from '../../state/useStore';

const LoadingScreen = () => {
  const { setLoading } = useStore();
  const containerRef = useRef();
  const progressRef = useRef();
  const textRef = useRef();
  const glitchLinesRef = useRef();
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Create cyberpunk-style glitch lines
    const glitchLines = glitchLinesRef.current;
    for (let i = 0; i < 20; i++) {
      const line = document.createElement('div');
      line.className = 'glitch-line';
      line.style.top = `${Math.random() * 100}%`;
      line.style.left = '0';
      line.style.right = '0';
      line.style.height = `${1 + Math.random() * 2}px`;
      line.style.position = 'absolute';
      line.style.background = i % 2 === 0 ? '#00FFFF' : '#FF00FF';
      line.style.opacity = 0.1 + Math.random() * 0.4;
      line.style.transform = 'translateX(-100%)';
      
      // Randomize animation
      const duration = 0.5 + Math.random() * 1.5;
      const delay = Math.random() * 3;
      
      gsap.to(line, {
        x: '100vw',
        duration: duration,
        repeat: -1,
        delay: delay,
        ease: 'none'
      });
      
      glitchLines.appendChild(line);
    }
    
    // Simulate loading time with animated progress bar
    const tl = gsap.timeline({
      onComplete: () => {
        // Create a more dramatic cyberpunk exit animation
        const exitTl = gsap.timeline({
          onComplete: () => setLoading(false)
        });
        
        // Glitch effect before disappearing
        exitTl.to(textRef.current, {
          x: 10,
          opacity: 0.8,
          duration: 0.05
        });
        
        exitTl.to(textRef.current, {
          x: -5,
          opacity: 0.9,
          duration: 0.05
        });
        
        exitTl.to(textRef.current, {
          x: 0,
          opacity: 1,
          duration: 0.05
        });
        
        // Final fade out
        exitTl.to(containerRef.current, {
          opacity: 0,
          duration: 0.5,
          ease: 'power2.in'
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
        if (!textRef.current) {
          clearInterval(interval);
          return;
        }
        
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
      
      // Clean up glitch lines
      while (glitchLines.firstChild) {
        glitchLines.removeChild(glitchLines.firstChild);
      }
    };
  }, [setLoading]);
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: '#05001E' }}
    >
      {/* Container for glitch lines */}
      <div ref={glitchLinesRef} className="absolute inset-0 overflow-hidden"></div>
      
      {/* Cyberpunk grid background */}
      <div className="absolute inset-0 cyber-grid opacity-20"></div>
      
      {/* Main content */}
      <div className="relative z-10 cyber-container p-10 max-w-xl w-full rounded-lg">
        {/* Corners for cyberpunk aesthetic */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-fuchsia-500"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-fuchsia-500"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500"></div>
        
        <h1 
          ref={textRef}
          className="text-5xl font-bold neon-text-pink mb-8 text-center glitch"
          data-text="CYBER//FOLIO"
        >
          CYBER//FOLIO
        </h1>
        
        {/* System boot messages */}
        <div className="mb-6 font-mono text-xs text-cyan-300">
          <p>&gt; INITIALIZING NEURAL INTERFACE</p>
          <p>&gt; ESTABLISHING DATA CONNECTION</p>
          <p>&gt; RENDERING CYBERNETIC ENVIRONMENT</p>
          <p className="text-fuchsia-400 animate-pulse">&gt; SYSTEM BOOT IN PROGRESS...</p>
        </div>
        
        {/* Cyberpunk progress bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-6 relative">
          {/* Animated neon gradient */}
          <div 
            ref={progressRef}
            className="h-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-300"
            style={{ width: "0%" }}
          ></div>
          
          {/* Scan line effect */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30" 
            style={{ 
              animation: 'loading 2s ease-in-out infinite',
              backgroundSize: '200% 100%'
            }}
          ></div>
        </div>
        
        <div className="mt-4 text-gray-400 flex flex-col items-center">
          <p className="mb-2 font-mono text-sm">BOOT SEQUENCE v2.077.b</p>
          <div className="text-xs text-cyan-300 animate-pulse flex items-center">
            <span className="mr-2">█</span>
            PRESS ANY KEY TO OVERRIDE
            <span className="ml-2">█</span>
          </div>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute bottom-4 left-0 w-full flex justify-center">
        <div className="text-xs text-gray-600 font-mono">
          SYS//ID: NE0-T0KY0-V2.4.5
        </div>
      </div>
      
      {/* Animated scan line */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute top-0 left-0 right-0 h-px bg-cyan-500 opacity-50" 
          style={{ 
            animation: 'scanline 3s linear infinite',
            boxShadow: '0 0 8px #00FFFF'
          }}
        ></div>
      </div>
      
      <style jsx>{`
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        @keyframes scanline {
          0% { transform: translateY(0vh); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;