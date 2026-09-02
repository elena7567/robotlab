# RobotLab project status

## PROJECT

RobotLab — «Почини робота», a browser educational 2D mini-game for ages 4–6.

## CURRENT DESIGN STAGE

Stage 8.4 Character Art Migration v2 — Mission 7 character review follow-up

## CURRENT STATUS

READY_FOR_MISSION7_CHARACTER_REVIEW — Robot v2 production art is active. Mission 7 desktop now uses measured readable side-character heights with a 1.111 helper/repaired hierarchy; tablet uses a slightly smaller 1.113 hierarchy; phone keeps the mechanic clear of miniature full-body robots. The helper extraction halo at the collar was removed in the production PNG and alpha bounds were re-normalized. Manual approval remains pending; no commit or push was performed.

## CANONICAL LOCAL URL

`http://127.0.0.1:4198/`

- `npm run dev` and `npm run preview` bind strictly to port 4198.
- Both Vite servers listen on `0.0.0.0`, preserving the canonical desktop URL while allowing same-LAN device access.
- Automatic fallback to changing ports is disabled.
- All future manual browser review, screenshots, and automated level QA must use this address.

## LAN TESTING ENABLEMENT

- Vite development and preview host: `0.0.0.0`.
- Canonical desktop URL remains `http://127.0.0.1:4198/`.
- Detected active physical Wi-Fi LAN IPv4: `192.168.0.114` (gateway `192.168.0.1`, subnet mask `255.255.255.0`). VPN adapter addresses were not selected as the phone/tablet LAN address.
- Same-network phone/tablet URL: `http://192.168.0.114:4198/`.
- Gameplay, Missions, production assets, and public deployment configuration were not changed.
- Verification on 2026-08-30: both `http://127.0.0.1:4198/` and `http://192.168.0.114:4198/` returned HTTP 200. Headless Chrome at 390×844 loaded the active `StartScene`, one 390×844 game canvas, and 82 resources through each URL with zero console, page, failed-request, or non-2xx response errors; both captures were visually inspected and matched.
- Strict-port verification: a second direct Vite launch on `0.0.0.0:4198` failed with `Port 4198 is already in use`, confirming that no fallback port is selected.
- Build verification: `npm run build` PASS (TypeScript clean; 52 modules transformed; existing non-blocking Phaser chunk-size advisory only).
- Files changed for LAN enablement: `package.json` and `ROBOTLAB-PROJECT-STATUS.md`. Files moved or deleted: none.

## FIRST FIVE MISSIONS

LOCKED

## MISSION 6–10

MISSIONS 6–8 IMPLEMENTED; MISSIONS 9–10 DESIGN ONLY / NOT IMPLEMENTED

## STAGE 8.4 — CHARACTER ART MIGRATION V2 / MISSION 7 FOLLOW-UP (2026-08-31)

- The fixed Robot v2 references were preserved under `docs/references/robot-style-v2/`; runtime-ready helper, repaired, duo, and seven modular assembly assets were created under `public/assets/characters/robot-v2/` with semantic `robot-v2-*` Phaser keys. Old robot assets remain on disk as rollback fallback and are not active runtime consumers.
- The helper is the dark-visor antenna identity. The repaired robot is the white-face identity assembled from the disassembled source. The locked 5/5 mechanic still installs an antenna, which remains a documented story/art mismatch against the canonical antenna-free repaired reference; gameplay was not redesigned.
- Mission 7 manual failure evidence showed desktop characters reading as miniatures and a translucent circular collar/neck extraction artifact. The helper production PNG was alpha-cleaned at source level, re-trimmed to `789×1534` with a `757×1502` visible-alpha region and 16 px safety padding, preserving antenna and feet baselines.
- Mission 7 measured visible bounds at 1280×720: helper `163.99 px` (22.8% viewport height), repaired `147.60 px` (20.5%), ratio `1.111`. At 1438×914: `208.17/187.37 px`, ratio `1.111`. At 768×1024: `165.25/148.48 px`, ratio `1.113`. Phone 390×844 hides both full-body side actors to protect the wire mechanic.
- Focused and regression browser QA PASS: 23 fresh-page cases, required 360×640, 390×844, 844×390, 768×1024, 1280×720, and 1438×914 profiles, Mission 1–8 character states, Mission 8 charger arrival, Victory, and portrait→landscape→portrait. Browser console/page/request/response failures: none; old active robot textures: none; orientation ratio remained stable.
- Evidence: `qa/stage8-4-character-art-playtest.cjs`, `docs/qa/stage8-4-character-art.json`, and `docs/qa/screenshots/stage8-4-*.png`. Required Mission 7 review captures: `stage8-4-mission7-desktop.png`, `stage8-4-mission7-wide-1438x914.png`, `stage8-4-mission7-tablet-768x1024.png`, and `stage8-4-mission7-phone.png`.
- Files moved or deleted: none. No commit or push was performed. Status is review-ready, not final visual approval.

## STAGE 8.3O — MISSION 2 VISIBLE TASK-FIRST ENLARGEMENT (2026-08-31)

- User review correctly rejected Stage 8.3N's first Mission 2 adjustment as not visibly substantial. The remaining constraint was the old 360 px phone-landscape side column; increasing only internal maxima could not produce a large visual change inside it.
- Phone landscape now uses a centralized task-first width of 390–540 px (`62%` of the safe width). At the reviewed 844×390 profile the configured card is 523.28 px wide and each answer frame is 88 px wide. The secondary assembly panel is hidden in all phone-landscape modes.
- Robot dialogue is also suppressed in phone landscape. Wrong feedback is the single local line `Попробуй ещё раз`; measured bounds do not intersect any answer, and no speech bubble or progress panel can cover the card.
- Focused canonical-URL QA PASS with nine checks and no browser errors: wide landscape card, child-sized choices, unobstructed feedback, cleared battery state, single route robot, and portrait behavior. Evidence: `docs/qa/stage8-3n-feedback-fixes.json` and `docs/qa/screenshots/stage8-3n-mission2-landscape-large-wrong.png`.
- The older Stage 8.3J harness was rerun and exposed stale confirm-flow assertions after the later direct-response interaction change; those interaction-timing assertions are not claimed as a PASS for this stage. Its screenshots were still used for visual inspection. The focused direct-response harness is the acceptance evidence.
- Server check: `http://127.0.0.1:4198/` returns 200 and exposes `/@vite/client`, confirming a Vite HMR development server. An already-open Phaser scene can retain its constructed TaskCard after source HMR; physical review must use a full page reload before reopening Mission 2.
- Verification: `npm run typecheck` PASS; focused Playwright QA PASS; `npm run build` PASS (55 modules, existing non-blocking large-chunk advisory only); `git diff --check` reports no whitespace errors.
- Files modified for this correction: `src/game/ui/responsiveLayout.ts`, `src/game/scenes/GameScene.ts`, `docs/decisions/0008-child-clarity-for-missions-2-6-8.md`, `qa/stage8-3n-feedback-fixes-playtest.cjs`, `docs/qa/stage8-3n-feedback-fixes.json`, `ROBOTLAB-PROJECT-STATUS.md`, and refreshed Stage 8.3J QA evidence. File created: `docs/qa/screenshots/stage8-3n-mission2-landscape-large-wrong.png`. Files moved or deleted: none. Approved production artwork was not modified. No commit or push was performed.

