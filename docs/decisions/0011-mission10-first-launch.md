# Decision 0011: Mission 10 — First Launch

Status: Ready for Gold Master physical review; physical Samsung acceptance pending

Date: 2026-09-12

## Decision

Mission 10 is the final playable mission and the only route to the true game victory. Its canonical serializable flow is:

`INTRO -> PATH -> ENERGY -> SIGNAL -> LAUNCH -> FINALE -> COMPLETE`

The mission uses four child-readable gameplay beats:

1. choose the semantically safe route in three rounds;
2. rotate three energy relays until the source-to-receiver chain is continuous;
3. rotate two or three signal reflectors to create an orthogonal emitter-to-receiver path;
4. launch the beacon only after all three prerequisite systems are ready.

Wrong answers preserve progress, give soft feedback, and do not create punishment or fail states. Mouse and touch share the same action boundary. Educational state and solution rules remain outside Phaser scenes.

## Presentation strategy

Mission 10 uses a hybrid implementation:

- directly use the approved RobotLab laboratory, repaired robot, route, beacon, launch-console, and active-finale artwork;
- implement dynamic energy links, signal beams, selection states, focus states, particles, and finale timing in Phaser;
- do not render reference screenshots as interactive UI;
- keep the existing centralized responsive composition, portrait orientation gate, and 320 px minimum-width support.

The final beacon launch uses a dedicated non-looping launch effect followed by a dedicated non-looping victory theme. Leaving or restarting the finale stops Mission 10 audio.

## Victory ownership

Mission 9 completion now hands off to Mission 10. `VictoryScene` is reserved for Mission 10 completion and represents completion of the full ten-mission game.

## QA contract

Automated acceptance requires:

- deterministic core-mechanics tests;
- complete Mission 10 mouse and touch progression;
- safe wrong-answer, duplicate-input, and locked-transition behavior;
- desktop, short-landscape, tablet, portrait-gate, and wide-desktop checks;
- clean console, page, request, and response error logs;
- production-preview verification at the canonical strict port `4198`.

Physical Samsung acceptance remains a separate user-owned gate and must not be inferred from emulation.
