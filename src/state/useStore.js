import {create} from 'zustand';
import { Vector3, Box3 } from 'three';

const useStore = create((set, get) => ({
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
  setLoading: (isLoading) => set({ isLoading }),
  toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),
  
  // Set assets once loaded
  setAssets: (assets) => set({ assets }),
  
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
  
  // Load projects from predefined data (fallback if JSON not available)
  loadProjects: async () => {
    try {
      // Try to fetch from a JSON file
      const response = await fetch('/data/projects.json');
      
      if (response.ok) {
        const projects = await response.json();
        set({ projects });
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
      }
    } catch (error) {
      console.error('Failed to load projects', error);
      
      // Set empty projects array on error
      set({ projects: [] });
    }
  },
}));

export { useStore };