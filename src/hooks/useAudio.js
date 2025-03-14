import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for managing audio in the cyberpunk environment
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoplay - Whether to autoplay audio (default: false)
 * @param {number} options.volume - Initial volume (0-1, default: 0.5)
 * @param {boolean} options.loop - Whether to loop audio (default: true)
 * @returns {Object} Audio controls and state
 */
const useAudio = (options = {}) => {
  const {
    autoplay = false,
    volume = 0.5,
    loop = true,
  } = options;
  
  // State and refs
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [currentVolume, setCurrentVolume] = useState(volume);
  const [isMuted, setIsMuted] = useState(false);
  
  // AudioContext and nodes
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioSourcesRef = useRef({});
  const audioBuffersRef = useRef({});
  
  // Initialize AudioContext (must be triggered by user interaction)
  const initialize = () => {
    if (isInitialized) return;
    
    // Create AudioContext
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create main gain node
    gainNodeRef.current = audioContextRef.current.createGain();
    gainNodeRef.current.gain.value = currentVolume;
    gainNodeRef.current.connect(audioContextRef.current.destination);
    
    setIsInitialized(true);
  };
  
  // Load audio file
  const loadSound = async (id, url) => {
    if (!isInitialized) {
      console.warn('Audio not initialized. Call initialize() first.');
      return;
    }
    
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      audioBuffersRef.current[id] = audioBuffer;
      return id;
    } catch (error) {
      console.error('Error loading audio:', error);
      return null;
    }
  };
  
  // Play a sound
  const playSound = (id, options = {}) => {
    if (!isInitialized || !audioBuffersRef.current[id]) return null;
    
    // Stop existing sound if it's already playing
    if (audioSourcesRef.current[id]) {
      audioSourcesRef.current[id].stop();
      delete audioSourcesRef.current[id];
    }
    
    // Create new audio source
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffersRef.current[id];
    source.loop = options.loop !== undefined ? options.loop : loop;
    
    // Create gain node for this specific sound
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = options.volume !== undefined ? options.volume : currentVolume;
    
    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(gainNodeRef.current);
    
    // Start playback
    const startTime = options.delay ? audioContextRef.current.currentTime + options.delay : audioContextRef.current.currentTime;
    source.start(startTime);
    
    // Store reference to source
    audioSourcesRef.current[id] = {
      source,
      gainNode,
      stop: () => {
        try {
          source.stop();
          source.disconnect();
          gainNode.disconnect();
        } catch (error) {
          console.warn('Error stopping audio source:', error);
        }
      }
    };
    
    // Handle when sound finishes playing
    source.onended = () => {
      if (audioSourcesRef.current[id]) {
        delete audioSourcesRef.current[id];
      }
    };
    
    return audioSourcesRef.current[id];
  };
  
  // Stop a sound
  const stopSound = (id) => {
    if (!isInitialized || !audioSourcesRef.current[id]) return;
    
    audioSourcesRef.current[id].stop();
    delete audioSourcesRef.current[id];
  };
  
  // Stop all sounds
  const stopAllSounds = () => {
    if (!isInitialized) return;
    
    Object.keys(audioSourcesRef.current).forEach(id => {
      audioSourcesRef.current[id].stop();
    });
    
    audioSourcesRef.current = {};
  };
  
  // Set master volume
  const setVolume = (value) => {
    const newVolume = Math.max(0, Math.min(1, value));
    setCurrentVolume(newVolume);
    
    if (isInitialized && gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        isMuted ? 0 : newVolume,
        audioContextRef.current.currentTime
      );
    }
  };
  
  // Toggle mute
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (isInitialized && gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        newMuted ? 0 : currentVolume,
        audioContextRef.current.currentTime
      );
    }
  };
  
  // Play ambient background soundtrack
  const playAmbient = (id, options = {}) => {
    if (!isInitialized || !audioBuffersRef.current[id]) return;
    
    // Create ambient sound with crossfade
    const ambient = playSound(id, { 
      loop: true, 
      volume: options.volume || 0.3,
      ...options
    });
    
    return ambient;
  };
  
  // Create positional audio for 3D environment
  const createPositionalSound = (id, position, options = {}) => {
    if (!isInitialized || !audioBuffersRef.current[id]) return null;
    
    // Create audio source
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffersRef.current[id];
    source.loop = options.loop !== undefined ? options.loop : false;
    
    // Create panner for 3D positioning
    const panner = audioContextRef.current.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = options.refDistance || 1;
    panner.maxDistance = options.maxDistance || 10000;
    panner.rolloffFactor = options.rolloffFactor || 1;
    
    // Set position
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
    
    // Create gain for this sound
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = options.volume !== undefined ? options.volume : currentVolume;
    
    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(gainNodeRef.current);
    
    // Start playback
    source.start();
    
    // Store reference with unique ID
    const sourceId = `${id}_pos_${Date.now()}`;
    audioSourcesRef.current[sourceId] = {
      source,
      panner,
      gainNode,
      updatePosition: (newPosition) => {
        panner.positionX.value = newPosition.x;
        panner.positionY.value = newPosition.y;
        panner.positionZ.value = newPosition.z;
      },
      stop: () => {
        try {
          source.stop();
          source.disconnect();
          gainNode.disconnect();
          panner.disconnect();
        } catch (error) {
          console.warn('Error stopping positional audio:', error);
        }
      }
    };
    
    // Handle when sound finishes playing
    source.onended = () => {
      if (audioSourcesRef.current[sourceId]) {
        delete audioSourcesRef.current[sourceId];
      }
    };
    
    return {
      id: sourceId,
      ...audioSourcesRef.current[sourceId]
    };
  };
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (isInitialized) {
        stopAllSounds();
        
        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
        }
        
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      }
    };
  }, [isInitialized]);
  
  return {
    initialize,
    isInitialized,
    isPlaying,
    currentVolume,
    isMuted,
    loadSound,
    playSound,
    stopSound,
    stopAllSounds,
    setVolume,
    toggleMute,
    playAmbient,
    createPositionalSound
  };
};

export default useAudio;