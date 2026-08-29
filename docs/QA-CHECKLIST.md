# QA checklist

Use `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` per check and attach evidence/notes. A compiled build alone is never sufficient for a stage or release PASS.

## BUILD

- [ ] Clean dependency install succeeds from the lockfile.
- [ ] Typecheck succeeds.
- [ ] Production build succeeds and output contains only expected files.
- [ ] Preview serves the production build, not only the dev server.

## PAGE LOAD

- [ ] First load reaches the expected scene.
- [ ] Refresh and direct base URL load work.
- [ ] Loading state remains understandable on a slow connection.
- [ ] Gameplay remains available after load without a network dependency.

## CONSOLE

- [ ] No uncaught errors, unhandled promises, missing keys, or repeated warnings.
- [ ] Development diagnostics are absent or disabled in production.

## ASSETS

- [ ] Every used production asset is `APPROVED` and then verified as `IMPLEMENTED`.
- [ ] No missing, distorted, blurry, substituted, or unlicensed asset.
- [ ] Audio decodes; transparency, pivots, crops, and atlas frames are correct.

## DESKTOP

- [ ] 1280×720 layout, pointer input, focus, resize, and full flow pass.
- [ ] Larger/smaller practical desktop sizes preserve hierarchy.

## TABLET

- [ ] 768×1024 portrait layout and touch flow pass.
- [ ] Practical tablet landscape and orientation change recover correctly.

## MOBILE

- [ ] 390×844 portrait full flow passes.
- [ ] Minimum 320 px width remains usable without essential clipping.
- [ ] Safe areas and browser chrome do not cover controls.

## TOUCH

- [ ] All targets are generous and work without hover.
- [ ] Tap, drag, drop, cancellation, and repeated input behave safely where applicable.
- [ ] Double taps and browser gestures do not cause duplicate progression.

## AUDIO

- [ ] Audio starts only after user gesture and mute is immediately available.
- [ ] Music, feedback, and voice balance is child-appropriate.
- [ ] Hidden-tab, interruption, mute persistence, and decode-failure behavior pass.

## GAME FLOW

- [ ] Start → Intro → exactly five tasks → Victory → Results → Replay passes.
- [ ] No infinite loop, skipped task, duplicate transition, or trapped state.

## WRONG ANSWER

- [ ] Feedback is gentle, readable, non-punitive, and permits another attempt.
- [ ] Progress does not decrement; rapid repeated attempts cannot break state.

## CORRECT ANSWER

- [ ] Feedback occurs once, input locks during transition, and the next state is correct.
- [ ] Correct meaning is not communicated by colour alone.

## PROGRESSION

- [ ] 0/5 through 5/5 are visually distinct and synchronized with state.
- [ ] Each completed task restores exactly one intended module.

## VICTORY

- [ ] Victory triggers once at 5/5, is positive/non-frightening, and settles correctly.
- [ ] Reduced-motion and muted variants remain understandable.

## RESTART

- [ ] Replay creates clean session state with no stale sprites, listeners, timers, audio, or answers.
- [ ] Multiple consecutive replays pass.

## PERFORMANCE

- [ ] Frame pacing is stable on representative desktop/tablet/mobile hardware.
- [ ] Load size/time, memory growth, long tasks, particles, and audio concurrency are reviewed.
- [ ] Hidden tabs pause nonessential work and return safely.

## VISUAL REGRESSION

- [ ] Capture consistent screenshots for start, each mechanic, each repair stage, victory, and results.
- [ ] Compare desktop/tablet/mobile baselines for crop, scale, hierarchy, text, and asset changes.
- [ ] Intentional visual changes are documented and baselines updated only after approval.

## Stage 0 record — 2026-08-28

- BUILD: NOT REQUIRED (dependencies not installed; no runtime implementation).
- Documentation/structure inspection: PASS.
- PAGE LOAD through VISUAL REGRESSION: NOT RUN (no gameplay exists).

## Stage 3.4 responsive QA contract — 2026-08-28

Permanent checkpoints (validation points only; none are code breakpoints):

| Group | Viewports | Result |
|---|---|---|
| Phone portrait | 320×568, 333×885, 360×800, 390×844, 400×824, 412×915 | PASS |
| Large portrait/tablet | 600×960, 768×1024, 820×1180, 912×1368, 1024×1366 | PASS |
| Landscape/short landscape | 568×320, 844×390, 915×412 | PASS |
| Desktop | 1280×720, 1366×768, 1920×1080 | PASS |
| Intermediate interpolation | widths 340, 375, 430, 540, 700, 860, 1100 | PASS |

- [x] Exactly four composition modes selected only by orientation and broad width ranges.
- [x] Fixed logical grounding remains X `640`, contact Y `560`, origin `(0.5, 1)`, scale `0.2520718` at all 24 checkpoints.
- [x] Task card, progress, dialogue, controls, gaps, and typography consume centralized clamped metrics.
- [x] Minimum measured interactive hit rectangle is 44×44 px, including 568×320.
- [x] Dialogue remains in viewport, below the robot face, outside the task card, and before the landscape progress column.
- [x] Representative touch/mouse flows cover hint, selection, wrong retry, dialogue, correct 0/5→1/5, rendered 5/5, sound, Home, and Дальше.
- [x] Canvas/document dimensions match each viewport; no scroll overflow.
- [x] No console errors, page errors, or failed requests.
- [x] Production build and preview pass; the Phaser bundle-size advisory remains non-blocking.

Automation: `qa/stage3-4-responsive-playtest.cjs`. Machine-readable evidence: `docs/qa/stage3-4-results.json`. Screenshot evidence: `docs/qa/screenshots/stage3-4-*.png`.
