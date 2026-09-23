# Desktop Character Role Matrix

SCENE COMPOSITION DESIGNER artifact.

| Scene | Character | Role | Policy |
|---|---|---|---|
| Mission 1 | assembly envelope / active build presence | ASSEMBLY_ENVELOPE | stable full-body sizing family |
| Mission 2 | assembly envelope / active build presence | ASSEMBLY_ENVELOPE | stable full-body sizing family |
| Mission 3 | assembly envelope / active build presence | ASSEMBLY_ENVELOPE | stable full-body sizing family |
| Mission 4 | assembly envelope / active build presence | ASSEMBLY_ENVELOPE | stable full-body sizing family |
| Mission 5 | completed/released robot presence | WORLD_PRIMARY | `41%` target viewport height |
| Mission 6 | helper | WORLD_PRIMARY | `41%` target viewport height |
| Mission 6 | assembled robot | WORLD_SECONDARY | `39%` target viewport height |
| Mission 7 | active repaired robot | WORLD_SUPPORT | `36%` target viewport height |
| Mission 8 | robot inside board | BOARD_ACTOR | `72%` local cell height |
| Mission 9 | repaired robot | WORLD_PRIMARY | `41%` target viewport height |
| Mission 10 | main world robot | WORLD_PRIMARY | `41%` target viewport height |
| Mission 10 Signal | side repaired robot | WORLD_SUPPORT | `36%` target viewport height |
| Transition | helper + assembled | WORLD_PRIMARY / WORLD_SECONDARY | policy-compensated pair scale |
| Victory | final robot | WORLD_PRIMARY | `41%` target viewport height |
