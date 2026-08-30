# RobotLab project status

## PROJECT

RobotLab — «Почини робота», a browser educational 2D mini-game for ages 4–6.

## CURRENT DESIGN STAGE

Stage 8.2A — Mission 7 composition rebalance

## CURRENT STATUS

PASS — Mission 7 keeps its approved connection mechanic while presenting a centered primary board, separated appropriately scaled robots, and uncluttered responsive UI. Ready for manual visual review; changes remain uncommitted.

## CANONICAL LOCAL URL

`http://127.0.0.1:4198/`

- `npm run dev` and `npm run preview` bind strictly to port 4198.
- Automatic fallback to changing ports is disabled.
- All future manual browser review, screenshots, and automated level QA must use this address.

## FIRST FIVE MISSIONS

LOCKED

## MISSION 6–10

MISSIONS 6–7 IMPLEMENTED; MISSIONS 8–10 DESIGN ONLY / NOT IMPLEMENTED

## STAGE 8.2A — MISSION 7 COMPOSITION REBALANCE

- Changed presentation only. Connection rules, drag evaluation, port mapping, wire colors, challenge/randomization/session behavior, hint/audio behavior, Mission 6 handoff, Missions 1–6 runtime code, and canonical robot assets remain unchanged.
- Added a centralized Mission 7 responsive composition to the existing four-mode layout system. No device-specific checks or runtime network dependency were introduced.
- Landscape now reserves separate helper/board/repaired-robot zones, centers the board exactly on the viewport, and restores both robots from the prior 0.15 miniature scale to 0.20, visually matching the established 0.19 gameplay pair scale.
- Tablet and mobile use a separated, grounded two-robot row above the centered board. The 320×568 mode recomposes the board vertically and keeps robots at 0.095 rather than clipping or reducing them to progress icons.
- The systems panel stays compact and secondary. Explicit responsive gaps separate Home/sound controls, systems, robots, board, and hint action.
- Ultra-narrow board rows use height-responsive internal spacing while preserving socket art size and 48 px minimum effective touch targets; connection mechanics and pointer handling are untouched.
- Grounding data is synchronized to each responsive actor position. Helper base/contact coordinates and repaired-robot position/contact coordinates match at all required viewports; robot shoulder/arm transforms remain unchanged.
- Mission 7 QA: `qa/stage8-2-mission7-playtest.cjs` PASS with `failures: []` at 320×568, 390×844, 768×1024, 1280×720, and 1438×914. Added assertions cover exact board centering, actor zones/scale/separation, board clearance, panel spacing, viewport bounds, and grounding, alongside the existing mouse/touch wire, wrong/cancel/duplicate, live-resize, audio, randomization, completion, and full-flow coverage.
- Missions 1–6 regression: unchanged `qa/stage8-1-mission6-playtest.cjs` PASS at the same five viewports with `failures: []`; no input, flow, dialogue, energy, audio, or layout regressions were reported.
- Required review evidence: `docs/qa/screenshots/stage8-2a-desktop-1280x720-challenge-1.png`, `stage8-2a-desktop-1280x720-partially-connected.png`, `stage8-2a-wide-1438x914-challenge-1.png`, `stage8-2a-tablet-768x1024-challenge-1.png`, and `stage8-2a-mobile-390x844-challenge-1.png`. An additional 320×568 challenge capture records the minimum-width composition.
- Verification: `npm run build` PASS (49 modules transformed; existing non-blocking Phaser chunk-size advisory only). The restricted-sandbox attempt hit the known Windows `spawn EPERM`; the approved rerun passed. Both browser suites ran against `http://127.0.0.1:4198/` with zero console/page/request/response errors.
- Files moved or deleted: none. Git commit: none. Ready for manual visual review.

## STAGE 8.2 — MISSION 7: ПОДКЛЮЧИ ПРОВОДА

- Mission 6 now exposes one guarded post-activation `ПРОДОЛЖИТЬ` action into Mission 7; the Mission 6 mechanic, answer rules, and power reward are unchanged.
- Added `connectionsMechanic` outside Phaser scenes with three challenges (3, 4, and 4 ports), non-identity randomized destination order, persistent correct pairs, and idempotent challenge/mission completion.
- Added a real one-pointer drag/trace interaction. Correct color pairs snap and lock; wrong targets play gentle feedback and retract; empty-space release cancels without wrong audio; completed endpoints cannot be reused.
- Added curved procedural Graphics wires with color, highlight, glow, clean endpoints, controlled crossings, and a final pulse along all completed wires.
- Added 48 px minimum effective targets at 320×568 and 64–72 px targets where space permits. CDP touch drags and mouse drags use the same connection boundary.
- Added `ЗАДАНИЕ 7 ИЗ 10`, `СИСТЕМЫ 2/4` / `СОЕДИНЕНИЯ`, and `ПОДКЛЮЧЕНИЕ 1 ИЗ 3` through `3 ИЗ 3` without reintroducing the stretched task panel.
- Hint pulses one unmatched source and then its matching target without drawing or completing the wire. Existing hint/correct/wrong/repair audio is reused; no new assets or runtime network dependencies were added.
- Challenge completion preserves the readable completed board for 900 ms. Final completion derives `connectionsCompleted` from canonical `completedTasks >= 7`, activates persistent robot chest/arm/antenna system lights, pulses the laboratory conduit, and shows the Mission 8-ready completion copy without implementing Mission 8.
- Live resize rebuilds only presentation objects; destination permutation and completed pair state remain intact. Shutdown removes global pointer listeners and clears any in-flight pointer state.
- Architecture decision: `docs/decisions/0005-mission7-wire-connections.md`.
- Stage 8.2 QA: `qa/stage8-2-mission7-playtest.cjs` PASS with `failures: []` at 320×568, 390×844, 768×1024, 1280×720, and 1438×914. It verifies mouse/CDP touch drag, wrong target, empty release, hint, duplicate source, locked endpoints, live resize, randomized layouts, all three challenges, audio, robot systems state, lab reactivity, clean console/network, and a normal Start → Missions 1–7 flow.
- Missions 1–6 regression: unchanged `qa/stage8-1-mission6-playtest.cjs` PASS at all five required viewports with `failures: []`.
- Visual evidence: seven required captures under `docs/qa/screenshots/stage8-2-*`, including initial, partial, and completed boards at 390×844; initial, partial, completed, and active robot-pulse states at 1280×720.
- Verification commands: `npm run build` PASS (49 modules; existing non-blocking chunk-size advisory only); bundled Node + `qa/stage8-2-mission7-playtest.cjs` PASS; bundled Node + `qa/stage8-1-mission6-playtest.cjs` PASS. Restricted-sandbox Vite/Chrome spawn attempts hit the known Windows `EPERM`; approved reruns passed.
- Files created: `src/game/mechanics/connections.ts`, `src/game/scenes/Mission7Scene.ts`, `src/game/ui/ConnectionTaskCard.ts`, `qa/stage8-2-mission7-playtest.cjs`, `docs/decisions/0005-mission7-wire-connections.md`, `docs/qa/stage8-2-mission7-results.json`, and seven `docs/qa/screenshots/stage8-2-*` images.
- Files changed: `src/game/config.ts`, `src/game/scenes/Mission6Scene.ts`, `src/game/scenes/StartScene.ts`, `src/game/state/sessionState.ts`, `src/game/ui/RobotAssemblyPreview.ts`, `docs/game-design/SECOND-HALF-DEVELOPMENT-PLAN.md`, `ROBOTLAB-PROJECT-STATUS.md`, and the refreshed Stage 8.1 regression results/screenshots.
- Files moved or deleted: none.
- Blockers: none. Ready for manual review.

## STAGE 8.1B — MISSION 6 DIALOGUE COLLISION FIX

- Added an opt-in `above-robot` placement mode to `RobotDialogue`; existing Missions 1–5 retain the prior automatic placement behavior.
- Mission 6 landscape dialogue is constrained to the safe horizontal region between the task card and systems panel and sits above the helper robot with a downward speech tail.
- Phone portrait dialogue uses the reserved upper status region. The systems chip is temporarily hidden while the transient dialogue is visible, so neither surface covers the other.
- Large portrait/tablet dialogue uses the dedicated progress-side region instead of the phone-centered position.
- Added explicit `dialogueSafe` QA assertions: the visible bubble must be inside the viewport and must not intersect the task card, helper robot, repaired robot, or a visible systems panel.
- Full ordinary Start → Missions 1–6 browser QA PASS at 320×568, 390×844, 768×1024, 1280×720, and 1438×914 with `failures: []`, including touch paths and zero console/page/request/response errors.
- Visual review PASS: `stage8-1b-mobile-390x844-dialogue-safe.png`, `stage8-1b-desktop-1280x720-dialogue-safe.png`, and `stage8-1b-wide-1438x914-dialogue-safe.png`.

## STAGE 8.1 — MISSION 6: ЗАРЯДИ РОБОТА

- Changed only the post-completion destination of Mission 5: its gameplay, Memory rules, assembly 5/5 reward, scoring, audio, and release remain intact; after release it now opens `РОБОТ СОБРАН!` / `ТЕПЕРЬ ПОРА ЕГО ОЖИВИТЬ!` with `ПРОДОЛЖИТЬ`, never the true final `VictoryScene`.
- Updated the Start subtitle to `СОБЕРИ, ОЖИВИ И ЗАПУСТИ РОБОТА!` without a mission count.
- Extended canonical session progression to ten missions. `completedTasks` remains the mutable major-progress source; `assemblyProgress` remains clamped to 0–5 and `powerActivated` is derived from `completedTasks >= 6`, preventing contradictory duplicated state.
- Added the reusable deterministic `energyMechanic` outside Phaser scenes: full-battery selection, almost-empty selection, and low → medium → full tap-ordering. Empty submission is neutral; wrong input resets only the current selection/order; hint state never solves or advances a challenge.
- Added a procedural child-facing battery card using Phaser shapes at 20%, 55%, and 100% fill. Existing `size-battery.png` was inspected conceptually as a single size-comparison object and not reused because it cannot communicate three independent fill levels clearly. No production artwork or audio was added.
- Mission 6 renders `ЗАДАНИЕ 6 ИЗ 10`, `ЭНЕРГИЯ 1 ИЗ 3` through `3 ИЗ 3`, and semantic phase progress `СИСТЕМЫ 1/4` / `ЭНЕРГИЯ`; it does not reuse assembly progress as the Mission 6 label.
- Selection uses tap → selected frame → `ПРОВЕРИТЬ`; ordering uses the approved robust tap-order alternative with three numbered slots, large targets, toggle-to-correct before check, and equivalent mouse/touch actions.
- Correct, wrong, and hint paths use the existing centralized audio manager and `answer-correct.wav`, `answer-wrong.wav`, and `hint.wav`; final activation uses `repair-reward.wav` exactly once.
- The assembled repaired robot is cool/dim but neutral before activation. At completion it becomes `assembled + powered`: full-colour parts, brighter eyes, chest display, antenna glow, a restrained power pulse, and persistent lit platform conduits. The helper robot artwork/state is not darkened or replaced.
- Completion is guarded by mechanic result, disabled submit, canonical state idempotency, one power-activation token, and scene shutdown-safe tweens. Stage 8.2 now continues from this completed state into Mission 7.
- Added architecture decision `docs/decisions/0004-mission6-energy-system.md`.
- Full-flow QA: `qa/stage8-1-mission6-playtest.cjs` completed the real Start → Missions 1–5 → transition → Energy 1/3 → 2/3 → 3/3 → powered flow at 320×568, 390×844, 768×1024, 1280×720, and 1438×914. All five use their intended touch/mouse paths and returned `failures: []`.
- QA explicitly passed no-selection neutrality, selection change, wrong/reset, hint in all three challenges, wrong-order reset, order correction, duplicate final submit protection, exact audio counts, canonical `completedTasks = 6` / `powerActivated = true`, persistent repaired-robot powered state, platform-conduit activation, in-bounds cards/batteries, >=56 px targets, and zero console/page/request/response errors.
- Visual review passed the eight required 390×844 and 1280×720 captures: Mission 5 transition, Energy 1/3, ordering, and powered completion at each size. At least two captures clearly show the powered reward.
- Verification: `npm run build` PASS; TypeScript passed, Vite transformed 46 modules, and only the existing non-blocking Phaser bundle-size advisory was emitted. The first restricted-sandbox attempt hit Windows `spawn EPERM`; the identical approved rerun passed.
- Evidence: `docs/qa/stage8-1-mission6-results.json` and `docs/qa/screenshots/stage8-1-*`.

