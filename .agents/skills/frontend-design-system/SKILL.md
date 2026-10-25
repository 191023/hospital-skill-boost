---
name: frontend-design-system
description: Standards and guidelines for creating modern, premium web UI/UX design systems using HSL colors, CSS variables, Google Fonts, and micro-interactions.
---

# Frontend Design System Standards

When designing and building web interfaces, strictly adhere to these standards:

## 1. Color Architecture
- Use CSS Custom Properties in `index.css`.
- Use curated HSL palettes (e.g. HSL tailored dark themes, glassmorphism `backdrop-filter: blur(16px)`).
- Never use raw default colors (`red`, `blue`, `#ff0000`).

## 2. Typography & Layout
- Import modern Google Fonts (`Plus Jakarta Sans`, `Inter`, `Outfit`, `Prompt`).
- Use relative units (`rem`, `em`) and responsive Flexbox/Grid layouts.

## 3. Micro-Animations
- Add smooth transitions (`0.2s - 0.3s ease-in-out`) for hover, active, and focus states on all interactive elements.
