import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PROGRAMMING_CHALLENGES, analyzeSimpleGridRoutes, commandDelta, findShortestGridPath, programmingMechanic, sameGridCell, simulateProgram } from '../src/game/mechanics/programming.ts';

const commandOrder = ['RIGHT', 'UP', 'LEFT', 'DOWN'];

function enumerateSimpleRoutes(challenge) {
  const routes = [];
  const commands = [];
  const visited = new Set([`${challenge.start.column},${challenge.start.row}`]);
  const visit = (cell) => {
    for (const command of commandOrder) {
      const delta = commandDelta(command);
      const next = { column: cell.column + delta.column, row: cell.row + delta.row };
      const key = `${next.column},${next.row}`;
      const outside = next.column < 0 || next.column >= challenge.columns || next.row < 0 || next.row >= challenge.rows;
      const blocked = challenge.obstacles.some((obstacle) => sameGridCell(obstacle, next));
      if (outside || blocked || visited.has(key)) continue;
      commands.push(command);
      if (sameGridCell(next, challenge.targetCell)) routes.push([...commands]);
      else {
        visited.add(key);
        visit(next);
        visited.delete(key);
      }
      commands.pop();
    }
  };
  visit(challenge.start);
  return routes;
}

const routes = PROGRAMMING_CHALLENGES.map((challenge, index) => {
  const shortest = findShortestGridPath(challenge, challenge.start, challenge.targetCell);
  assert(shortest, `Route ${index + 1} must have a legal BFS path`);
  assert.equal(shortest.length, challenge.shortestPathLength);
  const analysis = analyzeSimpleGridRoutes(challenge, challenge.start, challenge.targetCell);
  assert(analysis, `Route ${index + 1} must have a finite simple route space`);
  const allSimpleRoutes = enumerateSimpleRoutes(challenge);
  assert.equal(allSimpleRoutes.length, challenge.simpleRouteCount);
  assert.equal(analysis.routeCount, challenge.simpleRouteCount);
  assert.equal(analysis.longestPathLength, challenge.longestSimplePathLength);
  assert.equal(challenge.maxCommands, challenge.longestSimplePathLength);
  const executions = allSimpleRoutes.map((commands, routeIndex) => {
    assert(commands.length <= challenge.maxCommands, `Route ${index + 1}.${routeIndex + 1} exceeds capacity`);
    const result = simulateProgram(challenge, commands);
    assert.equal(result.reachedTarget, true, `Route ${index + 1}.${routeIndex + 1} must reach the charger`);
    assert.equal(result.failureReason, undefined, `Route ${index + 1}.${routeIndex + 1} must remain legal`);
    assert.deepEqual(result.finalCell, challenge.targetCell, `Route ${index + 1}.${routeIndex + 1} must finish on the charger`);
    return { commands, reachedTarget: result.reachedTarget, finalCell: result.finalCell, executedSteps: result.steps.length };
  });
  const longestRoute = allSimpleRoutes.reduce((longest, route) => route.length > longest.length ? route : longest, []);
  assert.equal(longestRoute.length, challenge.maxCommands);
  return {
    route: index + 1,
    board: { columns: challenge.columns, rows: challenge.rows, start: challenge.start, target: challenge.targetCell, obstacles: challenge.obstacles },
    shortestLength: challenge.shortestPathLength,
    longestSimpleLength: challenge.longestSimplePathLength,
    simpleRouteCount: challenge.simpleRouteCount,
    capacity: challenge.maxCommands,
    bfsPath: shortest,
    longestPath: longestRoute,
    verifiedSimplePaths: executions,
  };
});

const earlyCommands = ['RIGHT', 'RIGHT', 'LEFT', 'LEFT'];
const earlyArrival = simulateProgram(PROGRAMMING_CHALLENGES[0], earlyCommands);
assert.equal(earlyArrival.reachedTarget, true);
assert.equal(earlyArrival.steps.length, 2, 'Commands after charger arrival must be ignored');

const obstacleFailure = simulateProgram(PROGRAMMING_CHALLENGES[1], ['UP', 'RIGHT']);
assert.equal(obstacleFailure.failureReason, 'obstacle');
const boundaryFailure = simulateProgram(PROGRAMMING_CHALLENGES[0], ['LEFT']);
assert.equal(boundaryFailure.failureReason, 'boundary');
programmingMechanic.reset();
assert.equal(programmingMechanic.add('UP'), true);
const nextHint = programmingMechanic.hint();
assert.deepEqual(nextHint, { command: 'RIGHT', from: { column: 0, row: 0 }, to: { column: 1, row: 0 } });
programmingMechanic.reset();

const report = {
  exactSequenceValidation: 'REMOVED',
  capacityRule: 'LONGEST_SIMPLE_ROUTE',
  simulatorConsumers: ['preview', 'execution', 'validation', 'QA'],
  routes,
  earlyArrival: { queuedSteps: earlyCommands.length, executedSteps: earlyArrival.steps.length, reachedTarget: earlyArrival.reachedTarget, finalCell: earlyArrival.finalCell },
  failures: { obstacle: obstacleFailure.failureReason, boundary: boundaryFailure.failureReason },
  nextMoveHint: nextHint,
};

fs.mkdirSync(path.join('docs', 'qa'), { recursive: true });
fs.writeFileSync(path.join('docs', 'qa', 'stage8-3e-route-model.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
