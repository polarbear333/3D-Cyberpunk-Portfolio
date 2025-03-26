import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { raf } from '@react-spring/rafz';
import React from 'react';

// Priority levels for different types of updates
export const PRIORITY = {
  CRITICAL: 0,   // Camera, core UI
  HIGH: 1,       // Drone movement, active interactions
  MEDIUM: 2,     // Visual effects, animations
  LOW: 3,        // Background effects, distant objects
  IDLE: 4        // Non-essential updates (debug info, etc.)
};

// Create event system store
export const useEventSystem = create(
  subscribeWithSelector((set, get) => ({
    // Core state
    active: true,
    frameRate: 60,
    deltaTime: 0,
    elapsedTime: 0,
    lastTime: 0,
    frameCount: 0,
    
    // Performance monitoring
    performanceMetrics: {
      fps: 60,
      frameTime: 0,
      eventCount: 0,
      culledObjects: 0,
      visibleObjects: 0,
      drawnCalls: 0,
    },
    
    // Frame control
    useCustomLoop: true,   // Use rafz instead of useFrame
    throttleFrameRate: false,
    targetFrameRate: 60,
    
    // Events
    events: new Map(),         // All registered event types
    listeners: new Map(),      // Event listeners
    updateQueue: [],           // Queue of systems to update
    priorityQueue: [],         // Sorted by priority
    
    // Scheduling state
    needsUpdate: false,        // Flag to trigger a render
    isProcessing: false,       // Lock to prevent concurrent processing
    
    // Initialize the system
    initialize: () => {
      console.log('EventSystem initialized');
      const now = performance.now();
      set({ 
        lastTime: now,
        elapsedTime: 0
      });
      
      // Start the frame loop if using custom loop
      if (get().useCustomLoop) {
        raf.onStart(get().processFrame);
        // Initial frame request
        get().requestFrame();
      }
    },
    
    // Register a new event type
    registerEvent: (eventType, options = {}) => {
      const events = get().events;
      if (!events.has(eventType)) {
        events.set(eventType, {
          name: eventType,
          priority: options.priority || PRIORITY.MEDIUM,
          throttle: options.throttle || 0,
          lastFired: 0,
          ...options
        });
        set({ events });
        return true;
      }
      return false;
    },
    
    // Subscribe to an event
    subscribe: (id, eventType, callback, priority = PRIORITY.MEDIUM) => {
      const listeners = new Map(get().listeners);
      
      // Register event type if it doesn't exist
      if (!get().events.has(eventType)) {
        get().registerEvent(eventType);
      }
      
      // Add listener
      listeners.set(id, { 
        id, 
        eventType, 
        callback, 
        priority,
        active: true 
      });
      
      set({ listeners });
      
      // Return unsubscribe function
      return () => get().unsubscribe(id);
    },
    
    // Unsubscribe from events
    unsubscribe: (id) => {
      const listeners = new Map(get().listeners);
      const result = listeners.delete(id);
      set({ listeners });
      return result;
    },
    
    // Emit an event
    emit: (eventType, data = {}) => {
      const state = get();
      const events = state.events;
      
      // Track how many events are processed
      let metrics = { ...state.performanceMetrics };
      metrics.eventCount++;
      
      // Check if this event type exists
      if (!events.has(eventType)) {
        console.warn(`Event type "${eventType}" not registered.`);
        return false;
      }
      
      // Get event configuration
      const event = events.get(eventType);
      const now = performance.now();
      
      // Check throttling
      if (event.throttle > 0 && now - event.lastFired < event.throttle) {
        return false;
      }
      
      // Update event last fired time
      event.lastFired = now;
      events.set(eventType, event);
      
      // Flag that we need an update
      if (!state.needsUpdate) {
        state.requestFrame();
      }
      
      // Add data to event context
      const context = {
        ...data,
        time: state.elapsedTime,
        deltaTime: state.deltaTime,
        frameCount: state.frameCount,
        type: eventType
      };
      
      // Find listeners for this event type
      const relevantListeners = Array.from(state.listeners.values())
        .filter(listener => listener.eventType === eventType && listener.active);
      
      // Execute callbacks
      relevantListeners.forEach(listener => {
        try {
          listener.callback(context);
        } catch (error) {
          console.error(`Error in listener for ${eventType}:`, error);
        }
      });
      
      set({ 
        events,
        performanceMetrics: metrics,
        needsUpdate: true
      });
      
      return true;
    },
    
    // Register a system that needs updates each frame
    registerSystem: (id, updateFn, priority = PRIORITY.MEDIUM) => {
      const updateQueue = [...get().updateQueue];
      
      // Check if system is already registered
      const existingIndex = updateQueue.findIndex(system => system.id === id);
      if (existingIndex >= 0) {
        updateQueue[existingIndex] = { id, updateFn, priority, active: true };
      } else {
        updateQueue.push({ id, updateFn, priority, active: true });
      }
      
      // Sort by priority
      updateQueue.sort((a, b) => a.priority - b.priority);
      
      set({ updateQueue });
      return () => get().unregisterSystem(id);
    },
    
    // Unregister a system
    unregisterSystem: (id) => {
      const updateQueue = get().updateQueue.filter(system => system.id !== id);
      set({ updateQueue });
    },
    
    // Toggle a system's active state
    toggleSystem: (id, active = null) => {
      const updateQueue = [...get().updateQueue];
      const index = updateQueue.findIndex(system => system.id === id);
      
      if (index >= 0) {
        updateQueue[index].active = active !== null ? active : !updateQueue[index].active;
        set({ updateQueue });
        return true;
      }
      return false;
    },
    
    // Request a new frame
    requestFrame: () => {
      const state = get();
      if (!state.needsUpdate && state.active) {
        state.needsUpdate = true;
        
        if (state.useCustomLoop) {
          raf.schedule(state.processFrame);
        } else {
          // If using R3F's useFrame, this will be handled differently
          // We'll rely on the invalidate function passed from useThree
        }
      }
    },
    
    // Process a frame - this is our main loop
    processFrame: (time = performance.now()) => {
      const state = get();
      
      // Skip if inactive or already processing
      if (!state.active || state.isProcessing) {
        return;
      }
      
      // Lock to prevent concurrent processing
      set({ isProcessing: true });
      
      // Calculate timing
      const lastTime = state.lastTime || time;
      const deltaTime = (time - lastTime) / 1000; // Convert to seconds
      const elapsedTime = state.elapsedTime + deltaTime;
      const frameCount = state.frameCount + 1;
      
      // Throttle frame rate if needed
      if (state.throttleFrameRate) {
        const targetDelta = 1 / state.targetFrameRate;
        if (deltaTime < targetDelta) {
          set({ isProcessing: false });
          setTimeout(() => {
            get().processFrame();
          }, (targetDelta - deltaTime) * 1000);
          return;
        }
      }
      
      // Update timing state
      set({ 
        lastTime: time,
        deltaTime,
        elapsedTime,
        frameCount
      });
      
      // Process all active systems
      const startTime = performance.now();
      const context = { time: elapsedTime, deltaTime, frameCount };
      
      state.updateQueue.forEach(system => {
        if (system.active) {
          try {
            system.updateFn(context);
          } catch (error) {
            console.error(`Error in system ${system.id}:`, error);
          }
        }
      });
      
      // Calculate performance metrics
      const frameTime = performance.now() - startTime;
      const fps = Math.round(1 / deltaTime);
      
      // Update state
      set({
        performanceMetrics: {
          ...state.performanceMetrics,
          fps,
          frameTime
        },
        needsUpdate: false,
        isProcessing: false
      });
      
      // Request next frame if needed
      if (state.active && state.needsUpdate) {
        get().requestFrame();
      }
    },
    
    // Reset the system
    reset: () => {
      if (get().useCustomLoop) {
        raf.cancel(get().processFrame);
      }
      
      set({
        active: false,
        events: new Map(),
        listeners: new Map(),
        updateQueue: [],
        frameCount: 0,
        elapsedTime: 0,
        needsUpdate: false,
        isProcessing: false
      });
    }
  }))
);

