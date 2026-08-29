# RobotLab second-half development plan

## Purpose and constraints

This plan covers the future implementation of Missions 6–10. Stage 8.0 creates no runtime behavior.

Before implementation begins:

- treat Missions 1–5 as a locked regression baseline;
- preserve all approved assets and references;
- request or identify production assets before work that depends on them;
- report `MISSING_ASSET` by stable asset ID when a required asset is unavailable;
- do not substitute production art with an unapproved placeholder;
- keep educational rules and serializable state outside Phaser scenes;
- preserve one canonical source of progression truth;
- support mouse and touch from the same semantic actions;
- verify every stage across the five canonical viewport targets.

## Recommended implementation order

### 1. Progression foundation and Mission 5 transition seam

Build the versioned progression model, mission registry, legal transition controller, checkpoint persistence boundary, and derived robot/laboratory presentation selectors before adding a new mechanic. Add the future `РОБОТ СОБРАН!` transition as a guarded seam only when Mission 6 is ready to receive it; until then the locked five-mission runtime remains intact.

Exit criteria:

- existing Missions 1–5 still pass unchanged;
- assembly remains derived and displays 0/5–5/5;
- a restored save resolves to one legal next mission;
- no Phaser object is stored in canonical state;
- old or invalid saves fail safely to a defined migration/reset path.

### 2. Mission 6 — Заряди робота

Implement quantity comparison first because it introduces the Act II state and system-progress UI while using familiar select/order interaction patterns. Separate battery question data and evaluation from presentation. Add power activation, the first system-status marker, helper lines, and energy-conduit reaction only when approved assets are available.

Suggested vertical slice:

1. fullest selection;
2. emptiest selection;
3. empty-to-full ordering;
4. power activation reward;
5. checkpoint save/resume after Mission 6.

Exit criteria:

- all authored variants validate;
- selection and ordering work with mouse and touch;
- wrong answers are non-punitive and do not advance progress;
- Mission 6 completion atomically records energy activation;
- portrait layouts remain usable at 320×568 and 390×844;
- full flow from Mission 5 transition to Mission 7 entry passes.

### 3. Mission 7 — Подключи провода

Implement a reusable port-connection mechanic with semantic `selectSource`, `connect`, and `cancel` actions. Drag/trace is a presentation gesture, not the rule boundary; tap-source/tap-destination must produce the same command. Pair color with shape/symbol so recognition is not color-only.

Start with aligned ports, then add crossed layouts from validated content. Wire paths and pulses are disposable view effects derived from completed connections.

Exit criteria:

- drag and tap alternatives share one evaluator;
- pointer capture cannot become stranded after resize or scene shutdown;
- every port has a minimum 44×44 CSS-pixel hit target;
- wires remain legible without covering instructions or controls;
- completion records connections once and only once;
- portrait, touch, and crossed-position rounds pass.

### 4. Mission 8 — Запрограммируй робота

Implement the signature programming mechanic after the drag interaction foundation is stable. Keep grid/world state, command queue, simulation, and result evaluation in a deterministic module. The Phaser scene renders snapshots and movement; it does not determine whether the route succeeds.

Build in increments:

1. command selection and removal;
2. deterministic preview/simulation without animation;
3. run animation driven by simulation steps;
4. gentle failure/reset and visual hint;
5. movement-system reward and first controlled robot steps.

Exit criteria:

- the same command sequence always produces the same result;
- input is locked only during execution and safely restored afterward;
- repeated Run taps cannot duplicate transitions;
- resize/restart restores the logical state without replaying completion;
- 3–4 command slots remain fully visible in portrait;
- mouse/touch full flows and cause/effect readability pass.

### 5. Mission 9 — Проверь системы

Create a diagnostic orchestrator that composes small reusable tests instead of one large scene-specific mechanic. Ship a deliberately small approved subset first—recommended visual signal response, two-step light sequence, and subsystem identification. Any sound recognition task must have a visual-equivalent path and respect mute/autoplay constraints.

