# Technical Director Character Scale Review

TECHNICAL DIRECTOR artifact.

| Area | Finding | Decision |
|---|---|---|
| Scale ownership | Desktop scale numbers existed in scene composition and scenes. | Canonical policy now owns desktop character ratios. |
| Character root | `RobotActor` and `RobotAssemblyPreview` apply root scale. | Preserve root ownership. |
| Parent scale | Mission 6, transition, and GameScene use camera-scaled parents. | Policy accepts `parentScale` for compensation. |
| Board actor | Mission 8 robot is inside a local grid cell. | Allowlist as `BOARD_ACTOR`. |
| Mobile | Existing custom mobile sizing is accepted. | Desktop policy gated to desktop branches only. |