## STAGE 8.0A — TASK PANEL SPACING AND HEIGHT POLISH

- Added centralized fluid ribbon-overhang and control-gap measurements for landscape and large portrait/tablet compositions, respecting the existing safe-area inset pipeline.
- Replaced landscape full-available-height stretching with a content-driven height derived from panel width and capped at 480 px.
- Preserved the task ribbon, title, instruction, answer area, feedback/info row, action buttons, 44 px minimum hit areas, all mechanic code, and all game-state behavior.
- Responsive verification PASS at 320×568, 390×844, 768×1024, 1280×720, and 1438×914 with `failures: []`, no clipping, no overlap, and no console/page/request errors.
- Full layout regression reached Tasks 1–5 on touch mobile 390×844 and desktop 1280×720; every task card and visible child remained in bounds and every interactive target remained at least 44×44 px.
- Measured visual Home-to-ribbon gaps: 150.21 px at 320×568, 193.96 px at 390×844, 41.84 px at 768×1024, 30.17 px at 1280×720, and 39.78 px at 1438×914.
- Landscape task-card heights are 458.75 px at 1280×720 and 480 px at 1438×914 instead of consuming all available vertical space.
- Verification: `npm run build` PASS; TypeScript passed, Vite transformed 43 modules, and only the existing non-blocking Phaser bundle-size advisory was emitted. The first restricted-sandbox attempt hit the known Windows `spawn EPERM`; the identical approved rerun passed.
- Evidence: `docs/qa/stage8-0a-task-panel-results.json`, `docs/qa/screenshots/stage8-0a-task-panel-desktop-1280x720.png`, and `docs/qa/screenshots/stage8-0a-task-panel-mobile-390x844.png`.

## STAGE 8.0 — 10-MISSION GAME DESIGN

- Approved the three-act structure: `СОБЕРИ РОБОТА` (Missions 1–5), `ОЖИВИ РОБОТА` (Missions 6–9), and `ЗАПУСТИ РОБОТА` (Mission 10).
- Preserved Missions 1–5 as the locked assembly baseline and documented the second robot lifecycle: assembled, powered, connected, command-capable, verified, launched.
- Designed Mission 6 quantity/energy selection, Mission 7 port connection, Mission 8 command programming, Mission 9 diagnostics, and Mission 10 integrated first launch without implementing runtime behavior.
- Approved the future Mission 5 transition copy: `РОБОТ СОБРАН!`, `ТЕПЕРЬ ПОРА ЕГО ОЖИВИТЬ!`, and `ПРОДОЛЖИТЬ`; final repair language is reserved for Mission 10.
- Approved the future Start screen direction: `ПОЧИНИ РОБОТА` / `СОБЕРИ, ОЖИВИ И ЗАПУСТИ РОБОТА!`; current StartScene remains unchanged.
- Defined semantic progress phases for assembly, systems, and launch instead of a generic 0/10 bar.
- Defined progressive laboratory reactions, persistent helper responsibilities, non-punitive adaptive hints, and resumable session checkpoints.
- Defined a conceptual versioned state model with one canonical `completedMissions` source and derived assembly/system/robot/laboratory selectors.
- Added portrait-specific interaction guidance for wire connection and programming while retaining centralized fluid sizing, camera/framing, and four composition modes.
- Marked the future robot collection loop as out of current scope and excluded coins, loot boxes, random rewards, stores, and premium unlocks.
- Created `docs/game-design/10-MISSION-GAME-DESIGN.md`.
- Created `docs/game-design/SECOND-HALF-DEVELOPMENT-PLAN.md`.
- Created `docs/architecture/10-MISSION-PROGRESSION-ARCHITECTURE.md`.
- Runtime files modified: none.

## STAGE 7.1B.2 ASSEMBLY PANEL REDESIGN + FINAL ROBOT RELEASE

- Replaced the narrow desktop progress tube and shallow phone strip with a 1.32:1 repair-bay card using the existing four responsive composition modes.
- Landscape uses a fluid extra right-edge inset; phone portrait stacks the compact station above the task card with ribbon clearance; large portrait/tablet places the station beside the task card.
- Reduced blueprint alpha to `0.024`, changed it to a colder subdued tint, and retained full-colour installed parts for obvious contrast.
- Simplified the station interior to a dark-blue bay, small cyan corner/details, counter, divider, and grounding glow without cage-like rails or diagonal guides.
- Added an explicit final release: after the 5/5 antenna activation, the station fades away and the repaired robot travels into the logical actor layer beside the helper.
- Final gameplay and VictoryScene both show two independently grounded robots with no assembly frame around the repaired robot.
- Preserved canonical `completedTasks → assemblyProgress`, all five task mechanics, answer evaluation, audio ownership, controls, and helper part grounding.
- Added architecture decision `docs/decisions/0003-assembly-station-release.md`.
- Verification: `qa/stage7-1b-assembly-integration-playtest.cjs` PASS with `failures: []` across 320×568, 390×844, 768×1024, 1280×720, and 1438×914; full flows pass at desktop 1280×720 and touch mobile 390×844.
- Verification: 0/5–4/5 mapping, install animation, 5/5 activation, station release, final no-frame state, two-robot grounding, Victory, audio exactly once per task, Play Again, Home, and Home-during-reward all pass.
- Verification: `npm run build` PASS; 43 modules transformed with only the existing non-blocking Phaser bundle-size advisory.
- Evidence: `docs/qa/stage7-1b2-assembly-release-results.json` and `docs/qa/screenshots/stage7-1b2-*`.

## STAGE 7.1B.1 REMOVE ASSEMBLY CROSSHAIR

- Removed the two diagonal `lineBetween` draws from the compact `ProgressPanel` assembly station.
- Changed only the full preview station interior alpha from `0.68` to `1`, retaining the same dark-blue color and preventing background-window diagonals from reading as a debug X.
- Verified compact and full stations at every assembly state 0/5–5/5 on 390×844, 768×1024, and 1280×720.
- Visual review confirms clean interiors with the frame, rails/ticks, blueprint robot, installed parts, labels, and borders preserved.
- Verification: `qa/stage7-1b1-crosshair-playtest.cjs` PASS with `failures: []` and zero console/page/request/response errors.
- Verification: `npm run build` PASS; 43 modules transformed and only the existing non-blocking Phaser bundle-size advisory was emitted.
- Evidence: `docs/qa/stage7-1b1-crosshair-results.json` and `docs/qa/screenshots/stage7-1b1-*`.

## STAGE 7.1B ROBOT ASSEMBLY PROGRESSION INTEGRATION

- Added a centralized derived `assemblyProgress: 0 | 1 | 2 | 3 | 4 | 5` session snapshot value. `completedTasks` remains the only mutable major-progress counter.
- Added the exact mapping: Task 1 body; Task 2 head; Task 3 both legs; Task 4 both normal arms; Task 5 antenna plus activation.
- Replaced the abstract `РЕМОНТ` dot/check panel with a compact second-robot station and `СБОРКА N/5` label. The robot preview remains the primary progress signal in both portrait and landscape layouts.
- Each major completion runs one guarded 1.2–2.0 second reward: station focus, earned-part fade/move/0.85→1.05→1.00 settle, glow, one `repair-reward.wav`, helper reaction/dialogue, and compact return.
- Task 5 adds the antenna and runs the antenna/chest-color glow pulse activation before Victory.
- The helper stays intact and uses only stable `RobotActor` correct/celebrate reactions; no helper arm transform or asset changes were made.
- VictoryScene now shows the complete helper on screen-left and the modular repaired robot on screen-right. Both use the same responsive platform contact Y and remain visually distinct without overlap.
- Play Again resets session and mechanic state to assembly blueprint 0/5. Home during an active reward shuts down tweens safely; the next Play starts at 0/5 with no stale preview or duplicate reward.
- Added `docs/decisions/0002-robot-assembly-progression.md` to record canonical state ownership and the replaceable second-robot renderer boundary.
- Verification: `npm run build` PASS; TypeScript passed, Vite transformed 43 modules, and only the existing non-blocking bundle-size advisory was emitted.
- Verification: `qa/stage7-1a-assembly-preview-playtest.cjs` PASS for all six proof states plus responsive 5/5 captures. Blueprint alpha is `0.045`; complete proof scale is `0.1792`, exactly 12% above the prior `0.16`, with feet contact preserved.
- Verification: `qa/stage7-1b-assembly-integration-playtest.cjs` PASS. Full ordinary Start→Tasks 1–5→Victory flow passed at 1280×720 and touch 390×844; responsive compact-state checks passed at 320×568, 390×844, 768×1024, 1280×720, and 1438×914.
- Verification: all 0/5 through 5/5 state/part checks, install-animation observations, helper phrases, activation observation, exactly five repair-reward events, two-robot Victory, grounding, Play Again, Home, Home-during-reward, and console/page/request/response checks passed with `failures: []`.
- Evidence: `docs/qa/stage7-1b-assembly-integration-results.json` and `docs/qa/screenshots/stage7-1b-*`.

## STAGE 7.1A ROBOT ASSEMBLY VISUAL PROOF (APPROVED INPUT)

