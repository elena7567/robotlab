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

## Stage 8.2A composition amendment

- Mission 7 presentation uses a centralized responsive composition derived from the four existing layout modes.
- Landscape reserves distinct left, center, and right zones for the helper robot, connection board, and powered robot. The board is centered on the viewport rather than shifted into the remaining space between panels.
- Portrait and tablet modes place the separated robots in a grounded row above the centered board. Ultra-narrow portrait compresses only board spacing; socket visuals retain their size and effective targets remain at least 48 px.
- Robot placement changes only actor position and uniform scale. The helper grounding reset contract, modular robot part layout, shoulder anchors, and arm transforms remain unchanged.
- Home, sound, systems, board, and hint surfaces use explicit responsive gaps so no panels appear attached or compete with the connection workspace.
