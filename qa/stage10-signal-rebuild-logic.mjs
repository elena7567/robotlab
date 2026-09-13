import assert from 'node:assert/strict';
import { Mission10Controller } from '../src/game/mechanics/mission10/mission10Controller.ts';
import { MISSION10_SIGNAL_CONFIGS, findMission10SignalOptimalTaps, findMission10SignalSolution, solveMission10Signal } from '../src/game/mechanics/mission10/signalPuzzle.ts';

const same = (a, b) => a.x === b.x && a.y === b.y;
const expectedSolutions = [{ M1: 1, M2: 0 }, { M1: 0, M2: 0 }, { M1: 1, M2: 1, M3: 0 }];
assert.deepEqual(MISSION10_SIGNAL_CONFIGS.map(c => c.reflectors.length), [2, 2, 3]);
assert.deepEqual(MISSION10_SIGNAL_CONFIGS.map(findMission10SignalOptimalTaps), [2, 2, 3]);
let statesChecked = 0;
for (const [index, config] of MISSION10_SIGNAL_CONFIGS.entries()) {
  const answer = expectedSolutions[index];
  assert.deepEqual(findMission10SignalSolution(config), answer);
  const initial = solveMission10Signal(config, config.initialOrientations);
  assert.equal(initial.receiverHit, false);
  assert.ok(initial.segments.some(segment => same(segment.to, config.reflectors[0].position)));
  let prefix = { ...config.initialOrientations };
  for (const [mirrorIndex, mirror] of config.reflectors.entries()) {
    prefix[mirror.id] += 1;
    const trace = solveMission10Signal(config, prefix);
    for (const reached of config.reflectors.slice(0, Math.min(mirrorIndex + 2, config.reflectors.length))) {
      assert.ok(trace.segments.some(segment => same(segment.to, reached.position)), `${config.id} visible prefix ${reached.id}`);
    }
    assert.equal(trace.receiverHit, mirrorIndex === config.reflectors.length - 1);
    if (!trace.receiverHit) assert.equal(trace.firstIncompleteReflectorId, config.reflectors[mirrorIndex + 1].id);
  }
  for (let mask = 0; mask < 4 ** config.reflectors.length; mask += 1) {
    const orientations = Object.fromEntries(config.reflectors.map((mirror, i) => [mirror.id, (mask >> (2 * i)) & 3]));
    const trace = solveMission10Signal(config, orientations);
    assert.deepEqual(trace, solveMission10Signal(config, orientations), 'deterministic trace');
    assert.equal(trace.receiverHit, config.reflectors.every(m => orientations[m.id] % 2 === answer[m.id]), 'no false completion');
    assert.ok(trace.segments.length > 0);
    assert.ok(same(trace.segments[0].from, config.emitter));
    trace.segments.forEach((segment, i) => {
      assert.notDeepEqual(segment.from, segment.to, 'no empty beam segment');
      if (i) assert.deepEqual(segment.from, trace.segments[i - 1].to, 'continuous partial path');
      assert.ok(segment.from.x === segment.to.x || segment.from.y === segment.to.y, 'cardinal ray');
      assert.ok(segment.to.x >= -.5 && segment.to.x <= config.bounds.width - .5);
      assert.ok(segment.to.y >= -.5 && segment.to.y <= config.bounds.height - .5);
    });
    assert.equal(same(trace.segments.at(-1).to, config.receiver), trace.receiverHit, 'success requires actual endpoint hit');
    statesChecked += 1;
  }
  const base = new Mission10Controller(0);
  base.initializeStageShortcut('signal');
  const snapshot = { ...base.snapshot, signalConfigId: config.id, reflectorOrientations: { ...config.initialOrientations } };
  const controller = new Mission10Controller(snapshot);
  for (let tap = 0; tap < 100; tap += 1) {
    const before = controller.snapshot;
    const result = controller.rotateReflector('M1');
    assert.equal(result.status, 'signal');
    assert.equal(controller.snapshot.reflectorOrientations.M1, (before.reflectorOrientations.M1 + 1) % 2);
    for (const mirror of config.reflectors.slice(1)) assert.equal(controller.snapshot.reflectorOrientations[mirror.id], before.reflectorOrientations[mirror.id]);
    assert.equal(controller.snapshot.stage, 'SIGNAL');
  }
  assert.equal(controller.rotateReflector('missing').status, 'ignored');
  const restored = new Mission10Controller(JSON.parse(JSON.stringify(controller.snapshot)));
  assert.deepEqual(restored.snapshot, controller.snapshot, 'serialized state preserves orientation');
  for (const mirror of config.reflectors) restored.rotateReflector(mirror.id);
  assert.equal(restored.snapshot.stage, 'LAUNCH');
  assert.equal(restored.rotateReflector('M1').status, 'ignored', 'post-success taps cannot corrupt result');
}
console.log(JSON.stringify({ result: 'PASS', suite: 'stage10-signal-rebuild-logic', configurations: 3, optimalTaps: [2, 2, 3], exhaustiveOrientationStates: statesChecked, isolatedRapidTaps: 300, signalReflectorStates: 2 }));
