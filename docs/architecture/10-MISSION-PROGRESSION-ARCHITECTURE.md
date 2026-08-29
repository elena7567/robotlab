# RobotLab 10-mission progression architecture

## Status and scope

This is the conceptual architecture approved in Stage 8.0. It is not implemented. It extends the locked five-mission baseline without changing current runtime behavior.

## Architectural goals

- One canonical, serializable source of progression truth.
- Educational mechanics independent of Phaser scenes and visual effects.
- Three semantically distinct progress phases rather than a generic 0/10 counter.
- Explicit, guarded transitions that cannot double-complete.
- Save/resume at safe checkpoints without storing renderer objects.
- Derived robot and laboratory presentation from canonical progress.
- Versioned migration and validation for future persisted state.

## Canonical state concept

The brief’s conceptual fields are retained, but overlapping booleans should be exposed as derived selectors rather than stored alongside duplicated counters.

```ts
type MissionId =
  | 'mission-1'
  | 'mission-2'
  | 'mission-3'
  | 'mission-4'
  | 'mission-5'
  | 'mission-6'
  | 'mission-7'
  | 'mission-8'
  | 'mission-9'
  | 'mission-10';

type MissionStatus = 'locked' | 'available' | 'in-progress' | 'completed';

interface RobotLabProgressV2 {
  schemaVersion: 2;
  currentMission: MissionId;
  completedMissions: MissionId[];
  missionProgress: Partial<Record<MissionId, unknown>>;
  checkpointId: 'session-a' | 'session-b' | 'session-c' | 'final';
}
```

`missionProgress` is a discriminated, schema-validated record when mid-mission resume is intentionally supported. If a mechanic is only resumable at its boundary, its transient attempt state is excluded.

The following required product concepts are selectors derived from `completedMissions`:

```ts
interface ProgressSelectors {
  assemblyProgress: 0 | 1 | 2 | 3 | 4 | 5;
  powerActivated: boolean;
  connectionsCompleted: boolean;
  programmingCompleted: boolean;
  diagnosticsCompleted: boolean;
  finalLaunchCompleted: boolean;
}
```

Derivation rules:

- `assemblyProgress` is the count of completed Missions 1–5, clamped to 0–5.
- `powerActivated` is true when Mission 6 is completed.
- `connectionsCompleted` is true when Mission 7 is completed.
- `programmingCompleted` is true when Mission 8 is completed.
- `diagnosticsCompleted` is true when Mission 9 is completed.
- `finalLaunchCompleted` is true when Mission 10 is completed.

This preserves the requested canonical concepts without allowing fields such as `completedMissions` and `powerActivated` to disagree. `currentMission` is validated against the first incomplete legally available mission; it is a resume cursor, not an independent completion claim.

## Semantic phase selectors

```ts
type ProgressPhase = 'assembly' | 'systems' | 'launch' | 'complete';

interface SystemsProgress {
  energy: 'locked' | 'available' | 'complete';
  connections: 'locked' | 'available' | 'complete';
  program: 'locked' | 'available' | 'complete';
  diagnostics: 'locked' | 'available' | 'complete';
}
```

The UI consumes phase-specific views:

- Assembly: installed robot parts and 0/5–5/5.
- Systems: named energy, connections, program, and diagnostics states.
- Launch: current launch step and completion state.

No consumer calculates phase from scene names or sprite visibility.

## Robot lifecycle selector

The second robot’s narrative/presentation state is derived in one place:

```ts
type RobotLifecycleState =
  | 'assembling'
  | 'assembled'
  | 'powered'
  | 'connected'
  | 'programmable'
  | 'verified'
  | 'launched';
```

Precedence is highest completed milestone first: Mission 10 → launched, Mission 9 → verified, Mission 8 → programmable, Mission 7 → connected, Mission 6 → powered, Mission 5 → assembled, otherwise assembling. The renderer maps this state plus assembly parts to approved visuals. It never writes progression.

## Mission registry

Each mission is registered as data and factory boundaries rather than a scene switch statement:

```ts
interface MissionDefinition {
  id: MissionId;
  act: 1 | 2 | 3;
  prerequisite: MissionId | null;
  mechanicId: string;
  checkpointAfter?: boolean;
  presentationRewardId: string;
  requiredAssetIds: readonly string[];
}
```

The registry defines order, prerequisite, mechanic module, content source, reward presentation, and assets. It does not hold mutable session state or scene callbacks. Development validation rejects duplicate IDs, gaps, cycles, absent assets, and prerequisites inconsistent with the approved order.

## Flow controller and transitions

The flow controller owns legal state changes. Scenes send semantic commands and render resulting snapshots/events.

```text
Start / Resume
      ↓
Mission available → Challenge active → Mission reward
      ↑                    │ wrong/hint      │
      └────────────────────┘                 ↓
                                   Phase/act transition?
                                    ↙              ↘
                                  yes               no
                                   ↓                 ↓
                           milestone state      next mission
                                   ↓
                           checkpoint or continue
```

Only a successful mechanic result can request mission completion. The controller:

1. verifies the mission matches `currentMission`;
2. rejects an already-completed mission;
3. records completion atomically;
4. clears or seals transient mission state;
5. emits a single semantic reward event;
6. derives the next phase, checkpoint, and available mission;
7. persists the validated snapshot;
8. permits presentation to transition.

Use an idempotency guard or completion token so repeated taps, tween callbacks, resize restarts, and duplicate events cannot advance twice.

## Major transition map

