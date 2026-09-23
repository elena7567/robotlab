# 0015 — Mission 7 Desktop Composition Policy

Date: 2026-09-13
Status: Approved for manual desktop review

## Decision

Mission 7 keeps the accepted phone/tablet portrait gameplay and phone/tablet landscape orientation gate, but desktop landscape is playable and uses a dedicated composition policy.

Desktop Mission 7 is not a scaled copy of the phone portrait layout. The wire panel is bounded, centered around the laboratory platform, and paired with the repaired robot as a supporting character on the right. The Hint control belongs to the wire task and sits below the panel instead of in a remote support column.

## Desktop Composition Rules

- Allow Mission 7 gameplay on `DESKTOP` semantic mode even when the viewport is landscape.
- Keep non-desktop landscape in the existing portrait-orientation gate.
- Anchor the desktop composition to the visible laboratory platform center and contact plane.
- Bound the wire panel width so it does not expand with wide desktop viewports.
- Bring terminal columns closer together on wide panels to shorten wire travel.
- Keep terminal visible rings and hit areas child-readable.
- Use compact top status on desktop so gameplay hierarchy dominates.
- Keep the supporting robot readable, to the right of the panel, grounded near the platform/contact plane, and smaller than the wire task.

## Verification

Verified with production preview on `0.0.0.0:4198` and focused Playwright QA:

- `npm run typecheck` PASS.
- `npm run build` PASS with the existing Vite chunk-size advisory only.
- `npm run review` PASS; production preview reused and left running, HMR absent.
- `qa/mission7-desktop-fast-check.cjs` PASS: 44 checks across 1280x720, 1438x914, 1600x900, and 1920x1080, including desktop composition, terminal sizing/spacing, panel/platform alignment, hint attachment, robot readability/grounding, and mouse miss/wrong/correct/duplicate input behavior.
- `qa/mission7-mobile-regression-fast-check.cjs` PASS: 390x844 and 412x915 portrait gameplay, 844x390 landscape orientation gate.

## Notes

The original monolithic screenshot QA script generated the required desktop screenshots but was split into smaller focused scripts after it hung in the multi-viewport matrix. Screenshot evidence remains under `docs/qa/screenshots/mission7-*.png`.