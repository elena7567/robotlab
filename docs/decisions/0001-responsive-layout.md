# Decision 0001 — Fluid responsive layout and world framing

Date: 2026-08-28  
Status: Accepted; amended by Decision 0007

RobotLab keeps a fixed `1280×720` logical gameplay world and uses Phaser `Scale.RESIZE` for a full-container render surface. One uniform world-container scale and offset, calculated by `responsiveCamera.ts`, frames the background and actors without changing their logical coordinates or stretching them.

HUD composition is independent of world coordinates. `responsiveLayout.ts` retains four broad component modes—ultra-narrow portrait, portrait, large portrait/tablet, and landscape—and supplies clamped measurements to UI components. Decision 0007 adds visual-viewport sizing plus compact/regular/tall height pressure and a short-landscape diagnostic profile. `fluidSizing.ts` owns reusable clamp and interpolation functions. CSS safe-area environment values enter through host custom properties.

This choice preserves readable 56 px or larger primary input targets at 320 px width and short landscape while keeping `robotGrounding.ts` authoritative for origin `(0.5, 1)`, platform `(640, 560)`, and scale `0.2520718`. Exact device checks and QA-viewport patches are prohibited unless a browser defect is separately documented.

Stage 8.3J strengthens the short-phone-landscape composition after physical-device review. Shared TaskCards receive a task-first width of at least 300 CSS px, answer choices own at least 56×56 px interactive areas, and primary actions render at least 56 px high with an additional hit-area margin. Internal challenge progress moves from the feedback band into the task ribbon in this composition, while content, transient feedback, and actions are derived as three non-overlapping vertical bands.

Stage 8.3M adds the child UI contract in `childUi.ts`: 20 px task titles, 16 px instructions/actions, 14 px status/feedback, 56 px primary touch targets, and comparable reference/answer imagery. Single-choice Tasks 1–4 validate directly on answer selection, hold visible feedback, and advance automatically; explicit confirmation remains for ordering/programming mechanics. Shadow matching uses an equal-cell inline composition in short landscape rather than shrinking the reference first. When a short-landscape viewport cannot geometrically fit the task card beside the assembly panel, secondary chrome is hidden by an available-space rule. All rules are selected from composition and available geometry, never a device model.

Characters are primary gameplay content, not disposable chrome. Orientation reflow must preserve at least one active character alongside the mechanic. On compact Mission 7 and Mission 8 compositions the helper moves into a reserved, non-interactive part of the playfield instead of being hidden; controls, ports, board cells, and route state remain authoritative and unobstructed.
