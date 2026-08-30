export type RobotCommand = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';
export type ProgrammingCollision = 'obstacle' | 'boundary';

export interface GridCell {
  readonly column: number;
  readonly row: number;
}

export interface ProgrammingChallenge {
  readonly id: 'straight' | 'turn' | 'navigation';
  readonly columns: number;
  readonly rows: number;
  readonly start: GridCell;
  readonly target: GridCell;
  readonly obstacles: readonly GridCell[];
  readonly maxCommands: number;
}

export interface ProgrammingStep {
  readonly command: RobotCommand;
  readonly from: GridCell;
  readonly to: GridCell;
  readonly collision?: ProgrammingCollision;
}

export interface ProgrammingExecution {
  readonly steps: readonly ProgrammingStep[];
  readonly finalPosition: GridCell;
  readonly reachedTarget: boolean;
  readonly collision?: ProgrammingCollision;
}

export interface ProgrammingSnapshot {
  readonly challengeIndex: number;
  readonly challengeCount: 3;
  readonly challenge: ProgrammingChallenge;
  readonly commands: readonly RobotCommand[];
  readonly robotPosition: GridCell;
  readonly running: boolean;
  readonly routeComplete: boolean;
  readonly completed: boolean;
}

const CHALLENGES: readonly ProgrammingChallenge[] = [
  {
    id: 'straight', columns: 4, rows: 2, start: { column: 0, row: 1 }, target: { column: 2, row: 1 },
    obstacles: [], maxCommands: 3,
  },
  {
    id: 'turn', columns: 4, rows: 3, start: { column: 0, row: 2 }, target: { column: 2, row: 1 },
    obstacles: [{ column: 1, row: 1 }], maxCommands: 4,
  },
  {
    id: 'navigation', columns: 5, rows: 3, start: { column: 0, row: 2 }, target: { column: 3, row: 0 },
    obstacles: [{ column: 2, row: 2 }, { column: 3, row: 1 }], maxCommands: 5,
  },
] as const;

const DELTAS: Readonly<Record<RobotCommand, GridCell>> = {
  UP: { column: 0, row: -1 }, RIGHT: { column: 1, row: 0 },
  DOWN: { column: 0, row: 1 }, LEFT: { column: -1, row: 0 },
};

interface MutableProgrammingState {
  challengeIndex: number;
  commands: RobotCommand[];
  robotPosition: GridCell;
  running: boolean;
  routeComplete: boolean;
  completed: boolean;
}

const sameCell = (a: GridCell, b: GridCell): boolean => a.column === b.column && a.row === b.row;
const cloneCell = (cell: GridCell): GridCell => ({ column: cell.column, row: cell.row });

function initialState(): MutableProgrammingState {
  return {
    challengeIndex: 0, commands: [], robotPosition: cloneCell(CHALLENGES[0].start),
    running: false, routeComplete: false, completed: false,
  };
}

let state = initialState();

export function simulateProgram(challenge: ProgrammingChallenge, commands: readonly RobotCommand[]): ProgrammingExecution {
  let position = cloneCell(challenge.start);
  const steps: ProgrammingStep[] = [];
  let collision: ProgrammingCollision | undefined;
  for (const command of commands) {
    const delta = DELTAS[command];
    const candidate = { column: position.column + delta.column, row: position.row + delta.row };
    const outside = candidate.column < 0 || candidate.column >= challenge.columns || candidate.row < 0 || candidate.row >= challenge.rows;
    const blocked = challenge.obstacles.some((cell) => sameCell(cell, candidate));
    collision = outside ? 'boundary' : (blocked ? 'obstacle' : undefined);
    const to = collision ? cloneCell(position) : candidate;
    steps.push({ command, from: cloneCell(position), to: cloneCell(to), ...(collision ? { collision } : {}) });
    if (collision) break;
    position = candidate;
  }
  return {
    steps,
    finalPosition: cloneCell(position),
    reachedTarget: !collision && sameCell(position, challenge.target),
    ...(collision ? { collision } : {}),
  };
}

export const programmingMechanic = {
  get snapshot(): Readonly<ProgrammingSnapshot> {
    return {
      challengeIndex: state.challengeIndex,
      challengeCount: 3,
      challenge: CHALLENGES[state.challengeIndex],
      commands: [...state.commands],
      robotPosition: cloneCell(state.robotPosition),
      running: state.running,
      routeComplete: state.routeComplete,
      completed: state.completed,
    };
  },
  reset(): void { state = initialState(); },
  add(command: RobotCommand): boolean {
    const challenge = CHALLENGES[state.challengeIndex];
    if (state.running || state.routeComplete || state.completed || state.commands.length >= challenge.maxCommands) return false;
    state.commands.push(command);
    return true;
  },
  removeLast(): boolean {
    if (state.running || state.routeComplete || state.commands.length === 0) return false;
    state.commands.pop();
    return true;
  },
  clear(): boolean {
    if (state.running || state.routeComplete || state.commands.length === 0) return false;
    state.commands = [];
    return true;
  },
  beginRun(): ProgrammingExecution | null {
    if (state.running || state.routeComplete || state.completed || state.commands.length === 0) return null;
    state.running = true;
    state.robotPosition = cloneCell(CHALLENGES[state.challengeIndex].start);
    return simulateProgram(CHALLENGES[state.challengeIndex], state.commands);
  },
  applyStep(step: ProgrammingStep): void {
    if (!state.running) return;
    state.robotPosition = cloneCell(step.to);
  },
  finishRun(execution: ProgrammingExecution): 'success' | 'collision' | 'wrong' | 'ignored' {
    if (!state.running) return 'ignored';
    state.running = false;
    if (execution.reachedTarget) {
      state.routeComplete = true;
      state.robotPosition = cloneCell(execution.finalPosition);
      return 'success';
    }
    state.robotPosition = cloneCell(CHALLENGES[state.challengeIndex].start);
    return execution.collision ? 'collision' : 'wrong';
  },
  recoverInterruptedRun(): void {
    if (!state.running) return;
    state.running = false;
    state.robotPosition = cloneCell(CHALLENGES[state.challengeIndex].start);
  },
  hint(): { readonly command: RobotCommand; readonly from: GridCell; readonly to: GridCell } | null {
    if (state.running || state.routeComplete || state.completed) return null;
    const challenge = CHALLENGES[state.challengeIndex];
    const preview = simulateProgram(challenge, state.commands);
    if (preview.collision || preview.reachedTarget) return null;
    const candidates: readonly RobotCommand[] = ['RIGHT', 'UP', 'LEFT', 'DOWN'];
    for (const command of candidates) {
      const trial = simulateProgram(challenge, [...state.commands, command]);
      const step = trial.steps.at(-1);
      if (!step || step.collision) continue;
      const currentDistance = Math.abs(preview.finalPosition.column - challenge.target.column) + Math.abs(preview.finalPosition.row - challenge.target.row);
      const nextDistance = Math.abs(step.to.column - challenge.target.column) + Math.abs(step.to.row - challenge.target.row);
      if (nextDistance < currentDistance) return { command, from: cloneCell(step.from), to: cloneCell(step.to) };
    }
    return null;
  },
  continue(): 'next' | 'mission-complete' | 'ignored' {
    if (!state.routeComplete || state.running || state.completed) return 'ignored';
    if (state.challengeIndex === CHALLENGES.length - 1) {
      state.completed = true;
      return 'mission-complete';
    }
    state.challengeIndex += 1;
    state.commands = [];
    state.robotPosition = cloneCell(CHALLENGES[state.challengeIndex].start);
    state.routeComplete = false;
    return 'next';
  },
};