## STAGE 8.3N — CHILD READABILITY AND ANSWER-STATE CORRECTION (2026-08-31)

- Mission 2 `ПРОДОЛЖИ РЯД`: sequence artwork now receives a larger share of the existing content band. At 390×844 the four sequence images measure 56.94 px and answer images 60.175 px. Sequence progress is always in the ribbon, leaving the feedback line as the short `Попробуй ещё раз`; its measured bounds do not intersect any answer bounds.
- Mission 6 `ЗАРЯДИ РОБОТА`: battery selection emphasis now has a dedicated graphics layer that is cleared on every redraw. After choosing the wrong medium battery, all three selection layers contain zero drawing commands and all scales return to 1. Selecting the correct full battery then highlights only that battery at scale 1.06.
- Mission 8 `ДОВЕДИ РОБОТА`: removed the non-participating helper actor from route play. Focused QA finds exactly one `programming-robot`, zero `grounded-robot` helpers, and zero Mission 8 helper layers; the board robot still owns all route execution.
- Focused visual QA PASS: `qa/stage8-3n-feedback-fixes-playtest.cjs` on the canonical `http://127.0.0.1:4198/`; all seven assertions pass and browser errors are empty. Three 390×844 screenshots were generated and visually inspected.
- Regression PASS: `npm run typecheck`; `npm run build` (55 modules, existing non-blocking large-chunk advisory only); layout contract 17/17; short-landscape task-card playtest exit 0; `git diff --check` has no whitespace errors (only existing line-ending notices).
- Files modified for this stage: `src/game/ui/TaskCard.ts`, `src/game/ui/responsiveLayout.ts`, `src/game/ui/EnergyTaskCard.ts`, `src/game/scenes/Mission8Scene.ts`, and this status document. Files created: `docs/decisions/0008-child-clarity-for-missions-2-6-8.md`, `qa/stage8-3n-feedback-fixes-playtest.cjs`, `docs/qa/stage8-3n-feedback-fixes.json`, and three `docs/qa/screenshots/stage8-3n-*` screenshots. Files moved or deleted: none. Approved production artwork was not modified. No commit or push was performed.

## STAGE 8.3L — POST-ROTATION NEXT PROGRESSION FIX (2026-08-31)

- Exact reproduction FAIL before the fix at 412×180: Task 1 ball selection showed the correct check, `Дальше` was visible/active/enabled, touch was delivered, but the screen remained `ЗАДАНИЕ 1 ИЗ 10`. This reproduced both when Task 1 was completed before rotation and when it was completed after rotation.
- Root cause: viewport reflow restarts `GameScene` with a presentation payload that deliberately preserves completed Task 1. Phaser may retain prior init data when a later `Scene.restart()` receives no replacement data, so the explicit `Дальше` transition accidentally reapplied the preservation payload.
- `GameScene.renderCurrentTask()` now restarts with `{ viewportReflow: false }`. Only viewport lifecycle restarts carry `{ viewportReflow: true, presentationState }`.
- Exact reproduction PASS after the fix in both sequences: before `Дальше`, `ЗАДАНИЕ 1 ИЗ 10`; after the real touch, `ЗАДАНИЕ 2/10 · РЯД 1/3`; `failures: []`, browser errors empty.
- Verification: TypeScript PASS; responsive layout contract 17/17 PASS; production build PASS (54 modules, existing non-blocking bundle-size advisory only).
- Files modified: `src/game/scenes/GameScene.ts`, `package.json`, `docs/decisions/0007-real-device-mobile-reflow.md`, and this status document. Files created: `qa/stage8-3k-next-after-rotation-playtest.cjs`, `docs/qa/stage8-3k-next-after-rotation.json`, and four `stage8-3k-*` screenshots. Files moved or deleted: none. Gameplay rules and approved assets were not changed.

## STAGE 8.3K — REAL TOUCH DELIVERY VERIFICATION (2026-08-31)

- The earlier Stage 8.3J test contained an acceptance gap: it issued a touch tap but only measured layout afterward, so it did not prove that Phaser delivered the input event. The harness now records TaskCard selection/result state and requires visible feedback after each real browser touch action.
- Verified the full answer → Hint → Check chain for Tasks 2–4. A case passes only when the answer changes `selectedKey` and displays `Выбрано`, Hint displays its feedback, and Check produces `correct` or `wrong`.
- The user's follow-up confirmed that the generated 412×180 screenshot represented the failing physical orientation. Root cause: Android browser chrome can change the canvas' rendered CSS bounds before Phaser refreshes its cached `canvasBounds` and `displayScale`; visible controls then render in one coordinate space while touch hit testing uses another.
- `viewport.ts` now refreshes live canvas bounds and derives the current input display scale in capture phase before every `pointerdown` and `touchstart`, plus one animation frame after a committed viewport change. This updates coordinate conversion only and does not restart the scene.
- PASS with `failures: []` for 13 cases: direct short-landscape cases, Android-browser-chrome constrained viewports down to 412×180 CSS px, and portrait 390×844 → landscape 844×390 reflow for Tasks 2, 3, and 4. The constrained cases deliberately corrupt Phaser's stored input transform before answer, Hint, and Check taps; every tap restores the transform and reaches the intended action. Browser errors are empty.
- Regression: TypeScript PASS; responsive layout contract 17/17 PASS; orientation lifecycle PASS for six profiles with five portrait/landscape cycles each; production build PASS (54 modules, existing non-blocking bundle-size advisory only).
- Files modified in this follow-up: `src/game/ui/viewport.ts`, `qa/stage8-3j-task-card-landscape-playtest.cjs`, `docs/decisions/0007-real-device-mobile-reflow.md`, its JSON/screenshots, and this status document. Files moved or deleted: none. Gameplay rules and approved assets were not changed.

## STAGE 8.3J — CHILD-SIZED SHORT-LANDSCAPE TASK CARDS (2026-08-31)