```text
Missions 1–4
→ assembly reward
→ next assembly mission

Mission 5
→ assembly 5/5
→ robot release presentation
→ РОБОТ СОБРАН! / ТЕПЕРЬ ПОРА ЕГО ОЖИВИТЬ!
→ Mission 6

Mission 6
→ powerActivated
→ ЭНЕРГИЯ ПОДАНА
→ Session B checkpoint / Mission 7

Mission 7
→ connectionsCompleted
→ Mission 8

Mission 8
→ programmingCompleted
→ first controlled steps
→ Mission 9

Mission 9
→ diagnosticsCompleted
→ Session C checkpoint / Mission 10

Mission 10
→ finalLaunchCompleted
→ laboratory door opens
→ true completion / replay choice
```

The current Mission 5 → Victory runtime path is not changed in Stage 8.0. It is replaced only in a future implementation stage when Mission 6 and the new transition destination exist.

## Mechanic boundary

Each mechanic owns deterministic educational rules and serializable attempt state:

```ts
interface MissionMechanic<TState, TAction, TResult> {
  create(contentId: string, difficulty: DifficultyVariant): TState;
  reduce(state: TState, action: TAction): TState;
  evaluate(state: TState): TResult;
  getHint(state: TState, level: HintLevel): HintDescriptor;
}
```

Phaser adapters may animate batteries, wires, robot steps, signals, and launch effects, but these are disposable reactions to state/events. A tween finishing is never the source of educational correctness or saved progress.

For Mission 7, drag and tap gestures map to the same connection action. For Mission 8, command execution is first simulated deterministically; animation consumes the resulting step list. For Mission 10, a launch-flow module coordinates compact steps and stores their completion independently of scene display objects.

## Persistence and resume

Use a versioned persistence service with schema validation and one atomic saved snapshot. The service should:

- save after each major mission and defined launch/checkpoint step;
- validate mission IDs, order, prerequisites, and mission-state schemas;
- ignore unknown presentation fields;
- migrate supported older versions explicitly;
- recover safely from corrupt/partial data;
- never persist sprites, tweens, timers, audio objects, closures, or viewport layout;
- preserve audio/settings separately from game progression.

Recommended resume boundaries are after Missions 3, 6, and 9, plus before/within the final mission where launch steps are explicitly designed to persist. Continuous play uses the same saved snapshots.

An older five-mission completion save requires an explicit product decision during implementation. The safest conceptual migration maps completed Missions 1–5 to `assembled`, sets Mission 6 as current, and shows the assembly milestone recap once. Do not silently mark any Act II mission complete.

## Adaptive difficulty boundary

Adaptation consumes a small rolling performance summary rather than raw renderer events:

```ts
interface AttemptSignals {
  wrongAttempts: number;
  hintsUsed: number;
  solveDurationBand: 'short' | 'typical' | 'long';
  firstTrySuccess: boolean;
}
```

A bounded policy selects a validated authored `DifficultyVariant`. The selection is advisory and can be disabled. It cannot skip missions, revoke completion, generate content, expose a difficulty label, or change canonical story progress. Retain only the minimum local data needed for the next choice.

## Laboratory presentation selector

Laboratory reactions are derived from completed mission milestones:

```ts
interface LaboratoryState {
  monitorActive: boolean;
  blueprintUpdated: boolean;
  platformLightLevel: 0 | 1 | 2 | 3;
  workshopArmActive: boolean;
  assemblyStationActive: boolean;
  energyConduitsActive: boolean;
  systemWireLightsActive: boolean;
  diagnosticPanelsActive: boolean;
  mainDoorOpen: boolean;
}
```

This selector may drive initial scene reconstruction after resize/resume. Transient pulses and movements remain view effects. The main door can be open only when final launch is complete.

## Responsive architecture

Continue the existing pipeline: fixed logical world → responsive camera/framing → centralized fluid sizing → one of four documented composition modes. New mechanic adapters consume layout metrics and must not add model-specific viewport branches.

Mission 7 portrait composition:

- two vertical port rails with a central routing field;
- enlarged invisible hit areas;
- wire rendering clipped to the routing field;
- instructions above and actions below;
- equivalent tap-to-connect path.

Mission 8 portrait composition:

- compact grid above the command program;
- four large arrow actions in a stable control cluster;
- 3–4 visible sequence slots without horizontal scrolling;
- Run below the sequence, never overlaying the board;
- robot/path animation framed inside the grid/world region.

Layout state is reconstructed from canonical mechanic snapshots after resize; resize must not replay answer submission, reward, or progression events.

## Module ownership recommendation

```text
state/
  progressState          canonical versioned snapshot and validation
  progressSelectors      phase, systems, robot, and laboratory derivations
  missionRegistry        immutable mission definitions
  flowController         legal/idempotent transitions
  checkpointPolicy       save/resume boundary selection
  adaptivePolicy         optional bounded variant selection

mechanics/
  energy                 quantity rules and ordering
  connections            port-pair rules
  programming            grid simulation and command queue
  diagnostics            reusable diagnostic tests/orchestrator
  launch                 integrated final sequence

ui/scenes/
  adapters only          layout, input mapping, animation, audio requests
```

Exact filenames are deferred until implementation and should follow the repository’s established conventions.

## Invariants to test

- Completed missions are ordered, unique, and prerequisite-valid.
- Assembly remains 0–5 and depends only on Missions 1–5.
- A system flag cannot be true unless its mission is completed.
- Launch cannot complete unless Missions 1–9 are complete.
- Current mission is the first legal incomplete mission, except within an explicitly persisted launch step.
- One completion command produces at most one progression transition and one reward event.
- Wrong answers and hints never reduce or advance major progress.
- Restore/resize reproduces the same logical state without replaying mutations.
- Renderer state cannot contradict selectors after scene reconstruction.
- Invalid persistence fails closed to a safe, documented state.

## Non-goals

This architecture does not add a backend, accounts, payments, runtime network dependencies, AI difficulty generation, coins, stores, loot boxes, random rewards, or the future robot collection system.
