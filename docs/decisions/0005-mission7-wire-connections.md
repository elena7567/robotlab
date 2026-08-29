# Decision 0005: Mission 7 wire connections

## Status

Accepted — Stage 8.2.

## Context

Mission 7 must add a touch-first color-port connection activity after Mission 6 without putting educational rules in a Phaser scene or introducing production art. Correct wires must persist through challenge progress and viewport resize, while incomplete pointer gestures must never become stale.

## Decision

- `connectionsMechanic` owns the three challenge definitions, randomized destination order, completed color pairs, challenge advancement, and final completion state.
- `ConnectionTaskCard` converts one active pointer trace into the mechanic's `connect` or neutral cancel action. It owns disposable curved Graphics wires, generous port hit areas, hint pulses, and completion pulses.
- `Mission7Scene` owns scene composition, audio dispatch, helper reactions, laboratory conduit feedback, and the final pulse transfer to the powered second robot.
- Canonical mission completion remains derived from `completedTasks`; `connectionsCompleted` is true when `completedTasks >= 7`.
- Viewport resize restarts only the disposable Phaser presentation. The mechanic snapshot retains destination order and completed pairs, so resize does not reset play.
- Mission 6 exposes a guarded post-reward continuation into Mission 7. Mission 8 remains unimplemented.

## Consequences

- No bitmap wire or port assets are required.
- Correct, wrong, empty-release, hint, duplicate, simultaneous-pointer, and resize behavior share one rule boundary.
- The existing robot geometry and approved laboratory background remain immutable; systems lights and conduit activity are procedural overlays.