- The user's physical screenshot `photo_2026-08-31_11-58-22.jpg` confirmed a real usability defect in Task 2: the short-landscape card remained too narrow for a 4–6-year-old, four answer frames were visually small, and the persistent `РЯД …` text occupied the same lower band as answers and transient feedback.
- `responsiveLayout.ts` now gives `PHONE_LANDSCAPE_SHORT` a 300–360 px task-first card and a compact 150–190 px assembly panel. Primary action faces are 52 px high with 60 px hit height; answer containers have a minimum 56×56 px hit area. At 844×390, Task 2 answer faces measure about 75×50 px with 83×58 px hit areas, while Hint/Check faces measure about 153×52 px with 161×60 px hit areas.
- Internal challenge progress moves into the wide task ribbon only in short landscape (`ЗАДАНИЕ 2/10 · РЯД 1/3`, with equivalent Comparison/Shadow labels). The feedback band now contains only transient feedback. TaskCard derives the content bottom from the actual feedback and action bounds, so answer/status/action rows cannot share the same vertical space.
- Shadow matching no longer forces an 84 px content band when less height exists. On the 568×320 minimum it compresses the non-interactive target preview first and retains 88×48 px answer faces with 96×56 px hit areas.
- Focused visual QA PASS with `failures: []` for eight cases: Task 2 at 568×320, 740×360, 844×390, and 932×430; Tasks 3 and 4 at 568×320 and 844×390. Every card stayed inside the canvas; answer/action targets met the new contract; internal progress was present in the ribbon and absent from feedback; selected-state feedback cleared choices and actions; browser errors were empty. Sixteen initial/selected screenshots were generated and visually inspected.
- Regression PASS: Stage 8.3E layout contract 17/17; special states `failures: []`; Stage 8.3F exhaustive touch audit 40 cases / 284 probes / zero failures; Stage 8.3H orientation lifecycle six cases with five cycles each / zero failures; `npm run typecheck` PASS; production `npm run build` PASS (54 modules, existing non-blocking bundle-size advisory only).
- The legacy Stage 4/5/6 standalone harnesses were not used as acceptance evidence: they still wait for pre-Stage-8 text contracts such as internal progress in `feedbackText` and `ЗАДАНИЕ N ИЗ 5`, while the active game has ten tasks and Stage 8.3J intentionally moves short-landscape internal progress into the ribbon. Current focused, touch, special-state, and orientation suites cover the changed runtime contract.
- Files materially modified: `src/game/ui/responsiveLayout.ts`, `src/game/ui/TaskCard.ts`, `qa/stage8-3e-layout-contract.cjs`, `package.json`, `docs/decisions/0001-responsive-layout.md`, and this status document. Files created: `qa/stage8-3j-task-card-landscape-playtest.cjs`, `docs/qa/stage8-3j-task-card-landscape.json`, and Stage 8.3J screenshots under `docs/qa/screenshots/`. Files moved or deleted: none. Gameplay rules and approved assets were not changed. No commit or push was performed.

## STAGE 8.3I — SAMSUNG ROTATION FOLLOW-UP (2026-08-31)

- Real Samsung screenshot `photo_2026-08-31_11-26-43.jpg` confirmed two visible failures: the completed Mission 1 feedback/controls overlapped a cramped 2×2 choice grid in short landscape, and the scene did not reliably reconstruct the same visible mission after rotating back. The user's repeated reload report also identified that final phone review was still being served by Vite development/HMR.
- Root lifecycle correction: two stable frames were too permissive because Chrome browser chrome can pause at multiple intermediate heights during one orientation animation. The viewport bridge now waits 140 ms after the final resize/orientation/VisualViewport event, requires three identical animation-frame samples, ignores VisualViewport scroll-only changes, and skips already-synchronized commits. A simulated four-step Samsung geometry burst now produces exactly one landscape commit and one portrait commit.
- Presentation correction: canonical repair progress advances when a task succeeds, before the child presses `Дальше`. Viewport reflow now carries the visible mechanic's presentation snapshot, so rotating a completed Mission 1 card keeps Mission 1 on screen; only the existing explicit `Дальше` action advances to Mission 2. Normal gameplay restart behavior is unchanged.
- Compact-card correction: when the measured generic four-choice content band cannot safely contain two rows plus feedback and actions, `TaskCard` composes the choices in one horizontal row. The completed 844×390 Mission 1 card now has separate choice, feedback, and action bands; the returned 390×844 card restores its normal two-row portrait grid.
- Review-server correction: verified PID 34968 was `vite dev` with HMR on `0.0.0.0:4198`. It was stopped and replaced by hidden strict-port production preview PID 23348. Both `http://127.0.0.1:4198/` and `http://192.168.0.114:4198/` return HTTP 200; production preview has no HMR reload channel.
- Focused production-preview QA PASS: ordinary Start → Play → Mission 1 completion, a four-intermediate-size portrait-to-landscape burst, completed landscape review, a four-intermediate-size return burst, and completed portrait review. Visual/inner/parent/display/game/canvas geometry matched exactly; there was one commit per direction; the mission stayed completed and visible; all measured choice/feedback/action overlaps were false; console/page/network errors were empty.
- Full regression PASS after the changes: Missions 1, 5, 7, and 8 completed five 390×844 ↔ 844×390 cycles; Mission 8 also completed five cycles at 412×915 ↔ 915×412 and 393×852 ↔ 852×393. Mission 7 wire redraw and Mission 8 command/route-preview preservation remain PASS with `failures: []`.
- Verification: `npm run build` PASS (54 modules; existing non-blocking bundle-size advisory only); `qa/stage8-3i-samsung-orientation-regression.cjs` PASS against production preview; `qa/stage8-3h-orientation-lifecycle-playtest.cjs` PASS after the lifecycle/presentation changes. Both new Mission 1 screenshots were visually inspected.
- Files modified: `src/game/ui/viewport.ts`, `src/game/ui/sceneLayout.ts`, `src/game/scenes/GameScene.ts`, `src/game/ui/TaskCard.ts`, `docs/decisions/0007-real-device-mobile-reflow.md`, and this status document. Files created: `qa/stage8-3i-samsung-orientation-regression.cjs`, `docs/qa/stage8-3i-samsung-orientation-regression.json`, and two `docs/qa/screenshots/stage8-3i-*` captures. Files moved or deleted: none. Gameplay rules, Missions 1–8 logic, and approved assets were not changed. No commit or push was performed.

## STAGE 8.3H — ORIENTATION LIFECYCLE STABILIZATION (2026-08-31)

