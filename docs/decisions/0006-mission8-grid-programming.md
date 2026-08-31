# Decision 0006: Mission 8 grid programming

## Status

Amended — Stage 8.3G complete simple-route model.

## Context

Mission 8 introduces a command-building activity whose educational rules must remain deterministic, serializable, and independent from Phaser presentation. The repaired second robot must execute a visible program one grid cell at a time, while resize, Home, rapid input, collision, and retry paths must not leave stale tweens or contradictory progression state.

## Decision

- `programmingMechanic` owns the three authored boards, command queue, route-space-derived command capacities, pure simulation, collision classification, logical robot position, route advancement, next-move hint choice, execution lock, and mission-complete state.
- Each challenge owns one canonical `targetCell`. Simulation success requires exact column and row equality with it, obstacle classification explicitly preserves it as walkable, and the board reads the same object for the charging marker.
- `simulateGridProgram` is the single pure deterministic movement evaluator used by preview, execution, validation, and QA. A legal route succeeds whenever it reaches `targetCell`; no expected command array is compared. Arrival is immediate success and remaining queued commands are ignored.
- BFS is used only to calculate shortest path length and the next useful hint from the child's current planned endpoint. A separate renderer-independent depth-first analysis counts every legal simple route (a route that does not revisit a cell) and finds its longest length. Each board capacity equals `longestSimplePathLength`, so every geometrically distinct non-repeating route can be entered; arbitrary repeated loops are not used to define capacity because they form an infinite command set. Looped programs that fit within the finite capacity remain valid simulator input.
- `ProgrammingBoard` renders the laboratory test floor, start/target pads and labels, blocked-cell treatment, hint/tutorial tiles, approved modular repaired robot, planned-route preview, predicted endpoint, invalid marker, and disposable movement/pulse tweens. It receives the pure `simulateProgram` result and does not decide whether a route succeeds.
- `Mission8Scene` owns responsive composition, input-to-mechanic actions, audio, helper reactions, animation orchestration, laboratory navigation lights, and the autonomous completion reward.
- The command queue stays visible and editable after a wrong destination or collision. A failed run returns the logical robot to the authored start without clearing the queue.
- The scene refreshes the command strip and board preview from the same serialized command queue after every add/delete and after failed execution. During execution the preview dims, while the current program slot and board step are highlighted from the same ordered `ProgrammingStep` index.
- Route 1 owns one transient first-action tutorial. It highlights the authored first useful tile and matching arrow, then fully removes its tween and overlay after the first correct command. Routes 2 and 3 do not recreate it.
- Viewport resize and Home shut down presentation tweens and call `recoverInterruptedRun`. The queue and current route remain intact; an in-flight robot safely returns to the authored start so it never persists between cells.
- Canonical mission completion remains derived from `completedTasks`; `programmingCompleted` is true when `completedTasks >= 8`. Mission 8 records completion once, activates path lights, and marks the repaired robot as programmed for future Mission 9 presentation.
- The Mission 8 completion action intentionally carries `nextMission = 9` but does not navigate because Mission 9 is outside Stage 8.3.

## Consequences

- No new raster or audio assets are required; the board, pads, obstacles, navigation lights, and test strip use Phaser primitives while the approved modular robot assets remain unchanged.
- Planned invalid segments are warning-only presentation during composition: they do not mutate mechanic state and do not emit wrong-answer audio until the child actually runs the program.
- Mouse and touch share the same semantic command controls. Phone arrow and action controls retain finger-sized hit targets, and command strips fit the actual longest simple-route capacity without clipping.
- The authored boards contain 6, 6, and 7 simple routes. Their shortest/longest lengths are 2/6, 3/9, and 5/7 commands; QA independently enumerates and executes all 19 routes against the canonical simulator.
- Preview warning direction and simulation movement share the exported command-to-delta function. The active board robot uses a fluid cell-derived scale and aligns its rendered bounds to every logical cell center; the landscape helper is capped below the active robot's visual weight.
- Correct audio fires once per completed route, not per movement step. Wrong audio fires once per finished wrong/collision attempt, and `repair-reward.wav` fires once for Mission 8 completion.
- Reduced motion retains readable stepped movement and feedback with shorter durations.
- Mission 9 can consume the derived programmed state without importing Phaser objects or Mission 8 view state.
