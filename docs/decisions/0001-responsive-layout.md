# Decision 0001 — Fluid responsive layout and world framing

Date: 2026-08-28  
Status: Accepted

RobotLab keeps a fixed `1280×720` logical gameplay world and uses Phaser `Scale.RESIZE` for a full-container render surface. One uniform world-container scale and offset, calculated by `responsiveCamera.ts`, frames the background and actors without changing their logical coordinates or stretching them.

HUD composition is independent of world coordinates. `responsiveLayout.ts` selects exactly four modes—ultra-narrow portrait, portrait, large portrait/tablet, and landscape—and supplies clamped measurements to UI components. `fluidSizing.ts` owns reusable clamp and interpolation functions. CSS safe-area environment values enter through host custom properties.

This choice preserves readable 44 px or larger input targets at 320 px width and 568×320 short landscape while keeping `robotGrounding.ts` authoritative for origin `(0.5, 1)`, platform `(640, 560)`, and scale `0.2520718`. Exact device checks and QA-viewport patches are prohibited unless a browser defect is separately documented.