- Root cause: the prior VisualViewport bridge accepted the first animation frame after a rotation and changed host CSS plus Phaser size in the same frame. In `Scale.RESIZE`, Phaser's refresh consumes `parentSize`; if the host box had not committed yet, stale portrait dimensions could overwrite a landscape resize (or vice versa), and the scene could rebuild from transient geometry.
- `viewport.ts` now coalesces window resize/orientation and VisualViewport resize/scroll bursts, samples live VisualViewport width/height/offset and `innerWidth`/`innerHeight`, requires two identical consecutive animation-frame samples, and uses a bounded 12-frame retry. It commits host CSS first, refreshes Phaser parent bounds, then resizes Phaser and publishes one committed generation with viewport, parent, display, and game geometry.
- `sceneLayout.ts` now ignores transient Phaser resize emissions. Active scenes rebuild only after the centralized stable-viewport commit, from canonical mechanic/session state through the existing `create()` layout pass. No previous-orientation transform is multiplied or retained. The scene commit listener is removed on shutdown; global viewport listeners are registered once and removed on Phaser game destruction.
- Mission 7 rotation cancels any temporary drag through scene teardown, retains canonical connected colors, and redraws completed Graphics wires against the new port coordinates. Mission 8 reconstructs its grid and route preview from the live command sequence and places the board robot from the canonical logical cell.
- Acceptance PASS: Missions 1, 5, 7, and 8 each completed five 390×844 ↔ 844×390 cycles. Mission 7 began with a completed red wire; Mission 8 began with two touch-entered commands and a visible route preview. Mission 8 also completed five cycles at 412×915 ↔ 915×412 and 393×852 ↔ 852×393. Every state reported exact VisualViewport, inner, parent, display, game, canvas CSS, and canvas-pixel agreement; portrait geometry was deterministic after cycle 5; robot scale X/Y remained equal; state and listener counts remained stable; console/page/network errors were empty.
- Visual review PASS for Mission 7 and Mission 8 initial portrait, first landscape, first returned portrait, and cycle-5 portrait captures. Wires, grid cells, route preview, robot proportions, and controls recompose cleanly without stale dimensions or cumulative drift.
- Verification: existing focused orientation preflight PASS at 390×844 and 412×915; `qa/stage8-3h-orientation-lifecycle-playtest.cjs` PASS with `failures: []`; `npm run build` PASS (54 modules; existing non-blocking bundle-size advisory only).
- Files modified: `src/game/ui/viewport.ts`, `src/game/ui/sceneLayout.ts`, `src/main.ts`, `docs/decisions/0007-real-device-mobile-reflow.md`, and this status document. Files created: `qa/stage8-3h-orientation-lifecycle-playtest.cjs`, `docs/qa/stage8-3h-orientation-lifecycle.json`, and eight `docs/qa/screenshots/stage8-3h-*` captures. Files moved or deleted: none. Approved assets and gameplay/Missions 1–8 logic were not changed. No commit or push was performed.

## LEVEL 01 — RESPONSIVE ORIENTATION STABILIZATION (2026-08-31)

- Audited the existing responsive architecture before editing. `responsiveLayout.ts` remains the single geometry/classification contract; `viewport.ts` owns visual-viewport and safe-area metrics; `sceneLayout.ts` owns the resize lifecycle; and `GameScene.create()` remains the authoritative Level 01 composition pass. No second responsive service, device-model branch, Phaser upgrade, scale-mode change, or desktop redesign was introduced.
- Replaced the immediate one-shot resize restart with a persistent shutdown-scoped listener that reads current Phaser `parentSize`, `displaySize`, and `gameSize`, compares a normalized signature, coalesces same-frame resize bursts, ignores unchanged metrics, and rebuilds once from serializable session/mechanic state when geometry changes.
- Repeated orientation QA PASS for 390×844 → 844×390 → 390×844 → 844×390 and 412×915 → 915×412 → 412×915 → 915×412. Portrait and landscape geometry returned exactly, live ScaleManager metrics matched each target, Mission 1 selection survived, listener counts stayed stable, and browser/page/network errors were empty.
- Level 01 responsive matrix PASS with `failures: []` at 27 profiles: all requested 320×568, 333×885, 360×800, 390×844, 400×824, 412×915, 568×320, 800×360, 844×390, 824×400, 915×412, 768×1024, 1024×768, 820×1180, 1180×820, and 1280×720 sizes, plus existing regression, wide-desktop, and iOS safe-area profiles. Every profile passed viewport, mechanic/control containment, touch size, readability, overlap, safe-rect, real touch, and error checks.
- Representative 390×844 portrait, 844×390 landscape, and 1280×720 desktop captures were visually inspected. The phone compositions remain readable and unobstructed, and the approved desktop composition is unchanged.
- Verification: `npm run typecheck` PASS; `node --check qa/stage8-3c-mobile-reflow-playtest.cjs` PASS; `node qa/stage8-3e-layout-contract.cjs` PASS (17/17); production `npm run build` PASS (54 modules; existing non-blocking bundle-size advisory only); focused orientation QA PASS; Level 01 27-profile Chrome/Playwright matrix PASS.
- Files materially modified for this change: `src/game/ui/sceneLayout.ts`, `qa/stage8-3c-mobile-reflow-playtest.cjs`, `docs/decisions/0007-real-device-mobile-reflow.md`, and this status document. QA outputs created: `docs/qa/stage8-3g-level01-orientation-results.json` and `docs/qa/stage8-3g-level01-responsive-results.json`. Existing representative Stage 8.3E Mission 1 screenshots were refreshed. Files moved or deleted: none. Approved production/reference assets were not changed. No commit or push was performed.

## STAGE 8.3G — MISSION 8 COMPLETE ROUTE SPACE

- The reported defect was confirmed. Stage 8.3E accepted multiple paths but still capped each program at `shortestPathLength + 3`; this excluded a valid six-command path on Route 1 and three valid 7/9-command detours on Route 2 before simulation could evaluate them.
- `analyzeSimpleGridRoutes` now enumerates the finite set of legal non-repeating paths outside Phaser. Each challenge stores `simpleRouteCount`, `shortestPathLength`, and `longestSimplePathLength`; `maxCommands` is the actual longest simple route, not an allowance derived from one preferred path.
- Complete route space: Route 1 has 6 paths (2–6 commands), Route 2 has 6 paths (3–9 commands), and Route 3 has 7 paths (5–7 commands). All 19 were independently enumerated and executed through `simulateProgram`; every route reaches the exact charger cell without collision.
- Arbitrary paths with repeated loops are not used to size the strip because they create infinitely many sequences. They remain valid when they fit within the finite capacity, and reaching the charger still succeeds immediately and ignores later queued commands.
- The existing fluid strip supports the new 6/9/7 capacities without a device-specific layout branch. Focused Chrome QA fills and executes the longest route on all three boards through visible controls at 360×600 touch and 1280×720 mouse, checks every slot stays in the viewport, verifies 48 px input hit areas, exact charger arrival, final completion, and zero browser/network errors.
- Verification: `npm run typecheck` PASS; `npm run qa:stage8-3e:routes` PASS (19/19 routes); `npm run qa:stage8-3e:layout` PASS (17/17); `npm run build` PASS (54 modules, existing non-blocking chunk-size advisory only); `npm run qa:stage8-3g:routes` PASS.
- Files modified: `src/game/mechanics/programming.ts`, `qa/stage8-3e-route-model.mjs`, `docs/decisions/0006-mission8-grid-programming.md`, `package.json`, and this status document. Files created: `qa/stage8-3g-all-routes-playtest.cjs`, `docs/qa/stage8-3g-all-routes.json`, and six `stage8-3g-*` screenshots. Files moved or deleted: none. Approved production/reference assets were not changed. No commit or push was performed; Mission 9 was not started.

