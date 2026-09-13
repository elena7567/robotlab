# Decision 0013: Mission 7 landscape-only mobile/tablet play

Date: 2026-09-13
Status: Superseded on 2026-09-13 by Decision 0014

SUPERSEDED: Mission 7 wire connection gameplay was temporarily treated as landscape-only on phones and tablets. Portrait viewports render the existing RobotLab orientation gate with the child-facing copy `ПОВЕРНИ ТЕЛЕФОН` / `ИГРАЕМ ГОРИЗОНТАЛЬНО` and do not render the connection task card or wire ports as playable content.

The orientation gate is presentation-only. Mission 7 continues to preserve canonical `connectionsMechanic` and `sessionState` progress through the existing centralized VisualViewport/restart lifecycle. Rotating back to landscape reconstructs the scene from the existing mechanic state rather than creating an orientation-specific progress store.

Direct QA entry `?qaMission=7` starts Mission 7 from the same session checkpoint as a completed Mission 6: power is activated, connections are not yet completed, and the connection mechanic is reset for review.

Verification evidence: `docs/qa/mission7-orientation-review.json` and `docs/qa/screenshots/mission7-orientation-*.png`.