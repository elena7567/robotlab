# Decision 0002: Robot assembly progression

## Status

Accepted for Stage 7.1B.

## Context

The complete robot already present in gameplay is the helper mechanic, not the repair target. A second robot must visibly assemble across the five major educational tasks without creating a second progression counter or coupling saveable state to Phaser objects.

## Decision

- `sessionState.completedTasks` remains the only mutable major-progression value.
- `assemblyProgress` is exposed on each session snapshot and is derived by `deriveAssemblyProgress(completedTasks)`; it is never stored independently.
- `robotAssemblyState.ts` owns the task-to-part mapping, newly installed part groups, installation messages, and helper dialogue.
- `RobotAssemblyPreview` is the replaceable renderer boundary for the second robot skin. Gameplay and VictoryScene consume stable part IDs rather than asset paths or `RobotActor` transforms.
- `ProgressPanel` is now a compact assembly station. It animates only renderer state and reads the canonical session snapshot before and after each major completion.
- The existing `RobotActor` stays whole and reacts through its stable whole-body/head/antenna APIs; assembly never modifies helper arm transforms.
- Play Again and Start reset only the canonical session/mechanic state. The assembly renderer returns to blueprint automatically because its state is derived.

## Consequences

- Task and assembly progress cannot disagree after resize, restart, Home, Play Again, or future persistence restore.
- A future second-robot skin can replace the renderer layout and texture IDs without changing educational mechanics or task progression.
- Reward tweens are disposable presentation state and resolve safely when GameScene shuts down during an active installation.
