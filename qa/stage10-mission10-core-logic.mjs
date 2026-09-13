import assert from 'node:assert/strict';
import {
  assertMission10EnergyContracts,
  findMission10EnergyOptimalTaps,
  findMission10EnergySolution,
  MISSION10_ENERGY_CONFIGS,
  solveMission10Energy,
} from '../src/game/mechanics/mission10/energyRelayPuzzle.ts';
import { Mission10Controller, MISSION10_FINALE_STEP_COUNT } from '../src/game/mechanics/mission10/mission10Controller.ts';
import { MISSION10_PATH_CONFIGS, assertMission10PathContracts, getMission10SafeLane } from '../src/game/mechanics/mission10/safePathPuzzle.ts';
import {
  assertMission10SignalContracts,
  findMission10SignalSolution,
  MISSION10_SIGNAL_CONFIGS,
  solveMission10Signal,
} from '../src/game/mechanics/mission10/signalPuzzle.ts';

assertMission10PathContracts();
assertMission10EnergyContracts();
assertMission10SignalContracts();
assert.equal(MISSION10_PATH_CONFIGS.length, 3);
for (const config of MISSION10_PATH_CONFIGS) {
  assert.equal(config.rounds.length, 3);
  for (let index = 0; index < config.rounds.length; index += 1) assert.ok(getMission10SafeLane(config.id, index));
}

assert.deepEqual(MISSION10_ENERGY_CONFIGS.map(findMission10EnergyOptimalTaps), [3, 5, 7]);
for (const config of MISSION10_ENERGY_CONFIGS) {
  const initial = solveMission10Energy(config, config.initialOrientations);
  assert.equal(initial.receiverPowered, false);
  assert.equal(initial.breakRelayId, 'R1');
  const solution = findMission10EnergySolution(config);
  assert.ok(solution);
  assert.equal(solveMission10Energy(config, solution.orientations).connectedRelayCount, 3);
  assert.equal(solveMission10Energy(config, solution.orientations).receiverPowered, true);
  const prefix = solveMission10Energy(config, { ...solution.orientations, R2: 1 });
  assert.equal(prefix.connectedRelayCount, 1);
  assert.equal(prefix.breakRelayId, 'R2');
  assert.equal(prefix.receiverPowered, false);
  assert.equal(prefix.energizedSegments.length, 2);
}

assert.equal(MISSION10_SIGNAL_CONFIGS.length, 3);
for (const config of MISSION10_SIGNAL_CONFIGS) {
  const solution = findMission10SignalSolution(config);
  assert.ok(solution);
  const trace = solveMission10Signal(config, solution);
  assert.equal(trace.receiverHit, true);
  assert.equal(trace.firstIncompleteReflectorId, null);
  assert.ok(trace.segments.length > config.reflectors.length);
  const broken = { ...solution, [config.reflectors[0].id]: (solution[config.reflectors[0].id] ?? 0) + 1 };
  const brokenTrace = solveMission10Signal(config, broken);
  assert.equal(brokenTrace.receiverHit, false);
  assert.equal(brokenTrace.firstIncompleteReflectorId, config.reflectors[0].id);
}

const controller = new Mission10Controller(1010);
assert.equal(controller.snapshot.stage, 'INTRO');
assert.deepEqual(JSON.parse(JSON.stringify(controller.snapshot)), controller.snapshot);
assert.equal(controller.beginMission().status, 'started');
assert.equal(controller.beginMission().status, 'ignored');
const firstSafeLane = getMission10SafeLane(controller.snapshot.pathConfigId, 0);
assert.ok(firstSafeLane);
const firstWrongLane = MISSION10_PATH_CONFIGS.find((config) => config.id === controller.snapshot.pathConfigId)?.rounds[0].lanes.find((lane) => lane.kind !== 'SAFE')?.id;
assert.ok(firstWrongLane);
assert.equal(controller.choosePath(firstWrongLane).status, 'path');
const secondWrong = controller.choosePath(firstWrongLane);
assert.equal(secondWrong.status, 'path');
if (secondWrong.status === 'path') assert.equal(secondWrong.hintLaneId, firstSafeLane);