- Added `RobotAssemblyPreviewScene`, registered only for direct dev/QA invocation and never entered by Boot, Preload, Start, gameplay, Victory, or Results flow.
- Added a dedicated static `RobotAssemblyPreview` layout measured against the approved modular part artwork; it does not inherit transforms or behavior from `RobotActor`.
- State 0/5 now uses `0.045` alpha missing-part guides so it reads as a technical blueprint rather than a transparent complete robot. The renderer supports every state from 0/5 through 5/5.
- The 5/5 proof scale is `0.1792`, 12% larger than the original `0.16`, while remaining smaller than the helper and preserving feet contact.
- The repair station uses only Phaser primitives: restrained cyan outline, twin technical rails, inspection marks, subtle glow, and a rounded grounded platform.
- Visual QA confirms centered head/body and antenna, symmetric measured shoulder roots, natural neck and leg overlap, coherent silhouette, and visible feet contact on the stand.
- Complete-state responsive proof passes at 390×844, 768×1024, and 1280×720 without viewport-specific transforms or device checks.
- The approved task-to-part mapping is implemented by Stage 7.1B.
- Verification: `npm run build` PASS (TypeScript plus Vite production build; only the existing chunk-size advisory was emitted).
- Verification: Stage 7.1A Playwright visual/layout suite PASS across all eight current proof captures with no console, page, request, or response errors.
- Evidence report: `docs/qa/stage7-1a-assembly-preview-results.json`.
- Evidence screenshots: `docs/qa/screenshots/stage7-1a-state-0-of-5-desktop-1280x720.png`, `stage7-1a-state-2-of-5-desktop-1280x720.png`, `stage7-1a-state-5-of-5-desktop-1280x720.png`, `stage7-1a-state-5-of-5-mobile-390x844.png`, and `stage7-1a-state-5-of-5-tablet-768x1024.png`.
- Git: Stage 7.1A proof is included with the Stage 7.1B integration commit.

## TECH STACK

- Phaser 3.90.0
- TypeScript 5.9.3
- Vite 7.3.6
- No React, backend, account system, payment system, or runtime network dependency

## COMPLETED

- Installed declared dependencies and created `package-lock.json`.
- Added separate Boot, Preload, Start, Intro, Game, Transition, Victory, and Results scene modules.
- Implemented the temporary flow: Boot → Preload → Start → Intro → Game → Transition → Victory → Results → Start.
- Added shared pointer controls for START, NEXT, BACK, and RESTART; the same Phaser pointer boundary supports mouse and touch.
- Added a serializable session state with `currentTask`, `completedTasks`, `totalTasks = 5`, and `score` outside Phaser scenes.
- Added a typed asset manifest with stable IDs for all 26 production files found under the requested runtime groups; the single laboratory background file serves both required background IDs.
- Loaded and rendered `robot-complete_v01.png` in GameScene without modifying the approved source.
- Added a 1280×720 Phaser FIT canvas with automatic centering, a 320 px page minimum, touch-safe browser CSS, and no horizontal scrolling.
- Loaded and rendered the approved `laboratory-background.png` in StartScene and GameScene without duplicating or renaming the source.
- Bottom-aligned the full robot to the circular platform using its visual foot contact point; reduced its display height from 390 px to 365 px (approximately 6.4%).
- Replaced the Stage 1 technical StartScene presentation with the Russian title, supporting subtitle, approved robot, production-style sound control, and large `Играть` action.
- Rebuilt GameScene around the approved master-reference hierarchy: task card left, robot centered on the platform, and progress panel right on desktop, with a deliberate stacked portrait reflow.
- Added reusable runtime-vector `TaskCard`, `ProgressPanel`, and production control components without generating or modifying raster artwork.
- Added a viewport-aware laboratory crop that preserves the approved robot/platform contact point from desktop through 320 px portrait.
- Changed Phaser scaling from fixed 16:9 FIT to viewport RESIZE so portrait text and touch targets remain readable rather than shrinking with the whole desktop canvas.
- Stage 2.1: bound progress directly to `completedTasks`, removed the extra desktop `ЗАДАНИЕ 1 / 5` label, removed the separate portrait progress counter, and verified one initial `0 / 5` display with five inactive indicators.
- Stage 3.2: replaced GameScene's viewport/task-card-derived robot bottom and max-size calculations with one `placeRobotOnPlatform()` implementation.
- Stage 3.2: centralized background/robot grounding; the current responsive integration supplies both with the same explicit contact target so portrait UI cannot detach or hide the robot.
- Stage 3.2: retains approved scale `0.2520718` where space permits, clamps it only to keep the robot below the portrait task card, and preserves bottom origin `(0.5, 1)` plus the measured 25-source-pixel transparent-bottom correction.
- Stage 3.2: made the success reaction relative to a captured grounded base and explicitly restores the exact base transform when the tween completes.
- Stage 3.2 Kosmobegun reference: `D:\Projects\Codex\Recovery\Kosmobegun\assets\levels\forest\level01-layout.js` uses named `anchor: 'feet'` world points, `src-phaser/actors/createActors.ts` uses visual origins, and `src-phaser/feedback/WorldInteractableFeedback.ts` restores captured base transforms after feedback.
- Stage 3.1: corrected Phaser Container hit-area coordinates so visible controls and pointer/touch targets coincide.
- Stage 3.1: added immediate 0.97 press/depressed feedback and a 120 ms release to Играть, Домой, Звук, Подсказка, Проверить, and Дальше.
- Stage 3.1: added immediate object press feedback plus persistent 1.045 selected scale, ring, border, and checkmark; selection does not rely only on colour.
- Stage 3.1: expanded practical targets by 8 px; the minimum Odd One Out target is 135×64 px at 320×568.
- Stage 3.1: delayed only the newly revealed Дальше control by 180 ms after success, preventing a rapid second Проверить tap from causing an accidental transition.
- Grounding integration: responsive portrait placement now bounds the robot below the task card and uses the same explicit platform-contact Y for the background and robot; feedback tweens restore the captured grounded placement.
- Stage 3.3: wrong checks clear the mechanic selection immediately, keep progress and score unchanged, disable Проверить, and leave the current task active.
- Stage 3.3: the task card uses a separate 320 ms transient wrong-feedback key for a soft orange border and object wobble, then removes the wrong state without locking the object.
- Stage 3.3: added a runtime Phaser speech bubble with four rotating gentle phrases, responsive robot anchoring, immediate dismissal on re-selection, and automatic dismissal after 2 seconds.
- Stage 3.3: added a subtle 360 ms robot tilt that restores the exact captured grounded transform after completion.
- Stage 3.4: fixed background and robot children in a 1280×720 logical world; robot origin `(0.5, 1)`, platform `(640, 560)`, and canonical scale `0.2520718` remain immutable at every viewport.
- Stage 3.4: retained Phaser `Scale.RESIZE` as the display-surface mode and centralized uniform world scaling/offset in `responsiveCamera.ts`, avoiding non-uniform stretch while keeping HUD targets readable.
- Stage 3.4: centralized clamping/interpolation, safe margins, typography, spacing, card/progress/control/dialogue measurements, and the four composition modes in `fluidSizing.ts` and `responsiveLayout.ts`.
- Stage 3.4: added CSS safe-area environment variables and a project-level prohibition on exact-device responsive patches.
- Stage 3.4: added permanent fixed/intermediate viewport automation, screenshot evidence, runtime grounding assertions, 44 px target assertions, dialogue bounds, gameplay regression, rendered 5/5 progress, and error capture.
- Stage 4: added a serializable `SequenceMechanic` with authored `id`, `sequence`, `options`, `correctAnswer`, `hint`, and `difficulty` data for three internal challenges.
- Stage 4: integrated Mechanic 1 → Mechanic 2 directly through the existing Дальше action while preserving score and overall progress at 1/5.
- Stage 4: reused TaskCard selection, immediate pointer feedback, disabled/enabled Проверить behavior, wrong-answer clearing, and Дальше progression; the sequence and options occupy visually separate rows.
- Stage 4: added an outlined runtime missing slot that fills with the correct production symbol after success; no artwork was generated or modified.
- Stage 4: tracks `sequenceChallengeIndex` independently across 1/3, 2/3, and 3/3. Challenges 1 and 2 do not change overall progress; challenge 3 completes Mechanic 2 and changes progress to 2/5 once.
- Stage 4: uses challenge-specific hint data in RobotDialogue, four rotating gentle wrong-answer phrases, the existing grounded positive/wrong robot reactions, and deterministic option reordering based on symbol IDs rather than option position.
- Stage 4: preserves selected sequence state and internal challenge state across live resize restarts; Home → Играть resets both overall and sequence state to Mechanic 1 at 0/5.
- Stage 5: added a serializable `SizeComparisonMechanic` with authored `id`, `instruction`, `sizes`, `correctSize`, and `hint` data for three internal challenges.
- Stage 5: uses only runtime ID `size-battery` and the unchanged `size-battery.png` source at canonical multipliers small `0.70`, medium `1.00`, and large `1.30`; colour, orientation, brightness, crop, and object type do not change.
- Stage 5: shuffles size IDs once per new game, guarantees that the correct answer is not in the same slot for every challenge, and checks size identity rather than screen position.
- Stage 5: renders three horizontal child-friendly choice cells with a shared bottom baseline, at least 64×44 px hit areas, and the existing persistent selection/check/wrong-retry interaction.
- Stage 5: tracks `sizeChallengeIndex` independently across 1/3, 2/3, and 3/3. Challenges 1 and 2 keep overall progress at 2/5; challenge 3 changes progress to 3/5 once and sets the session's next task to 4.
- Stage 5: uses challenge-specific hints and size-aware wrong/correct RobotDialogue phrases with the existing grounded reactions; hints never reveal, select, or advance the answer.
- Stage 5: preserves the selected size, shuffled order, correct identity, and internal challenge across live resize; Home → Играть resets size state together with the full session.
- Stage 5.1 foundation: GameScene uses a seven-part modular `RobotActor` with centralized states, immutable part baselines, idle/micro-reactions, reduced-motion handling, repair-energy profiles, and the existing gear reward asset; StartScene intentionally uses the complete approved hero sprite.
- Stage 5.1A: restored the approved `robot-complete` presentation on StartScene with a centered fluid title/subtitle/robot/Play composition and subtle whole-sprite idle; the modular GameScene actor remains intact.
- Stage 5.1B: changed the modular GameScene robot's screen-left `armRight` shared base rotation from 82° to 122°, turning the approved arm artwork's built-in bend and open hand into an upward-diagonal friendly wave without moving its shoulder attachment or pivot.
- Stage 5.1B: idle, correct, hint, wrong, and micro-wave behavior continues to derive from the captured shared base transform; exact part restoration and canonical grounded actor transform remain intact.
- Stage 5.1E: removed `robot-arm-wave-left.png` from the runtime manifest and `RobotActor`; the source file remains unchanged on disk for possible later review.
- Stage 5.1E: explicitly maps screen-left to `robot-arm-right.png` at local `(-236, -733)` / `+4°`, and screen-right to `robot-arm-left.png` at `(236, -733)` / `-4°`.
- Stage 5.1E: removed every arm-specific idle, correct, hint, celebrate, wave, crossfade, visibility-state, and micro-reaction tween. Reactions now use only actor/body, head, and antenna feedback.
- Stage 5.1F: defines explicit `RESTING_ARM_POSES` for both screen sides; the canonical coordinates are symmetric at `x = ±220`, `y = -765`, scale `0.4`, with artwork-specific shoulder origins and mirrored `±4°` rotations.
- Stage 5.1F: extends immutable part baselines to include `originX` and `originY`, so idle, wrong, correct, hint, and celebrate recover the full canonical pose even after a stale pivot or interrupted transform.
- Stage 5.1F: leaves both arms free of tween targets and keeps `robot-arm-wave-left.png` absent from the runtime manifest and actor.
- Stage 5.1H: defines `BODY_SHOULDER_ANCHORS` from the body texture's visible socket centers instead of independent global arm offsets.
- Stage 5.1H: uses the proximal connector center of each approved normal arm as that image's origin, then places both roots exactly at the socket anchors with the existing scale and rotations.
- Stage 5.1H: adds no production debug art; the QA harness injects socket/root markers temporarily, verifies coincidence, destroys them, and captures clean responsive evidence.
- Stage 5.2: reproduced the Start-origin Sequence 3/3 stall and confirmed that it was visual-control timing, not a missing completion flag, state increment, task mapping, or battery mechanic.
- Stage 5.2: final Sequence correctness immediately sets `completedTasks = 2`, `currentTask = 3`, `score = 2`, renders `2 / 5`, and reveals `Дальше` after 180 ms.
- Stage 5.2: `Дальше` loads the existing `sizeComparisonMechanic` and `size-battery` choices as `ЗАДАНИЕ 3/5`; completing its three challenges sets `completedTasks = 3`, `currentTask = 4`, and `score = 3`.
- Stage 5.2: a scene-liveness guard prevents non-blocking reward feedback from starting another tween after GameScene shutdown.
- Stage 5.2A: all task `Дальше` actions use one guarded `renderCurrentTask` handoff; it hides transient dialogue and explicitly restarts the normal renderer once, after serializable state mutation.
- Stage 5.2A: the repair reward resolves on GameScene shutdown, kills its active tweens, and destroys its transient image so an in-flight Stage 5.1 choreography cannot outlive or interfere with Task 3 rendering.
- Stage 5.2A: the normal Start-origin flow visibly shows one TaskCard containing `ЗАДАНИЕ 3/5`, `СРАВНИ ПО РАЗМЕРУ`, and three in-viewport `size-battery` images at all three required responsive targets.
- Stage 5.2B: changed only progress presentation; `currentTask`, `completedTasks`, score, major-mechanic completion, and internal challenge state semantics are unchanged.
- Stage 5.2B: major task and internal challenge counters use explicit `ИЗ` wording so the two scopes remain distinct for young players.
- Stage 5.2B: renamed the responsive progress panel to `РЕМОНТ`, removed its numeric fraction, and retained exactly five named visual repair indicators in both horizontal portrait/tablet and vertical desktop layouts.
- Stage 5.3: synthesized `start-theme.wav`, `ui-click.wav`, `answer-correct.wav`, `answer-wrong.wav`, `hint.wav`, and `repair-reward.wav` locally from original waveforms; no external downloads, unclear licenses, vocals, or third-party sound packs are used.
- Stage 5.3: added `AudioManager` with semantic APIs, music/SFX levels `0.26`/`0.58`, explicit first-gesture gating, a 180 ms Play fade, single-loop music, same-key SFX restart, master mute, blur/focus handling, and `robotlab.audioMuted` persistence.
- Stage 5.3: shared controls emit one UI click at their existing `pointerdown` boundary; Odd One Out, Continue the Sequence, and Compare by Size emit correct/wrong/hint cues without delaying state, and only major mechanic completion emits repair reward audio.
- Stage 6: added serializable `ShadowMatchingMechanic` data for apple, banana, and ball targets with their exact approved shadow mapping and the requested two distractors per challenge.
- Stage 6: shuffles each three-shadow option order at new-game reset while preventing consecutive challenges from sharing the same correct slot; answer evaluation always uses the stable shadow ID, never screen position.
- Stage 6: added a reusable `shadow-matching` TaskCard composition with one unchanged colour source asset, three fully interactive silhouette cards, at least 56×56 px effective targets, persistent selection, selection changes before check, and disabled empty checking.
- Stage 6: hints pulse the colour target and then the correct shadow card temporarily without selecting, revealing, or advancing it; challenge transitions reset selection, result, hint, and rendered options through serializable state plus normal scene rendering.
- Stage 6: Challenges 1 and 2 leave repair progress at `✓ ✓ ✓ ○ ○`; Challenge 3 completes Task 4 once, plays the existing repair reward choreography/audio once, and renders `✓ ✓ ✓ ✓ ○`.
- Stage 6: restored the existing `Дальше` handoff after final Task 3 correctness so the ordinary player route visibly reaches `ЗАДАНИЕ 4 ИЗ 5`.
- Stage 7: added a serializable `MemoryMechanic` with eight unique card IDs, four stable pair IDs, explicit `FACE_DOWN` / `FACE_UP` / `MATCHED` state, first/second selection, comparison lockout, idempotent resolution, and reset-time shuffling that rejects trivial horizontal adjacent pairs.
- Stage 7: added a dedicated responsive `MemoryTaskCard` so Tasks 1–4 retain their proven generic four-choice renderer; phones/desktop use a 4×2 grid and large portrait tablets use 2×4, with full-rectangle pointer targets at least 56×44 px.
- Stage 7: reuses only `memory-cover`, `odd-apple`, `odd-banana`, `sequence-star`, and `size-battery`; no production art or audio was created, copied, renamed, or modified.
- Stage 7: hints briefly reveal two unmatched cards or the selected card's partner without changing mechanic state; accepted card taps, correct/wrong/hint cues, comparison timing, reduced-motion flips, matched-card disabling, and third-tap lockout use existing input/audio/reaction boundaries.
- Stage 7: the fourth pair alone advances overall repair from `✓ ✓ ✓ ✓ ○` to `✓ ✓ ✓ ✓ ✓`, plays one correct cue and one final repair reward, shows `Я СНОВА РАБОТАЮ!`, preserves the completed board for a readable success moment, then enters the production completion screen.
- Stage 7: replaced the unused temporary Victory presentation with `РОБОТ ПОЧИНЕН!`, `ТЫ ВЫПОЛНИЛ ВСЕ ЗАДАНИЯ`, `Играть ещё`, and `На главную`; both exits reset session and all mechanic-local state without a browser reload or duplicate music loop.
- Stage 7.0A: replaced VictoryScene's arbitrary bottom Y with a measured robot-feet visual origin (`source y = 1423`) attached to the laboratory platform's upper-plane contact point (`source x/y = 836/700`).
- Stage 7.0A: derives the shared platform/feet point from the scaled background composition, with a centralized control-clearance constraint for the minimum portrait layout; no exact-device checks, gameplay state, assets, controls, or robot scale rules changed.
- Stage 7.0A: removed vertical displacement from the existing completion pulse so its feet anchor remains planted throughout the animation; the subtle scale pulse remains anchored at the soles.

