# Decision 0004: Mission 6 energy system and Act II transition

## Status

Accepted for Stage 8.1.

## Context

The five-mission runtime previously treated Mission 5 as final completion and routed directly to `VictoryScene`. Mission 6 begins Act II after the second robot has been assembled but before it has power. The new mechanic must remain deterministic and serializable outside Phaser presentation, use existing approved assets/audio, support mouse and touch, and preserve assembly semantics for Missions 1–5.

## Decision

- Keep `completedTasks` as the single mutable major-progress counter and extend `totalTasks` to 10.
- Continue deriving assembly progress by clamping completed missions to 0–5.
- Derive `powerActivated` from `completedTasks >= 6`; do not store an independent boolean that can contradict progression.
- Route only Mission 5's completed presentation from `VictoryScene` to the assembly milestone `TransitionScene`; its `ПРОДОЛЖИТЬ` action opens the dedicated `Mission6Scene`.
- Keep Mission 6 educational state in `mechanics/energy.ts`; Phaser objects only render snapshots and map pointer actions.
- Use procedural battery shapes because the existing `size-battery.png` communicates object size, not distinct low/medium/full charge fill.
- Use tap-ordering for challenge 3. Tapping an already chosen battery removes it, so children can correct the order before checking with the same large action boundary on touch and mouse.
- Derive repaired-robot and laboratory presentation from canonical power state. Inactive treatment is a cool dim tint; powered treatment restores colour and adds chest, eye, antenna, pulse, and platform-conduit overlays.
- Keep final `VictoryScene` registered but unreachable after Mission 5; it remains reserved for Mission 10.

## Consequences

- Missions 1–5 retain their existing mechanic implementations and assembly reward path, while their overall task labels now correctly use the approved ten-mission total.
- Restarting/resizing Mission 6 reconstructs selection/challenge state from the mechanic snapshot and powered presentation from the session snapshot without replaying completion audio.
- Mission 7 remains out of scope; after Mission 6 completion the powered reward stays visible for review rather than entering an unimplemented scene.
