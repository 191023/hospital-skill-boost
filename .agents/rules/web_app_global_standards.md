---
name: web-app-global-standards
description: Industry-standard guidelines for web application development covering design systems, architecture, 3D/WebGL graphics, security, performance, and verification.
trigger: model_decision
globs:
  - "**/*.html"
  - "**/*.css"
  - "**/*.js"
  - "**/*.ts"
  - "**/*.jsx"
  - "**/*.tsx"
  - "**/*.glsl"
  - "**/*.vert"
  - "**/*.frag"
---

# Industry-Standard Web Application Development Rules

## 1. Core Architecture & Code Quality (สถาปัตยกรรมและคุณภาพโค้ด)
- **Design Tokens First**: Always establish a scalable CSS Design System using CSS Custom Properties (Variables) in a central stylesheet (e.g., `index.css`, `main.css`, or `globals.css`) before building components (define color schemes, typography, spacing scales, border-radii, shadows, and z-index layers).
- **Modular & Clean Architecture**: Follow the Single Responsibility Principle (SRP) and DRY (Don't Repeat Yourself). Keep UI presentation, business logic, and storage decoupled and structured logically.
- **State & Memory Management**: Maintain clean reactive/local state. Never mutate third-party DOM properties directly. Always clean up intervals, animation frames, and event listeners to prevent memory leaks. Safely access storage APIs (`localStorage`) with try-catch fallbacks.
- **Execution & Protocol Compatibility**: For pure client-side/vanilla apps, ensure scripts are standalone or compatible with both `file:///` protocol (avoiding blocked cross-origin ES6 module imports when opened directly) and local HTTP servers.

## 2. UI/UX Design System, 3D Graphics & Aesthetics (มาตรฐานดีไซน์, 3D และอินเทอร์เฟซ)
- **Color Systems**: Never use browser-default or raw primary colors (plain red, green, blue). Use curated HSL palettes, modern dark/light modes, glassmorphism (`backdrop-filter: blur`), subtle neon glows, and smooth gradient backgrounds.
- **Typography & Hierarchy**: Import modern web fonts (e.g., 'Plus Jakarta Sans', 'Inter', 'Prompt', or 'Outfit') from Google Fonts. Use relative units (`rem`, `em`) for scaling, enforce strict line-height and letter-spacing hierarchy, and include `font-display: swap`.
- **Responsive & Mobile-First**: Ensure fluid layouts using CSS Grid and Flexbox with breakpoints for Mobile, Tablet, and Desktop viewports. Touch targets must be at least 44x44px.
- **Micro-Interactions & Motion**: Every interactive control (buttons, cards, inputs, tabs) MUST have subtle hover, focus, and active transitions (0.2s–0.3s ease). Include loading indicators or skeleton loaders for asynchronous states.
- **3D & WebGL Animation (Three.js / R3F / GSAP / Shaders)**:
  - **Frame-Rate Independence**: Always drive 3D animations using delta time (`THREE.Clock` or `performance.now()`) rather than fixed per-frame increments.
  - **GPU Performance & Cleanup**: Cap device pixel ratio at `Math.min(window.devicePixelRatio, 2)`, handle window resize (`camera.aspect` & `updateProjectionMatrix()`), and explicitly `.dispose()` geometries, materials, and textures to prevent VRAM leaks.
  - **UI Layering & CORS Safety**: Ensure `<canvas>` overlays never block interactive HTML UI (`pointer-events` / `z-index` separation), and prefer procedural geometries/canvas textures when standalone `file:///` compatibility is required. (Activate the `3d-webgl-animation` skill for deep 3D tasks).
- **Zero Placeholders**: Never use placeholder text ("Lorem Ipsum") or empty container boxes. Always generate realistic, context-aware demo content.

## 3. Web Security & Reliability (ความปลอดภัยและเสถียรภาพ)
- **XSS & Injection Defense**: Never inject untrusted content using `innerHTML` directly. Use `textContent` or safe DOM creation APIs.
- **Input Sanitization & Validation**: Validate and sanitize all user input fields before processing or storing.
- **Graceful Error Handling**: Implement graceful error boundaries and friendly user notifications (e.g., toast messages) instead of letting app crashes show blank screens or unhandled promise rejections.

## 4. Performance & SEO / Accessibility (ประสิทธิภาพ, การเข้าถึง และ SEO)
- **Semantic HTML5**: Always use appropriate semantic elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`).
- **SEO Elements**: Include proper `<title>`, `<meta name="viewport">`, `<meta name="description">`, and OpenGraph meta tags on every page. Use exactly one `<h1>` per page with a logical heading hierarchy (`<h2>`, `<h3>`).
- **Accessibility (WCAG 2.1 AA)**: Ensure high contrast color ratios (WCAG AA compliant), visible focus indicators (`:focus-visible`) for keyboard navigation, proper `aria-label` / `alt` attributes, and respect `prefers-reduced-motion` for intensive animations.
- **Web Performance**: Optimize assets (prefer SVGs or WebP), defer non-critical scripts, and avoid blocking the main browser thread.

## 5. Verification & Testing Workflow (การทดสอบยืนยันผล)
- **Runtime Verification**: Always launch and test the web application using a local dev server (`npm run dev`, `vite`, `npx serve`, or `python -m http.server`) or verify direct browser rendering after generating or editing code.
- **Root-Cause Error Fixing**: Inspect developer console and terminal logs for any runtime errors. Diagnose and fix the underlying root causes—NEVER swallow exceptions, mask broken assertions, or return dummy fallbacks silently.