## ASSET STATUS

### FOUND AND LOADED (32 FILES / 33 RUNTIME IDS)

- Laboratory background (1 file / 2 runtime IDs): `laboratory-background.png` (`bg-start-laboratory`, `bg-main-laboratory`)
- Robot complete (1): `robot-complete_v01.png` (runtime ID `robot-complete`)
- Robot parts (7): `robot-head.png`, `robot-body.png`, `robot-arm-left.png`, `robot-arm-right.png`, `robot-leg-left.png`, `robot-leg-right.png`, `robot-antenna.png`
- Odd-one-out objects (4): `apple.png`, `ball.png`, `banana.png`, `carrot.png`
- Sequence objects (4): `sequence-gear.png`, `sequence-lightning.png`, `sequence-planet.png`, `sequence-star.png`
- Size comparison (1): `size-battery.png`
- Shadows (4): `shadow-apple.png`, `shadow-ball.png`, `shadow-banana.png`, `shadow-carrot.png`
- Memory (1): `memory-cover.png`
- Repair items (3): `bolt.png`, `circuit-board.png`, `gear.png`
- Audio (6): `start-theme.wav`, `ui-click.wav`, `answer-correct.wav`, `answer-wrong.wav`, `hint.wav`, `repair-reward.wav`

### MISSING_ASSET

- None.

Stage 1.2 filesystem re-audit confirmed `public/assets/backgrounds/laboratory-background.png`. Both background runtime IDs map directly to that one approved file. The existing `robot-complete` mapping to `assets/characters/robot/robot-complete_v01.png` remains unchanged.

`public/assets/characters/robot/parts/robot-arm-wave-left.png` remains on disk but is intentionally inactive: it has no runtime manifest ID and is not instantiated by `RobotActor`.

## BUILD STATUS

PASS

- Stage 7.1B.2 `npm run build` — PASS; TypeScript validation passed, 43 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 7.1B.1 `npm run build` — PASS; TypeScript validation passed, 43 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 7.1B `npm run build` — PASS; TypeScript validation passed, 43 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- `npm run build` — PASS; TypeScript validation passed, 29 modules transformed, and `dist/` generated.
- Vite reported a non-blocking bundle-size advisory for the Phaser bundle; no build errors or missing modules.
- Stage 3.4 `npm run build` — PASS; 32 modules transformed and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 3.4 production preview at `http://127.0.0.1:4184/` — PASS.
- Stage 4 `npm run build` — PASS; TypeScript validation passed, 33 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 4 production preview at `http://127.0.0.1:4186/` — PASS.
- Stage 5 `npm run build` — PASS; TypeScript validation passed, 34 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 5 production preview at `http://127.0.0.1:4188/` — PASS and left open in the in-app browser for manual review.
- Stage 5.2 `npm run build` — PASS; TypeScript validation passed, 37 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 5.2 production preview at `http://127.0.0.1:4190/` — PASS.
- Stage 5.2A `npm run build` — PASS; TypeScript validation passed, 37 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 5.2A production preview at `http://127.0.0.1:4191/` — PASS.
- Stage 5.2B `npm run build` — PASS; TypeScript validation passed, 37 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 5.2B production preview at `http://127.0.0.1:4192/` — PASS.
- Stage 5.1B `npm run build` — PASS; TypeScript validation passed, 37 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 5.1B development preview at `http://127.0.0.1:4207/` — PASS.
- Stage 5.1E `npm run build` — PASS; TypeScript validation passed, 37 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 5.1E production preview at `http://127.0.0.1:4210/` — PASS.
- Stage 5.1F `npm run build` — PASS; TypeScript validation passed, 37 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 5.1F production preview at `http://127.0.0.1:4210/` — PASS.
- Stage 5.1H `npm run build` — PASS; TypeScript validation passed, 37 modules transformed, and `dist/` generated. The existing non-blocking Phaser bundle-size advisory remains.
- Stage 5.1H production preview at `http://127.0.0.1:4213/` — PASS.
- Stage 5.3 `npm run build` — PASS; TypeScript validation passed, 38 modules transformed, six WAV files copied into the self-contained production output, and the existing non-blocking Phaser bundle-size advisory remains.
- Stage 5.3 production preview at `http://127.0.0.1:4193/` — PASS.
- Stage 6 `npm run build` — PASS; TypeScript validation passed, 39 modules transformed, all approved object/shadow/audio assets were included, and only the existing non-blocking Phaser bundle-size advisory remains.
- Stage 6 production preview at `http://127.0.0.1:4196/` — PASS.
- Stage 7 `npm run build` — PASS; TypeScript validation passed, 41 modules transformed, all approved memory/object/audio assets were included, and only the existing non-blocking Phaser bundle-size advisory remains.
- Stage 7 production preview at `http://127.0.0.1:4197/` — PASS.
- Stage 7.0A `npm run build` — PASS; TypeScript validation passed, 41 modules transformed, and only the existing non-blocking Phaser bundle-size advisory remains.
- Stage 7.0A production preview at `http://127.0.0.1:4198/` — PASS.
- `npm run preview -- --host 127.0.0.1 --port 4174` — PASS; Vite selected the available local preview at `127.0.0.1:4177` for final Stage 3.1 verification.
- `npm run preview -- --host 127.0.0.1 --port 4180` — PASS; Stage 3.3 was verified from the generated production build.

