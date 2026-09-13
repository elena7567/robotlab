export type Mission10Stage = 'INTRO' | 'PATH' | 'ENERGY' | 'SIGNAL' | 'LAUNCH' | 'FINALE' | 'COMPLETE';
export type Mission10StageShortcut = 'intro' | 'path' | 'energy' | 'signal' | 'launch' | 'final' | 'complete';

export interface Mission10Snapshot {
  readonly stage: Mission10Stage;
  readonly runSeed: number;
  readonly pathConfigId: string;
  readonly energyConfigId: string;
  readonly signalConfigId: string;
  readonly pathDecisionIndex: number;
  readonly pathWrongAttempts: number;
  readonly relayOrientations: Readonly<Record<string, number>>;
  readonly energyWrongAttempts: number;
  readonly reflectorOrientations: Readonly<Record<string, number>>;
  readonly signalWrongAttempts: number;
  readonly launchPressed: boolean;
  readonly finaleStep: number;
  readonly completed: boolean;
}

export function normalizeMission10Seed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  return Math.abs(Math.trunc(seed)) >>> 0;
}

export function selectMission10ConfigIndex(seed: number, salt: number, count: number): number {
  if (!Number.isInteger(count) || count < 1) throw new Error('Mission 10 config count must be positive');
  let value = (normalizeMission10Seed(seed) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) % count;
}

export function cloneMission10Snapshot(snapshot: Mission10Snapshot): Mission10Snapshot {
  return { ...snapshot, relayOrientations: { ...snapshot.relayOrientations }, reflectorOrientations: { ...snapshot.reflectorOrientations } };
}
