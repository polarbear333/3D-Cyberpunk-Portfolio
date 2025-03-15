import create from 'zustand';
import { Vector3, Euler, Box3 } from 'three';

const useStore = create((set, get) => ({
  // Application state
  isLoading: true,
  debugMode: true, // Set to true for development
  
  // Navigation and camera
  dronePosition: new Vector3(0, 10, 0),
  droneRotation: new Euler(0, 0, 0), // Changed to Euler for proper rotation
  droneVelocity: new Vector3(0, 0, 0),
  cameraMode: 'thirdPerson', // 'firstPerson' or 'thirdPerson'
  
  // Navigation settings
  droneSpeed: 1.0,
  droneAcceleration: 0.05,
  droneTurnSpeed: 0.02,
  
  // City and collision boundaries
  cityBounds: null,  // Will be set when the city model loads
  collisionObjects: [], // Object meshes to check for collision
  
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
  
  updateDronePosition: (position) => set({ dronePosition: position }),
  updateDroneRotation: (rotation) => set({ droneRotation: rotation }),
  updateDroneVelocity: (velocity) => set({ droneVelocity: velocity }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  
  setCityBounds: (bounds) => set({ cityBounds: bounds }),
  addCollisionObject: (object) => set((state) => ({ 
    collisionObjects: [...state.collisionObjects, object] 
  })),
  
  setActiveHotspot: (id) => set({ activeHotspotId: id }),
  showOverlay: (content) => set({ isOverlayVisible: true, overlayContent: content }),
  hideOverlay: () => set({ isOverlayVisible: false }),
  
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
  
  loadProjects: async () => {
    try {
      // This could fetch from a CMS or local JSON
      const response = await fetch('/data/projects.json');
      const projects = await response.json();
      set({ projects });
    } catch (error) {
      console.error('Failed to load projects', error);
    }
  }
}));

export { useStore };