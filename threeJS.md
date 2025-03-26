---
title: Performance pitfalls
description: Performance 1x1
nav: 12
---

You are an expert software architect specializing in high-performance 3D web applications using Three.js and React Three Fiber. The user has an existing codebase and wants to refactor significant parts of it to follow an event-driven architecture to improve modularity, maintainability, and potentially performance by decoupling systems.

The user's current code likely includes:
- A render , postprocessing pipeline managed within a loop (potentially using `useFrame` in React Three Fiber).
- Model loading logic triggered at component mount or state changes.
- Drone navigation logic that updates drone positions within the render loop, also remove collision detection.
- Camera controls that directly manipulate the camera's state in response to user input.
- Various other functions and logic that are likely tightly coupled and executed within the main render loop or in direct response to state updates.


The goal is to rewrite these systems to communicate primarily through events.


**In your response, please consider the following:**

* **Event Dispatching and Handling:** Suggest a mechanism for event management (e.g., a simple custom event emitter, a state management library with event capabilities, or a dedicated event bus library).
* **Decoupling of Systems:** Emphasize how this event-driven approach decouples different parts of the application, making it more modular and easier to maintain.
* **Potential Performance Implications:** Discuss potential performance benefits (e.g., only updating systems that need to be updated) and potential drawbacks (e.g., event overhead).

The user's goal is to gain a clear understanding of how to architect their application using an event-driven model to improve its structure and performance. Focus on providing practical and actionable insights with illustrative code.


## Tips and Tricks

This is a good overview: https://discoverthreejs.com/tips-and-tricks

The most important gotcha in three.js is that creating objects can be expensive, think twice before you mount/unmount things! Every material or light that you put into the scene has to compile, every geometry you create will be processed. Share materials and geometries if you can, either in global scope or locally:

```jsx
const geom = useMemo(() => new BoxGeometry(), [])
const mat = useMemo(() => new MeshBasicMaterial(), [])
return items.map(i => <mesh geometry={geom} material={mat} ...
```

