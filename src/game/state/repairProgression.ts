export interface RobotEnergyProfile {
  readonly completedTasks: number;
  readonly idleAmplitude: number;
  readonly idleDurationMs: number;
  readonly antennaAmplitude: number;
  readonly reactionStrength: number;
}

export function getRobotEnergyProfile(completedTasks: number): RobotEnergyProfile {
  const progress = Math.max(0, Math.min(5, Math.floor(completedTasks)));
  return {
    completedTasks: progress,
    idleAmplitude: [2, 2.4, 2.8, 3.2, 3.8, 4.2][progress],
    idleDurationMs: [3400, 3250, 3100, 2950, 2750, 2550][progress],
    antennaAmplitude: [1.5, 2.5, 3, 3.5, 4, 4.5][progress],
    reactionStrength: [1, 1, 1.05, 1.15, 1.22, 1.35][progress],
  };
}