## PLAYTEST STATUS

PASS

- Production preview desktop 1280×720 mouse Start → Game: PASS.
- Production preview tablet 768×1024 touch Start → Game: PASS.
- Production preview mobile 390×844 touch Start → Game: PASS.
- Production preview minimum 320×568 touch Start → Game: PASS.
- Stage 2.1 initial state: exactly one `0 / 5` progress label and exactly one `ЗАДАНИЕ 1/5` task-card label at every viewport: PASS.
- Five inactive/gray progress indicators and no first checkmark before completion: PASS by screenshot review at every viewport.
- Redundant desktop purple task label: absent.
- Redundant portrait top progress counter: absent.
- Canvas size equals viewport size and document scroll dimensions at all four targets; no horizontal scroll: PASS.
- Background crop, task-card readability, progress readability, robot/platform alignment, and non-overlap: PASS by screenshot review.
- Control hit areas: 76×52 px home/sound; 112×44 px compact hint; task choices at least 102×44 px at portrait targets.
- Console errors, page errors, failed asset requests, and `MISSING_ASSET` warnings: none.
- Stage 2.1 evidence: `docs/qa/screenshots/stage2-1-game-{desktop,tablet,mobile,minimum}.png`.
- Stage 3.2 production-preview assertion run: PASS at 1280×720, 768×1024, 390×844, and 320×568.
- Stage 3.2 states at every viewport: initial 0/5, object selected, wrong answer, hint shown, correct answer 1/5, and next button visible — PASS.
- Earlier Stage 3.2 invariant checks established the canonical desktop base. The final integrated run additionally verifies responsive contact targets and portrait card/robot separation after bounded scaling.
- Stage 3.2 screenshot review: feet remain on the circular platform upper surface without floating, sinking, or moving in response to task/progress/feedback changes — PASS.
- Stage 3.2 console errors, page errors, and failed requests: none at all four viewports.
- Stage 3.2 evidence: `docs/qa/screenshots/stage3-2-{desktop,tablet,mobile,minimum}-{initial,selected,wrong,hint,correct,next-visible}.png`.
- Stage 3.1 production-preview playtest: PASS at 1280×720 mouse and 768×1024, 390×844, and 320×568 touch emulation.
- Stage 3.1 verified: immediate press/release; hint; select/change selection; wrong retry; correct 1/5; rapid-check transition guard; Играть, Домой, Звук; no stuck state; and no double completion.
- Stage 3.1 practical Odd One Out targets: 144×116.5 px desktop, 140×80 px tablet/mobile, and 135×64 px minimum viewport.
- Responsive platform-contact targets: 560.0 px desktop, 798.7 px tablet, 658.3 px mobile, and 534.0 px minimum; portrait task-card overlap: none.
- Stage 3.1 console/page errors: 0 across all four viewports.
- Stage 3.1 evidence: `docs/qa/screenshots/stage3-1-game-{desktop,tablet,mobile,minimum}.png`.
- Stage 3.3 production-preview playtest: PASS at 1280×720 mouse and 768×1024, 390×844, and 320×568 touch emulation.
- Stage 3.3 retry sequence banana → apple → carrot → ball: wrong selections cleared, Проверить reset/re-enabled, progress stayed 0/5 through all wrong attempts, and the ball completed normally at 1/5 — PASS at all four viewports.
- Stage 3.3 dialogue: immediate display, phrase rotation, dismissal on new selection, 2-second auto-dismiss, task-card non-overlap, mobile readability, and no robot-face obstruction in final screenshot review — PASS.
- Stage 3.3 robot reaction: gentle tilt and exact x/y/scale/angle baseline restoration — PASS at all four viewports.
- Stage 3.3 hint after wrong and Home → new game reset: PASS.
- Stage 3.3 console errors, page errors, and failed requests: none at all four viewports.
- Stage 3.3 evidence: `docs/qa/screenshots/stage3-3-{wrong,correct}-{desktop,tablet,mobile,minimum}.png`.
- Stage 3.4 fixed matrix: PASS at 320×568, 333×885, 360×800, 390×844, 400×824, 412×915, 600×960, 768×1024, 820×1180, 912×1368, 1024×1366, 568×320, 844×390, 915×412, 1280×720, 1366×768, and 1920×1080.
- Stage 3.4 interpolation matrix: PASS at widths 340, 375, 430, 540, 700, 860, and 1100 with no discontinuities outside the four mode transitions.
- Stage 3.4 assertions: exact logical grounding, card/robot portrait separation, full-viewport canvas/no scroll, minimum 44×44 targets, dialogue bounds/progress clearance, and mode selection — PASS at all 24 checkpoints.
- Stage 3.4 representative touch/mouse regression at 320×568, 390×844, 768×1024, 568×320, and 1280×720: hint, select, wrong retry/dialogue, correct 0/5→1/5, rendered 5/5, sound, Home, and Дальше — PASS.
- Stage 3.4 console errors, page errors, and failed requests: none across all 24 checkpoints.
- Stage 3.4 evidence: `docs/qa/stage3-4-results.json` and `docs/qa/screenshots/stage3-4-*.png`.
- Stage 4 required matrix: PASS at 320×568, 333×885, 360×800, 390×844, 412×915, 768×1024, 820×1180, 1024×1366, 568×320, 844×390, 915×412, 1280×720, 1366×768, and 1920×1080.
- Stage 4 challenge flow: challenge 1 wrong recovery, hint, and correct transition; challenge 2 two wrong attempts then correct; challenge 3 correct and overall 2/5 completion — PASS.
- Stage 4 live resize with a selected answer, Home/new-game reset, 44 px minimum answer targets, full-viewport/no-scroll, exact logical robot grounding, and zero console/page/request failures — PASS.
- Stage 4 screenshot review: minimum mobile, tablet, short landscape, desktop, and completed states preserve pattern readability, missing-slot clarity, separate option row, progress separation, robot clearance, and production asset integrity — PASS.
- Stage 4 evidence: `docs/qa/stage4-sequence-results.json` and `docs/qa/screenshots/stage4-*.png`.
- Stage 5 required matrix: PASS at 320×568, 333×885, 360×800, 390×844, 412×915, 768×1024, 820×1180, 1024×1366, 568×320, 844×390, 915×412, 1280×720, 1366×768, and 1920×1080.
- Stage 5 flow: challenge 1 wrong → cleared selection → hint → large correct; challenge 2 small correct; challenge 3 medium correct → overall 3/5 — PASS.
- Stage 5 visual invariants: all three choices use `size-battery`, rendered height ratios match `0.70/1.00/1.30`, bottoms share one baseline, all images remain inside the TaskCard, and all targets are at least 64×44 px — PASS at all 14 viewports.
- Stage 5 shuffle uses persistent randomized orders and correct-answer slots differ across the three challenges; live resize preserves selected ID and exact order — PASS.
- Stage 5 robot dialogue, positive/wrong reactions, exact logical grounding `(640, 560)`, origin `(0.5, 1)`, scale `0.2520718`, full-viewport canvas, no page scroll, and zero console/page/request failures — PASS.
- Stage 5 representative screenshot review at minimum mobile, tablet, short landscape, desktop, and completed flow found no clipping, overlap, grounding, baseline, or readability regressions.
- Stage 5 evidence: `docs/qa/stage5-size-comparison-results.json` and `docs/qa/screenshots/stage5-*.png`.
- Stage 5.2 pre-fix reproduction: the normal Start-origin run timed out before Compare by Size because QA attempted final-Sequence Next after 250 ms while the button was configured to remain hidden for 2350 ms.
- Stage 5.2 full Start-origin playthrough: PASS at 390×844 touch, 768×1024 touch, and 1280×720 mouse.
- Stage 5.2 state trace: new game `currentTask=1/completedTasks=0/score=0`; Odd completion `2/1/1`; final Sequence completion `3/2/2`; final Size completion `4/3/3`; Home → Играть reset `1/0/0` — PASS at all three viewports.
- Stage 5.2 internal/overall separation: Sequence `1/3 → 2/3 → 3/3` keeps overall `1/5` until final correctness, then renders `2/5`; Size `1/3 → 2/3 → 3/3` keeps overall `2/5` until final correctness, then renders `3/5` — PASS.
- Stage 5.2 task transition: final Sequence `Дальше` loads `ЗАДАНИЕ 3/5`, `СРАВНИ ПО РАЗМЕРУ`, and three `size-battery` choices — PASS.
- Stage 5.2 screenshot review found readable mobile/desktop cards, visible `2 / 5`, correct battery content, unchanged modular robot grounding, and clear controls.
- Stage 5.2 console errors, page errors, and failed requests: none across all three complete playthroughs.
- Stage 5.2 evidence: `docs/qa/stage5-2-main-flow-results.json` and `docs/qa/screenshots/stage5-2-*.png`.
- Stage 5.2A exact Start-origin visible flow: PASS at 390×844 touch, 768×1024 touch, and 1280×720 mouse.
- Stage 5.2A post-Next render checks: one TaskCard, no `ПРОДОЛЖИ РЯД`, `currentTask=3`, `completedTasks=2`, no remaining reward object, and three visible `size-battery` images with alpha/scale above zero and bounds inside the viewport — PASS at all three targets.
- Stage 5.2A human screenshot review: final Sequence completion and `Дальше` are clear; after the click the Task 3 ribbon/title and all three differently sized battery instances are visibly present without clipping or background occlusion — PASS.
- Stage 5.2A console errors, page errors, and failed requests: none across all three complete playthroughs.
- Stage 5.2A evidence: `docs/qa/stage5-2a-manual-visibility-results.json` and `docs/qa/screenshots/stage5-2a-*.png`.
- Stage 5.2B exact semantics flow: PASS at 390×844 touch, 768×1024 touch, and 1280×720 mouse.
- Stage 5.2B repair state trace: initial `○ ○ ○ ○ ○`; after Task 1 `✓ ○ ○ ○ ○`; final Sequence 3/3 wrong `✓ ○ ○ ○ ○`; final Sequence 3/3 correct `✓ ✓ ○ ○ ○`; Task 3 battery screen `✓ ✓ ○ ○ ○` — PASS at all three targets.
- Stage 5.2B labels: `ЗАДАНИЕ N ИЗ 5`, internal `РЯД N ИЗ 3` / `СРАВНЕНИЕ N ИЗ 3`, and `РЕМОНТ` — PASS; numeric repair progress is absent at every captured state.
- Stage 5.2B screenshot review found no title/indicator overlap, clipping, playfield obstruction, or mobile/tablet/desktop readability regression.
- Stage 5.2B main-flow regression and Stage 5.2A battery-visibility regression: PASS at all three required viewports.
- Stage 5.2B console errors, page errors, and failed requests: none.
- Stage 5.2B evidence: `docs/qa/stage5-2b-progress-semantics-results.json` and `docs/qa/screenshots/stage5-2b-*.png`.
- Stage 5.1B focused actor checks: screen-left `robot-armRight` / `robot-part-arm-right`, 122° captured base, idle/correct/hint/wrong states, exact seven-part restoration, canonical `(640, 560)` grounding, scale `0.2520718`, and zero console/page/request errors — PASS at 390×844, 768×1024, and 1280×720.
- Stage 5.1B screenshot review: friendly open-hand silhouette, soft elbow, upward-diagonal forearm, natural shoulder attachment, body clearance, and viewport clipping — PASS in all four states at all three required viewports.
- Stage 5.1B current Stage 5.2B real Start-origin gameplay regression — PASS at all three required viewports. The older Stage 5.1 harness reaches gameplay but its obsolete numeric `1 / 5` wait is incompatible with the intentional Stage 5.2B removal of numeric progress.
- Stage 5.1B evidence: `docs/qa/stage5-1b-friendly-arm-results.json` and `docs/qa/screenshots/stage5-1b-*.png`.
- Stage 5.1E exact mapping, no-wave-runtime, immutable arm-transform, reaction, grounding, viewport-containment, and error checks — PASS at 1280×720, 390×844, and 768×1024.
- Stage 5.1E screenshot review: both arms are visible, correctly attached below the head, outside the face and torso, and form a clean balanced silhouette at all three required viewports.
- Stage 5.1E evidence: `docs/qa/stage5-1e-emergency-arm-reset-results.json` and `docs/qa/screenshots/stage5-1e-*-idle.png`.
- Stage 5.1F canonical transform, deliberately corrupted-pose recovery, all-state reset, no-raised-runtime, viewport-containment, grounding, and error checks — PASS at 390×844, 768×1024, and 1280×720.
- Stage 5.1F screenshot review: both shoulder modules seat naturally in the upper body sockets, forearms hang outside the torso, hands end at lower-torso level, and the mirrored silhouette remains balanced without overlap or clipping.
- Stage 5.1F evidence: `docs/qa/stage5-1f-lowered-arm-placement-results.json` and `docs/qa/screenshots/stage5-1f-*-resting.png`.
- Stage 5.1H body-local socket/root coordinate, approved-texture, connector-origin, matching-height, temporary-marker, and error checks — PASS at 390×844, 768×1024, and 1280×720.
- Stage 5.1H screenshot review: both arms visibly emerge from the round body sockets; no empty socket remains below either arm and neither arm grows from an upper torso corner.
- Stage 5.1H evidence: `docs/qa/stage5-1h-shoulder-socket-alignment-results.json`, `docs/qa/screenshots/stage5-1h-*.png`, and `docs/qa/screenshots/stage5-1h-desktop-1280x720-torso-shoulders-close-up.png`.
- Stage 5.3 audio assertions: exact WAV format/duration, decoded cache entries, no pre-gesture playback, gesture unlock, one click per tap, three mechanic-specific hint/wrong paths, seven correct paths, exactly three major repair cues, immediate wrong retry, Start music, Home/resize loop uniqueness, mute, reload persistence, unmute resume, and zero errors — PASS.
- Stage 5.3 full gameplay regression: Start through all three implemented mechanics, Home, and restart — PASS at 390×844, 768×1024, and 1280×720 with no console/page/request failures.
- Stage 5.3 screenshot review: desktop Start, desktop completed Task 3, mobile live-resized Start, mobile unmuted Start, and the three-viewport full-flow evidence retain readable controls, unobstructed playfields, and correct responsive composition.
- Stage 5.3 evidence: `docs/qa/stage5-3-audio-results.json`, `docs/qa/screenshots/stage5-3-*.png`, refreshed `docs/qa/stage5-2-main-flow-results.json`, and refreshed `docs/qa/screenshots/stage5-2-*.png`.
- Stage 6 full Start-origin flow: Start → Odd One Out → three Sequence challenges → three Size challenges → `ЗАДАНИЕ 4 ИЗ 5` / `НАЙДИ ТЕНЬ` with three shadow options — PASS.
- Stage 6 challenge coverage: wrong, transient target→shadow hint, and correct for apple, banana, and ball; change-selection, empty check, rapid repeated selection/check, and no double progress/reward — PASS.
- Stage 6 state trace: Task 4 initial and Challenges 1–2 correct remain `✓ ✓ ✓ ○ ○`; final Challenge 3 correct becomes `✓ ✓ ✓ ✓ ○` exactly once — PASS.
- Stage 6 audio: three `answer-wrong`, three `hint`, three `answer-correct`, and one `repair-reward` event while unmuted; muted hint is suppressed by `AudioManager`; no duplicate audio — PASS.
- Stage 6 responsive/visual review: 390×844, 768×1024, 1280×720, and 320×568 all show the target, three complete silhouettes, task/internal labels, accessible buttons, grounded robot, safe edges, and no clipping or overlap — PASS.
- Stage 6 live resize preserves selected ID/order; Home → Играть resets session and all shadow state to Task 1; console errors, page errors, failed requests, and non-OK responses are zero — PASS.
- Stage 6 evidence: `docs/qa/stage6-shadow-matching-results.json` and `docs/qa/screenshots/stage6-shadow-*.png`.
- Stage 7 full Start-origin flow: Start → Odd One Out → Sequence → Size Comparison → Shadow Matching → Memory → 5/5 repair → completion screen — PASS.
- Stage 7 input/state coverage: first card, same-card double tap, matching pair, mismatch reveal/reset, third-card attempt during lock, rapid input, matched-card tap, last pair, and no duplicate progress/completion — PASS.
- Stage 7 hint coverage: no-selection hint temporarily reveals two unmatched cards; selected-card hint temporarily reveals its partner; both restore normal state without matching or progress, and muted hint emits no sound — PASS.
- Stage 7 state/audio trace: `ПАРЫ 0 ИЗ 4` through `ПАРЫ 4 ИЗ 4`; four `answer-correct`, one exercised `answer-wrong`, two audible `hint`, and one final `repair-reward`, with exact overall repair `4/5 → 5/5` — PASS.
- Stage 7 responsive/visual review: 390×844, 768×1024, 1280×720, and 320×568 keep all eight cards, controls, progress, robot, and final completion controls visible and non-overlapping; tablet uses 2×4 while the other required targets use 4×2 — PASS.
- Stage 7 randomization produced four distinct layouts across four starts with no trivial horizontal adjacent pair; live resize preserves selected/matched state; Play Again and final-screen Home reset the full session to Task 1 — PASS.
- Stage 7 console errors, page errors, failed requests, and non-OK responses: zero.
- Stage 7 evidence: `docs/qa/stage7-memory-results.json` and `docs/qa/screenshots/stage7-*.png`.
- Stage 7.0A exact background-platform and robot-feet contacts coincide with zero delta at every required viewport: `(160, 408)` at 320×568, `(195, 627.843)` at 390×844, `(384, 761.743)` at 768×1024, `(640, 535.694)` at 1280×720, and `(719, 679.915)` at 1438×914 — PASS.
- Stage 7.0A visual review: both soles rest on the upper platform surface, front-rim overlap is absent, the robot remains centered, buttons do not overlap, and both title lines remain readable at all five viewports — PASS.
- Stage 7.0A temporary QA markers for the platform contact and feet contact were rendered at the same coordinate, captured, and destroyed before the clean production screenshots; no debug marker exists in production code.
- Stage 7.0A existing complete Stage 7 flow regression — PASS at 390×844, 768×1024, 1280×720, and 320×568; all Memory, final repair, completion, Play Again, Home, audio, and error checks remain green.
- Stage 7.0A console errors, page errors, failed requests, and non-OK responses: zero across the focused five-viewport run and the existing full-flow regression.
- Stage 7.0A evidence: `docs/qa/stage7-0a-victory-grounding-results.json` and `docs/qa/screenshots/stage7-0a-victory-*.png`.

