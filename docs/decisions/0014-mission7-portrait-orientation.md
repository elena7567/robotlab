# Decision 0014: Mission 7 portrait gameplay orientation

Date: 2026-09-13
Status: Approved for manual review

Mission 7 wire connection gameplay is portrait-first on phones and tablets. Landscape viewports render the existing RobotLab animated orientation gate with the child-facing copy `ПОВЕРНИ ТЕЛЕФОН` / `ИГРАЕМ ВЕРТИКАЛЬНО` and do not render the connection task card, terminals, Hint, or gameplay input as active content.

The Mission 7 gate uses the shared RobotLab orientation infrastructure. Its Mission 7 animation direction is landscape phone -> portrait phone. No new orientation system was introduced.

The product reason is child usability: the colored terminal connection mechanic benefits from vertical space, larger separation between red/green/blue/yellow terminals, easier touch targeting, and clearer wire paths.

Canonical progress remains in `connectionsMechanic` and `sessionState`. Rotating from portrait gameplay to landscape cancels active drag through scene teardown/rebuild, shows the gate, and rotating back to portrait reconstructs Mission 7 from the preserved mechanic state without restarting completed connections.

Direct QA entry `?qaMission=7` starts Mission 7 from the same session checkpoint as completed Mission 6. Portrait opens gameplay. Landscape opens the orientation gate and waits for portrait.

Verification evidence: `docs/qa/mission7-orientation-review.json` and `docs/qa/screenshots/mission7-orientation-*.png`.