## STAGE 8.3F — MOBILE BUTTON HIT-AREA RECOVERY

- Real-phone feedback that buttons stopped responding was reproduced with a new exhaustive Chrome touch harness. The root cause was a centered custom Phaser hit rectangle added during Stage 8.3E: Container hit areas use local coordinates from 0..width and 0..height, so Missions 1–4 taps were redirected to neighboring/last choices and Mission 5 memory cards could become unreachable.
- TaskCard now enlarges the interactive container itself to at least 48 px and uses Phaser's canonical generated hit area. MemoryTaskCard keeps separate visual dimensions while its interactive container owns the enlarged hit size, preserving layout without misaligned touch coordinates.
- The previously unnamed Missions 1–4 hint control now has the stable hint-button ID so it participates in runtime and automated button audits.
- qa/stage8-3f-mobile-button-playtest.cjs recreates each scene before every tap, converts the target through its actual world transform and canvas DOM rectangle, and verifies the exact object's own pointerdown. Final result: 40 scene/profile cases, 284 individual button/card/port probes, failures: [] at 320×568, 360×600, 390×844, and 844×390. It covers Start, Missions 1–8, and the Mission 5→6 transition; minimum observed hit dimension is 48 px.
- Existing stateful full-flow regression still reaches Missions 1–7 and Mission 8, and its mobile Mission 8 touch route passes. The older fixed-route assertions in that legacy suite are obsolete under Stage 8.3E's open-route model and are not used as Stage 8.3F acceptance evidence.
- A 320×568 StartScene audit found and fixed a title/subtitle stroke overlap by increasing the centralized title gap. Final Start audit: no overlaps, no safe-rect escape, no undersized targets, no browser errors; the updated screenshot was visually inspected.
- Verification: npm run typecheck PASS; npm run build PASS (54 modules; existing non-blocking chunk-size advisory only); Stage 8.3E layout contract 17/17 PASS; exhaustive mobile button audit 284/284 PASS.
- Files created: qa/stage8-3f-mobile-button-playtest.cjs, docs/qa/stage8-3f-mobile-buttons.json, and Stage 8.3F screenshots under docs/qa/screenshots/. Files materially modified: src/game/ui/TaskCard.ts, src/game/ui/MemoryTaskCard.ts, src/game/ui/responsiveLayout.ts, qa/stage8-3e-layout-contract.cjs, package.json, and this status document. Files moved or deleted: none. No commit or push was performed.

## STAGE 8.3E — RESPONSIVE ARCHITECTURE RESET + MISSION 8 OPEN ROUTES

- The active implementation now reads `visualViewport` width, height, offsets, orientation, aspect ratio, inner dimensions, DPR, and CSS safe-area insets through `src/game/ui/viewport.ts`. The app host uses dynamic viewport sizing and follows visual-viewport offsets while retaining Phaser `Scale.RESIZE`.
- `ResponsiveLayout` publishes one `VisibleSafeRect`, semantic gaps, semantic zones (`headerZone`, `gameplayZone`, `controlsZone`, `characterZone`, `modalZone`), and seven width-plus-height modes: short/normal/tall phone portrait, short phone landscape, tablet portrait, tablet landscape, and desktop. Existing broad modes remain compatibility fields only. Shared Missions 1–6, Mission 7, Mission 8, and the Mission 5→6 transition now obtain scene geometry from this module.
- Phone portrait Home and Sound occupy row 1. Mission 6–8 status chips use row 2; Mission 7 and Mission 8 mechanics start below that row. Mission 7 phone removes full-body secondary robots and extends the wire board to the hint row. Short phone landscape has an independent board/control composition.
- Mission 5→6 transition actors are composed directly inside the visible phone safe area at readable `HERO` scale instead of inheriting desktop logical-world coordinates. Mission 8 hides the helper on phone layouts and enlarges the desktop helper.
- Runtime bounds auditing now records actual major-element intersections, safe-rect escapes, undersized touch targets, and semantic character-role readability in the Phaser registry. Modal input blockers prevent gameplay interaction under Mission 7 and Mission 8 completion surfaces.
- Mission 8 uses one canonical pure `simulateGridProgram` result for preview, execution, validation, and QA. Reaching the charger succeeds immediately and ignores remaining queued commands. Stage 8.3E originally used BFS shortest length plus three commands; Stage 8.3G supersedes that remaining capacity restriction with complete simple-route analysis.
- Stage 8.3E pure route QA originally sampled two alternatives per board. Stage 8.3G supersedes that sample with independent enumeration and execution of all 19 simple routes.
- TypeScript `npm run typecheck` PASS after the current architecture and scene changes. Pure layout contract QA `qa/stage8-3e-layout-contract.cjs` PASS with 17 cases: all 15 required viewport sizes plus portrait and landscape iOS safe-area injections. It checks Start title/hero/button spacing, shared card/progress separation, visible ribbon clearance, semantic zones, Mission 7 status/board/hint geometry, Mission 8 board/feedback/arrows/actions geometry, transition robot/button spacing, modal containment, touch sizes, and safe-bottom bounds. The contract caught and drove fixes for the short-phone Start title/Sound collision and tablet/desktop Mission 8 arrow/action collision.
- Full Chrome/Playwright matrix `qa/stage8-3c-mobile-reflow-playtest.cjs` PASS with `failures: []`: 17 viewport profiles × Missions 1–8 = 136 scene cases. It covers 360×600 through 430×932 phone portraits, 740×360 through 932×430 phone landscapes, injected iOS portrait/landscape safe areas, 768×1024 and 1024×768 tablets, and 1280×720/1438×914 desktops. Every case passed viewport, mechanic/control containment, 48 px touch targets, mechanic/robot readability, semantic-overlap audit, safe-rect audit, real touch activation, and console/page/request/response checks.
- Orientation QA PASS: a Mission 8 partial command queue and a Mission 1 selected answer both survived portrait → landscape → portrait scene reconstruction. Touch drag on Mission 7 and tap actions on Missions 1–6/8 passed in the phone profiles.
- Special-state Chrome QA `qa/stage8-3e-special-states.cjs` PASS with `failures: []` at 360×600, 390×844, 844×390, 768×1024, and 1280×720. The transition keeps both robots readable and inside the viewport; Mission 7 completion blocks underlying ports; Mission 8 accepts the alternate `UP RIGHT RIGHT DOWN` route, places the robot on the charger, and reports early success.
- Fresh `stage8-3e-*` evidence was captured for every Mission 1–8 at representative minimum phone, iOS-safe phone portrait/landscape, tablet portrait/landscape, and desktop/wide profiles, plus transition, Mission 7 completion, and Mission 8 alternative-arrival states. Representative captures were visually inspected after the final run; no browser-edge clipping, unintended overlap, microscopic character, or dead mobile control layout remained.
- Final verification on 2026-08-30: `npm run build` PASS (TypeScript clean; 54 modules transformed; existing non-blocking Phaser chunk-size advisory only), pure layout contract 17/17 PASS, pure open-route model PASS, full browser matrix PASS, special states PASS, and `git diff --check` reported only the repository's CRLF normalization warnings. `http://127.0.0.1:4198/` returned HTTP 200; Vite remained bound to `0.0.0.0:4198`, and active connections from LAN client `192.168.0.108` were observed. Same-device URL remains `http://192.168.0.114:4198/`.
- No production/reference asset was modified or replaced. No files were moved or deleted. No commit or push was performed. Mission 9 and Character Art Migration v2 were not started.