## FILES CREATED

- `docs/decisions/0003-assembly-station-release.md`
- `docs/qa/stage7-1b2-assembly-release-results.json`
- `docs/qa/screenshots/stage7-1b2-{desktop-1280x720,mobile-390x844}-assembly-{0,1,2,3,4}-of-5.png`
- `docs/qa/screenshots/stage7-1b2-{desktop-1280x720,mobile-390x844}-activation-5-of-5.png`
- `docs/qa/screenshots/stage7-1b2-{desktop-1280x720,mobile-390x844}-final-released.png`
- `docs/qa/screenshots/stage7-1b2-{desktop-1280x720,mobile-390x844}-victory-two-robots.png`

- `qa/stage7-1b1-crosshair-playtest.cjs`
- `docs/qa/stage7-1b1-crosshair-results.json`
- `docs/qa/screenshots/stage7-1b1-{mobile-390x844,tablet-768x1024,desktop-1280x720}-{compact,full}-{0,5}-of-5.png`

- `src/game/state/robotAssemblyState.ts`
- `src/game/ui/RobotAssemblyPreview.ts`
- `src/game/scenes/RobotAssemblyPreviewScene.ts`
- `docs/decisions/0002-robot-assembly-progression.md`
- `qa/stage7-1a-assembly-preview-playtest.cjs`
- `qa/stage7-1b-assembly-integration-playtest.cjs`
- `qa/stage7-1b-home-interrupt-playtest.cjs`
- `docs/qa/stage7-1a-assembly-preview-results.json`
- `docs/qa/stage7-1b-assembly-integration-results.json`
- `docs/qa/screenshots/stage7-1a-state-{0,1,2,3,4,5}-of-5-desktop-1280x720.png`
- `docs/qa/screenshots/stage7-1a-state-5-of-5-{mobile-390x844,tablet-768x1024}.png`
- `docs/qa/screenshots/stage7-1b-desktop-1280x720-assembly-{0,1,2,3,4,5}-of-5.png`
- `docs/qa/screenshots/stage7-1b-{desktop-1280x720,mobile-390x844}-victory-two-robots.png`
- `docs/qa/screenshots/stage7-1b-mobile-390x844-assembly-5-of-5.png`

- `qa/stage7-0a-victory-grounding-playtest.cjs`
- `docs/qa/stage7-0a-victory-grounding-results.json`
- `docs/qa/screenshots/stage7-0a-victory-{minimum-320x568,mobile-390x844,tablet-768x1024,desktop-1280x720,desktop-wide-1438x914}.png`
- `docs/qa/screenshots/stage7-0a-victory-desktop-contact-debug.png`
- `docs/qa/screenshots/stage7-0a-victory-desktop-feet-close-up.png`

- `src/game/mechanics/memory.ts`
- `src/game/ui/MemoryTaskCard.ts`
- `qa/stage7-memory-playtest.cjs`
- `docs/qa/stage7-memory-results.json`
- `docs/qa/screenshots/stage7-memory-mobile-390x844.png`
- `docs/qa/screenshots/stage7-memory-tablet-768x1024.png`
- `docs/qa/screenshots/stage7-memory-desktop-1280x720.png`
- `docs/qa/screenshots/stage7-memory-minimum-320x568.png`
- `docs/qa/screenshots/stage7-memory-final-pair-4-of-4.png`
- `docs/qa/screenshots/stage7-final-completion-1280x720.png`

- `src/game/mechanics/shadowMatching.ts`
- `qa/stage6-shadow-matching-playtest.cjs`
- `docs/qa/stage6-shadow-matching-results.json`
- `docs/qa/screenshots/stage6-shadow-mobile-390x844.png`
- `docs/qa/screenshots/stage6-shadow-tablet-768x1024.png`
- `docs/qa/screenshots/stage6-shadow-desktop-1280x720.png`
- `docs/qa/screenshots/stage6-shadow-minimum-320x568.png`
- `docs/qa/screenshots/stage6-shadow-complete-1280x720.png`

