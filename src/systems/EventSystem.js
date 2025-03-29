import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import React from 'react';

export const PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  IDLE: 4,
};

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

    // Frame control and event storage
    useCustomLoop: false,
    throttleFrameRate: false,
    targetFrameRate: 60,
    events: new Map(),
    listeners: new Map(),
    updateQueue: [],
    priorityQueue: [],
    needsUpdate: false,
    isProcessing: false,

    // Initialize the system
    initialize: () => {
      console.log('EventSystem initialized');
      const now = performance.now();
      set({ 
        lastTime: now,
        elapsedTime: 0,
        active: true
      });
      // Register core events
      Object.values(EVENT_TYPES).forEach((type) => {
        if (!get().events.has(type)) {
          const events = new Map(get().events);
          events.set(type, {
            name: type,
            priority: PRIORITY.MEDIUM,
            throttle: 0,
            lastFired: 0,
          });
          set({ events });
        }
      });
    },

    // Register a new event type
    registerEvent: (eventType, options = {}) => {
      if (!get().events.has(eventType)) {
        const events = new Map(get().events);
        events.set(eventType, {
          name: eventType,
          priority: options.priority || PRIORITY.MEDIUM,
          throttle: options.throttle || 0,
          lastFired: 0,
          ...options,
        });
        set({ events });
        return true;
      }
      return false;
    },

    subscribe: (id, eventType, callback, priority = PRIORITY.MEDIUM) => {
      // Ensure the event is registered
      if (!get().events.has(eventType)) {
        get().registerEvent(eventType);
      }
      const listeners = new Map(get().listeners);
      listeners.set(id, { id, eventType, callback, priority, active: true });
      set({ listeners });
      return () => {
        const currentState = useEventSystem.getState();
        if (currentState.listeners.has(id)) {
          const updatedListeners = new Map(currentState.listeners);
          updatedListeners.delete(id);
          useEventSystem.setState({ listeners: updatedListeners });
        }
      };
    },

    unsubscribe: (id) => {
      const store = useEventSystem.getState();
      const currentListeners = new Map(store.listeners);
      const result = currentListeners.delete(id);
      if (result) {
        useEventSystem.setState({ listeners: currentListeners });
      }
      return result;
    },

    // Emit an event with safe throttling and re-read events after auto-registration
    emit: (eventType, data = {}) => {
      const state = get();
      if (!state.active) return false;
      let events = state.events;
      if (!events.has(eventType)) {
        state.registerEvent(eventType);
        // Re-read the updated events map
        events = get().events;
      }
      const event = events.get(eventType);
      const now = performance.now();
      // Check throttling if throttle is set
      if (event.throttle > 0 && now - event.lastFired < event.throttle) {
        return false;
      }
      // Update event's last fired time
      const updatedEvents = new Map(events);
      updatedEvents.set(eventType, { ...event, lastFired: now });
      // Update performance metrics
      const metrics = { ...state.performanceMetrics, eventCount: state.performanceMetrics.eventCount + 1 };
      if (!state.needsUpdate) {
        state.needsUpdate = true;
      }
      // Construct context for listeners
      const context = {
        ...data,
        time: state.elapsedTime,
        deltaTime: state.deltaTime,
        frameCount: state.frameCount,
        type: eventType,
        timestamp: now,
      };
      // Create snapshot of listeners and execute callbacks
      const relevantListeners = Array.from(state.listeners.values()).filter(
        (listener) => listener.eventType === eventType && listener.active
      );
      relevantListeners.forEach((listener) => {
        try {
          listener.callback(context);
        } catch (error) {
          console.error(`Error in listener for ${eventType}:`, error);
        }
      });
      set({
        events: updatedEvents,
        performanceMetrics: metrics,
        needsUpdate: true,
      });
      return true;
    },

    // Register a system that needs updates each frame
    registerSystem: (id, updateFn, priority = PRIORITY.MEDIUM, active = true) => {
      const systemsCopy = [...get().updateQueue];
      const existingIndex = systemsCopy.findIndex((system) => system.id === id);
      if (existingIndex >= 0) {
        systemsCopy[existingIndex] = { id, updateFn, priority, active };
      } else {
        systemsCopy.push({ id, updateFn, priority, active });
      }
      systemsCopy.sort((a, b) => a.priority - b.priority);
      set({ updateQueue: systemsCopy });
      return () => {
        const currentSystems = get().updateQueue.filter((system) => system.id !== id);
        set({ updateQueue: currentSystems });
      };
    },

    unregisterSystem: (id) => {
      const currentSystems = get().updateQueue.filter((system) => system.id !== id);
      set({ updateQueue: currentSystems });
      return true;
    },

    toggleSystem: (id, active = null) => {
      const systemsCopy = [...get().updateQueue];
      const index = systemsCopy.findIndex((system) => system.id === id);
      if (index >= 0) {
        const newActive = active !== null ? active : !systemsCopy[index].active;
        systemsCopy[index] = { ...systemsCopy[index], active: newActive };
        set({ updateQueue: systemsCopy });
        return true;
      }
      return false;
    },

    requestFrame: () => {
      const state = get();
      if (!state.isProcessing && state.active) {
        state.needsUpdate = true;
      }
    },

    processFrame: (time = performance.now(), invalidate = null) => {
      const state = get();
      if (!state.active || state.isProcessing) return;
      set({ isProcessing: true });
      const lastTime = state.lastTime || time;
      const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
      const elapsedTime = state.elapsedTime + deltaTime;
      const frameCount = state.frameCount + 1;
      if (state.throttleFrameRate) {
        const targetDelta = 1 / state.targetFrameRate;
        if (deltaTime < targetDelta) {
          set({ isProcessing: false });
          setTimeout(() => {
            get().processFrame(performance.now(), invalidate);
          }, (targetDelta - deltaTime) * 1000);
          return;
        }
      }
      set({ lastTime: time, deltaTime, elapsedTime, frameCount });
      const systemsToUpdate = [...state.updateQueue];
      const context = { time: elapsedTime, deltaTime, frameCount };
      systemsToUpdate.forEach((system) => {
        if (system.active) {
          try {
            system.updateFn(context);
          } catch (error) {
            console.error(`Error in system ${system.id}:`, error);
          }
        }
      });
      const frameTime = performance.now() - time;
      const fps = Math.round(1 / deltaTime);
      set({
        performanceMetrics: { ...state.performanceMetrics, fps, frameTime },
        needsUpdate: false,
        isProcessing: false,
      });
      if (invalidate && typeof invalidate === 'function') {
        invalidate();
      }
    },

    reset: () => {
      set({
        active: false,
        events: new Map(),
        listeners: new Map(),
        updateQueue: [],
        frameCount: 0,
        elapsedTime: 0,
        needsUpdate: false,
        isProcessing: false,
      });
    },
  }))
);

