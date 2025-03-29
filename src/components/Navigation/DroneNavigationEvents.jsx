import React, { useRef, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../state/useStore';
import { useEventSystem, EVENT_TYPES, PRIORITY, useSystem } from '../../systems/EventSystem';

const DRONE_MODEL_PATH = '/models/cyberdrone/drone.glb';

const DroneNavigationEvents = ({ audio }) => {
  const {
    dronePosition,
    updateDronePosition,
    setActiveHotspot,
    debugMode,
    soundEnabled,
  } = useStore();

  const { scene, camera, invalidate } = useThree();
  const droneRef = useRef();
  const droneModelRef = useRef();
  const propellersRef = useRef([]);
  const droneLightRef = useRef();
  const targetPositionRef = useRef(null);

  // Animation state refs
  const propellerSpeed = useRef(0.5);
  const lightIntensity = useRef(1.5);
  const isMovingRef = useRef(false);

  // Vector refs for reuse
  const tempVec = useRef(new THREE.Vector3());
  const directionVec = useRef(new THREE.Vector3());

  // Get the event system's emit function
  const { emit } = useEventSystem();

  // Load drone model using GLTF
  let droneModel;
  try {
    droneModel = useGLTF(DRONE_MODEL_PATH, true);
  } catch (error) {
    console.log("Using default drone model");
  }

  // Setup drone model once on mount
  useEffect(() => {
    if (droneModel && droneModel.scene && droneModelRef.current) {
      // Clear any previous children
      while (droneModelRef.current.children.length > 0) {
        droneModelRef.current.remove(droneModelRef.current.children[0]);
      }
      const model = droneModel.scene.clone();
      // Find and store propellers; adjust mesh properties
      model.traverse((child) => {
        if (child.isMesh) {
          if (child.name.includes('propeller') || child.name.includes('rotor')) {
            propellersRef.current.push(child);
          }
          child.castShadow = child.name.includes('body');
          child.receiveShadow = false;
          if (child.material) {
            if (child.material.map) {
              child.material.map.anisotropy = 4;
            }
            child.material.needsUpdate = true;
          }
        }
      });
      model.scale.set(0.1, 0.1, 0.1);
      // Add a drone light once
      const droneLight = new THREE.PointLight('#00FFFF', lightIntensity.current, 10);
      droneLight.position.set(0, 0.5, 0);
      droneLightRef.current = droneLight;
      model.add(droneLight);
      droneModelRef.current.add(model);
      // Notify spatial manager that the drone was added
      emit(EVENT_TYPES.OBJECT_ADDED, {
        object: model,
        options: {
          important: true,
          dynamic: true,
          lod: false,
        },
      });
      invalidate();
    }
    return () => {
      if (droneModelRef.current) {
        emit(EVENT_TYPES.OBJECT_REMOVED, { object: droneModelRef.current });
        while (droneModelRef.current.children.length > 0) {
          const child = droneModelRef.current.children[0];
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
          if (child.geometry) {
            child.geometry.dispose();
          }
          droneModelRef.current.remove(child);
        }
      }
      propellersRef.current = [];
    };
  }, [droneModel, emit, invalidate]);

  // Setup click handler for navigation
  useEffect(() => {
    const handleClick = (event) => {
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Check for hotspot intersections
      const hotspots = scene.children.filter(
        child =>
          child.isObject3D &&
          child.type === 'Group' &&
          child.name.includes('hotspot')
      );
      const hotspotIntersects = raycaster.intersectObjects(hotspots, true);
      if (hotspotIntersects.length > 0) {
        let hotspotObject = hotspotIntersects[0].object;
        while (hotspotObject && !hotspotObject.name.includes('hotspot')) {
          hotspotObject = hotspotObject.parent;
        }
        if (hotspotObject) {
          const hotspotId = hotspotObject.name.replace('hotspot-', '');
          setActiveHotspot(hotspotId);
          if (!targetPositionRef.current) {
            targetPositionRef.current = new THREE.Vector3();
          }
          targetPositionRef.current.copy(hotspotObject.position);
          targetPositionRef.current.y = Math.max(hotspotObject.position.y + 2, 5);
          isMovingRef.current = true;
          emit(EVENT_TYPES.DRONE_MOVE, {
            targetPosition: targetPositionRef.current.clone(),
            source: 'hotspot',
            hotspotId,
          });
          if (audio?.isInitialized && soundEnabled) {
            audio.playSound('click', { volume: 0.3 });
          }
          invalidate();
          return;
        }
      }

      // Check for ground intersection
      const groundObjects = scene.children.filter(
        child =>
          child.isObject3D &&
          child.type === 'Mesh' &&
          (child.rotation.x === -Math.PI / 2 || child.name.includes('ground'))
      );
      if (groundObjects.length > 0) {
        const intersects = raycaster.intersectObjects(groundObjects, false);
        if (intersects.length > 0) {
          if (!targetPositionRef.current) {
            targetPositionRef.current = new THREE.Vector3();
          }
          targetPositionRef.current.copy(intersects[0].point);
          targetPositionRef.current.y = Math.max(5, targetPositionRef.current.y);
          isMovingRef.current = true;
          emit(EVENT_TYPES.DRONE_MOVE, {
            targetPosition: targetPositionRef.current.clone(),
            source: 'ground',
          });
          if (audio?.isInitialized && soundEnabled) {
            audio.playSound('click', { volume: 0.3 });
          }
          invalidate();
        }
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [camera, scene, setActiveHotspot, audio, soundEnabled, emit, invalidate]);

  // Drone movement update (wrapped in useCallback for stability)
  const droneMovementUpdate = useCallback(
    ({ deltaTime }) => {
      if (!isMovingRef.current || !targetPositionRef.current) return;

      tempVec.current.copy(dronePosition);
      directionVec.current.copy(targetPositionRef.current).sub(tempVec.current);
      const distance = directionVec.current.length();
      if (distance < 1) {
        isMovingRef.current = false;
        emit(EVENT_TYPES.DRONE_ARRIVED, { position: tempVec.current.clone() });
        return;
      }
      directionVec.current.normalize();
      const speed = Math.min(Math.max(distance * 0.02, 0.2), 1.5) * deltaTime * 60;
      directionVec.current.multiplyScalar(speed);
      const newPosition = tempVec.current.clone().add(directionVec.current);
      updateDronePosition(newPosition);
      if (droneRef.current) {
        droneRef.current.position.copy(newPosition);
      }
      invalidate();
    },
    [dronePosition, updateDronePosition, emit, invalidate]
  );

  // Register the drone movement system using a stable callback
  useSystem('drone-movement', droneMovementUpdate, PRIORITY.HIGH, true);

  // Drone propeller and light animation update (wrapped in useCallback)
  const dronePropellersUpdate = useCallback(
    ({ deltaTime }) => {
      const targetSpeed = isMovingRef.current ? 2.0 : 0.5;
      propellerSpeed.current += (targetSpeed - propellerSpeed.current) * deltaTime * 5;
      propellersRef.current.forEach((propeller, index) => {
        if (propeller) {
          propeller.rotation.y += propellerSpeed.current * (1 + index * 0.05) * deltaTime * 60;
        }
      });
      if (droneLightRef.current) {
        const time = performance.now() / 1000;
        const targetIntensity = 1.5 + Math.sin(time * 2) * 0.5;
        lightIntensity.current += (targetIntensity - lightIntensity.current) * deltaTime * 3;
        droneLightRef.current.intensity = lightIntensity.current;
      }
      if (isMovingRef.current) {
        invalidate();
      }
    },
    [invalidate]
  );

  // Register the drone propellers system using a stable callback
  useSystem('drone-propellers', dronePropellersUpdate, PRIORITY.MEDIUM, true);

  // Sync the droneRef position with the store (only when dronePosition changes)
  useEffect(() => {
    if (droneRef.current) {
      droneRef.current.position.copy(dronePosition);
    }
  }, [dronePosition]);

  return (
    <group>
      <group ref={droneRef} position={dronePosition.toArray()}>
        <group ref={droneModelRef} />
        {!droneModel && (
          <mesh castShadow>
            <boxGeometry args={[1, 0.2, 1]} />
            <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.5} />
            <pointLight color="#00FFFF" intensity={2} distance={8} position={[0, 0.2, 0]} />
          </mesh>
        )}
      </group>
    </group>
  );
};

export default DroneNavigationEvents;
