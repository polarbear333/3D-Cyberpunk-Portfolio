# 3D Cyberpunk Portfolio Website

An immersive, interactive 3D portfolio website where users navigate a procedurally generated cyberpunk city using a drone. This project showcases advanced WebGL rendering techniques, efficient framebuffer management, and optimized Three.js performance.

![Cyberpunk Portfolio Screenshot](screenshot.jpg)

## Performance Features

This project implements advanced rendering techniques to maintain high performance even during complex navigation:

### 📊 Multi-Pass Rendering Pipeline

- **RenderingManager**: Manages framebuffer operations, texture swapping, and multi-pass rendering
- **Custom framebuffer chaining** with ping-pong rendering for efficient post-processing
- **Adaptive resolution scaling** that dynamically adjusts resolution based on movement
- **Bloom effect optimization** with quarter-resolution blur passes
- **Scissor testing** to limit rendering to visible areas

### 🚀 Spatial Optimization

- **SpatialManager**: Handles occlusion culling, frustum culling, and LOD management
- **Spatial grid partitioning** for efficient collision detection and scene management
- **Material instancing** to reduce draw calls and GPU state changes
- **Level of Detail (LOD)** with automatic switching based on distance
- **Texture caching and optimization** with KTX2 format support

### ⚡ Uniform Management

- **UniformManager**: Efficiently updates shader uniforms only when values change
- **Batch uniform updates** for better performance
- **Cached material animations** for neon lighting effects
- **Emissive intensity optimization** with batched updates
- **Shared uniform bindings** across materials

### 🎮 Physics & Navigation

- **Fixed-timestep physics** for consistent movement regardless of frame rate
- **Optimized collision detection** with spatial partitioning
- **Smooth camera transitions** with customizable easing
- **Path planning** for navigating to clicked locations
- **Adaptive movement speed** based on distance to target

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/cyberpunk-portfolio.git
cd cyberpunk-portfolio

# Install dependencies
npm install
# or
yarn install

# Start the development server
npm run dev
# or
yarn dev
```

The application will start at `http://localhost:3000`.

## Controls

- **WASD**: Move the drone forward, backward, left, right
- **Space/Shift**: Ascend/descend
- **Arrow Keys**: Rotate the drone
- **F Key**: Speed boost
- **Mouse Click**: Select destination or project hotspot
- **H Key**: Toggle controls help

## Performance Optimization

This project implements several advanced WebGL optimization techniques:

### Framebuffer Management

The rendering pipeline uses multiple off-screen render targets for efficient post-processing:

1. **Main scene render target** (`sceneTarget`) - Full scene at dynamic resolution
2. **Bloom extraction target** (`bloomTargetHalfRes`) - Half-resolution bright areas
3. **Blur ping-pong targets** (`blurTargetA`, `blurTargetB`) - Quarter-resolution for efficient blurring
4. **Final composition target** for combining all effects

### Texture Optimization

- **KTX2 texture format** support with fallbacks to PNG
- **Mipmap generation** for distant textures
- **Texture atlas** support for reducing draw calls
- **Memory-efficient texture cache** with automatic cleanup

### Material Optimization

- **Material instance sharing** for similar objects
- **Custom shader optimization** for emissive effects
- **Uniform batching** to reduce state changes
- **LOD material swapping** based on distance

### Rendering Pipeline Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Scene Render   │────▶│ Threshold Pass  │────▶│    Blur Pass    │
│  (sceneTarget)  │     │(bloomTargetHalf)│     │ (blurA/blurB)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
┌─────────────────┐                                      ▼
│  Final Output   │◀────────────────────────────────────┘
│  (to screen)    │
└─────────────────┘
```

## Architecture

The application is built with a component-based architecture:

```
├── components/
│   ├── City/           - 3D cityscape environment
│   ├── Navigation/     - Drone controls and physics
│   ├── Hotspots/       - Interactive portfolio elements
│   ├── UI/             - User interface components
│   └── Effects/        - Post-processing effects
├── utils/
│   ├── RenderingManager.js  - Multi-pass rendering
│   ├── SpatialManager.js    - Culling and LOD
│   └── UniformManager.js    - Efficient shader updates
├── state/              - Application state management
└── hooks/              - Custom React hooks
```

## Performance Monitoring

Enable debug mode to view real-time performance metrics:

- FPS counter
- Draw call count
- Triangle count
- Culled object count
- Uniform update statistics
- Resolution scale

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Three.js for 3D rendering
- React Three Fiber for React integration
- GSAP for animations
- All the cyberpunk aesthetic inspirations
