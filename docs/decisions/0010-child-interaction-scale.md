# Decision 0010: Child interaction scale after scene composition

Date: 2026-09-09

## Status

Implemented; pending final physical Samsung approval.

## Decision

- Child-facing visual size is resolved from the actual composed mechanic rectangle after the Scene Composition Director has assigned scene regions.
- Visible artwork/card bounds and interactive hit bounds are separate contracts. A control can pass touch accessibility while failing child visual readability.
- Short-landscape Mission 2 targets 48–64 px visible sequence objects, 80–110 × 56–72 px answer cards, and 56 px minimum hit targets. Under moderate browser-chrome height pressure, feedback and Hint may share one reserved footer row. When the composed task card falls below 260 px high, Hint moves to the Director-owned support column and the character region starts below it; mechanic and feedback retain exclusive ownership of the task card.
- Short-landscape Mission 5 uses a 4×2 grid with 90–125 × 58–80 px cards where space permits. Existing artwork is fitted from measured non-transparent source bounds.
- Geometry is recomputed only during scene construction/reconstruction after a committed viewport change; no per-frame layout solver is added.
- Shared Missions 1–6 use a Director-owned full-safe-width game surface in phone short landscape. The surface visually contains the top HUD, mechanic card, support action, and character; a nested right support surface separates assistance/character content from the primary mechanic without placing controls directly on scenery.

## Constraints preserved

- Scene Composition Director remains authoritative for semantic region ownership.
- No device-model checks, gameplay changes, route changes, new artwork, or runtime dependencies are introduced.
- Mouse and touch share the existing action boundary.
- Final physical-device acceptance remains a separate user approval step.