- `public/assets/audio/music/start-theme.wav`
- `public/assets/audio/sfx/ui-click.wav`
- `public/assets/audio/sfx/answer-correct.wav`
- `public/assets/audio/sfx/answer-wrong.wav`
- `public/assets/audio/sfx/hint.wav`
- `public/assets/audio/sfx/repair-reward.wav`
- `src/game/audio/AudioManager.ts`
- `tools/generate-audio.mjs`
- `qa/stage5-3-audio-playtest.cjs`
- `docs/qa/stage5-3-audio-results.json`
- `docs/qa/screenshots/stage5-3-desktop-start-before-gesture.png`
- `docs/qa/screenshots/stage5-3-desktop-game-audio-complete.png`
- `docs/qa/screenshots/stage5-3-mobile-start-after-resize.png`
- `docs/qa/screenshots/stage5-3-mobile-start-unmuted.png`

- `package-lock.json`
- `src/style.css`
- `src/game/config.ts`
- `src/game/assets/manifest.ts`
- `src/game/state/sessionState.ts`
- `src/game/ui/sceneUi.ts`
- `src/game/scenes/BootScene.ts`
- `src/game/scenes/PreloadScene.ts`
- `src/game/scenes/StartScene.ts`
- `src/game/scenes/IntroScene.ts`
- `src/game/scenes/GameScene.ts`
- `src/game/scenes/TransitionScene.ts`
- `src/game/scenes/VictoryScene.ts`
- `src/game/scenes/ResultsScene.ts`
- `docs/qa/screenshots/stage1-start-desktop.png`
- `docs/qa/screenshots/stage1-game-desktop.png`
- `docs/qa/screenshots/stage1-game-tablet.png`
- `docs/qa/screenshots/stage1-game-mobile.png`
- `docs/qa/screenshots/stage1-game-minimum.png`
- `src/game/state/preferencesState.ts`
- `src/game/ui/controls.ts`
- `src/game/ui/ProgressPanel.ts`
- `src/game/ui/sceneLayout.ts`
- `src/game/ui/TaskCard.ts`
- `src/game/ui/visualTheme.ts`
- `docs/qa/screenshots/stage2-start-desktop.png`
- `docs/qa/screenshots/stage2-start-tablet.png`
- `docs/qa/screenshots/stage2-start-mobile.png`
- `docs/qa/screenshots/stage2-start-minimum.png`
- `docs/qa/screenshots/stage2-game-desktop.png`
- `docs/qa/screenshots/stage2-game-tablet.png`
- `docs/qa/screenshots/stage2-game-mobile.png`
- `docs/qa/screenshots/stage2-game-minimum.png`
- `docs/qa/screenshots/stage2-1-game-desktop.png`
- `docs/qa/screenshots/stage2-1-game-tablet.png`
- `docs/qa/screenshots/stage2-1-game-mobile.png`
- `docs/qa/screenshots/stage2-1-game-minimum.png`
- `qa/screenshots/stage1-2-start-desktop.png`
- `qa/screenshots/stage1-2-game-desktop.png`
- `qa/screenshots/stage1-3-game-desktop.png`
- `qa/screenshots/stage1-3-game-tablet.png`
- `qa/screenshots/stage1-3-game-mobile.png`
- `src/game/ui/robotGrounding.ts`
- `qa/stage3-2-playtest.cjs`
- `docs/qa/screenshots/stage3-2-{desktop,tablet,mobile,minimum}-{initial,selected,wrong,hint,correct,next-visible}.png` (24 files)
- `qa/stage3-1-playtest.cjs`
- `docs/qa/screenshots/stage3-1-game-desktop.png`
- `docs/qa/screenshots/stage3-1-game-tablet.png`
- `docs/qa/screenshots/stage3-1-game-mobile.png`
- `docs/qa/screenshots/stage3-1-game-minimum.png`
- `docs/qa/screenshots/debug-minimum.png` (diagnostic evidence; not a production asset)
- `src/game/ui/RobotDialogue.ts`
- `qa/stage3-3-playtest.cjs`
- `docs/qa/screenshots/stage3-3-{wrong,correct}-{desktop,tablet,mobile,minimum}.png` (8 files)
- `src/game/ui/fluidSizing.ts`
- `src/game/ui/responsiveLayout.ts`
- `src/game/ui/responsiveCamera.ts`
- `qa/stage3-4-responsive-playtest.cjs`
- `docs/qa/stage3-4-results.json`
- `docs/qa/screenshots/stage3-4-*.png` (36 files: 24 checkpoint screens, wrong/correct screens at 5 regression viewports, and 2 Start screens)
- `docs/decisions/0001-responsive-layout.md`
- `src/game/mechanics/sequence.ts`
- `qa/stage4-sequence-playtest.cjs`
- `docs/qa/stage4-sequence-results.json`
- `docs/qa/screenshots/stage4-*.png` (16 files: 14 required viewport screens and 2 completed-flow screens)
- `src/game/mechanics/sizeComparison.ts`
- `qa/stage5-size-comparison-playtest.cjs`
- `docs/qa/stage5-size-comparison-results.json`
- `docs/qa/screenshots/stage5-*.png` (16 files: 14 required viewport screens and 2 completed-flow screens)
- `src/game/state/repairProgression.ts`
- `src/game/ui/RobotActor.ts`
- `src/game/ui/RepairReward.ts`
- `qa/stage5-1-robot-animation-playtest.cjs`
- `qa/stage5-1a-start-recovery-playtest.cjs`
- `qa/stage5-2-main-flow-playtest.cjs`
- `docs/qa/stage5-2-main-flow-results.json`
- `docs/qa/screenshots/stage5-2-{mobile-390x844,tablet-768x1024,desktop-1280x720}-{sequence-complete,size-loaded}.png`
- `qa/stage5-2a-manual-visibility-playtest.cjs`
- `qa/stage5-1b-friendly-arm-playtest.cjs`
- `docs/qa/stage5-1b-friendly-arm-results.json`
- `docs/qa/screenshots/stage5-1b-{mobile-390x844,tablet-768x1024,desktop-1280x720}-{idle,correct,hint,wrong}.png` (12 files)
- `docs/qa/stage5-2a-manual-visibility-results.json`
- `docs/qa/screenshots/stage5-2a-{after-sequence-complete,after-next-click,battery-task-visible}.png`
- `docs/qa/screenshots/stage5-2a-{tablet,desktop}-{after-sequence-complete,after-next-click,battery-task-visible}.png`
- `qa/stage5-2b-progress-semantics-playtest.cjs`
- `docs/qa/stage5-2b-progress-semantics-results.json`
- `docs/qa/screenshots/stage5-2b-{mobile-390x844,tablet-768x1024,desktop-1280x720}-{after-task1,sequence3-wrong,after-task2,battery-task}.png`
- `qa/stage5-1e-emergency-arm-reset-playtest.cjs`
- `docs/qa/stage5-1e-emergency-arm-reset-results.json`
- `docs/qa/screenshots/stage5-1e-{desktop-1280x720,mobile-390x844,tablet-768x1024}-idle.png`
- `qa/stage5-1f-lowered-arm-placement-playtest.cjs`
- `docs/qa/stage5-1f-lowered-arm-placement-results.json`
- `docs/qa/screenshots/stage5-1f-{desktop-1280x720,mobile-390x844,tablet-768x1024}-resting.png`
- `docs/qa/screenshots/stage5-1f-candidate-{a,b,c}.png` (development-only placement comparison evidence)

Generated build output under `dist/` is ignored project output and is not a source deliverable.

## FILES CHANGED

- `src/game/ui/responsiveLayout.ts` — replaces the tube/strip dimensions with centralized wide station compositions and portrait ribbon clearance.
- `src/game/ui/responsiveCamera.ts` — slightly reduces the ultra-narrow world scale so the expanded station/task stack and helper remain separated at 320 px.
- `src/game/ui/ProgressPanel.ts` — redesigns the station card, dedicated assembly fit, faint blueprint, labels, install focus, and release fade.
- `src/game/ui/RobotAssemblyPreview.ts` — applies the colder, lower-alpha blueprint treatment.
- `src/game/scenes/GameScene.ts` — coordinates the final station exit and grounded two-robot gameplay presentation before VictoryScene.
- `src/game/scenes/RobotAssemblyPreviewScene.ts` — updates the visual proof station to the same wider, less cage-like composition.
- `qa/stage7-1b-assembly-integration-playtest.cjs` — adds release/no-frame/grounding assertions and the complete Stage 7.1B.2 screenshot set.
- `docs/qa/stage7-1b-assembly-integration-results.json` and existing `docs/qa/screenshots/stage7-1b-*` evidence — refreshed by the backward-compatible full-flow QA run while the new review set is stored separately under `stage7-1b2-*`.
- `ROBOTLAB-PROJECT-STATUS.md` — records Stage 7.1B.2 implementation, verification, evidence, and manual-review readiness.

- `src/game/ui/ProgressPanel.ts` — removes the compact station's two diagonal crosshair draws.
- `src/game/scenes/RobotAssemblyPreviewScene.ts` — makes the existing dark-blue full-station interior opaque so background diagonals cannot show through.
- `ROBOTLAB-PROJECT-STATUS.md` — records Stage 7.1B.1 scope, QA, build, and evidence.

- `src/game/config.ts` — registers the dev/QA-only assembly proof scene without adding a production-flow route.
- `src/game/state/sessionState.ts` — exposes derived `assemblyProgress` from the canonical completed-task count.
- `src/game/ui/ProgressPanel.ts` — replaces abstract repair indicators with the compact assembly station and guarded install choreography.
- `src/game/scenes/GameScene.ts` — synchronizes task completion, assembly rewards, helper dialogue/reactions, audio, activation, and final transition.
- `src/game/scenes/VictoryScene.ts` — composes the intact helper and modular repaired robot on separate grounded platform positions.
- `ROBOTLAB-PROJECT-STATUS.md` — records Stage 7.1A approval adjustments, Stage 7.1B architecture, verification, evidence, and release status.

- `src/game/scenes/VictoryScene.ts` — Stage 7.0A maps a measured feet origin to the visible platform upper plane, keeps the shared contact responsive and control-safe, and anchors the completion pulse at the soles.
- `ROBOTLAB-PROJECT-STATUS.md` — records Stage 7.0A implementation, verification, exact contact coordinates, and evidence.

- `src/game/scenes/GameScene.ts` — routes final Shadow completion into Task 5, coordinates Memory comparison/hint/audio/robot/final-repair behavior, and transitions once to the completion screen after the readable 4/4 state.
- `src/game/scenes/StartScene.ts` — resets Memory together with the existing full-session reset boundary.
- `src/game/scenes/VictoryScene.ts` — replaces the unused temporary placeholder with the responsive final completion state and clean Play Again/Home resets.
- `ROBOTLAB-PROJECT-STATUS.md` — records Stage 7 implementation, full five-task completion, verification, evidence, and release state.

- `src/game/scenes/GameScene.ts` — routes completed Task 3 into Mechanic 4, coordinates all three shadow challenges, and restores the normal final-Task-3 `Дальше` handoff.
- `src/game/scenes/StartScene.ts` — resets shadow-matching state with the existing session/mechanic reset boundary.
- `src/game/ui/TaskCard.ts` — adds the reusable responsive target-plus-three-shadows composition and temporary two-phase hint choreography.
- `ROBOTLAB-PROJECT-STATUS.md` — records Stage 6 implementation, QA, evidence, and release state.

