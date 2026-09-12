import assert from 'node:assert/strict';
import { Mission9InteractionController } from '../src/game/mechanics/Mission9InteractionController.ts';
import { assertMission9PuzzleContracts, MISSION9_PUZZLES } from '../src/game/mechanics/mission9Puzzles.ts';
import { robotTestCourse } from '../src/game/mechanics/robotTestCourse.ts';

assertMission9PuzzleContracts();
assert.equal(MISSION9_PUZZLES.GATE.correctCandidateId, 'gate-truss-profile');
assert.equal(MISSION9_PUZZLES.GATE.candidates.find((item) => item.id === 'gate-truss-profile')?.textureKey, 'MISSION9_GATE_KEY_WRONG_1');
assert.equal(MISSION9_PUZZLES.POWER.correctCandidateId, 'power-capsule-module');
assert.equal(MISSION9_PUZZLES.POWER.candidates.find((item) => item.id === 'power-capsule-module')?.textureKey, 'MISSION9_ENERGY_WRONG_1');

robotTestCourse.reset();
assert.equal(robotTestCourse.snapshot.courseStage, 'BRIDGE');
assert.equal(robotTestCourse.act('bridge-arc-span'), 'wrong');
assert.equal(robotTestCourse.act('bridge-flat-span'), 'correct');
assert.equal(robotTestCourse.act('bridge-flat-span'), 'ignored');
assert.equal(robotTestCourse.continue(), 'GATE');
assert.equal(robotTestCourse.act('gate-triangle-profile'), 'wrong');
assert.equal(robotTestCourse.act('gate-round-lightning-profile'), 'wrong');
assert.equal(robotTestCourse.act('gate-truss-profile'), 'correct');
assert.equal(robotTestCourse.continue(), 'POWER');
assert.equal(robotTestCourse.act('power-orb-module'), 'wrong');
assert.equal(robotTestCourse.act('power-triangle-module'), 'wrong');
assert.equal(robotTestCourse.act('power-capsule-module'), 'complete');
assert.equal(robotTestCourse.continue(), 'COMPLETE');
assert.equal(robotTestCourse.snapshot.completed, true);
assert.equal(robotTestCourse.snapshot.lastAction, 'power-capsule-module');

const interaction = new Mission9InteractionController('BRIDGE');
assert.deepEqual(interaction.snapshot, { stage: 'BRIDGE', state: 'IDLE', selectedCandidateId: null, targetHighlighted: false });
assert.equal(interaction.attemptPlacement('bridge-gap').status, 'ignored');
assert.equal(interaction.selectCandidate('gate-truss-profile'), false);
assert.equal(interaction.selectCandidate('bridge-arc-span'), true);
assert.equal(interaction.snapshot.state, 'SELECTED');
assert.equal(interaction.highlightTarget(), true);
assert.deepEqual(interaction.attemptPlacement('bridge-gap'), {
  status: 'ready', candidateId: 'bridge-arc-span', targetId: 'bridge-gap', matches: false,
});
assert.equal(interaction.snapshot.state, 'PLACING');
assert.equal(interaction.rejectCandidate(), true);
assert.equal(interaction.snapshot.state, 'REJECTING');
assert.equal(interaction.finishRejection(), true);
assert.equal(interaction.snapshot.state, 'IDLE');
assert.equal(interaction.selectCandidate(MISSION9_PUZZLES.BRIDGE.correctCandidateId), true);
assert.deepEqual(interaction.attemptPlacement('bridge-gap'), {
  status: 'ready', candidateId: 'bridge-flat-span', targetId: 'bridge-gap', matches: true,
});
assert.equal(interaction.confirmPlacement(), true);
assert.equal(interaction.snapshot.state, 'SNAPPING');
assert.equal(interaction.beginTransition(), true);
assert.equal(interaction.snapshot.state, 'TRANSITIONING');
interaction.lockInput();
assert.equal(interaction.snapshot.state, 'LOCKED');
assert.equal(interaction.selectCandidate('bridge-truss-span'), false);
interaction.unlockInput('GATE');
assert.deepEqual(interaction.snapshot, { stage: 'GATE', state: 'IDLE', selectedCandidateId: null, targetHighlighted: false });

process.stdout.write(JSON.stringify({ result: 'PASS', suite: 'stage9r-mission9-core-logic' }) + '\n');