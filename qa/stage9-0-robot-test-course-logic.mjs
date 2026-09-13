import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { robotTestCourse } from '../src/game/mechanics/robotTestCourse.ts';

const snapshots = [];
const record = (name) => snapshots.push({ name, snapshot: robotTestCourse.snapshot });

robotTestCourse.reset();
record('initial');
assert.equal(robotTestCourse.snapshot.courseStage, 'BRIDGE');
assert.equal(robotTestCourse.act('bridge-wrong-arc'), 'wrong');
record('wrong-bridge-input');
assert.equal(robotTestCourse.snapshot.courseStage, 'BRIDGE');
assert.equal(robotTestCourse.snapshot.bridgeRepaired, false);
assert.equal(robotTestCourse.act('bridge-correct'), 'correct');
record('correct-bridge-input');
assert.equal(robotTestCourse.act('bridge-correct'), 'ignored');
record('duplicate-bridge-input');
assert.equal(robotTestCourse.continue(), 'GATE');
record('after-bridge-world-reaction');

assert.equal(robotTestCourse.act('gate-wrong-1'), 'wrong');
record('wrong-gate-input');
assert.equal(robotTestCourse.snapshot.courseStage, 'GATE');
assert.equal(robotTestCourse.snapshot.gateOpened, false);
assert.equal(robotTestCourse.act('gate-correct'), 'correct');
record('correct-gate-input');
assert.equal(robotTestCourse.act('gate-correct'), 'ignored');
record('duplicate-gate-input');
assert.equal(robotTestCourse.continue(), 'POWER');
record('after-gate-world-reaction');

assert.equal(robotTestCourse.act('power-wrong-2'), 'wrong');
record('wrong-power-input');
assert.equal(robotTestCourse.snapshot.courseStage, 'POWER');
assert.equal(robotTestCourse.snapshot.stationPowered, false);
assert.equal(robotTestCourse.act('power-correct'), 'complete');
record('correct-power-input');
assert.equal(robotTestCourse.act('power-correct'), 'ignored');
record('duplicate-power-input');
assert.equal(robotTestCourse.continue(), 'COMPLETE');
record('completion');
assert.equal(robotTestCourse.snapshot.completed, true);
assert.equal(robotTestCourse.snapshot.stationPowered, true);

robotTestCourse.reset();
assert.equal(robotTestCourse.act('bridge-correct'), 'correct');
assert.equal(robotTestCourse.act('bridge-wrong-truss'), 'ignored');
assert.equal(robotTestCourse.act('gate-correct'), 'ignored');
assert.equal(robotTestCourse.continue(), 'GATE');
assert.equal(robotTestCourse.act('gate-correct'), 'correct');
assert.equal(robotTestCourse.act('power-correct'), 'ignored');
assert.equal(robotTestCourse.continue(), 'POWER');
record('rapid-tap-idempotency');

const report = {
  mission: 9,
  mechanic: 'robotTestCourse',
  tested: [
    'initial bridge state',
    'wrong bridge input',
    'correct bridge input',
    'duplicate bridge input',
    'wrong gate input',
    'correct gate input',
    'duplicate gate input',
    'wrong power input',
    'correct power input',
    'duplicate power input',
    'completion',
    'rapid taps',
    'idempotency',
  ],
  failures: [],
  snapshots,
};

fs.mkdirSync(path.join('docs', 'qa'), { recursive: true });
fs.writeFileSync(path.join('docs', 'qa', 'stage9-0-robot-test-course-logic.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
