# Technical specification

## Runtime and browser requirements

- Static HTML5 application built with Vite, TypeScript, and Phaser 3.
- Current stable desktop and mobile releases of Chrome, Edge, Firefox, and Safari are targets.
- Gameplay must have no network dependency after the page and local assets have loaded.
- No backend, database, authentication, registration, or payment.
- The app should survive tab visibility changes and pause/resume audio appropriately.

## Viewports and responsive behavior

Minimum supported viewport width: **320 px**.

The fixed logical game world is **1280×720**. Phaser uses `Scale.RESIZE` for the render surface so the canvas fills the browser container without non-uniformly scaling game objects. A centralized world-framing transform maps the fixed world into that surface; HUD layout uses container dimensions and clamped values in CSS-pixel-equivalent canvas units.

Responsive composition uses exactly four modes:

1. ultra-narrow portrait (`< 360 px` portrait);
2. portrait (`360–599 px` portrait);
3. large portrait/tablet (`>= 600 px` portrait);
4. landscape, including short landscape.

Reference layouts:

| Class | Reference viewport | Primary expectation |
|---|---:|---|
| Desktop landscape | 1280×720 | Centered playfield, comfortable pointer targets |
| Tablet portrait | 768×1024 | Reflowed UI, touch-first spacing |
| Mobile portrait | 390×844 | Single-focus composition, large targets |

Landscape and portrait should remain usable where practical. The playfield uses a logical design size selected in Stage 1, aspect-preserving scale, safe-area padding, and responsive composition rules. Essential controls may not be cropped or covered by notches/browser chrome. Avoid relying on hover. Minimum touch target goal is 44×44 CSS px, with larger targets preferred for children.

Fluid typography, padding, gaps, card dimensions, progress indicators, controls, and dialogue use centralized clamped sizing. CSS `env(safe-area-inset-*)` values are exposed as host custom properties and combined with a fluid minimum margin. Responsive code must not contain device-model checks or exact QA-viewport patches.

## Input

- Mouse and touch use one semantic action boundary: point/select, drag (only when required), confirm, continue, replay, and toggle sound.
- Prevent accidental double activation and unintended browser gestures inside the play surface.
- Drag mechanics must offer generous hit areas and forgiving drop zones; a tap-based alternative is preferred if equivalent.
- Keyboard support for basic shell controls is desirable where DOM controls are used, but the core child experience remains pointer/touch-first.

## Audio

- Use Phaser Audio / Web Audio with local files only.
- Start or resume audio only after a user gesture to satisfy browser autoplay policies.
- Provide a persistent, clearly visible sound toggle.
- Pause or attenuate audio when the document is hidden; restore settings without surprise playback.
- Mix music below instruction, feedback, and optional voice. Incorrect feedback must be soft.
- If decoding fails, gameplay remains fully playable without audio.

## Game state

Serializable session state is independent of Phaser display objects. Minimum state shape:

- session ID/seed if content selection is randomized;
- current flow state/scene intent;
- current task index (0–4);
- robot repair progress (0–5);
- mechanic/question IDs selected for this session;
- attempt state for the current task;
- sound preference;
- completion state.

Renderer objects, tweens, timers, and audio instances are never persisted as game state.

## Scene transitions

Planned flow: Boot → Preload → Start → Intro → Task → Repair Transition, repeated through five tasks, then Victory → Results. Transitions are explicit state changes, input is disabled during non-interactive transitions, and duplicate navigation is guarded. Reduced-motion behavior should shorten or simplify nonessential motion.

## Asset loading

- Load local assets through a typed manifest with stable IDs; gameplay code does not embed asset file paths.
- Preload the minimum initial shell first, then the bounded session asset set where useful.
- Validate missing keys and decode failures with useful development diagnostics.
- Production assets must be `APPROVED` before integration and become `IMPLEMENTED` only after runtime verification.
- No random external URLs or runtime asset downloads.

## Performance expectations

- Target 60 fps on representative modern devices, with stable, readable behavior at 30 fps.
- Avoid allocations and content mutation in hot update paths.
- Bound particles, tweens, texture sizes, and concurrent audio instances.
- Prefer texture atlases or appropriately grouped assets after explicit optimization approval.
- Keep initial transfer modest; establish measured size and load-time budgets after approved assets are available.
- Pause nonessential processing in hidden tabs.

## Local persistence

`localStorage` is optional and limited to non-sensitive local settings such as sound preference and an optional best/completion result. Use a namespaced, versioned key, validate parsed data, tolerate storage denial/corruption, and provide a reset path. Core progression resets on replay and does not require persistence.

## Deployment requirements

- `npm run build` must create a self-contained static `dist/` folder.
- Production routes require no server rendering or API.
- Asset/base paths must support a Netlify root deployment and a GitHub Pages repository subpath.
- HTTPS, UTF-8, correct MIME types, cache-safe hashed bundles, and mobile viewport metadata are required.
- Release verification must include real or representative mobile browsers, not compilation alone.
