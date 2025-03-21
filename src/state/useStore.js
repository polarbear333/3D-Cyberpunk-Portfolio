import create from 'zustand';
import { Vector3, Box3 } from 'three';

const useStore = create((set, get) => ({
  // Application state
  isLoading: true,
  debugMode: true, // Set to true for development
  
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
  setLoading: (isLoading) => set({ isLoading }),
  toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),
  
  // Simplified drone position update
  updateDronePosition: (position) => set({ dronePosition: position }),
  
  setCityBounds: (bounds) => set({ cityBounds: bounds }),
  
  // UI actions
  setActiveHotspot: (id) => set({ activeHotspotId: id }),
  showOverlay: (content) => set({ isOverlayVisible: true, overlayContent: content }),
  hideOverlay: () => set({ isOverlayVisible: false }),
  
  // Audio controls
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  
  // Check if a position is inside city bounds
  isInCityBounds: (position) => {
    const { cityBounds } = get();
    if (!cityBounds) return true; // If bounds not set yet, allow movement
    
    return (
      position.x >= cityBounds.min.x && position.x <= cityBounds.max.x &&
      position.y >= cityBounds.min.y && position.y <= cityBounds.max.y &&
      position.z >= cityBounds.min.z && position.z <= cityBounds.max.z
    );
  },
  
  // Load projects from JSON file
  loadProjects: async () => {
    try {
      // This could fetch from a CMS or local JSON
      const response = await fetch('/data/projects.json');
      
      // If the JSON file doesn't exist, use default projects
      if (!response.ok) {
        console.warn('Projects JSON not found, using default projects');
        return;
      }
      
      const projects = await response.json();
      set({ projects });
    } catch (error) {
      console.error('Failed to load projects', error);
    }
  },
}));

export { useStore };