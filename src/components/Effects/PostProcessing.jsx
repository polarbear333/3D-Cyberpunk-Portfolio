import React, { useRef, useEffect } from 'react';
import { 
  EffectComposer, 
  Bloom, 
  ChromaticAberration, 
  Vignette, 
  Noise,
  GodRays
} from '@react-three/postprocessing';
import { BlendFunction, Resizer, KernelSize } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import { useStore } from '../../state/useStore';

const PostProcessing = () => {
  const { gl, scene, camera } = useThree();
  const composerRef = useRef();
  const sunRef = useRef();
  
  // Create a sun/light source for god rays
  useEffect(() => {
    if (!sunRef.current) {
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff00ff })
      );
      sun.position.set(0, 30, -100);
      sun.layers.enable(1);
      scene.add(sun);
      sunRef.current = sun;
    }
    
    return () => {
      if (sunRef.current) {
        scene.remove(sunRef.current);
      }
    };
  }, [scene]);

  return (
    <EffectComposer ref={composerRef} multisampling={8}>
      {/* Bloom effect for neon glow */}
      <Bloom 
        intensity={1.5}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.LARGE}
      />
      
      {/* Chromatic aberration for that digital distortion look */}
      <ChromaticAberration
        offset={[0.003, 0.003]}
        blendFunction={BlendFunction.NORMAL}
        opacity={0.5}
      />
      
      {/* Vignette for darker edges */}
      <Vignette
        offset={0.3}
        darkness={0.7}
        blendFunction={BlendFunction.NORMAL}
      />
      
      {/* Film grain noise */}
      <Noise
        opacity={0.06}
        blendFunction={BlendFunction.OVERLAY}
      />
      
      {/* God rays for dramatic lighting - only works when sun is visible */}
      {sunRef.current && (
        <GodRays
          sun={sunRef.current}
          blendFunction={BlendFunction.SCREEN}
          samples={60}
          density={0.8}
          decay={0.95}
          weight={0.9}
          exposure={0.6}
          clampMax={1}
          blur={true}
        />
      )}
    </EffectComposer>
  );
};

export default PostProcessing;