## STAGE 8.3C — REAL DEVICE MOBILE REFLOW FOUNDATION

- Added `viewport-fit=cover`, `100dvh` fallback sizing, CSS safe-area insets, and a `visualViewport` bridge that keeps the host and Phaser `Scale.RESIZE` surface aligned to the actually visible browser area rather than nominal `100vh`.
- Visual viewport resize/scroll, window resize, and orientation changes recompute presentation. Scene rebuilds retain canonical session/mechanic state; the Mission 8 orientation round-trip preserved its partially built command route.
- Added width-plus-height classification. Phone portrait publishes compact/regular/tall pressure, and widths below 430 px use compact/ultra behavior below 720 px visible height. No brand, model, or exact-device checks were added.
- Reworked Missions 1–5 phone composition so the task card follows the small Home/Sound header, consumes the main viewport, and leaves a bottom support zone for one readable helper plus a compact assembly station. The prior large assembly panel above the mechanic is removed on phone portrait.
- Mission 6 uses the same mechanic-first portrait contract and combines `СИСТЕМЫ 1/4 • ЭНЕРГИЯ` into the header row. The battery task remains dominant and both reward robots stay readable below it.
- Mission 7 combines `СИСТЕМЫ 2/4 • СОЕДИНЕНИЯ` into the header and gives the wire board nearly the full remaining width/height. Secondary robots are intentionally omitted on phone portrait instead of becoming tiny or reducing the 64 px socket targets.
- Mission 8 combines `СИСТЕМЫ 3/4 • МАРШРУТ N/3` into the header, then budgets visible height in the required board → `ТВОЙ ПУТЬ` → arrows → actions order. The helper is omitted on phone portrait; the board robot remains the primary readable character.
- Added a development-only diagnostic console report and opt-in overlay at `?viewportDebug=1` with inner size, visual viewport size, DPR, canvas CSS size, Phaser size/display scale, and composition mode. It is excluded from production behavior.
- Added `qa/stage8-3c-mobile-reflow-playtest.cjs` and `docs/qa/stage8-3c-mobile-reflow-results.json`. The suite covers Missions 1–8 at 320×568, 360×620, 360×640, 360×740, 390×650, 390×700, 390×844, 412×915, 768×1024, 1280×720, and 1438×914; it audits bounds, touch targets, mechanic/robot readability, console/network errors, and orientation state.
- Final consolidated QA PASS with `failures: []`: all 88 mission/viewport cases passed viewport, mechanic bounds, control bounds, touch-target, mechanic readability, robot readability, real interaction, and console/page/request/response checks. Mission 7 used CDP touch start/move/end and verified the matching wire; orientation preserved Mission 1 selection and the Mission 8 command queue.
- Captured the required Mission 1, 5, 7, and 8 screenshots at 360×640, 390×700, and 390×844, plus Mission 8 at 768×1024 and 1280×720. Captures were visually inspected; gameplay dominates phone layouts without overlap or browser-edge control placement.
- `npm run build` PASS after the expected restricted Windows `spawn EPERM` rerun with approval: TypeScript clean, 53 modules transformed, existing non-blocking Phaser chunk-size advisory only.
- No production artwork or approved reference was changed. No files were moved or deleted. No commit or push was performed. Mission 9 and Character Art Migration v2 were not started.
- Final status remains `WAITING FOR REAL DEVICE REVIEW`; use `http://192.168.0.114:4198/` on the Samsung phone, optionally adding `?viewportDebug=1` while collecting metrics.

## STAGE 8.3B — TARGET REACH + ROBOT SCALE + TOUCH VALIDATION

- Mission 8 challenges now expose one canonical `targetCell`. The charging marker, preview endpoint, execution final position, and success equality all use that same column/row pair. Target cells are explicitly exempt from obstacle classification and success is never inferred from adjacency.
- Preview warnings and execution simulation share the exported command-to-delta mapping. All three approved routes produced a preview endpoint exactly equal to the target center and an execution `robotCell` exactly equal to `targetCell`.
- `ProgrammingBoard` uses fluid cell-derived active-robot sizing and derives a stable vertical offset from the rendered robot bounds, so every move settles the visual center on the destination cell. Wide/tablet active robots are larger; mobile retains a readable contained scale. The Mission 8 landscape helper cap was reduced so the active board robot remains the hero.
- Mission 7 keeps unified Phaser Pointer events and now handles pointer-up-outside, suppresses the active pointer's native gesture, provides at least 64 px source/target hit areas, resolves overlapping hit areas to the nearest eligible target, and clears wrong/empty releases without a ghost wire. Touch/text-selection suppression is scoped to `#app`/canvas instead of the body.
- Dedicated QA: `qa/stage8-3b-target-touch-playtest.cjs` used real Chrome CDP `touchStart`/`touchMove`/`touchEnd` drag input at 390×844 and 768×1024. Wrong target, empty release, active wire following, correct release, completed lock, no ghost, and 64 px hit areas all PASS.
- Mission 8 touch/visual QA PASS at 320×568, 390×844, 768×1024, 1280×720, and 1438×914. Routes 1–3 each PASS exact preview/execution target equality; controls remain tappable; console/page/request/response errors are empty.
- Visual review PASS for the required 13 `docs/qa/screenshots/stage8-3b-*` captures: desktop Route 1 initial/full preview/on-target/close-up; mobile active scale/full preview/on-target; tablet active scale/on-target; Mission 7 mobile/tablet active drag and completed connection.
- Existing `qa/stage8-3-mission8-playtest.cjs` full regression rerun PASS with `failures: []`: five responsive viewports, interaction/safety/audio, real mobile Mission 8 touch, and ordinary Start → Missions 1–8 all passed. Missions 1–6 source was not modified.
- `npm run build` PASS: TypeScript clean, 52 modules transformed, only the existing non-blocking Phaser bundle-size advisory. Canonical QA URL was `http://127.0.0.1:4198/` with strict port binding.
- Files moved or deleted: none. No approved source/reference asset was modified. No commit or push was performed. Mission 9 remains unimplemented.

