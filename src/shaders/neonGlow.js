import { ShaderMaterial, Color, Vector2 } from 'three';

// Vertex shader
const vertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader
const fragmentShader = `
uniform vec3 glowColor;
uniform float intensity;
uniform float time;
uniform float pulseSpeed;
uniform float rimPower;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Calculate rim lighting (stronger at edges)
  vec3 viewDirection = normalize(-vPosition);
  float rimFactor = 1.0 - max(0.0, dot(viewDirection, vNormal));
  rimFactor = pow(rimFactor, rimPower);
  
  // Pulsing effect
  float pulse = 0.5 * sin(time * pulseSpeed) + 0.5;
  
  // Combine for final glow
  float glow = rimFactor * intensity * (0.8 + 0.2 * pulse);
  
  // Add some noise/static effect for cyberpunk feel
  float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233)) * 43758.5453 + time) * 0.1);
  
  // Final color with slight noise
  vec3 finalColor = glowColor * glow * (1.0 + noise * 0.1);
  
  gl_FragColor = vec4(finalColor, glow);
}
`;

/**
 * Creates a custom neon glow shader material
 * 
 * @param {Object} options - Configuration options
 * @param {String|Number} options.color - Neon color (hex or Three.js color)
 * @param {Number} options.intensity - Glow intensity (default: 1.0)
 * @param {Number} options.rimPower - Edge glow power (default: 3.0)
 * @param {Number} options.pulseSpeed - Pulsing speed (default: 1.0)
 * @returns {ShaderMaterial} Three.js shader material
 */
export const createNeonMaterial = (options = {}) => {
  const color = options.color ? new Color(options.color) : new Color(0x00FFFF);
  const intensity = options.intensity || 1.0;
  const rimPower = options.rimPower || 3.0;
  const pulseSpeed = options.pulseSpeed || 1.0;
  
  return new ShaderMaterial({
    uniforms: {
      glowColor: { value: color },
      intensity: { value: intensity },
      time: { value: 0.0 },
      pulseSpeed: { value: pulseSpeed },
      rimPower: { value: rimPower },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
};

/**
 * Updates the neon material with the current time
 * 
 * @param {ShaderMaterial} material - The neon shader material
 * @param {number} time - Current time in seconds
 */
export const updateNeonMaterial = (material, time) => {
  if (material.uniforms && material.uniforms.time) {
    material.uniforms.time.value = time;
  }
};

export default {
  createNeonMaterial,
  updateNeonMaterial
};