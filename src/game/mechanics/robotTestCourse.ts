import {
  getMission9Puzzle,
  isCorrectMission9Candidate,
  isMission9CandidateForStage,
  type Mission9CandidateId,
  type Mission9PlayStage,
} from './mission9Puzzles.ts';

export type RobotTestCourseStage = 'START' | Mission9PlayStage | 'COMPLETE';
export type RobotTestCourseAction = Mission9CandidateId;
export type RobotTestCourseResult = 'correct' | 'wrong' | 'ignored' | 'complete';

export interface RobotTestCourseSnapshot {
  readonly courseStage: RobotTestCourseStage;
  readonly bridgeRepaired: boolean;
  readonly gateOpened: boolean;
  readonly stationPowered: boolean;
  readonly wrongAttempts: number;
  readonly lastAction: RobotTestCourseAction | null;
  readonly lastResult: RobotTestCourseResult | 'idle';
  readonly transitioning: boolean;
  readonly completed: boolean;
}

interface MutableRobotTestCourseState {
  courseStage: RobotTestCourseStage;
  bridgeRepaired: boolean;
  gateOpened: boolean;
  stationPowered: boolean;
  wrongAttempts: number;
  lastAction: RobotTestCourseAction | null;
  lastResult: RobotTestCourseResult | 'idle';
  transitioning: boolean;
  completed: boolean;
}

const initial = (): MutableRobotTestCourseState => ({
  courseStage: 'START',
  bridgeRepaired: false,
  gateOpened: false,
  stationPowered: false,
  wrongAttempts: 0,
  lastAction: null,
  lastResult: 'idle',
  transitioning: false,
  completed: false,
});

let state = initial();

function publicStage(): Mission9PlayStage | 'COMPLETE' {
  return state.courseStage === 'START' ? 'BRIDGE' : state.courseStage;
}

export const robotTestCourse = {
  get snapshot(): Readonly<RobotTestCourseSnapshot> {
    return {
      courseStage: publicStage(),
      bridgeRepaired: state.bridgeRepaired,
      gateOpened: state.gateOpened,
      stationPowered: state.stationPowered,
      wrongAttempts: state.wrongAttempts,
      lastAction: state.lastAction,
      lastResult: state.lastResult,
      transitioning: state.transitioning,
      completed: state.completed,
    };
  },
  reset(): void {
    state = initial();
  },
  validActions(): readonly RobotTestCourseAction[] {
    const stage = publicStage();
    return stage === 'COMPLETE' ? [] : getMission9Puzzle(stage).candidates.map((candidate) => candidate.id);
  },
  act(action: RobotTestCourseAction): RobotTestCourseResult {
    if (state.transitioning || state.completed) return 'ignored';
    const stage = publicStage();
    if (stage === 'COMPLETE') return 'ignored';
    const candidateId = action;
    if (!isMission9CandidateForStage(stage, candidateId)) return 'ignored';
    state.lastAction = candidateId;

    if (stage === 'BRIDGE') {
      if (!isCorrectMission9Candidate(stage, candidateId)) {
        state.lastResult = 'wrong';
        state.wrongAttempts += 1;
        return 'wrong';
      }
      state.bridgeRepaired = true;
      state.transitioning = true;
      state.lastResult = 'correct';
      return 'correct';
    }

    if (stage === 'GATE') {
      if (!isCorrectMission9Candidate(stage, candidateId)) {
        state.lastResult = 'wrong';
        state.wrongAttempts += 1;
        return 'wrong';
      }
      state.gateOpened = true;
      state.transitioning = true;
      state.lastResult = 'correct';
      return 'correct';
    }

    if (stage === 'POWER') {
      if (!isCorrectMission9Candidate(stage, candidateId)) {
        state.lastResult = 'wrong';
        state.wrongAttempts += 1;
        return 'wrong';
      }
      state.stationPowered = true;
      state.completed = true;
      state.transitioning = true;
      state.lastResult = 'complete';
      return 'complete';
    }

    return 'ignored';
  },
  continue(): RobotTestCourseStage {
    if (!state.transitioning) return publicStage();
    if (state.completed) {
      state.courseStage = 'COMPLETE';
      state.transitioning = false;
      return 'COMPLETE';
    }
    state.courseStage = state.bridgeRepaired && !state.gateOpened
      ? 'GATE'
      : state.gateOpened && !state.stationPowered
        ? 'POWER'
        : publicStage();
    state.transitioning = false;
    state.wrongAttempts = 0;
    state.lastAction = null;
    state.lastResult = 'idle';
    return state.courseStage;
  },
  markCompleted(): void {
    state = {
      courseStage: 'COMPLETE',
      bridgeRepaired: true,
      gateOpened: true,
      stationPowered: true,
      wrongAttempts: 0,
      lastAction: 'power-capsule-module',
      lastResult: 'complete',
      transitioning: false,
      completed: true,
    };
  },
};