Exit criteria:

- diagnostic selection comes from validated authored data;
- response windows are generous and never punitive;
- audio is not the sole carrier of required information;
- energy, connections, program, and diagnostics statuses agree with canonical state;
- completion marks the robot launch-ready once;
- resume begins at the correct incomplete diagnostic or defined mission boundary.

### 6. Mission 10 — Первый запуск

Build the finale only after Missions 6–9 and their state transitions are stable. Compose compact callbacks through a launch-flow controller rather than directly embedding previous mechanic instances. Each completed launch step is retained. The main door opening and two-robot celebration are the final presentation of `finalLaunchCompleted`, not the state mutation itself.

Recommended launch sequence:

1. tool selection;
2. energy selection;
3. remember two symbols;
4. short command route;
5. explicit launch action.

Exit criteria:

- the finale feels continuous and goal-directed;
- no completed launch step is lost after a wrong answer;
- duplicate input cannot double-complete launch;
- final language is reserved for true completion;
- final door/celebration and replay/resume behavior pass at all canonical sizes;
- full Missions 1–10 regression passes on desktop and touch mobile.

### 7. Start screen, session polish, and complete regression

After the ten-mission loop is proven, replace obsolete five-task copy with the approved premise, finish checkpoint selection/recap presentation, tune adaptive hints, and run a complete accessibility, audio, performance, persistence, and responsive review.

## Cross-cutting workstreams

### Content and validation

Give every mission, challenge, answer, hint, command layout, and required asset a stable ID. Validate duplicates, missing correct answers, unsupported fill levels, unreachable programming targets, duplicate port matches, missing asset IDs, and developmentally unsuitable ambiguity before runtime mounting.

### Asset readiness

Create an asset inventory per mission before implementation. Likely new production needs include battery states, ports/wire endpoints, command/grid symbols, diagnostic indicators, power/system effects, and a laboratory door sequence. Assets remain behind stable manifest IDs. If any required item lacks approval, stop dependent visual implementation and report `MISSING_ASSET`.

### Audio

Extend the centralized audio manifest/manager only. Plan semantic cues for charge, connection, command step/run, diagnostics, launch, and milestone music. Prevent overlap, honor mute, require no audio-only answer, and verify user-gesture unlock.

### Adaptive hints

Add instrumentation after each mechanic works deterministically. Record only the bounded signals needed for local difficulty selection. First ship standard authored progression; enable adaptation behind a policy boundary after QA proves both simpler and harder variants.

### QA strategy

For every mission, test:

- initial, selected/dragging/queued, wrong, hint, correct, reward, and transition states;
- rapid repeated input and input during transitions;
- scene shutdown, resize, Home, replay, and resume;
- mouse and touch action parity;
- 320×568, 390×844, 768×1024, 1280×720, and 1438×914;
- console, page, request, response, and missing-asset errors;
- locked Missions 1–5 regression.

Compilation is necessary but not sufficient for a mission-stage PASS.

## Recommended stage boundaries

| Future stage | Deliverable | Dependency |
|---|---|---|
| 8.1 | Progression/persistence foundation and transition seam | Approved Stage 8.0 design |
| 8.2 | Mission 6 complete | Foundation; approved energy assets |
| 8.3 | Mission 7 complete | Foundation; approved connection assets |
| 8.4 | Mission 8 complete | Foundation; approved grid/command assets |
| 8.5 | Mission 9 complete | Missions 6–8 system states; diagnostic assets/audio |
| 8.6 | Mission 10 complete | Stable Missions 6–9; finale assets |
| 8.7 | Start/checkpoint/adaptation polish and 1–10 regression | Complete ten-mission loop |

Each stage must update `ROBOTLAB-PROJECT-STATUS.md` with exact file changes, verification commands/results, unresolved assets, and whether runtime scope remained within the approved stage.