while (controller.snapshot.stage === 'PATH') {
  const safeLane = getMission10SafeLane(controller.snapshot.pathConfigId, controller.snapshot.pathDecisionIndex);
  assert.ok(safeLane);
  controller.choosePath(safeLane);
}
assert.equal(controller.snapshot.pathDecisionIndex, 3);
assert.equal(controller.snapshot.stage, 'ENERGY');
assert.equal(controller.choosePath('LEFT').status, 'ignored');

const energyConfig = MISSION10_ENERGY_CONFIGS.find((config) => config.id === controller.snapshot.energyConfigId);
assert.ok(energyConfig);
const energySolution = findMission10EnergySolution(energyConfig);
assert.ok(energySolution);
for (const relay of energyConfig.relays) {
  while (controller.snapshot.stage === 'ENERGY' && controller.snapshot.relayOrientations[relay.id] !== energySolution.orientations[relay.id]) {
    controller.rotateRelay(relay.id);
  }
}
assert.equal(controller.snapshot.stage, 'SIGNAL');
assert.equal(controller.rotateRelay('R1').status, 'ignored');

const signalConfig = MISSION10_SIGNAL_CONFIGS.find((config) => config.id === controller.snapshot.signalConfigId);
assert.ok(signalConfig);
const signalSolution = findMission10SignalSolution(signalConfig);
assert.ok(signalSolution);
for (const reflector of signalConfig.reflectors) {
  while (controller.snapshot.stage === 'SIGNAL' && controller.snapshot.reflectorOrientations[reflector.id] % 2 !== signalSolution[reflector.id]) {
    controller.rotateReflector(reflector.id);
  }
}
assert.equal(controller.snapshot.stage, 'LAUNCH');
assert.equal(controller.launchBeacon().status, 'launched');
assert.equal(controller.launchBeacon().status, 'ignored');
for (let step = 1; step <= MISSION10_FINALE_STEP_COUNT; step += 1) {
  const result = controller.advanceFinale();
  assert.equal(result.status, 'finale');
  assert.equal(controller.snapshot.finaleStep, step);
}
assert.equal(controller.snapshot.stage, 'COMPLETE');
assert.equal(controller.snapshot.completed, true);
assert.equal(controller.advanceFinale().status, 'ignored');

const serializedCompletion = JSON.stringify(controller.snapshot);
assert.equal(JSON.parse(serializedCompletion).completed, true);
const restored = new Mission10Controller(JSON.parse(serializedCompletion));
assert.deepEqual(restored.snapshot, controller.snapshot);
assert.equal(restored.advanceFinale().status, 'ignored');
controller.reset(2020);
assert.equal(controller.snapshot.stage, 'INTRO');
assert.equal(controller.snapshot.runSeed, 2020);
for (const shortcut of ['intro', 'path', 'energy', 'signal', 'launch', 'final', 'complete']) {
  const result = controller.initializeStageShortcut(shortcut, 3030);
  assert.equal(result.status, 'shortcut');
}
assert.equal(controller.snapshot.stage, 'COMPLETE');
assert.equal(controller.snapshot.completed, true);
controller.initializeStageShortcut('launch', 4040);
assert.equal(controller.snapshot.stage, 'LAUNCH');
assert.equal(solveMission10Energy(
  MISSION10_ENERGY_CONFIGS.find((config) => config.id === controller.snapshot.energyConfigId),
  controller.snapshot.relayOrientations,
).receiverPowered, true);
assert.equal(solveMission10Signal(
  MISSION10_SIGNAL_CONFIGS.find((config) => config.id === controller.snapshot.signalConfigId),
  controller.snapshot.reflectorOrientations,
).receiverHit, true);

process.stdout.write(JSON.stringify({
  result: 'PASS', suite: 'stage10-mission10-core-logic', pathConfigs: 3, energyConfigs: 3,
  energyOptimalTaps: MISSION10_ENERGY_CONFIGS.map(findMission10EnergyOptimalTaps), signalConfigs: 3,
}) + '\n');