## STAGE 8.3A — MISSION 8 TUTORIAL + VISIBLE ROUTE PREVIEW

- Reworked only Mission 8 presentation/onboarding; the three approved route definitions and the pure programming mechanic remain unchanged, and Missions 1–7 were not modified.
- The board now gives `СТАРТ` and `ЗАРЯДКА` distinct labeled pads, a persistent start ring, a dominant energy target, and stronger full-cell obstacle treatment.
- Every accepted arrow immediately updates both `ТВОЙ ПУТЬ` and a large on-board planned route made from glowing future cells, thick connectors, directional arrows, and a yellow predicted-endpoint ring. `УДАЛИТЬ` and empty-program cleanup rebuild both views from the same queue.
- Boundary/obstacle commands show a red blocked marker during planning without playing `answer-wrong.wav`; the child remains free to edit. Run is visibly disabled when the queue is empty.
- Route 1 has one lightweight first-action tutorial: the right arrow and first future cell pulse, with `НАЖМИ →, ЧТОБЫ РОБОТ ПОШЁЛ ВПРАВО` plus the short Run instruction. The tutorial is destroyed after the correct first command and is not repeated on Routes 2–3.
- Execution dims the planned route and highlights the current board step and matching command slot while the real robot moves exactly one cell per simulated step. Success keeps the route visible through the charging-pad reward; wrong/collision recovery preserves the program for correction.
- The active board robot now uses cell-derived responsive scale with a larger desktop cap and readable mobile floor. The helper remains recognizable but moves into a compact portrait header position so it cannot cover Home, the board, or controls.
- Mission 8 composition now gives the board more desktop space and keeps `ТВОЙ ПУТЬ`, `СОСТАВЬ ПУТЬ`, arrows, and actions as one compact console. The palette caption has a dedicated band and all actions remain in bounds at 320×568.
- `qa/stage8-3-mission8-playtest.cjs` now verifies tutorial dismissal, marker/label copy, empty Run state, first/full/invalid previews, endpoint state, delete/empty synchronization, execution highlighting, obstacle treatment, robot readability, touch targets, live resize, reduced motion, audio counts, Home interruption, all three routes, and the ordinary Missions 1–8 flow.
- Stage 8.3A QA result: `docs/qa/stage8-3a-mission8-results.json` PASS with `failures: []` at 320×568, 390×844, 768×1024, 1280×720, and 1438×914; console/page/request/response errors are empty.
- Required visual evidence: 12 `docs/qa/screenshots/stage8-3a-*` captures covering desktop initial/first/full/invalid/executing/success, wide full preview, tablet full preview, mobile initial/first/full preview, and minimum playable state. Each capture was visually inspected after generation.
- Full flow: ordinary Start → Missions 1–8 PASS; Routes 1, 2, and 3 PASS; Mission 8 completion PASS; real touch completion at 390×844 PASS.
- Missions 1–7 regression: `qa/stage8-2-mission7-playtest.cjs` rerun PASS with `failures: []` across all five viewports and full Mission 6 → Mission 7 flow.
- Build: `npm run build` PASS (52 modules; only the existing non-blocking Phaser bundle-size advisory). The first sandboxed Vite attempt hit the known Windows `spawn EPERM`; the approved identical rerun passed.
- Canonical URL: `http://127.0.0.1:4198/` returned HTTP 200 and was used for all screenshots and browser QA.
- Files moved or deleted: none. Approved visual assets and robot source assets were not modified. No commit or push was performed. Mission 9 remains unimplemented.

## STAGE 8.3 — MISSION 8: ЗАПРОГРАММИРУЙ РОБОТА

- Mission 7's existing completion card now activates its previously reserved `ПРОДОЛЖИТЬ` control and enters Mission 8 without changing the Mission 7 connection mechanic or composition.
- Added `programmingMechanic` outside Phaser with three deterministic authored routes: a 4×2 straight introduction, a 4×3 turn around one obstacle, and a 5×3 five-command route around two obstacles. The module owns queue limits, pure simulation, ordered execution steps, collision classification, hints, logical position, route progression, interruption recovery, and idempotent completion.
- Added a procedural laboratory test floor with dark-blue tiles, cyan grid lines, start pad, glowing charge target, crate obstacles, and the approved modular second robot at readable board scale. No background, robot, or production asset was modified or replaced.
- Added four large arrow controls, a visible `КОМАНДЫ` strip with route-specific capacity, `УДАЛИТЬ`, `ПОДСКАЗКА`, and `ЗАПУСТИТЬ`. Wrong destinations and collisions keep the command sequence; the robot returns gently to start and becomes editable again.
- Robot movement executes one tile at a time at 330 ms per normal step (95 ms under reduced motion). Editing and Run lock during execution; duplicate Run, duplicate completion, stale tween, Home-during-run, and between-cell persistence are guarded.
- Hints highlight only the next useful neighboring tile and pulse its arrow control. They never insert commands or solve a route. Existing centralized audio provides UI, hint, one correct sound per route, one wrong sound per failed attempt, and one final repair reward.
- Mission completion derives canonical `programmingCompleted` from `completedTasks >= 8`, updates `СИСТЕМЫ 3/4`, activates procedural laboratory navigation lights, and performs a short autonomous forward/return movement on a test strip. The completion copy points toward system verification but Mission 9 is not implemented.
- Live resize retains current route and command queue. An interrupted movement safely resets only the logical robot to the authored start while leaving the queue editable. Home during movement passes with no stale tween or console error.
- Architecture decision: `docs/decisions/0006-mission8-grid-programming.md`.
- Stage 8.3 QA: `qa/stage8-3-mission8-playtest.cjs` PASS with `failures: []`. The responsive matrix passes 320×568, 390×844, 768×1024, 1280×720, and 1438×914; all boards/controls are in bounds, command hit targets pass, and live resize preserves the queue.
- Interaction QA passes empty/too-short and extra-command recovery, wrong destination, obstacle collision, board boundary collision, delete/edit, hint, rapid Run, route transitions, exact route/audio counts, mission completion, lab reactivity, autonomous reward, mute, Home interruption, reduced motion, and zero console/page/request/response errors.
- Real touch completes all three routes at 390×844. The ordinary production flow Start → Missions 1–5 → Mission 6 → Mission 7 → Mission 8 passes at 1280×720 with canonical `completedTasks = 8`, `connectionsCompleted = true`, and `programmingCompleted = true`.
- Missions 1–7 regression: `qa/stage8-2-mission7-playtest.cjs` was rerun after Mission 8 integration and passes with `failures: []` across all five required viewports plus its ordinary Start → Missions 1–7 flow. Its existing result JSON and screenshot evidence were refreshed by that verification run.
- Production build: `npm run build` PASS with TypeScript clean, 52 modules transformed, and only the existing non-blocking Phaser chunk-size advisory.
- Verification evidence: `docs/qa/stage8-3-mission8-results.json` and nine `docs/qa/screenshots/stage8-3-*` captures covering desktop empty/built/executing/success/completion/autonomous states and mobile board/strip/completion states.
- Files moved or deleted: none. Mission 9 remains unimplemented.

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
- `src/game/ui/viewport.ts`
- `qa/stage8-3c-mobile-reflow-playtest.cjs`
- `docs/decisions/0007-real-device-mobile-reflow.md`
- `docs/qa/stage8-3c-mobile-reflow-results.json`
- `docs/qa/stage8-3c-orientation-results.json`
- `docs/qa/stage8-3c-touch-results.json`
- `docs/qa/screenshots/stage8-3c-mission{1,5,7,8}-{360x640,390x700,390x844}.png`
- `docs/qa/screenshots/stage8-3c-mission8-{768x1024,1280x720}.png`
- `docs/qa/screenshots/stage8-3c-mission6-390x700.png` (supplementary visual check)
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

