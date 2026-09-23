import { deriveAssemblyProgress, type RobotAssemblyProgress } from './robotAssemblyState';

export interface GameSessionState {
  currentTask: number;
  completedTasks: number;
  readonly assemblyProgress: RobotAssemblyProgress;
  readonly powerActivated: boolean;
  readonly connectionsCompleted: boolean;
  readonly programmingCompleted: boolean;
  readonly robotVerified: boolean;
  readonly robotTested: boolean;
  readonly robotReadyForFirstLaunch: boolean;
  readonly totalTasks: 10;
  score: number;
}

type MutableGameSessionState = Omit<GameSessionState, 'assemblyProgress' | 'powerActivated' | 'connectionsCompleted' | 'programmingCompleted' | 'robotVerified' | 'robotTested' | 'robotReadyForFirstLaunch'>;

const createInitialState = (): MutableGameSessionState => ({ currentTask: 1, completedTasks: 0, totalTasks: 10, score: 0 });
let state: MutableGameSessionState = createInitialState();

export const sessionState = {
  get snapshot(): Readonly<GameSessionState> {
    return {
      ...state,
      assemblyProgress: deriveAssemblyProgress(state.completedTasks),
      powerActivated: state.completedTasks >= 6,
      connectionsCompleted: state.completedTasks >= 7,
      programmingCompleted: state.completedTasks >= 8,
      robotVerified: state.completedTasks >= 9,
      robotTested: state.completedTasks >= 9,
      robotReadyForFirstLaunch: state.completedTasks >= 9,
    };
  },
  reset(): void { state = createInitialState(); },
  enterMission6Qa(): void {
    state = { currentTask: 6, completedTasks: 5, totalTasks: 10, score: 5 };
  },
  enterMission7Qa(): void {
    state = { currentTask: 7, completedTasks: 6, totalTasks: 10, score: 6 };
  },
  enterMission8Qa(): void {
    state = { currentTask: 8, completedTasks: 7, totalTasks: 10, score: 7 };
  },
  enterMission9Qa(): void {
    state = { currentTask: 9, completedTasks: 8, totalTasks: 10, score: 8 };
  },
  enterMission10Qa(): void {
    state = { currentTask: 10, completedTasks: 9, totalTasks: 10, score: 9 };
  },
  completeCurrentTask(points = 1): void {
    if (state.currentTask <= state.completedTasks || state.completedTasks >= state.totalTasks) return;
    state.completedTasks += 1;
    state.score += points;
    state.currentTask = Math.min(state.completedTasks + 1, state.totalTasks);
  },
};
