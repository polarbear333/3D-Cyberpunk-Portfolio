import { create } from 'zustand';
import { Vector3, Box3 } from 'three';
import { useEventSystem, EVENT_TYPES } from '../systems/EventSystem';

// Create the store with event system integration
export const createEventStore = () => {
  return create((set, get) => ({
    // Application state
    isLoading: true,
    debugMode: true, // Set to true for development
    assets: null, // Store for loaded assets
    
    // Drone position (simplified from main.js approach)
    dronePosition: new Vector3(0, 15, 0),
    
    // City and collision boundaries
    cityBounds: null,  // Will be set when the city model loads
    
    // UI state
    activeHotspotId: null,
    isOverlayVisible: false,
    overlayContent: null,
    
    // Audio state
    soundEnabled: true,
    
    // Projects data
    projects: [],
    
    // Actions
    setLoading: (isLoading) => {
      set({ isLoading });
      // Emit event when loading state changes
      useEventSystem.getState().emit(
        isLoading ? 'app:loading' : EVENT_TYPES.APP_LOADED, 
        { isLoading }
      );
    },
    
    toggleDebugMode: () => {
      const newDebugMode = !get().debugMode;
      set({ debugMode: newDebugMode });
      // Emit event when debug mode changes
      useEventSystem.getState().emit('app:debugMode', { 
        debugMode: newDebugMode 
      });
    },
    
    // Set assets once loaded
    setAssets: (assets) => {
      set({ assets });
      
      // Emit asset loaded event
      if (assets) {
        useEventSystem.getState().emit(EVENT_TYPES.ASSET_LOAD_COMPLETE, { 
          type: 'assets',
          assetCount: Object.keys(assets).length
        });
      }
    },
    
    // Update drone position with event integration
    updateDronePosition: (position) => {
      // Get current position for event data
      const currentPosition = get().dronePosition;
      
      // Update position in store
      set({ dronePosition: position });
      
      // Emit drone position update event
      useEventSystem.getState().emit('drone:position', {
        previousPosition: currentPosition,
        newPosition: position
      });
    },
    
    setCityBounds: (bounds) => {
      set({ cityBounds: bounds });
      
      // Emit city bounds updated event
      useEventSystem.getState().emit('city:boundsUpdated', { bounds });
    },
    
    // UI actions
    setActiveHotspot: (id) => {
      // Get previous hotspot for event data
      const previousHotspot = get().activeHotspotId;
      
      // Update state
      set({ activeHotspotId: id });
      
      // Emit hotspot selection events
      if (previousHotspot && previousHotspot !== id) {
        useEventSystem.getState().emit(EVENT_TYPES.HOTSPOT_DESELECT, { 
          id: previousHotspot 
        });
      }
      
      if (id) {
        useEventSystem.getState().emit(EVENT_TYPES.HOTSPOT_SELECT, { 
          id 
        });
      }
    },
    
    showOverlay: (content) => {
      set({ isOverlayVisible: true, overlayContent: content });
      
      // Emit overlay shown event
      useEventSystem.getState().emit(EVENT_TYPES.UI_OVERLAY_SHOW, { 
        content 
      });
    },
    
    hideOverlay: () => {
      set({ isOverlayVisible: false });
      
      // Emit overlay hidden event
      useEventSystem.getState().emit(EVENT_TYPES.UI_OVERLAY_HIDE, {});
    },
    
    // Audio controls
    toggleSound: () => {
      const newSoundEnabled = !get().soundEnabled;
      set({ soundEnabled: newSoundEnabled });
      
      // Emit sound toggle event
      useEventSystem.getState().emit('audio:toggle', { 
        enabled: newSoundEnabled 
      });
    },
    
    // Check if a position is inside city bounds
    isInCityBounds: (position) => {
      const { cityBounds } = get();
      if (!cityBounds) return true; // If bounds not set yet, allow movement
      
      const isInBounds = (
        position.x >= cityBounds.min.x && position.x <= cityBounds.max.x &&
        position.y >= cityBounds.min.y && position.y <= cityBounds.max.y &&
        position.z >= cityBounds.min.z && position.z <= cityBounds.max.z
      );
      
      // If position is not in bounds, emit event
      if (!isInBounds) {
        useEventSystem.getState().emit('drone:outOfBounds', {
          position,
          bounds: cityBounds
        });
      }
      
      return isInBounds;
    },
    
    // Load projects with event integration
    loadProjects: async () => {
      // Emit load start event
      useEventSystem.getState().emit(EVENT_TYPES.ASSET_LOAD_START, {
        type: 'projects'
      });
      
      try {
        // Try to fetch from a JSON file
        const response = await fetch('/data/projects.json');
        
        if (response.ok) {
          const projects = await response.json();
          set({ projects });
          
          // Emit load complete event
          useEventSystem.getState().emit(EVENT_TYPES.ASSET_LOAD_COMPLETE, {
            type: 'projects',
            count: projects.length
          });
        } else {
          // Use default projects if JSON file not found
          console.warn('Projects JSON not found, using default projects');
          
          const defaultProjects = [
            {
              id: 'project1',
              title: 'Web Development',
              description: 'Frontend and backend development using modern frameworks',
              technologies: ['React', 'Node.js', 'Three.js'],
              image: '/images/project1.jpg',
              url: 'https://example.com/project1'
            },
            {
              id: 'project2',
              title: 'Mobile App',
              description: 'Cross-platform mobile applications',
              technologies: ['React Native', 'Flutter', 'Firebase'],
              image: '/images/project2.jpg',
              url: 'https://example.com/project2'
            },
            {
              id: 'project3',
              title: '3D Modeling',
              description: 'Creating immersive 3D experiences',
              technologies: ['Blender', 'Three.js', 'WebGL'],
              image: '/images/project3.jpg',
              url: 'https://example.com/project3'
            },
            {
              id: 'project4',
              title: 'AI Projects',
              description: 'Intelligent solutions using machine learning',
              technologies: ['TensorFlow', 'PyTorch', 'OpenAI'],
              image: '/images/project4.jpg',
              url: 'https://example.com/project4'
            },
            {
              id: 'project5',
              title: 'Central Hub',
              description: 'Central showcase of all available projects and capabilities',
              technologies: ['Three.js', 'React', 'GSAP', 'WebGL'],
              image: '/images/central.jpg',
              url: 'https://example.com/hub'
            }
          ];
          
          set({ projects: defaultProjects });
          
          // Emit load complete event with default projects
          useEventSystem.getState().emit(EVENT_TYPES.ASSET_LOAD_COMPLETE, {
            type: 'projects',
            count: defaultProjects.length,
            isDefault: true
          });
        }
      } catch (error) {
        console.error('Failed to load projects', error);
        
        // Set empty projects array on error
        set({ projects: [] });
        
        // Emit error event
        useEventSystem.getState().emit(EVENT_TYPES.ASSET_LOAD_ERROR, {
          type: 'projects',
          error: error.message
        });
      }
    },
  }));
};

// Create a hook to connect to the eventStore
export const useEventStore = createEventStore();