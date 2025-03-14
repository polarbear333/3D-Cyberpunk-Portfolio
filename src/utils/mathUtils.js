import { Vector3, Quaternion, Euler, MathUtils } from 'three';

/**
 * Smoothly interpolate between two angles in radians
 * 
 * @param {number} a1 - Starting angle in radians
 * @param {number} a2 - Target angle in radians
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated angle
 */
export const lerpAngle = (a1, a2, t) => {
  // Normalize angles to be between -PI and PI
  a1 = MathUtils.euclideanModulo(a1, Math.PI * 2);
  a2 = MathUtils.euclideanModulo(a2, Math.PI * 2);
  
  // Find the shortest path
  if (Math.abs(a2 - a1) > Math.PI) {
    if (a1 < a2) {
      a1 += Math.PI * 2;
    } else {
      a2 += Math.PI * 2;
    }
  }
  
  return a1 * (1 - t) + a2 * t;
};

/**
 * Smoothly interpolate between two 3D vectors with ease-out
 * 
 * @param {Vector3} start - Starting vector
 * @param {Vector3} end - Target vector
 * @param {number} alpha - Interpolation factor (0-1)
 * @returns {Vector3} Interpolated vector
 */
export const smoothLerp = (start, end, alpha) => {
  // Apply ease-out function to make movement more natural
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const smoothedAlpha = easeOutCubic(alpha);
  
  // Create new vector to avoid modifying originals
  return new Vector3(
    start.x + (end.x - start.x) * smoothedAlpha,
    start.y + (end.y - start.y) * smoothedAlpha,
    start.z + (end.z - start.z) * smoothedAlpha
  );
};

/**
 * Calculate a point on a bezier curve
 * 
 * @param {number} t - Parameter between 0-1
 * @param {Vector3} p0 - Start point
 * @param {Vector3} p1 - Control point 1
 * @param {Vector3} p2 - Control point 2
 * @param {Vector3} p3 - End point
 * @returns {Vector3} Point on curve
 */
export const cubicBezier = (t, p0, p1, p2, p3) => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  let p = new Vector3().copy(p0).multiplyScalar(uuu);
  p.add(new Vector3().copy(p1).multiplyScalar(3 * uu * t));
  p.add(new Vector3().copy(p2).multiplyScalar(3 * u * tt));
  p.add(new Vector3().copy(p3).multiplyScalar(ttt));
  
  return p;
};

/**
 * Apply damping to a value to smooth changes
 * 
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} smoothing - Smoothing factor (higher is smoother)
 * @param {number} deltaTime - Time since last frame
 * @returns {number} Smoothed value
 */
export const dampValue = (current, target, smoothing, deltaTime) => {
  const factor = Math.exp(-smoothing * deltaTime);
  return current * factor + target * (1 - factor);
};

/**
 * Calculate distance between two 3D points
 * 
 * @param {Vector3} point1 - First point
 * @param {Vector3} point2 - Second point
 * @returns {number} Distance between points
 */
export const distanceBetween = (point1, point2) => {
  return new Vector3()
    .copy(point1)
    .sub(point2)
    .length();
};

/**
 * Convert drone's local forward direction to world space
 * 
 * @param {Euler} rotation - Drone's rotation in Euler angles
 * @returns {Vector3} Forward direction vector
 */
export const getForwardDirection = (rotation) => {
  const direction = new Vector3(0, 0, -1);
  const quaternion = new Quaternion().setFromEuler(rotation);
  return direction.applyQuaternion(quaternion);
};

/**
 * Generate a random position within a defined area
 * 
 * @param {number} minX - Minimum X value
 * @param {number} maxX - Maximum X value
 * @param {number} minY - Minimum Y value
 * @param {number} maxY - Maximum Y value
 * @param {number} minZ - Minimum Z value
 * @param {number} maxZ - Maximum Z value
 * @returns {Vector3} Random position
 */
export const randomPosition = (minX, maxX, minY, maxY, minZ, maxZ) => {
  return new Vector3(
    MathUtils.randFloat(minX, maxX),
    MathUtils.randFloat(minY, maxY),
    MathUtils.randFloat(minZ, maxZ)
  );
};

/**
 * Check if a point is inside a bounding box
 * 
 * @param {Vector3} point - The point to check
 * @param {Vector3} boxMin - Minimum corner of bounding box
 * @param {Vector3} boxMax - Maximum corner of bounding box
 * @returns {boolean} True if point is inside box
 */
export const isPointInBox = (point, boxMin, boxMax) => {
  return (
    point.x >= boxMin.x && point.x <= boxMax.x &&
    point.y >= boxMin.y && point.y <= boxMax.y &&
    point.z >= boxMin.z && point.z <= boxMax.z
  );
};

export default {
  lerpAngle,
  smoothLerp,
  cubicBezier,
  dampValue,
  distanceBetween,
  getForwardDirection,
  randomPosition,
  isPointInBox
};