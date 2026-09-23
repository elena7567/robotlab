# Desktop Character Scale Inventory

Read-only audit before migration.

| Area | Current Owner | Decision |
|---|---|---|
| Mission 6 | `actorScale = 0.19` in `sceneCompositionDirector`; scene applies `mission6Layout.*.scale` under camera-scaled actor parent | replaced desktop value with canonical policy using parent-scale compensation |
| Mission 7 | `repairedVisibleHeight` and `repairedScale` in `composeMission7` | replaced desktop value with `WORLD_SUPPORT` |
| Mission 8 | `ProgrammingBoard` fits robot to local cell | allowlisted as `BOARD_ACTOR`, not a world character |
| Mission 9 | `robotVisibleHeight`, `robotScale`, and scene-level fit cap | desktop migrated to `WORLD_PRIMARY`; mobile fit protection retained |
| Mission 10 | `robotVisibleHeight`, stage intro/signal robot heights, and `robotScale` | desktop full-size world values migrated to policy; phone/tablet branches retained |
| Transition | `pairScale` | desktop pair migrated to policy-compensated assembled secondary scale |
| Victory | scene-local `robotHeight` scale calculation | desktop final robot migrated to `WORLD_PRIMARY`; portrait fit retained |
| GameScene Missions 1-5 | `ROBOT_PLATFORM_SCALE`, camera parent scale, and Mission 5 release `pairScale` | desktop callers migrated to `ASSEMBLY_ENVELOPE`; mobile behavior preserved |

Direct arbitrary desktop mission character scale owners before migration: Mission 6, Mission 7, Mission 9, Mission 10, Transition, Victory, GameScene Mission 1-5/release.
