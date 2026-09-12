# 0010 — Mission 9 Robot Test Course

Date: 2026-09-11

Status: Stage 9R approved; physical Samsung hardware review pending

## Decision

Mission 9 is `ИСПЫТАЙ РОБОТА`: a continuous final integration test built from the approved Mission 9 visual references.

Approved flow:

1. `BRIDGE` — `ПОЧИНИ МОСТ`
2. `GATE` — `НАЙДИ КЛЮЧ`
3. `POWER` — `ЗАПУСТИ СТАНЦИЮ`
4. `COMPLETE` — `ИСПЫТАНИЕ ПРОЙДЕНО!`

The previous `GATE -> FORK -> PICKUP -> DELIVERY` prototype is deprecated.

## Source References

Runtime assets are derived from these approved references under `docs/references/mission9/`:

- `mission9_bridge_choices.png` — bridge ends, gap target, correct flat bridge piece, arc distractor, truss distractor.
- `mission9_bridge_scene_reference.png` — bridge-stage composition, robot scale, choice hierarchy.
- `mission9_gate_choices.png` — security gate, lock language, physical key-module silhouettes.
- `mission9_gate_scene_reference.png` — gate-stage composition, robot/gate scale, choice placement.
- `mission9_power_station_choices.png` — station geometry, energy modules, cyan activation material.
- `mission9_power_station_scene_reference.png` — power-stage composition, station prominence, final activation mood.

The reference screenshots are not used as full-screen runtime screenshots.

## Runtime Assets

Mission 9 runtime props live only under `public/assets/missions/mission9/`.

The scene uses semantic preload keys such as `MISSION9_BRIDGE_CORRECT`, `MISSION9_GATE_CLOSED`, and `MISSION9_POWER_STATION_ON`.

## Gameplay Rules

- Bridge answer is based on physical shape/fit in the gap.
- Gate answer is based on matching the lock/socket silhouette.
- Power answer is based on matching the station socket with the physical module.
- Wrong choices return with soft feedback and no lives/reset.
- Correct choices snap into the target, trigger world reaction, move the repaired robot, then advance.
- Progress is compact three-dot progress only.

## Architecture

Serializable Mission 9 truth lives in `src/game/mechanics/robotTestCourse.ts`.

`src/game/scenes/Mission9Scene.ts` owns Phaser presentation, input, snapping, reactions, and completion overlay.

Responsive composition remains centralized through `ViewportMetrics`, `ResponsiveLayout`, and `SceneCompositionDirector`.

## Verification

- `node --experimental-strip-types qa/stage9-0-robot-test-course-logic.mjs` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS with existing Vite large-chunk advisory.
- `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Владимир\Documents\Codex\scripts\Invoke-PlaywrightQa.ps1" "qa\stage9-3-mission9-art-gameplay-playtest.cjs"` — PASS on production preview with `failures: []`.

Physical Samsung hardware remains NOT TESTED and is a separate real-device acceptance gate.

## Stage 9R Supersession (2026-09-12)

This section supersedes the drag-era interaction and acceptance rules above where they conflict. The source-reference and runtime-asset history remains authoritative and is retained.

### Semantic Puzzle Contract

- `BRIDGE`: the embedded gap clue identifies `bridge-flat-span` as the correct flat bridge piece.
- `GATE`: the single embedded lock clue identifies `gate-truss-profile` as the correct truss-profile key.
- `POWER`: the single embedded socket clue identifies `power-capsule-module` as the correct horizontal capsule.
- Candidate IDs and the clue/target contract are authoritative. Historical texture-key names do not define correctness.
- Every stage renders one target and exactly three same-family candidates; cross-family candidates are forbidden.

### Interaction Contract

- The only production interaction is tap-select, then tap-target. Mouse and touch share the same controller boundary.
- Drag is disabled and is no longer an accepted or compatibility interaction.
- Tapping the target before selection, tapping between candidates, or sending duplicate/rapid input cannot advance the course.
- Wrong placement returns to `IDLE` with soft feedback and preserves the current stage.
- Correct placement locks input, snaps once, performs one world reaction, and advances exactly one stage.
- Serializable course state remains outside Phaser scene objects. `Mission9InteractionController` owns the `IDLE -> SELECTED -> PLACING -> REJECTING/SNAPPING -> TRANSITIONING/LOCKED` input lifecycle.

### Composition and Lifecycle

- BRIDGE, GATE, POWER, the repaired robot, target, and three-choice row use centralized platform anchors from `SceneCompositionDirector`.
- Target center and candidate-row center remain aligned to `platformCenterX`; visible robot feet remain aligned to `platformContactY`.
- Portrait renders exactly one orientation gate and no playable stage root, candidates, or target.
- A committed viewport change restarts Mission 9 from serializable state. Active-stage disposal disables input; shutdown disposal removes listeners without calling `disableInteractive()` after Phaser input teardown.

### Stage 9R Verification

- `npm run typecheck` - PASS.
- `node --experimental-strip-types qa/stage9r-mission9-core-logic.mjs` - PASS.
- `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\Владимир\\Documents\\Codex\\scripts\\Invoke-PlaywrightQa.ps1" "qa\\stage9r-mission9-full-rebuild.cjs"` - PASS against fresh strict `http://127.0.0.1:4198/`.
- Final browser result: mouse flow PASS, real CDP touch flow PASS, all six responsive viewports PASS, portrait PASS, resize/orientation lifecycle PASS, `failedChecks: []`, and no console, page, failed-request, or failed-response errors.
- Evidence: `docs/qa/stage9r-mission9-full-rebuild.json` and 21 `docs/qa/screenshots/stage9r-mission9-*.png` captures.
- Human visual review: PASS.
- Physical Samsung hardware: NOT TESTED.

No commit or push was performed. Mission 10 was not changed.
