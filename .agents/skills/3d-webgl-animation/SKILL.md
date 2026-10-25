---
name: 3d-webgl-animation
description: Best practices and architectural standards for building high-performance 3D web experiences, WebGL scenes, Three.js, React Three Fiber (R3F), GSAP animations, and custom GLSL shaders.
---

# 3D Web, WebGL & Animation Engineering Standards (Three.js / GSAP / Shaders)

When building 3D web applications, interactive WebGL backgrounds, or complex timeline animations (using Three.js, React Three Fiber, Cannon.js/Rapier, or GSAP), strictly follow these engineering rules:

## 1. Scene Architecture & Initialization
- **Renderer Optimization**: Always configure `THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })`.
- **Device Pixel Ratio (DPR) Cap**: Always cap the pixel ratio using `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` to prevent GPU overload and battery drain on high-DPI / Retina / 4K screens.
- **Color Management**: Set `renderer.outputColorSpace = THREE.SRGBColorSpace` and use appropriate tone mapping (e.g., `THREE.ACESFilmicToneMapping`) for realistic lighting and glowing aesthetics.
- **Responsive Resize Handling**: Always attach a debounced or clean `resize` listener that updates:
  1. `camera.aspect = width / height`
  2. `camera.updateProjectionMatrix()`
  3. `renderer.setSize(width, height)`
  4. `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`

## 2. Frame-Rate Independence & Animation Loop
- **Delta Time First**: NEVER animate objects by adding fixed constants per frame (e.g., avoid `mesh.rotation.y += 0.01`). Always use `THREE.Clock` (`clock.getDelta()` / `clock.getElapsedTime()`) or `performance.now()` delta time so animations run at the exact same speed on 60Hz, 120Hz, and 144Hz monitors.
- **Tab Visibility Pause**: Pause heavy rendering loops or reset clock delta when `document.hidden` is true (`visibilitychange` event) to prevent huge delta jumps when the user switches tabs back.
- **GSAP Integration**: When combining GSAP with Three.js, animate object properties (`mesh.position`, `mesh.rotation`, `material.uniforms`) cleanly and kill active tweens/timelines (`gsap.killTweensOf(...)`) before resetting or unmounting.

## 3. GPU Memory Management (VRAM Leak Prevention)
- **Strict Disposal**: WebGL does not garbage-collect GPU resources automatically. Whenever removing meshes, switching scenes, or unmounting components, explicitly call:
  - `geometry.dispose()`
  - `material.dispose()` (and iterate over material arrays if multi-material)
  - `texture.dispose()`
  - `renderer.dispose()` (on full teardown)
  - `cancelAnimationFrame(animFrameId)`
- **Geometry & Material Reuse (Instancing)**: Reuse `Geometry` and `Material` instances across multiple meshes. When rendering >100 identical objects or particles, use `THREE.InstancedMesh` or `THREE.Points` with `THREE.BufferGeometry`.

## 4. Asset Loading, Procedural Fallbacks & CORS Safety
- **Standalone / `file:///` Compatibility**: When building vanilla/standalone 3D apps that may be opened directly via `file:///`, avoid external `.gltf`/`.glb` or image texture fetches that fail due to browser CORS policy. Instead:
  - Prefer **Procedural Geometries** (`IcosahedronGeometry`, `TorusKnotGeometry`, `BufferGeometry`), **Procedural Canvas Textures** (`THREE.CanvasTexture`), and **Custom ShaderMaterials / PBR Materials** (`MeshPhysicalMaterial`, `MeshStandardMaterial`).
  - Load Three.js / GSAP via reliable CDN scripts (UMD/Global build or properly shimmed Import Maps) with graceful error fallbacks if offline.
- **Async Loading UX**: When loading external 3D models over HTTP/HTTPS (`GLTFLoader`, `DRACOLoader`), always use `THREE.LoadingManager` to drive a visual progress bar / skeleton state and handle `onError` gracefully.

## 5. UI Layering, Raycasting & Accessibility
- **Canvas & UI Separation**: Position background 3D canvases with `position: fixed; inset: 0; z-index: 0; pointer-events: none;` (or attach mouse/raycast listeners to `window`) so the `<canvas>` never blocks HTML buttons, forms, or scrolling.
- **Smooth Pointer Parallax & Raycasting**: Normalize mouse coordinates (`[-1, 1]`) and apply linear interpolation (`lerp` / damping) to camera or object movement for cinematic, non-jerky interactivity.
- **Motion Sensitivity (`prefers-reduced-motion`)**: Respect `window.matchMedia('(prefers-reduced-motion: reduce)')` by reducing rotation speeds, disabling rapid camera shake, or offering a toggle to pause 3D background motion.