// Export a simple hook to connect to the event system
export const useEventListener = (eventType, callback, options = {}) => {
  const {
    priority = PRIORITY.MEDIUM,
    enabled = true
  } = options;
  
  // Get event system methods
  const { subscribe, unsubscribe } = useEventSystem(state => ({
    subscribe: state.subscribe,
    unsubscribe: state.unsubscribe
  }));
  
  // Generate a unique ID for this component
  const idRef = React.useRef(
    `event-listener-${Math.random().toString(36).substring(2, 9)}`
  );
  
  // Track active subscriptions
  const subscriptionsRef = React.useRef([]);
  
  // Function to clean up subscriptions
  const cleanupSubscriptions = () => {
    subscriptionsRef.current.forEach(id => {
      unsubscribe(id);
    });
    subscriptionsRef.current = [];
  };
  
  // Function to setup subscriptions
  const setupSubscriptions = () => {
    // Clean up existing subscriptions first
    cleanupSubscriptions();
    
    // Handle both single event type and array of event types
    const events = Array.isArray(eventType) ? eventType : [eventType];
    
    // Subscribe to each event type
    events.forEach((event, index) => {
      const subscriptionId = `${idRef.current}-${index}`;
      
      // Add to tracking array
      subscriptionsRef.current.push(subscriptionId);
      
      // Create subscription
      subscribe(subscriptionId, event, callback, priority);
    });
  };
  
  // Setup subscriptions on mount and when dependencies change
  React.useEffect(() => {
    if (enabled) {
      setupSubscriptions();
    }
    
    // Clean up on unmount or when dependencies change
    return cleanupSubscriptions;
  }, [
    // Add all dependencies to ensure proper cleanup and re-subscription
    ...(Array.isArray(eventType) ? eventType : [eventType]), 
    callback, 
    priority, 
    enabled
  ]);
  
  // Return functions to manually control the listener
  return {
    // Enable the listener
    enable: () => {
      if (!enabled) {
        setupSubscriptions();
      }
    },
    
    // Disable the listener
    disable: () => {
      if (enabled) {
        cleanupSubscriptions();
      }
    },
    
    // Check if the listener is currently active
    isActive: () => subscriptionsRef.current.length > 0
  };
};