Try to use [instancing](https://codesandbox.io/s/r3f-instanced-colors-8fo01) as much as you can when you need to display many objects of a similar type!

## Avoid setState in loops

TLDR, don't, mutate inside `useFrame`!

- Threejs has a render-loop, it does not work like the DOM does. **Fast updates are carried out in `useFrame` by mutation**. `useFrame` is your per-component render-loop.

- It is not enough to set values in succession, _you need frame deltas_. Instead of `position.x += 0.1` consider `position.x += delta` or your project will run at different speeds depending on the end-users system. Many updates in threejs need to be paired with update flags (`.needsUpdate = true`), or imperative functions (`.updateProjectionMatrix()`).

- You might be tempted to setState inside `useFrame` but there is no reason to. You would only complicate something as simple as an update by routing it through React's scheduler, triggering component render etc.

### ❌ `setState` in loops is bad

```jsx
useEffect(() => {
  const interval = setInterval(() => setX((x) => x + 0.1), 1)
  return () => clearInterval(interval)
}, [])
```

### ❌ `setState` in useFrame is bad

```jsx
const [x, setX] = useState(0)
useFrame(() => setX((x) => x + 0.1))
return <mesh position-x={x} />
```

### ❌ `setState` in fast events is bad

```jsx
<mesh onPointerMove={(e) => setX((x) => e.point.x)} />
```

### ✅ Instead, just mutate, use deltas

In general you should prefer useFrame. Consider mutating props safe as long as the component is the only entity that mutates. Use deltas instead of fixed values so that your app is refresh-rate independent and runs at the same speed everywhere!

```jsx
const meshRef = useRef()
useFrame((state, delta) => (meshRef.current.position.x += delta))
return <mesh ref={meshRef} />
```

Same goes for events, use references.

```jsx
<mesh onPointerMove={(e) => (ref.current.position.x = e.point.x)} />
```

If you must use intervals, use references as well, but keep in mind that this is not refresh-rate independent.

```jsx
useEffect(() => {
  const interval = setInterval(() => ref.current.position.x += 0.1, 1)
  return () => clearInterval(interval)
}, [])
```

## Handle animations in loops

The frame loop is where you should place your animations. For instance using lerp, or damp.

### ✅ Use `lerp` + `useFrame`

```jsx
function Signal({ active }) {
  const meshRef = useRef()
  useFrame((state, delta) => {
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, active ? 100 : 0, 0.1)
  })
  return <mesh ref={meshRef} />
```

### ✅ Or react-spring

Or, use animation libraries. React-spring has its own frame-loop and animates outside of React. Framer-motion is another popular alternative.

```jsx
import { a, useSpring } from '@react-spring/three'

function Signal({ active }) {
  const { x } = useSpring({ x: active ? 100 : 0 })
  return <a.mesh position-x={x} />
```

## Do not bind to fast state reactively

Using state-managers and selective state is fine, but not for updates that happen rapidly for the same reason as above.

### ❌ Don't bind reactive fast-state

```jsx
import { useSelector } from 'react-redux'

// Assuming that x gets animated inside the store 60fps
const x = useSelector((state) => state.x)
return <mesh position-x={x} />
```

### ✅ Fetch state directly

For instance using [Zustand](https://github.com/pmndrs/zustand) (same in Redux et al).

```jsx
useFrame(() => (ref.current.position.x = api.getState().x))
return <mesh ref={ref} />
```

## Don't mount indiscriminately

In threejs it is very common to not re-mount at all, see the ["disposing of things"](https://discoverthreejs.com/tips-and-tricks/) section in discover-three. This is because buffers and materials get re-initialized/compiled, which can be expensive.

### ❌ Avoid mounting runtime

```jsx
{
  stage === 1 && <Stage1 />
}
{
  stage === 2 && <Stage2 />
}
{
  stage === 3 && <Stage3 />
}
```

### ✅ Consider using visibility instead

```jsx
<Stage1 visible={stage === 1} />
<Stage2 visible={stage === 2} />
<Stage3 visible={stage === 3} />

function Stage1(props) {
  return (
    <group {...props}>
      ...
```

### ✅ Use `startTransition` for expensive ops

React 18 introduces the `startTransition` and `useTransition` APIs to defer and schedule work and state updates. Use these to de-prioritize expensive operations.

Since version 8 of Fiber canvases use concurrent mode by default, which means React will schedule and defer expensive operations. You don't need to do anything, but you can play around with the [experimental scheduler](https://github.com/drcmda/scheduler-test) and see if marking ops with a lesser priority makes a difference.

```jsx
import { useTransition } from 'react'
import { Points } from '@react-three/drei'

const [isPending, startTransition] = useTransition()
const [radius, setRadius] = useState(1)
const positions = calculatePositions(radius)
const colors = calculateColors(radius)
const sizes = calculateSizes(radius)

<Points
  positions={positions}
  colors={colors}
  sizes={sizes}
  onPointerOut={() => {
    startTransition(() => {
      setRadius(prev => prev + 1)
    })
  }}
>
  <meshBasicMaterial vertexColors />
</Points>
```

## Don't re-create objects in loops

Try to avoid creating too much effort for the garbage collector, re-pool objects when you can!

### ❌ Bad news for the GC

This creates a new vector 60 times a second, which allocates memory and forces the GC to eventually kick in.

```jsx
useFrame(() => {
  ref.current.position.lerp(new THREE.Vector3(x, y, z), 0.1)
})
```

### ✅ Better re-use object

Set up re-used objects in global or local space, now the GC will be silent.

```jsx
function Foo(props)
  const vec = new THREE.Vector()
  useFrame(() => {
    ref.current.position.lerp(vec.set(x, y, z), 0.1)
  })
```

## `useLoader` instead of plain loaders

Threejs loaders give you the ability to load async assets (models, textures, etc), but if you do not re-use assets it can quickly become problematic.

### ❌ No re-use is bad for perf

This re-fetches, re-parses for every component instance.

```jsx
function Component() {
  const [texture, set] = useState()
  useEffect(() => void new TextureLoader().load(url, set), [])
  return texture ? (
    <mesh>
      <sphereGeometry />
      <meshBasicMaterial map={texture} />
    </mesh>
  ) : null
}
```

Instead use useLoader, which caches assets and makes them available throughout the scene.

### ✅ Cache and re-use objects

```jsx
function Component() {
  const texture = useLoader(TextureLoader, url)
  return (
    <mesh>
      <sphereGeometry />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
```

Regarding GLTF's try to use [GLTFJSX](https://github.com/pmndrs/gltfjsx) as much as you can, this will create immutable JSX graphs which allow you to even re-use full models.

Libraries:

react-spring

Best for: Complex animations with spring physics

Benefits:

```
import { useSpring, animated } from '@react-spring/web'

// Automatically batches updates and syncs with RAF
const props = useSpring({ 
  from: { opacity: 0 }, 
  to: { opacity: 1 },
  config: { mass: 1, tension: 120, friction: 40 } // Spring physics
})
```
Use when: You need smooth, interruptible animations for UI elements or 3D object movements

rafz

Best for: Manual control of requestAnimationFrame

Benefits:

import { raf } from 'rafz'

// Coordinated frame loop
raf(() => {
  updatePhysics()
  updateCamera()
})

2. Top Performance Solutions for Your Case
Based on common R3F performance issues:

A. Frame Loop Optimization

// Bad - Multiple useFrame hooks
useFrame(() => updatePosition())
useFrame(() => updateRotation())

// Good - Single coordinated loop
useFrame(({ clock }) => {
  updatePosition(clock.elapsedTime)
  updateRotation(clock.elapsedTime)
})

B. Animation Management

// Using react-spring for complex sequences
import { useTrail } from '@react-spring/three'

const [items] = useState([...Array(100)])
const trail = useTrail(items.length, {
  from: { scale: 0 },
  to: { scale: 1 },
  config: { tension: 200, friction: 20 }
})

return items.map((_, i) => (
  <animated.mesh scale={trail[i].scale} key={i}>
    <sphereGeometry />
  </animated.mesh>
))


C. Memory Management
// Critical for large scenes
useEffect(() => {
  return () => {
    geometry.dispose()
    material.dispose()
    texture.dispose()
  }
}, [])


3. Recommended Libraries
Based on your cyberpunk city scenario:

Library	Purpose	Benchmark Impact

@react-spring/rafz (Scheduling): This is the orchestrator. You could use rafz to manage the main animation loop where rendering, physics updates (if you want manual, event-driven updates), and other frame-dependent tasks occur, along with `invalidate`. Also handle physics updates with `requestAnimationFrame` wisely: Use rafz for precise updates instead of per-frame updates.

@react-three/rapier	Physics (40% faster than cannon)	-15% CPU usage

@react-three/postprocessing	Optimized effects	-20ms/frame

leva	Debugging controls	No perf impact

@react-three/csg	Boolean geometry ops	-30% geometry mem

State Management:
Zustand works better than Context API for 3D apps:

```
import create from 'zustand'

const useStore = create(set => ({
  count: 0,
  increment: () => set(state => ({ count: state.count + 1 })),
}))
```

5. When to Use What
Scenario	Solution	Expected Gain
Janky animations	react-spring + useGesture	+15 FPS
Physics stutter	@react-three/rapier	+20% physics perf
Post-processing lag	@react-three/postprocessing	-30% effect cost
Memory leaks	three.js-dispose pattern	-40% mem usage


Key Benefits:
Single Frame Loop: All updates happen in one useFrame call

Automatic Delta Timing: Consistent time increments for smooth animations

Component Isolation: Each component manages its own updates

Priority Control: Add priority sorting if needed

Advanced: Event-Driven Updates
Add event system for coordinated interactions:
```
// systems/EventSystem.js
import create from 'zustand';

export const useEventSystem = create((set) => ({
  listeners: new Map(),
  emit: (event, data) => {
    const listeners = Array.from(get().listeners.values())
      .filter(l => l.event === event);
    listeners.forEach(l => l.callback(data));
  },
  subscribe: (id, event, callback) => set(state => ({
    listeners: new Map(state.listeners).set(id, { event, callback })
  })),
  unsubscribe: (id) => set(state => ({
    listeners: new Map(state.listeners).delete(id)
  }))
}));
```
