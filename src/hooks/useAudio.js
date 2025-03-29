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
    // Prevent double initialization
    if (audioContextRef.current) return;

    try {
      // Create AudioContext
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

      // Create main gain node
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = currentVolume;
      gainNodeRef.current.connect(audioContextRef.current.destination);

      setIsInitialized(true); // Set state *after* successful context creation
      console.log("AudioContext initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize AudioContext:", error);
        // Ensure refs are null if initialization fails
        audioContextRef.current = null;
        gainNodeRef.current = null;
        setIsInitialized(false);
    }
  };

  // Load audio file
  const loadSound = async (id, url) => {
    // --- FIX 2: Check the ref directly ---
    if (!audioContextRef.current) {
      console.warn(`Audio context not ready. Cannot load sound: ${id}`);
      // Optionally throw an error or return a specific status
      return Promise.reject(new Error("Audio context not initialized"));
    }
    // --------------------------------------

    // Avoid reloading if already cached
    if (audioBuffersRef.current[id]) {
        console.log(`Sound ${id} already cached.`);
        return Promise.resolve(id);
    }

    try {
      console.log(`Fetching sound: ${id} from ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      console.log(`Decoding audio data for: ${id}`);
      // Use the existing context ref
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      audioBuffersRef.current[id] = audioBuffer;
      console.log(`Sound ${id} loaded and decoded successfully.`);
      return id;
    } catch (error) {
      console.error(`Error loading audio ${id}:`, error);
      // Propagate the error
      return Promise.reject(error);
    }
  };

  // Play a sound
  const playSound = (id, options = {}) => {
    // Check context and buffer existence
    if (!audioContextRef.current || !audioBuffersRef.current[id]) {
        console.warn(`Cannot play sound ${id}: Context or buffer not ready.`);
        return null;
    }

    // Stop existing sound if it's already playing (optional, depends on desired behavior)
    if (audioSourcesRef.current[id]) {
      try {
        audioSourcesRef.current[id].source.stop();
      } catch (e) { /* Ignore errors if already stopped */ }
      delete audioSourcesRef.current[id];
    }

    // Create new audio source
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffersRef.current[id];
    source.loop = options.loop !== undefined ? options.loop : loop;

    // Create gain node for this specific sound
    const gainNode = audioContextRef.current.createGain();
    // Apply mute status directly here
    gainNode.gain.value = isMuted ? 0 : (options.volume !== undefined ? options.volume : currentVolume);

    // Connect nodes: source -> gainNode -> mainGain -> destination
    source.connect(gainNode);
    gainNode.connect(gainNodeRef.current);

    // Start playback
    const startTime = options.delay ? audioContextRef.current.currentTime + options.delay : audioContextRef.current.currentTime;
    source.start(startTime);
    setIsPlaying(true); // Update general playing state

    // Store reference to source and its gain node
    const sourceControl = {
      source,
      gainNode,
      stop: () => {
        try {
          source.stop();
          source.disconnect();
          gainNode.disconnect();
        } catch (error) {
          console.warn('Error stopping audio source:', error);
        } finally {
            // Clean up ref after stopping
            if (audioSourcesRef.current[id] === sourceControl) {
                delete audioSourcesRef.current[id];
            }
        }
      }
    };
    audioSourcesRef.current[id] = sourceControl;


    // Handle when sound finishes playing (important for non-looping sounds)
    source.onended = () => {
      // Check if this specific source instance is still the one tracked
      if (audioSourcesRef.current[id] === sourceControl) {
        delete audioSourcesRef.current[id];
        // Update general playing state if no sounds are left
        if (Object.keys(audioSourcesRef.current).length === 0) {
            setIsPlaying(false);
        }
      }
    };

    return sourceControl; // Return the control object
  };

  // Stop a sound
  const stopSound = (id) => {
    if (!audioContextRef.current || !audioSourcesRef.current[id]) return;

    audioSourcesRef.current[id].stop(); // stop() method handles cleanup now
    // No need to delete here, stop() does it
  };

  // Stop all sounds
  const stopAllSounds = () => {
    if (!audioContextRef.current) return;

    Object.keys(audioSourcesRef.current).forEach(id => {
      // Use a copy of the key array in case stop() modifies the object during iteration
      const sourceControl = audioSourcesRef.current[id];
      if (sourceControl) {
          sourceControl.stop();
      }
    });

    // Ensure the ref object is cleared
    audioSourcesRef.current = {};
    setIsPlaying(false);
  };

  // Set master volume
  const setVolume = (value) => {
    const newVolume = Math.max(0, Math.min(1, value));
    setCurrentVolume(newVolume);

    if (audioContextRef.current && gainNodeRef.current) {
      // Apply volume respecting mute state
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

    if (audioContextRef.current && gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        newMuted ? 0 : currentVolume, // Use currentVolume when unmuting
        audioContextRef.current.currentTime
      );
    }
  };

  // Play ambient background soundtrack
  const playAmbient = (id, options = {}) => {
    // Check context and buffer existence
    if (!audioContextRef.current || !audioBuffersRef.current[id]) {
        console.warn(`Cannot play ambient sound ${id}: Context or buffer not ready.`);
        return null;
    }

    console.log(`Playing ambient sound: ${id}`);
    // Use playSound for consistency, ensuring loop is true
    const ambientOptions = {
      loop: true,
      volume: options.volume !== undefined ? options.volume : 0.3,
      ...options // Allow overriding other options if needed
    };
    const ambient = playSound(id, ambientOptions);

    return ambient;
  };

  // Create positional audio for 3D environment
  const createPositionalSound = (id, position, options = {}) => {
     // Check context and buffer existence
    if (!audioContextRef.current || !audioBuffersRef.current[id]) {
        console.warn(`Cannot create positional sound ${id}: Context or buffer not ready.`);
        return null;
    }

    // Create audio source
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffersRef.current[id];
    source.loop = options.loop !== undefined ? options.loop : false;

    // Create panner for 3D positioning
    const panner = audioContextRef.current.createPanner();
    panner.panningModel = options.panningModel || 'HRTF'; // Default to HRTF
    panner.distanceModel = options.distanceModel || 'inverse'; // Default distance model
    panner.refDistance = options.refDistance || 1;
    panner.maxDistance = options.maxDistance || 10000;
    panner.rolloffFactor = options.rolloffFactor || 1;
    panner.coneInnerAngle = options.coneInnerAngle || 360; // Omni-directional by default
    panner.coneOuterAngle = options.coneOuterAngle || 360;
    panner.coneOuterGain = options.coneOuterGain || 0;

    // Set initial position
    if (panner.positionX) { // Standard API
        panner.positionX.setValueAtTime(position.x, audioContextRef.current.currentTime);
        panner.positionY.setValueAtTime(position.y, audioContextRef.current.currentTime);
        panner.positionZ.setValueAtTime(position.z, audioContextRef.current.currentTime);
    } else if (panner.setPosition) { // Older API fallback
        panner.setPosition(position.x, position.y, position.z);
    }


    // Create gain for this sound
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = isMuted ? 0 : (options.volume !== undefined ? options.volume : currentVolume);

    // Connect nodes: source -> gainNode -> panner -> mainGain -> destination
    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(gainNodeRef.current);

    // Start playback
    source.start(audioContextRef.current.currentTime + (options.delay || 0));
    setIsPlaying(true);

    // Store reference with unique ID
    const sourceId = `${id}_pos_${Date.now()}`;
    const sourceControl = {
      source,
      panner,
      gainNode,
      updatePosition: (newPosition) => {
        if (panner.positionX) {
            // Smooth update using linearRampToValueAtTime for potentially better results
            const rampTime = audioContextRef.current.currentTime + 0.05; // Short ramp
            panner.positionX.linearRampToValueAtTime(newPosition.x, rampTime);
            panner.positionY.linearRampToValueAtTime(newPosition.y, rampTime);
            panner.positionZ.linearRampToValueAtTime(newPosition.z, rampTime);
        } else if (panner.setPosition) {
            panner.setPosition(newPosition.x, newPosition.y, newPosition.z);
        }
      },
      stop: () => {
        try {
          source.stop();
          source.disconnect();
          gainNode.disconnect();
          panner.disconnect();
        } catch (error) {
          console.warn('Error stopping positional audio:', error);
        } finally {
            if (audioSourcesRef.current[sourceId] === sourceControl) {
                delete audioSourcesRef.current[sourceId];
            }
        }
      }
    };
    audioSourcesRef.current[sourceId] = sourceControl;


    // Handle when sound finishes playing
    source.onended = () => {
      if (audioSourcesRef.current[sourceId] === sourceControl) {
        delete audioSourcesRef.current[sourceId];
        if (Object.keys(audioSourcesRef.current).length === 0) {
            setIsPlaying(false);
        }
      }
    };

    return {
      id: sourceId,
      ...sourceControl
    };
  };

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Check if context was ever created
      if (audioContextRef.current) {
        console.log("Cleaning up audio resources.");
        stopAllSounds(); // Stop all active sounds

        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current = null;
        }

        // Close the AudioContext
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(e => console.error("Error closing AudioContext:", e));
        }
        audioContextRef.current = null;
        setIsInitialized(false); // Reset initialization state
      }
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  // Expose isInitialized state along with methods
  return {
    initialize,
    isInitialized, // Expose the state for external checks if needed
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