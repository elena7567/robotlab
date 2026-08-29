# Decision 0003: Temporary assembly station and final robot release

## Status

Accepted for Stage 7.1B.2 manual visual review.

## Decision

The assembly station is a temporary reward surface for progress states 0/5 through 4/5. It uses a wide repair-bay card with an approximately 1.32:1 width-to-height ratio, a dark-blue interior, restrained cyan technical accents, and a faint blueprint silhouette behind installed full-colour parts.

The existing four responsive composition modes remain canonical. Landscape places the station on the right with an additional fluid edge inset. Phone portrait modes stack a compact station above the task card with ribbon clearance. Large portrait/tablet mode places the station beside the task card. No device-specific viewport checks are introduced.

At 5/5, the antenna install and activation complete inside the station. The station then fades away while the repaired robot moves into the logical world beside the helper robot. Both robots use the same logical platform contact and remain independently grounded. VictoryScene continues the same two-active-robot result without an assembly frame.

## Consequences

- Assembly progress remains derived from the canonical completed-task count.
- Educational mechanics, answer evaluation, audio ownership, controls, and task sequencing are unchanged.
- The final gameplay state now has an explicit released robot and hidden station before the VictoryScene transition.
- Responsive QA must verify station/task/helper separation at all five canonical viewports and full release flows on desktop and touch mobile.
