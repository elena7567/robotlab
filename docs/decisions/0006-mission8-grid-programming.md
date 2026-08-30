# Decision 0006: Mission 8 grid programming

## Status

Accepted — Stage 8.3.

## Context

Mission 8 introduces a command-building activity whose educational rules must remain deterministic, serializable, and independent from Phaser presentation. The repaired second robot must execute a visible program one grid cell at a time, while resize, Home, rapid input, collision, and retry paths must not leave stale tweens or contradictory progression state.

## Decision

- `programmingMechanic` owns the three authored route definitions, command queue, command limits, pure simulation, collision classification, logical robot position, route advancement, hint choice, execution lock, and mission-complete state.
- `simulateProgram` is a pure deterministic evaluator. A given challenge and command sequence always produce the same ordered steps, final position, collision, and success result.
- `ProgrammingBoard` renders the laboratory test floor, start/target pads, obstacles, hint tile, approved modular repaired robot, and disposable movement/pulse tweens. It does not decide whether a route succeeds.
- `Mission8Scene` owns responsive composition, input-to-mechanic actions, audio, helper reactions, animation orchestration, laboratory navigation lights, and the autonomous completion reward.
- The command queue stays visible and editable after a wrong destination or collision. A failed run returns the logical robot to the authored start without clearing the queue.
- Viewport resize and Home shut down presentation tweens and call `recoverInterruptedRun`. The queue and current route remain intact; an in-flight robot safely returns to the authored start so it never persists between cells.
- Canonical mission completion remains derived from `completedTasks`; `programmingCompleted` is true when `completedTasks >= 8`. Mission 8 records completion once, activates path lights, and marks the repaired robot as programmed for future Mission 9 presentation.
- The Mission 8 completion action intentionally carries `nextMission = 9` but does not navigate because Mission 9 is outside Stage 8.3.

## Consequences

- No new raster or audio assets are required; the board, pads, obstacles, navigation lights, and test strip use Phaser primitives while the approved modular robot assets remain unchanged.
- Mouse and touch share the same semantic command controls, and command buttons retain at least a 56 px effective target.
- Correct audio fires once per completed route, not per movement step. Wrong audio fires once per finished wrong/collision attempt, and `repair-reward.wav` fires once for Mission 8 completion.
- Reduced motion retains readable stepped movement and feedback with shorter durations.
- Mission 9 can consume the derived programmed state without importing Phaser objects or Mission 8 view state.
