import React, { useRef, useEffect, useState } from 'react';
import { 
  EffectComposer, 
  Bloom, 
  Vignette, 
  Noise
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';

const PostProcessing = () => {
  const { gl, scene, camera } = useThree();
  const composerRef = useRef();
  const [isSupported, setIsSupported] = useState(true);
  const { debugMode } = useStore();
  
  // Check if the device can handle post-processing
  useEffect(() => {
    // Check if the device is likely to have trouble with post-processing
    const isLowPowerDevice = 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
      (window.devicePixelRatio < 1.5);
    
    // For low-power devices, disable post-processing completely
    if (isLowPowerDevice) {
      console.log("Low power device detected, disabling post-processing");
      setIsSupported(false);
    }
    
    // Clean up function for when component unmounts
    return () => {
      if (composerRef.current) {
        const composer = composerRef.current;
        if (composer.dispose) {
          composer.dispose();
        }
      }
    };
  }, []);

  // If post-processing is not supported on this device, don't render anything
  if (!isSupported) return null;

  return (
    <EffectComposer 
      ref={composerRef} 
      multisampling={0} // Disable multisampling for better performance
      frameBufferType={16} // Use standard precision (16 instead of 32)
      enabled={true}
      disableNormalPass
    >
      {/* Bloom effect for neon glow - simplified for performance */}
      <Bloom 
        intensity={1.0} // Reduced from 1.5
        luminanceThreshold={0.3} // Increased from 0.2 to affect fewer pixels
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.MEDIUM} // Reduced from LARGE
        mipmapBlur={true} // Enable mipmapping for better performance
      />
      
      {/* Vignette for darker edges */}
      <Vignette
        offset={0.3}
        darkness={0.7}
        blendFunction={BlendFunction.NORMAL}
      />
      
      {/* Film grain noise - only if not in debug mode */}
      {!debugMode && (
        <Noise
          opacity={0.06}
          blendFunction={BlendFunction.OVERLAY}
        />
      )}
      
      {/* Removed ChromaticAberration and GodRays effects to improve performance */}
    </EffectComposer>
  );
};

export default PostProcessing;