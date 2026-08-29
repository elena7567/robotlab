import { deriveAssemblyProgress, type RobotAssemblyProgress } from './robotAssemblyState';

export interface GameSessionState {
  currentTask: number;
  completedTasks: number;
  readonly assemblyProgress: RobotAssemblyProgress;
  readonly totalTasks: 5;
  score: number;
}

type MutableGameSessionState = Omit<GameSessionState, 'assemblyProgress'>;

const createInitialState = (): MutableGameSessionState => ({ currentTask: 1, completedTasks: 0, totalTasks: 5, score: 0 });
let state: MutableGameSessionState = createInitialState();

export const sessionState = {
  get snapshot(): Readonly<GameSessionState> {
    return { ...state, assemblyProgress: deriveAssemblyProgress(state.completedTasks) };
  },
  reset(): void { state = createInitialState(); },
  completeCurrentTask(points = 1): void {
    if (state.currentTask <= state.completedTasks || state.completedTasks >= state.totalTasks) return;
    state.completedTasks += 1;
    state.score += points;
    state.currentTask = Math.min(state.completedTasks + 1, state.totalTasks);
  },
};