// Helper hook for systems that need to update every frame
export const useSystem = (id, updateFn, priority = PRIORITY.MEDIUM, enabled = true) => {
  const { registerSystem, unregisterSystem, toggleSystem } = useEventSystem(state => ({
    registerSystem: state.registerSystem,
    unregisterSystem: state.unregisterSystem,
    toggleSystem: state.toggleSystem
  }));
  
  React.useEffect(() => {
    if (enabled) {
      const unregister = registerSystem(id, updateFn, priority);
      return () => unregister();
    }
  }, [id, updateFn, priority, enabled]);
  
  return {
    toggle: (active) => toggleSystem(id, active)
  };
};

// Export the event types
export const EVENT_TYPES = {
  // Core events
  FRAME_START: 'frame:start',
  FRAME_END: 'frame:end',
  
  // Application state
  APP_LOADED: 'app:loaded',
  APP_ERROR: 'app:error',
  
  // Navigation
  DRONE_MOVE: 'drone:move',
  DRONE_ARRIVED: 'drone:arrived',
  DRONE_COLLISION: 'drone:collision',
  
  // Camera
  CAMERA_MOVE: 'camera:move',
  CAMERA_TARGET: 'camera:target',
  
  // Interactions
  HOTSPOT_HOVER: 'hotspot:hover',
  HOTSPOT_SELECT: 'hotspot:select',
  HOTSPOT_DESELECT: 'hotspot:deselect',
  
  // Mouse/Input
  MOUSE_MOVE: 'mouse:move',
  MOUSE_CLICK: 'mouse:click',
  KEY_PRESS: 'key:press',
  
  // Rendering
  RENDER_NEEDED: 'render:needed',
  QUALITY_ADJUST: 'render:quality',
  
  // Scene management
  OBJECT_ADDED: 'scene:objectAdded',
  OBJECT_REMOVED: 'scene:objectRemoved',
  VISIBILITY_CHANGED: 'scene:visibility',
  
  // Asset loading
  ASSET_LOAD_START: 'asset:loadStart',
  ASSET_LOAD_PROGRESS: 'asset:loadProgress',
  ASSET_LOAD_COMPLETE: 'asset:loadComplete',
  ASSET_LOAD_ERROR: 'asset:loadError',
  
  // UI
  UI_OVERLAY_SHOW: 'ui:overlayShow',
  UI_OVERLAY_HIDE: 'ui:overlayHide',
  UI_INTERACTION: 'ui:interaction'
};

// Initialize system with important events
Object.values(EVENT_TYPES).forEach(eventType => {
  useEventSystem.getState().registerEvent(eventType);
});

export default useEventSystem;