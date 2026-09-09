# Decision 0009: Scene Composition Director

Date: 2026-09-09

## Status

Approved for Stage 8.4A review.

## Context

Stage 8.4 completed the Robot v2 art migration, but scene composition was still split across responsive layout helpers, individual Phaser scenes, and component-local sizing. That made Mission 7, Mission 8, and the Mission 5 transition hard to reason about as one product surface across phone portrait, short landscape, tablet, and desktop.

## Decision

Add `sceneCompositionDirector.ts` as a pure downstream composition policy layer. It consumes the existing `ResponsiveLayout` and returns semantic regions, component size contracts, character roles, whitespace allocation, and mission-specific layout payloads.

`responsiveLayout.ts` remains responsible for viewport classification, safe areas, and shared layout primitives. Scene-specific compatibility wrappers now delegate to the Director so existing Stage 8.3 QA can continue to exercise the older public API.

## Character Policy

- Missions 1-6 keep the existing task-first flow, with character roles declared as primary, supporting, or hidden for mechanic focus.
- Mission 7 phone portrait is board-focused and hides full-body robots to protect the wire mechanic. Non-portrait Mission 7 reserves a bounded support region for the repaired robot and hint action.
- Mission 8 uses only the board robot as the active actor. The non-participating helper remains hidden by policy.
- Transition composition uses the existing Robot v2 production assets and static visible-alpha bounds for tighter screen placement where needed.

## Verification

Stage 8.4A adds a pure contract suite and a browser playtest suite:

- `qa/stage8-4a-composition-contract.cjs`
- `qa/stage8-4a-scene-composition-playtest.cjs`

No production artwork was generated, downloaded, or replaced.
