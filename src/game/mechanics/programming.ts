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
  readonly targetCell: GridCell;
  readonly obstacles: readonly GridCell[];
  readonly shortestPathLength: number;
  readonly longestSimplePathLength: number;
  readonly simpleRouteCount: number;
  readonly maxCommands: number;
}

export interface SimpleGridRouteAnalysis {
  readonly routeCount: number;
  readonly shortestPathLength: number;
  readonly longestPathLength: number;
}

export interface ProgrammingStep {
  readonly command: RobotCommand;
  readonly from: GridCell;
  readonly to: GridCell;
  readonly collision?: ProgrammingCollision;
}

export interface ProgrammingExecution {
  readonly steps: readonly ProgrammingStep[];
  readonly visitedCells: readonly GridCell[];
  readonly finalPosition: GridCell;
  readonly finalCell: GridCell;
  readonly reachedTarget: boolean;
  readonly collision?: ProgrammingCollision;
  readonly failureReason?: ProgrammingCollision;
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

type ProgrammingBoardDefinition = Omit<ProgrammingChallenge, 'shortestPathLength' | 'longestSimplePathLength' | 'simpleRouteCount' | 'maxCommands'>;

const DELTAS: Readonly<Record<RobotCommand, GridCell>> = {
  UP: { column: 0, row: -1 }, RIGHT: { column: 1, row: 0 },
  DOWN: { column: 0, row: 1 }, LEFT: { column: -1, row: 0 },
};

const COMMAND_ORDER: readonly RobotCommand[] = ['RIGHT', 'UP', 'LEFT', 'DOWN'];

export const sameGridCell = (a: GridCell, b: GridCell): boolean => a.column === b.column && a.row === b.row;
export const commandDelta = (command: RobotCommand): GridCell => DELTAS[command];
const cloneCell = (cell: GridCell): GridCell => ({ column: cell.column, row: cell.row });
const cellKey = (cell: GridCell): string => `${cell.column},${cell.row}`;

function isWalkable(board: Pick<ProgrammingChallenge, 'columns' | 'rows' | 'targetCell' | 'obstacles'>, cell: GridCell): boolean {
  if (cell.column < 0 || cell.column >= board.columns || cell.row < 0 || cell.row >= board.rows) return false;
  return sameGridCell(cell, board.targetCell) || !board.obstacles.some((obstacle) => sameGridCell(obstacle, cell));
}

export function findShortestGridPath(
  board: Pick<ProgrammingChallenge, 'columns' | 'rows' | 'targetCell' | 'obstacles'>,
  startCell: GridCell,
  targetCell: GridCell = board.targetCell,
): readonly RobotCommand[] | null {
  if (sameGridCell(startCell, targetCell)) return [];
  const queue: Array<{ cell: GridCell; commands: RobotCommand[] }> = [{ cell: cloneCell(startCell), commands: [] }];
  const visited = new Set<string>([cellKey(startCell)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const command of COMMAND_ORDER) {
      const delta = commandDelta(command);
      const next = { column: current.cell.column + delta.column, row: current.cell.row + delta.row };
      if (!isWalkable(board, next) || visited.has(cellKey(next))) continue;
      const commands = [...current.commands, command];
      if (sameGridCell(next, targetCell)) return commands;
      visited.add(cellKey(next));
      queue.push({ cell: next, commands });
    }
  }
  return null;
}

/**
 * Counts every legal simple route from start to charger. A simple route never
 * revisits a cell, so the authored route space is finite while still covering
 * every geometrically distinct way through the board. Commands with loops are
 * still accepted by the simulator when they fit within the same capacity.
 */
export function analyzeSimpleGridRoutes(
  board: Pick<ProgrammingChallenge, 'columns' | 'rows' | 'targetCell' | 'obstacles'>,
  startCell: GridCell,
  targetCell: GridCell = board.targetCell,
): SimpleGridRouteAnalysis | null {
  if (sameGridCell(startCell, targetCell)) return { routeCount: 1, shortestPathLength: 0, longestPathLength: 0 };
  const visited = new Set<string>([cellKey(startCell)]);
  let routeCount = 0;
  let shortestPathLength = Number.POSITIVE_INFINITY;
  let longestPathLength = 0;

  const visit = (cell: GridCell, pathLength: number): void => {
    for (const command of COMMAND_ORDER) {
      const delta = commandDelta(command);
      const next = { column: cell.column + delta.column, row: cell.row + delta.row };
      const key = cellKey(next);
      if (!isWalkable(board, next) || visited.has(key)) continue;
      const nextLength = pathLength + 1;
      if (sameGridCell(next, targetCell)) {
        routeCount += 1;
        shortestPathLength = Math.min(shortestPathLength, nextLength);
        longestPathLength = Math.max(longestPathLength, nextLength);
        continue;
      }
      visited.add(key);
      visit(next, nextLength);
      visited.delete(key);
    }
  };

  visit(startCell, 0);
  return routeCount === 0 ? null : { routeCount, shortestPathLength, longestPathLength };
}

function createChallenge(definition: ProgrammingBoardDefinition): ProgrammingChallenge {
  const routeAnalysis = analyzeSimpleGridRoutes(definition, definition.start, definition.targetCell);
  if (!routeAnalysis) throw new Error(`Programming challenge ${definition.id} has no legal route`);
  return {
    ...definition,
    shortestPathLength: routeAnalysis.shortestPathLength,
    longestSimplePathLength: routeAnalysis.longestPathLength,
    simpleRouteCount: routeAnalysis.routeCount,
    maxCommands: routeAnalysis.longestPathLength,
  };
}

export const PROGRAMMING_CHALLENGES: readonly ProgrammingChallenge[] = [
  createChallenge({
    id: 'straight', columns: 4, rows: 2, start: { column: 0, row: 1 }, targetCell: { column: 2, row: 1 },
    obstacles: [],
  }),
  createChallenge({
    id: 'turn', columns: 4, rows: 3, start: { column: 0, row: 2 }, targetCell: { column: 2, row: 1 },
    obstacles: [{ column: 1, row: 1 }],
  }),
  createChallenge({
    id: 'navigation', columns: 5, rows: 3, start: { column: 0, row: 2 }, targetCell: { column: 3, row: 0 },
    obstacles: [{ column: 2, row: 2 }, { column: 3, row: 1 }],
  }),
] as const;

interface MutableProgrammingState {
  challengeIndex: number;
  commands: RobotCommand[];
  robotPosition: GridCell;
  running: boolean;
  routeComplete: boolean;
  completed: boolean;
}

function initialState(): MutableProgrammingState {
  return {
    challengeIndex: 0, commands: [], robotPosition: cloneCell(PROGRAMMING_CHALLENGES[0].start),
    running: false, routeComplete: false, completed: false,
  };
}

let state = initialState();

/** Canonical Mission 8 movement rule used by preview, execution, validation, hints, and QA. */
export function simulateGridProgram(
  board: ProgrammingChallenge,
  startCell: GridCell,
  targetCell: GridCell,
  obstacles: readonly GridCell[],
  commands: readonly RobotCommand[],
): ProgrammingExecution {
  let position = cloneCell(startCell);
  const steps: ProgrammingStep[] = [];
  const visitedCells: GridCell[] = [cloneCell(startCell)];
  let collision: ProgrammingCollision | undefined;
  for (const command of commands) {
    const delta = commandDelta(command);
    const candidate = { column: position.column + delta.column, row: position.row + delta.row };
    const outside = candidate.column < 0 || candidate.column >= board.columns || candidate.row < 0 || candidate.row >= board.rows;
    // The authored target cell is always a walkable destination. This keeps a
    // malformed obstacle list from splitting the visual and logical contracts.
    const blocked = !sameGridCell(candidate, targetCell)
      && obstacles.some((cell) => sameGridCell(cell, candidate));
    collision = outside ? 'boundary' : (blocked ? 'obstacle' : undefined);
    const to = collision ? cloneCell(position) : candidate;
    steps.push({ command, from: cloneCell(position), to: cloneCell(to), ...(collision ? { collision } : {}) });
    if (collision) break;
    position = candidate;
    visitedCells.push(cloneCell(position));
    // Reaching the charger is immediate success. Remaining authored commands are
    // intentionally ignored because arrival, not efficiency, is the learning goal.
    if (sameGridCell(position, targetCell)) break;
  }
  return {
    steps,
    visitedCells,
    finalPosition: cloneCell(position),
    finalCell: cloneCell(position),
    reachedTarget: !collision && sameGridCell(position, targetCell),
    ...(collision ? { collision } : {}),
    ...(collision ? { failureReason: collision } : {}),
  };
}

export function simulateProgram(challenge: ProgrammingChallenge, commands: readonly RobotCommand[]): ProgrammingExecution {
  return simulateGridProgram(challenge, challenge.start, challenge.targetCell, challenge.obstacles, commands);
}

export const programmingMechanic = {
  get snapshot(): Readonly<ProgrammingSnapshot> {
    return {
      challengeIndex: state.challengeIndex,
      challengeCount: 3,
      challenge: PROGRAMMING_CHALLENGES[state.challengeIndex],
      commands: [...state.commands],
      robotPosition: cloneCell(state.robotPosition),
      running: state.running,
      routeComplete: state.routeComplete,
      completed: state.completed,
    };
  },
  reset(): void { state = initialState(); },
  add(command: RobotCommand): boolean {
    const challenge = PROGRAMMING_CHALLENGES[state.challengeIndex];
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
    state.robotPosition = cloneCell(PROGRAMMING_CHALLENGES[state.challengeIndex].start);
    return simulateProgram(PROGRAMMING_CHALLENGES[state.challengeIndex], state.commands);
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
    state.robotPosition = cloneCell(PROGRAMMING_CHALLENGES[state.challengeIndex].start);
    return execution.collision ? 'collision' : 'wrong';
  },
  recoverInterruptedRun(): void {
    if (!state.running) return;
    state.running = false;
    state.robotPosition = cloneCell(PROGRAMMING_CHALLENGES[state.challengeIndex].start);
  },
  hint(): { readonly command: RobotCommand; readonly from: GridCell; readonly to: GridCell } | null {
    if (state.running || state.routeComplete || state.completed) return null;
    const challenge = PROGRAMMING_CHALLENGES[state.challengeIndex];
    const preview = simulateProgram(challenge, state.commands);
    if (preview.collision || preview.reachedTarget) return null;
    const route = findShortestGridPath(challenge, preview.finalPosition, challenge.targetCell);
    const command = route?.[0];
    if (!command) return null;
    const delta = commandDelta(command);
    return {
      command,
      from: cloneCell(preview.finalPosition),
      to: { column: preview.finalPosition.column + delta.column, row: preview.finalPosition.row + delta.row },
    };
  },
  continue(): 'next' | 'mission-complete' | 'ignored' {
    if (!state.routeComplete || state.running || state.completed) return 'ignored';
    if (state.challengeIndex === PROGRAMMING_CHALLENGES.length - 1) {
      state.completed = true;
      return 'mission-complete';
    }
    state.challengeIndex += 1;
    state.commands = [];
    state.robotPosition = cloneCell(PROGRAMMING_CHALLENGES[state.challengeIndex].start);
    state.routeComplete = false;
    return 'next';
  },
};
