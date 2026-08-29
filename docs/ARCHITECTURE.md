# Runtime architecture

## Principles

- Phaser scenes are lifecycle and presentation adapters, not the source of truth for educational rules.
- Serializable state lives in systems/models outside display objects.
- Each mechanic implements a shared contract and consumes validated question data.
- Asset IDs are stable manifest keys; file paths remain an integration detail.
- Mouse and touch are mapped into the same semantic actions.
- Canvas owns the animated playfield; restrained DOM UI may own browser shell and accessibility-sensitive controls.

## Planned scenes

| Scene | Responsibility | Must not own |
|---|---|---|
| Boot | Minimal runtime setup, scale/input configuration, choose next scene | Question content or progression rules |
| Preload | Load/validate manifest assets and show an accessible load state | Gameplay decisions |
| Start | Title, play action, sound setting | Session task logic |
| Intro | Establish that the robot needs repair and initialize session presentation | Mechanic implementations |
| Task | Host the selected mechanic adapter and reflect mechanic/system state | Five hard-coded mechanic branches in one giant scene |
| Transition | Show a completed task restoring one robot module and advance flow | Permanent progression as sprite flags |
| Victory | Present full activation and celebration at 5/5 | Result persistence rules |
| Results | Positive completion summary and replay action | Mutating old-session renderer objects |

`Intro` may be a small dedicated scene or a declared substate coordinated by the flow controller; this choice is finalized in Stage 1 without changing the public state flow.

## State flow

```text
Boot → Preload → Start → Intro
                         ↓
                    Task[index]
                         ↓ correct
                 Repair Transition
                    ↙          ↘
             index < 4        progress = 5
                 ↓                 ↓
            next Task           Victory
                                    ↓
                                  Results
                                    ↓ replay
                                  Intro
```

Wrong answers remain inside the current mechanic attempt and emit gentle feedback. They do not decrement progress or change scenes. The flow controller guards against repeated completion signals and owns the finite five-task sequence.

## Module boundaries

### State and systems

- `SessionState`: serializable current run and repair progress.
- `FlowController`: legal transitions and finite-loop guards.
- `ProgressionSystem`: maps completed task count to repair stage/module IDs.
- `InputRouter`: translates mouse/touch/optional keyboard into semantic actions.
- `AudioSystem`: local playback, mixing, mute preference, lifecycle handling.
- `PersistenceService`: versioned, validated optional local settings only.
- `AssetRegistry`: typed stable IDs mapped to local files and metadata.

Systems expose state/events without retaining Phaser sprites, tweens, scenes, or audio objects.

### Mechanics

Each educational mechanic follows a reusable lifecycle such as:

```ts
interface MechanicModule<TQuestion, TAnswer> {
  mount(context: MechanicContext, question: TQuestion): void;
  submit(answer: TAnswer): MechanicResult;
  resetAttempt(): void;
  dispose(): void;
}
```

The final interface may evolve in Stage 1, but all implementations must support deterministic setup, normalized results, cleanup, and independence from progression.

### Data-driven content

Preferred composition:

```text
mechanic definition
        +
validated level/question data
        +
stable visual/audio asset IDs
        =
runtime task instance
```

Question data carries IDs, prompt intent, choices/order, correct-answer data, difficulty metadata, and required asset IDs. It does not contain scene callbacks. Schema validation should catch duplicate IDs, missing answers, invalid counts, and unavailable asset references during development.

## Event boundary

Scenes render snapshots and translate input into mechanic/system commands. Modules emit normalized events such as `attempt:incorrect`, `task:completed`, `transition:finished`, and `session:completed`. Only the flow/progression systems may advance the task index or repair count.

## Cleanup and reliability

- Scene shutdown disposes subscriptions, timers, tweens, drag handlers, and transient audio.
- Navigation is idempotent and rejects duplicate completion taps.
- Replay creates fresh session state and reuses immutable loaded resources.
- Debug logging and performance probes are development-only and removable from production builds.

## Responsive rendering architecture

The gameplay world has immutable logical bounds of `1280×720`. Background and actor children retain logical coordinates inside dedicated world containers; the robot remains at platform X `640`, contact Y `560`, origin `(0.5, 1)`, and canonical scale `0.2520718` as defined by `robotGrounding.ts`.

The rendering pipeline is:

```text
fixed 1280×720 logical world
        ↓
Phaser Scale.RESIZE display surface
        ↓
responsiveCamera world-container framing
        ↓
responsiveLayout four-mode composition
        ↓
TaskCard / ProgressPanel / RobotDialogue / controls consume fluid metrics
```

`Scale.RESIZE` is intentional: it provides a full-container canvas and 1:1 CSS-pixel-equivalent HUD measurements at extreme portrait and short-landscape aspect ratios. It does not stretch actors or the background; the centralized framing helper applies one uniform world scale and offset. Recalculation occurs only during initial scene layout and the existing resize event restart, never per frame.

`fluidSizing.ts` owns clamp/interpolation primitives. `responsiveLayout.ts` owns safe margins, typography, spacing, panel/control sizes, and the only four composition modes. `responsiveCamera.ts` owns world framing. Components may consume those values but must not introduce device-specific viewport branches.

## Robot presentation and animation

`StartScene` and `GameScene` intentionally use different robot presentations. `StartScene` uses the approved `robot-complete` sprite as a stable hero image with only a reduced-motion-aware whole-sprite idle. `GameScene` uses `RobotActor`, a Phaser Container assembled from the seven stable robot-part asset IDs.

`RobotActor` owns the renderer-facing `IDLE`, `THINKING`, `WRONG`, `CORRECT`, `HINT`, and `CELEBRATE` states. It captures immutable base transforms for every part, permits one reaction at a time, restores the canonical transform before returning to idle, and schedules lightweight micro-reactions without an update loop. `robotGrounding.ts` remains the placement boundary: the actor container stays at logical platform contact `(640, 560)` with canonical scale `0.2520718`.

Repair energy is derived from completed-task count through `repairProgression.ts`; sprites and tweens are not progression truth. `RepairReward.ts` is a disposable view helper. `GameScene` may cancel that visual coroutine when it shuts down, while session progression remains synchronous and independent of tween lifetime.
