import { useEffect } from 'react';
import { useEventSystem, PRIORITY } from '../systems/EventSystem';

/**
 * Custom hook to easily subscribe to event system events
 * 
 * @param {string|string[]} eventTypes - Event type or array of event types to listen for
 * @param {function} callback - Callback function to execute when event occurs
 * @param {object} options - Options for the event listener
 * @param {number} options.priority - Event priority (default: PRIORITY.MEDIUM)
 * @param {boolean} options.enabled - Whether the listener is enabled (default: true)
 * @returns {object} Functions to manually control the listener
 */
export const useEventListener = (eventTypes, callback, options = {}) => {
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
    const events = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    
    // Subscribe to each event type
    events.forEach((eventType, index) => {
      const subscriptionId = `${idRef.current}-${index}`;
      
      // Add to tracking array
      subscriptionsRef.current.push(subscriptionId);
      
      // Create subscription
      subscribe(subscriptionId, eventType, callback, priority);
    });
  };
  
  // Setup subscriptions on mount and when dependencies change
  useEffect(() => {
    if (enabled) {
      setupSubscriptions();
    }
    
    // Clean up on unmount or when dependencies change
    return cleanupSubscriptions;
  }, [
    // Add all dependencies to ensure proper cleanup and re-subscription
    ...(Array.isArray(eventTypes) ? eventTypes : [eventTypes]), 
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

/**
 * Custom hook to emit events with proper typing and error handling
 * 
 * @param {string} eventType - Default event type to emit
 * @returns {function} Function to emit events with optional custom type
 */
export const useEventEmitter = (defaultEventType) => {
  const emit = useEventSystem(state => state.emit);
  
  return (data, customEventType = null) => {
    try {
      const eventType = customEventType || defaultEventType;
      if (!eventType) {
        console.error('No event type specified');
        return false;
      }
      
      return emit(eventType, data);
    } catch (error) {
      console.error(`Error emitting event ${defaultEventType}:`, error);
      return false;
    }
  };
};

export default useEventListener;