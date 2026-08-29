import { deriveAssemblyProgress, type RobotAssemblyProgress } from './robotAssemblyState';

export interface GameSessionState {
  currentTask: number;
  completedTasks: number;
  readonly assemblyProgress: RobotAssemblyProgress;
  readonly powerActivated: boolean;
  readonly connectionsCompleted: boolean;
  readonly totalTasks: 10;
  score: number;
}

type MutableGameSessionState = Omit<GameSessionState, 'assemblyProgress' | 'powerActivated' | 'connectionsCompleted'>;

const createInitialState = (): MutableGameSessionState => ({ currentTask: 1, completedTasks: 0, totalTasks: 10, score: 0 });
let state: MutableGameSessionState = createInitialState();

export const sessionState = {
  get snapshot(): Readonly<GameSessionState> {
    return {
      ...state,
      assemblyProgress: deriveAssemblyProgress(state.completedTasks),
      powerActivated: state.completedTasks >= 6,
      connectionsCompleted: state.completedTasks >= 7,
    };
  },
  reset(): void { state = createInitialState(); },
  completeCurrentTask(points = 1): void {
    if (state.currentTask <= state.completedTasks || state.completedTasks >= state.totalTasks) return;
    state.completedTasks += 1;
    state.score += points;
    state.currentTask = Math.min(state.completedTasks + 1, state.totalTasks);
  },
};
