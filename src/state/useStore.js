import create from 'zustand';
import { Vector3, Euler } from 'three';

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
  
  // UI state
  activeHotspotId: null,
  isOverlayVisible: false,
  overlayContent: null,
  
  // Projects data
  projects: [],
  
  // Actions
  setLoading: (isLoading) => set({ isLoading }),
  toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),
  
  updateDronePosition: (position) => set({ dronePosition: position }),
  updateDroneRotation: (rotation) => set({ droneRotation: rotation }),
  updateDroneVelocity: (velocity) => set({ droneVelocity: velocity }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  
  setActiveHotspot: (id) => set({ activeHotspotId: id }),
  showOverlay: (content) => set({ isOverlayVisible: true, overlayContent: content }),
  hideOverlay: () => set({ isOverlayVisible: false }),
  
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