- `src/game/assets/manifest.ts` — registers the six stable local audio IDs and exact runtime paths.
- `src/game/scenes/PreloadScene.ts` — preloads audio and initializes the manager after decoding.
- `src/game/scenes/StartScene.ts` — requests gesture-gated music, fades it on Play, and binds the real sound toggle.
- `src/game/scenes/GameScene.ts` — emits semantic correct, wrong, hint, and major repair audio for all implemented mechanics.
- `src/game/state/preferencesState.ts` — validates and persists `robotlab.audioMuted` with denied-storage fallback.
- `src/game/ui/controls.ts` — registers the first user gesture and emits exactly one centralized UI click per accepted press.
- `docs/TECH-SPEC.md`, `docs/ARCHITECTURE.md`, `docs/ASSET-PLAN.md` — document audio architecture, files, mixing, persistence, autoplay, and lifecycle.
- `qa/stage5-2-main-flow-playtest.cjs` evidence outputs — rerun unchanged across the required responsive targets.
- `ROBOTLAB-PROJECT-STATUS.md` — documents Stage 5.3 implementation and verification.

- `index.html` — added an empty data favicon to prevent an unnecessary browser 404.
- `src/main.ts` — added the Phaser bootstrap and browser QA handle.
- `src/game/assets/manifest.ts` — mapped both laboratory background IDs to the single approved production file and cleared resolved missing IDs.
- `src/game/scenes/StartScene.ts` — renders the approved start background before the UI layer.
- `src/game/scenes/GameScene.ts` — renders the approved game background before the UI and robot layers, then bottom-aligns the robot's visible feet to the circular platform.
- `src/game/config.ts` — uses viewport resize scaling for true responsive scene composition.
- `src/style.css` — supplies the production UI font stack and full-viewport canvas shell.
- `src/game/scenes/StartScene.ts` — implements the approved production start presentation and direct Start → Game action.
- `src/game/scenes/GameScene.ts` — implements the responsive approved composition; Stage 2.1 binds initial progress to 0/5 and removes duplicated task/progress UI.
- `src/game/scenes/GameScene.ts` — Stage 3.2 removes viewport/task-card robot positioning and delegates creation and reactions to the canonical grounding helper.
- `src/game/ui/sceneLayout.ts` — Stage 3.2 defines the 1280×720 logical laboratory transform and maps the background's platform source point to logical `(640, 560)`; StartScene's existing optional target behavior is preserved.
- `src/game/ui/TaskCard.ts` — adds a stable runtime name used by production-preview QA without changing layout or interaction behavior.
- `src/game/ui/controls.ts` — fixes Container hit-area alignment and implements immediate press/depressed/release feedback with a reusable enabled state.
- `src/game/ui/TaskCard.ts` — implements immediate object press, persistent non-colour selection, clear disabled-check state, responsive hint/check actions, and rapid-transition guarding.
- `src/game/ui/robotGrounding.ts` — accepts bounded responsive placement and restores the exact captured base after correct/wrong reactions.
- `src/game/scenes/GameScene.ts` — shares the responsive platform contact between background and robot while keeping the robot clear of the portrait task card.
- `src/game/mechanics/oddOneOut.ts` — clears a wrong selection in serializable mechanic state while keeping the task active.
- `src/game/ui/TaskCard.ts` — separates transient wrong-object feedback from answer selection, resets Проверить, and enables immediate re-selection.
- `src/game/ui/robotGrounding.ts` — adds the gentle wrong-answer tilt and exact grounded-baseline restoration.
- `src/game/scenes/GameScene.ts` — coordinates rotating robot dialogue and the wrong reaction without changing scene layout or assets.
- `ROBOTLAB-PROJECT-STATUS.md` — documents Stage 3.3 implementation and verification evidence.
- `AGENTS.md` — adds the no one-off device patch project rule.
- `src/style.css` — exposes browser safe-area environment insets as host CSS custom properties.
- `src/game/config.ts` — permits the 320 px short-landscape height while retaining `Scale.RESIZE`.
- `src/game/scenes/GameScene.ts` — consumes centralized layout/framing and hosts fixed logical world layers without changing gameplay callbacks.
- `src/game/ui/sceneLayout.ts` — adds fixed-world laboratory placement.
- `src/game/ui/robotGrounding.ts` — removes viewport scaling from the robot base transform and preserves canonical logical grounding.
- `src/game/ui/controls.ts` — accepts centralized icon-control sizing.
- `src/game/ui/TaskCard.ts` — consumes centralized fluid metrics and maintains 44 px hit-area floors.
- `src/game/ui/ProgressPanel.ts` — consumes centralized fluid metrics and exposes a stable QA name.
- `src/game/ui/RobotDialogue.ts` — consumes centralized bubble metrics and avoids the landscape progress column.
- `docs/TECH-SPEC.md` — documents logical world, scale mode, four modes, fluid HUD, and safe areas.
- `docs/ARCHITECTURE.md` — documents the responsive rendering pipeline and module ownership.
- `docs/QA-CHECKLIST.md` — records the permanent responsive QA matrix and Stage 3.4 PASS.
- `ROBOTLAB-PROJECT-STATUS.md` — documents Stage 3.4 implementation and evidence.
- `src/game/scenes/StartScene.ts` — resets internal sequence state together with overall session state when a new game starts.
- `src/game/scenes/GameScene.ts` — routes completed Mechanic 1 sessions into Mechanic 2 and coordinates its internal progression, hints, dialogue, reactions, and final 2/5 completion.
- `src/game/ui/TaskCard.ts` — adds the reusable sequence presentation variant, separate pattern/options rows, runtime missing slot, internal indicator, dynamic hints, and correct-symbol fill animation.
- `src/game/ui/responsiveLayout.ts` — adds centralized fluid sequence icon, gap, and option-height measurements without adding composition modes or device checks.
- `ROBOTLAB-PROJECT-STATUS.md` — documents Stage 4 implementation and verification evidence.
- `src/game/scenes/StartScene.ts` — resets the size-comparison state when a new game starts.
- `src/game/scenes/GameScene.ts` — routes Mechanic 2 completion into Mechanic 3 and coordinates size challenges, hints, dialogue, reactions, internal progression, and final 3/5 completion.
- `src/game/ui/TaskCard.ts` — adds a reusable three-choice same-texture size layout with configurable visual multipliers, shared bottom alignment, internal progress label, and compact success feedback.
- `ROBOTLAB-PROJECT-STATUS.md` — documents Stage 5 implementation and verification evidence.
- `src/game/scenes/GameScene.ts` — restores synchronous overall-progress rendering and the 180 ms final-Sequence Next guard, exposes a read-only QA session snapshot, and guards reward feedback across scene shutdown.
- `src/game/scenes/GameScene.ts` — Stage 5.2A routes all task continuation through one guarded normal-renderer restart and clears transient dialogue before rebuilding the current task.
- `src/game/ui/RepairReward.ts` — Stage 5.2A resolves and cleans up in-flight reward choreography on scene shutdown.
- `src/game/ui/TaskCard.ts` — Stage 5.2B renders major-task and internal-mechanic counters with explicit `ИЗ` wording.
- `src/game/ui/ProgressPanel.ts` — Stage 5.2B replaces numeric progress with the `РЕМОНТ` title and five named visual repair indicators.
- `src/game/ui/responsiveLayout.ts` — Stage 5.2B supplies centralized responsive title sizing for the horizontal repair panel and removes unused numeric-count sizing.
- `qa/stage5-2-main-flow-playtest.cjs` — Stage 5.2B updates the active full-flow regression to assert repair indicator counts and absence of numeric progress.
- `qa/stage5-2a-manual-visibility-playtest.cjs` — Stage 5.2B updates the Task 3 ribbon expectation to the new wording.
- `ROBOTLAB-PROJECT-STATUS.md` — documents the Stage 5.2 cause, state trace, full-flow verification, and evidence.
- `ROBOTLAB-PROJECT-STATUS.md` — documents the Stage 5.2A visible-flow hardening, exact screenshots, and three-viewport results.
- `docs/ARCHITECTURE.md` — documents the complete-hero/modular-gameplay robot split and progression-independent animation boundary.
- `src/game/ui/RobotActor.ts` — Stage 5.1B changes only the modular screen-left `armRight` shared base rotation to the named 122° friendly greeting pose; existing reactions inherit and restore it.
- `ROBOTLAB-PROJECT-STATUS.md` — documents the Stage 5.1B arm identification, implementation, verification, and evidence.
- `src/game/ui/RobotActor.ts` — Stage 5.1E removes the wave sprite and all arm tweens, restores mirrored ±4° resting arms, and limits reactions to actor/body, head, and antenna feedback.
- `src/game/assets/manifest.ts` — Stage 5.1E removes the wave-arm runtime registration while leaving the source PNG unchanged on disk.
- `ROBOTLAB-PROJECT-STATUS.md` — documents the Stage 5.1E emergency reset, exact screen mapping, build, playtest, and screenshot evidence.
- `src/game/ui/RobotActor.ts` — Stage 5.1F adds explicit screen-left/screen-right resting-pose objects, applies the corrected shoulder coordinates, and captures/restores part origins in the canonical reset contract.
- `ROBOTLAB-PROJECT-STATUS.md` — documents the Stage 5.1F transforms, reset hardening, build, responsive playtest, and visual evidence.
- `src/game/ui/RobotActor.ts` — Stage 5.1H derives body-local anchors from the visible socket pixels and aligns artwork-specific proximal arm-root pivots directly to them.
- `qa/stage5-1h-shoulder-socket-alignment-playtest.cjs` — verifies exact socket/root coincidence, approved assets, clean console, three required viewports, temporary debug markers, and screenshots.
- `docs/qa/stage5-1h-shoulder-socket-alignment-results.json` — records the three-viewport Stage 5.1H results and exact local/world coordinates.
- `docs/qa/screenshots/stage5-1h-*.png` — records clean and debug-marker visual evidence, including the required desktop torso/shoulder close-up.
- `ROBOTLAB-PROJECT-STATUS.md` — documents Stage 5.1H implementation, verification, and evidence.

## FILES MOVED OR DELETED

- None.

## BLOCKERS

- None for Stage 8.0 design completion.

## GIT

GIT:
INITIALIZED

BASELINE:
`99058509ab5cc7ee2d267f6c5d9178905f2137f2`

BRANCH:
main

## NEXT

Stage 8.0A is ready for manual visual review. Stage 8.0 design remains ready for a separately authorized Mission 6 implementation stage; confirm required production asset IDs/readiness before dependent visual work.

## LAST VERIFIED

2026-08-29 — Stage 8.0A responsive layout QA passed at 320×568, 390×844, 768×1024, 1280×720, and 1438×914; Tasks 1–5 additionally passed layout and touch-target regression on 390×844 and 1280×720 with `failures: []`. `npm run build` passes with 43 modules transformed and only the existing non-blocking Phaser chunk-size advisory. The first restricted-sandbox build attempt was blocked by Windows `spawn EPERM`; the identical approved rerun completed successfully.