// Export hook for event listeners
export const useEventListener = (eventType, callback, options = {}) => {
  const { priority = PRIORITY.MEDIUM, enabled = true } = options;
  const { subscribe, unsubscribe } = useEventSystem((state) => ({
    subscribe: state.subscribe,
    unsubscribe: state.unsubscribe,
  }));
  const idRef = React.useRef(`event-listener-${Math.random().toString(36).substring(2, 9)}`);
  const subscriptionsRef = React.useRef([]);
  const cleanupSubscriptions = () => {
    [...subscriptionsRef.current].forEach((id) => unsubscribe(id));
    subscriptionsRef.current = [];
  };
  const setupSubscriptions = () => {
    cleanupSubscriptions();
    const events = Array.isArray(eventType) ? eventType : [eventType];
    events.forEach((event, index) => {
      const subscriptionId = `${idRef.current}-${index}`;
      subscribe(subscriptionId, event, callback, priority);
      subscriptionsRef.current.push(subscriptionId);
    });
  };
  React.useEffect(() => {
    if (enabled) setupSubscriptions();
    return cleanupSubscriptions;
  }, [JSON.stringify(Array.isArray(eventType) ? eventType : [eventType]), enabled, priority]);
  return {
    enable: () => {
      if (!enabled) setupSubscriptions();
    },
    disable: () => {
      if (enabled) cleanupSubscriptions();
    },
    isActive: () => subscriptionsRef.current.length > 0,
  };
};

// Helper hook for systems that need to update every frame
export const useSystem = (id, updateFn, priority = PRIORITY.MEDIUM, enabled = true) => {
  const { registerSystem, unregisterSystem, toggleSystem } = useEventSystem((state) => ({
    registerSystem: state.registerSystem,
    unregisterSystem: state.unregisterSystem,
    toggleSystem: state.toggleSystem,
  }));
  React.useEffect(() => {
    let unregister = null;
    if (enabled) {
      unregister = registerSystem(id, updateFn, priority);
    }
    return () => {
      if (unregister) unregister();
    };
  }, [id, updateFn, priority, enabled]);
  return {
    toggle: (active) => toggleSystem(id, active),
  };
};

export const EVENT_TYPES = {
  SYSTEM_INITIALIZED: 'system:initialized',
  SYSTEM_ERROR: 'system:error',
  SYSTEM_RESET: 'system:reset',
  SYSTEM_REGISTERED: 'system:registered',
  SYSTEM_UNREGISTERED: 'system:unregistered',
  SYSTEM_TOGGLED: 'system:toggled',
  FRAME_REQUESTED: 'frame:requested',
  FRAME_START: 'frame:start',
  FRAME_END: 'frame:end',
  APP_LOADED: 'app:loaded',
  APP_ERROR: 'app:error',
  DRONE_MOVE: 'drone:move',
  DRONE_ARRIVED: 'drone:arrived',
  DRONE_COLLISION: 'drone:collision',
  CAMERA_MOVE: 'camera:move',
  CAMERA_TARGET: 'camera:target',
  HOTSPOT_HOVER: 'hotspot:hover',
  HOTSPOT_SELECT: 'hotspot:select',
  HOTSPOT_DESELECT: 'hotspot:deselect',
  MOUSE_MOVE: 'mouse:move',
  MOUSE_CLICK: 'mouse:click',
  KEY_PRESS: 'key:press',
  RENDER_NEEDED: 'render:needed',
  QUALITY_ADJUST: 'render:quality',
  OBJECT_ADDED: 'scene:objectAdded',
  OBJECT_REMOVED: 'scene:objectRemoved',
  VISIBILITY_CHANGED: 'scene:visibility',
  ASSET_LOAD_START: 'asset:loadStart',
  ASSET_LOAD_PROGRESS: 'asset:loadProgress',
  ASSET_LOAD_COMPLETE: 'asset:loadComplete',
  ASSET_LOAD_ERROR: 'asset:loadError',
  UI_OVERLAY_SHOW: 'ui:overlayShow',
  UI_OVERLAY_HIDE: 'ui:overlayHide',
  UI_INTERACTION: 'ui:interaction',
};

// Ensure core events are registered on load
Object.values(EVENT_TYPES).forEach((eventType) => {
  const eventSystem = useEventSystem.getState();
  if (!eventSystem.events.has(eventType)) {
    eventSystem.registerEvent(eventType);
  }
});

export default useEventSystem;