- `index.html`, `src/main.ts`, and `src/style.css` — connect the app shell to the real visual viewport, dynamic viewport units, safe areas, and the dev-only metric surface.
- `src/game/ui/responsiveLayout.ts` — centralizes width-plus-height composition selection, phone task-first geometry, compact support zones, and readable robot framing.
- `src/game/scenes/GameScene.ts`, `src/game/scenes/Mission6Scene.ts`, `src/game/scenes/Mission7Scene.ts`, and `src/game/scenes/Mission8Scene.ts` — apply the Stage 8.3C mission-specific mobile reflows and compact semantic headers while preserving desktop branches.
- `src/game/mechanics/oddOneOut.ts` and `src/game/scenes/StartScene.ts` — preserve/reset Mission 1 selection through the same singleton lifecycle used by later mechanics so orientation reflow cannot discard it.
- `docs/decisions/0001-responsive-layout.md` — records that Decision 0007 amends the original four-mode contract with visual-height pressure.
- `ROBOTLAB-PROJECT-STATUS.md` — records Stage 8.3C implementation, QA, evidence, file inventory, and real-device gate.

- `src/game/mechanics/programming.ts` — defines the canonical walkable `targetCell`, exact equality contract, and shared command delta.
- `src/game/ui/ProgrammingBoard.ts` — uses the canonical target for rendering, fluid active-robot scale, rendered-bounds cell centering, and shared preview deltas.
- `src/game/scenes/Mission8Scene.ts` — reduces only the landscape helper scale through the existing responsive composition.
- `src/game/ui/ConnectionTaskCard.ts` — hardens unified pointer drag/release handling, 64 px hit areas, nearest-target selection, and outside release cleanup.
- `src/style.css` — scopes touch-action and text-selection suppression to the game host/canvas.
- `docs/decisions/0005-mission7-wire-connections.md` and `docs/decisions/0006-mission8-grid-programming.md` — record the Stage 8.3B touch and target/scale contracts.
- `qa/stage8-3b-target-touch-playtest.cjs` — adds exact target, responsive scale/control, CDP touch drag, recovery, lock, ghost-wire, and error assertions.
- `docs/qa/stage8-3b-target-touch-results.json` and 13 `docs/qa/screenshots/stage8-3b-*` files — record the dedicated PASS evidence.
- Existing Stage 8.2/8.3/8.3A QA outputs were refreshed by the required full regression run; no production assets were changed.
- `ROBOTLAB-PROJECT-STATUS.md` — records Stage 8.3B implementation, verification, evidence, and manual-review readiness.

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

- No implementation or automated-QA blocker remains. Final physical-device acceptance belongs to the user's Samsung Android review at `http://192.168.0.114:4198/`.

## GIT

GIT:
INITIALIZED

BASELINE:
`99058509ab5cc7ee2d267f6c5d9178905f2137f2`

BRANCH:
main

## NEXT

Review all three Mission 8 maps on the real Samsung, especially the nine-command Route 2 detour. Mission 9 remains design-only and requires separate authorization.

## LAST VERIFIED

2026-08-31 — Stage 8.3M systemic child UI and interaction correction completed. Tasks 1–4 now use direct answer validation and automatic continuation, removing the repeated answer → Check → Next carousel. The exact rotated 412×180 regression passes ball selection → correct state → Task 2 without a confirm/next button; hidden secondary chrome no longer covers answers. Task 4 short-landscape reference and shadows use comparable 48.75–49.5 px visible extents with 74.75×69.5 interactive answer regions. Tasks 5–8 pass portrait 390×844 and landscape 844×390 browser checks for readable named text, touch targets, canvas sizing, console cleanliness, and layout overlap. The 17-case centralized layout contract, TypeScript check, `git diff --check`, and production build pass (Vite reports only its existing large-chunk advisory).

Stage 8.3M files added: `src/game/ui/childUi.ts`, `qa/stage8-3m-child-ui-flow-playtest.cjs`, `qa/stage8-3m-missions5-8-playtest.cjs`, `docs/qa/stage8-3m-child-ui-flow.json`, `docs/qa/stage8-3m-missions5-8.json`, and `docs/qa/screenshots/stage8-3m-*.png`. Files modified: `src/game/ui/responsiveLayout.ts`, `src/game/ui/TaskCard.ts`, `src/game/ui/MemoryTaskCard.ts`, `src/game/ui/EnergyTaskCard.ts`, `src/game/ui/ConnectionTaskCard.ts`, `src/game/scenes/GameScene.ts`, `src/game/scenes/Mission6Scene.ts`, `src/game/scenes/Mission7Scene.ts`, `src/game/scenes/Mission8Scene.ts`, `src/game/scenes/VictoryScene.ts`, `docs/decisions/0001-responsive-layout.md`, and this status file. No files moved or deleted. No commit or push was performed.

Stage 8.3M character-preservation follow-up: removed the phone-only character suppression from Missions 7 and 8. The helper now reflows into reserved center/edge playfield space in portrait and short landscape while ports, grid cells, command controls, and the board actor remain usable. Repeated orientation lifecycle QA passes six cases over five portrait↔landscape cycles each, including 390×844↔844×390, 412×915↔915×412, and 393×852↔852×393. Mission 7 preserves and redraws the connected wire; Mission 8 preserves commands and rebuilds the route preview; state, listener counts, deterministic portrait geometry, uniform robot scale, and console cleanliness all pass.
