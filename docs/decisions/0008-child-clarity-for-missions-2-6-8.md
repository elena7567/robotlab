# Decision 0008: Child clarity for Missions 2, 6, and 8

Date: 2026-08-31

## Status

Accepted by direct user review feedback.

## Decision

- Mission 2 uses a task-first landscape card up to 540 px wide, instead of the former 360 px side column, and hides the secondary assembly panel in phone landscape. Its sequence and answer artwork receive the larger content area. Sequence progress stays in the ribbon and robot speech is suppressed in phone landscape, so transient feedback remains short and cannot cover answer choices or controls.
- Mission 6 draws selection emphasis on a dedicated cleared graphics layer. A wrong answer therefore leaves no persistent selection outline before the child tries again.
- Mission 8 shows only the robot that actually traverses the programming grid during route play. The separate non-participating helper robot is not rendered in this mission.

## Constraints preserved

- No production artwork is replaced or modified.
- Educational state remains in the existing serializable mechanics.
- Mouse and touch continue through the same controls.
- Responsive composition remains centralized and supports the 320 px minimum width.
