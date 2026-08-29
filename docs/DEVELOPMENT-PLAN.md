# Development plan

Every stage requires its deliverables and verification evidence. Compilation alone never grants PASS.

## Stage 0 — Foundation and documentation

- **Goal:** establish scope, architecture, ownership, inventory, and safe project structure.
- **Deliverables:** folders, project metadata, all core documents, 37-item missing asset inventory.
- **Verification:** inspect the canonical tree; confirm required documents/sections; confirm no gameplay, production art, dependency installation, or deployment.
- **PASS criteria:** documentation is internally consistent, every asset has a status/specification, and Stage 1 is clearly bounded.

## Stage 1 — Technical skeleton

- **Goal:** create a running framework without educational gameplay.
- **Deliverables:** installed locked dependencies, Phaser/Vite bootstrap, Boot/Preload/Start/shell scene flow, responsive canvas, typed asset manifest/loader, basic input/audio/persistence boundaries, neutral code-only navigation.
- **Verification:** typecheck and production build; load in browser; inspect console; resize through 320 px, desktop, tablet, and mobile references; mouse/touch navigation smoke test.
- **PASS criteria:** clean build/console, responsive shell is usable, scene lifecycle has no duplicate transitions/leaks, and missing production assets are reported rather than substituted.

## Stage 2 — Approved visual integration

- **Goal:** integrate approved background, robot, and UI assets without redefining them.
- **Deliverables:** verified manifests, responsive positioning/scaling, progress presentation shell, source/approval traceability.
- **Verification:** asset completeness check, pixel/crop review at three reference viewports, visual screenshots, missing-key/fallback behavior.
- **PASS criteria:** only approved assets are used; no cropping/blur/pivot defects; every integrated item is marked `IMPLEMENTED` with evidence.

## Stage 3 — Mechanic 1

- **Goal:** implement Find the Odd One Out as the reusable mechanic contract's first proof.
- **Deliverables:** data schema/content, mechanic module, task adapter, correct/gentle retry feedback, cleanup tests.
- **Verification:** valid and invalid question data; mouse/touch; repeated wrong/correct attempts; scene restart; three reference viewports.
- **PASS criteria:** deterministic completion, unlimited gentle retries, no progression duplication, no console errors, and reviewed content clarity.

## Stage 4 — Mechanics 2–3

- **Goal:** add Continue the Sequence and Compare by Size using shared boundaries.
- **Deliverables:** two modules, reviewed data, selection/arrangement interactions, shared feedback.
- **Verification:** edge-case content, tap and drag/drop where applicable, forgiving hit areas, responsive layouts, module disposal/re-entry.
- **PASS criteria:** mechanics do not duplicate scene flow logic, answers are unambiguous, and touch works on minimum viewport.

## Stage 5 — Mechanics 4–5

- **Goal:** add Matching Shadow and Memory.
- **Deliverables:** two modules, timed reveal state without pressure, reviewed data, accessible silhouettes/choices.
- **Verification:** pause/resume and tab visibility during memory reveal, wrong/correct retries, repeat sessions, responsive/touch checks.
- **PASS criteria:** timing cannot trap the player, silhouettes are visually valid, state resets cleanly, and all five mechanics share normalized results.

## Stage 6 — Progression and robot repair

- **Goal:** connect five task completions to 0/5–5/5 repair progression.
- **Deliverables:** finite session selection, ProgressionSystem, modular part activation, repair transition, replay reset.
- **Verification:** full runs, duplicate-click guards, incorrect answers, refresh/replay, every progress stage, randomized content bounds.
- **PASS criteria:** exactly five completions lead to victory once, wrong answers never remove progress, and replay starts cleanly.

## Stage 7 — Animation and audio

- **Goal:** add approved motion and sound with child-safe feedback.
- **Deliverables:** approved animations/audio, mute persistence, autoplay-safe start, reduced-motion behavior, lifecycle cleanup.
- **Verification:** muted/unmuted starts, visibility changes, rapid navigation, decode failure, volume balance, reduced motion.
- **PASS criteria:** no autoplay violations, overlap/leaks, harsh retry feedback, or gameplay dependency on audio/animation.

## Stage 8 — Responsive/mobile polish

- **Goal:** make the complete experience robust across target orientations and inputs.
- **Deliverables:** final breakpoints/composition rules, safe-area support, touch tuning, mobile browser fixes.
- **Verification:** 1280×720, 768×1024, 390×844, 320 px minimum, practical landscapes, device emulation plus representative real-device checks.
- **PASS criteria:** no essential cropping/overlap, targets remain child-appropriate, browser gestures do not interrupt play, and orientation changes recover.

## Stage 9 — QA

- **Goal:** complete functional, visual, performance, and regression validation.
- **Deliverables:** completed QA checklist, evidence screenshots, resolved issue log, performance/load observations.
- **Verification:** full checklist across supported browsers/devices and multiple complete sessions.
- **PASS criteria:** no blocking/high-severity issues, all core flows pass with evidence, assets are approved/implemented, and remaining limitations are documented.

## Stage 10 — Portfolio build and deployment

- **Goal:** produce and publish a reproducible portfolio release after explicit approval.
- **Deliverables:** optimized build, chosen host configuration, deployed URL, README/status updates, release smoke-test evidence.
- **Verification:** clean install/build, direct URL and refresh, hashed/local assets, offline-after-load behavior, mobile browsers, full gameplay run on production.
- **PASS criteria:** production URL is stable and complete, no runtime network dependency after load, and deployment matches the verified build.
