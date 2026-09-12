export type Mission9PlayStage = 'BRIDGE' | 'GATE' | 'POWER';
export type Mission9AssetFamily = 'bridge' | 'gate' | 'power';
export type Mission9CandidateId =
  | 'bridge-flat-span' | 'bridge-arc-span' | 'bridge-truss-span'
  | 'gate-truss-profile' | 'gate-triangle-profile' | 'gate-round-lightning-profile'
  | 'power-capsule-module' | 'power-orb-module' | 'power-triangle-module';
export type Mission9TargetId = 'bridge-gap' | 'gate-lock' | 'power-socket';

export interface Mission9CandidateDefinition {
  readonly id: Mission9CandidateId;
  readonly family: Mission9AssetFamily;
  readonly textureKey: string;
}
export interface Mission9PuzzleDefinition {
  readonly stage: Mission9PlayStage;
  readonly title: string;
  readonly family: Mission9AssetFamily;
  readonly clueId: Mission9CandidateId;
  readonly targetId: Mission9TargetId;
  readonly targetTextureKey: string;
  readonly correctCandidateId: Mission9CandidateId;
  readonly candidates: readonly [Mission9CandidateDefinition, Mission9CandidateDefinition, Mission9CandidateDefinition];
}

export const MISSION9_PUZZLES: Readonly<Record<Mission9PlayStage, Mission9PuzzleDefinition>> = {
  BRIDGE: {
    stage: 'BRIDGE', title: 'ПОЧИНИ МОСТ', family: 'bridge', clueId: 'bridge-flat-span',
    targetId: 'bridge-gap', targetTextureKey: 'MISSION9_BRIDGE_GAP_TARGET', correctCandidateId: 'bridge-flat-span',
    candidates: [
      { id: 'bridge-flat-span', family: 'bridge', textureKey: 'MISSION9_BRIDGE_CORRECT' },
      { id: 'bridge-arc-span', family: 'bridge', textureKey: 'MISSION9_BRIDGE_WRONG_ARC' },
      { id: 'bridge-truss-span', family: 'bridge', textureKey: 'MISSION9_BRIDGE_WRONG_TRUSS' },
    ],
  },
  GATE: {
    stage: 'GATE', title: 'НАЙДИ КЛЮЧ', family: 'gate', clueId: 'gate-truss-profile',
    targetId: 'gate-lock', targetTextureKey: 'MISSION9_GATE_CLOSED', correctCandidateId: 'gate-truss-profile',
    candidates: [
      { id: 'gate-triangle-profile', family: 'gate', textureKey: 'MISSION9_GATE_KEY_CORRECT' },
      { id: 'gate-truss-profile', family: 'gate', textureKey: 'MISSION9_GATE_KEY_WRONG_1' },
      { id: 'gate-round-lightning-profile', family: 'gate', textureKey: 'MISSION9_GATE_KEY_WRONG_2' },
    ],
  },
  POWER: {
    stage: 'POWER', title: 'ЗАПУСТИ СТАНЦИЮ', family: 'power', clueId: 'power-capsule-module',
    targetId: 'power-socket', targetTextureKey: 'MISSION9_POWER_STATION_OFF', correctCandidateId: 'power-capsule-module',
    candidates: [
      { id: 'power-orb-module', family: 'power', textureKey: 'MISSION9_ENERGY_CORRECT' },
      { id: 'power-capsule-module', family: 'power', textureKey: 'MISSION9_ENERGY_WRONG_1' },
      { id: 'power-triangle-module', family: 'power', textureKey: 'MISSION9_ENERGY_WRONG_2' },
    ],
  },
};

export function getMission9Puzzle(stage: Mission9PlayStage): Mission9PuzzleDefinition {
  return MISSION9_PUZZLES[stage];
}
export function isMission9CandidateForStage(stage: Mission9PlayStage, candidateId: Mission9CandidateId): boolean {
  return MISSION9_PUZZLES[stage].candidates.some((candidate) => candidate.id === candidateId);
}
export function isCorrectMission9Candidate(stage: Mission9PlayStage, candidateId: Mission9CandidateId): boolean {
  return MISSION9_PUZZLES[stage].correctCandidateId === candidateId;
}
export function assertMission9PuzzleContracts(): void {
  for (const puzzle of Object.values(MISSION9_PUZZLES)) {
    if (puzzle.clueId !== puzzle.correctCandidateId) throw new Error(`Mission 9 ${puzzle.stage}: clue mismatch`);
    const ids = new Set(puzzle.candidates.map((candidate) => candidate.id));
    if (ids.size !== 3 || !ids.has(puzzle.correctCandidateId)) throw new Error(`Mission 9 ${puzzle.stage}: invalid candidates`);
    if (puzzle.candidates.some((candidate) => candidate.family !== puzzle.family)) throw new Error(`Mission 9 ${puzzle.stage}: asset family mismatch`);
  }
}
assertMission9PuzzleContracts();