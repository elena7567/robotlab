export type Mission10LaneId = 'LEFT' | 'CENTER' | 'RIGHT';
export type Mission10PathKind = 'SAFE' | 'LASER' | 'HAZARD';

export interface Mission10PathLane { readonly id: Mission10LaneId; readonly kind: Mission10PathKind }
export interface Mission10PathRound { readonly id: string; readonly lanes: readonly [Mission10PathLane, Mission10PathLane, Mission10PathLane] }
export interface Mission10PathConfig { readonly id: string; readonly rounds: readonly [Mission10PathRound, Mission10PathRound, Mission10PathRound] }

const lanes = (left: Mission10PathKind, center: Mission10PathKind, right: Mission10PathKind): readonly [Mission10PathLane, Mission10PathLane, Mission10PathLane] => [
  { id: 'LEFT', kind: left }, { id: 'CENTER', kind: center }, { id: 'RIGHT', kind: right },
];

export const MISSION10_PATH_CONFIGS: readonly Mission10PathConfig[] = [
  { id: 'PATH_A', rounds: [
    { id: 'A1', lanes: lanes('SAFE', 'LASER', 'HAZARD') }, { id: 'A2', lanes: lanes('HAZARD', 'SAFE', 'LASER') }, { id: 'A3', lanes: lanes('LASER', 'HAZARD', 'SAFE') },
  ] },
  { id: 'PATH_B', rounds: [
    { id: 'B1', lanes: lanes('LASER', 'SAFE', 'HAZARD') }, { id: 'B2', lanes: lanes('SAFE', 'HAZARD', 'LASER') }, { id: 'B3', lanes: lanes('HAZARD', 'LASER', 'SAFE') },
  ] },
  { id: 'PATH_C', rounds: [
    { id: 'C1', lanes: lanes('HAZARD', 'LASER', 'SAFE') }, { id: 'C2', lanes: lanes('LASER', 'SAFE', 'HAZARD') }, { id: 'C3', lanes: lanes('SAFE', 'HAZARD', 'LASER') },
  ] },
] as const;

export function getMission10PathConfig(configId: string): Mission10PathConfig {
  const config = MISSION10_PATH_CONFIGS.find((candidate) => candidate.id === configId);
  if (!config) throw new Error(`Unknown Mission 10 path config: ${configId}`);
  return config;
}

export function getMission10PathLane(configId: string, decisionIndex: number, laneId: Mission10LaneId): Mission10PathLane | null {
  return getMission10PathConfig(configId).rounds[decisionIndex]?.lanes.find((lane) => lane.id === laneId) ?? null;
}

export function getMission10SafeLane(configId: string, decisionIndex: number): Mission10LaneId | null {
  return getMission10PathConfig(configId).rounds[decisionIndex]?.lanes.find((lane) => lane.kind === 'SAFE')?.id ?? null;
}

export function assertMission10PathContracts(): void {
  if (MISSION10_PATH_CONFIGS.length !== 3) throw new Error('Mission 10 path requires exactly three authored configs');
  const configIds = new Set<string>();
  for (const config of MISSION10_PATH_CONFIGS) {
    if (configIds.has(config.id) || config.rounds.length !== 3) throw new Error(`Invalid path config ${config.id}`);
    configIds.add(config.id);
    for (const round of config.rounds) {
      const laneIds = new Set(round.lanes.map((lane) => lane.id));
      const kinds = new Set(round.lanes.map((lane) => lane.kind));
      if (laneIds.size !== 3 || kinds.size !== 3 || !kinds.has('SAFE') || !kinds.has('LASER') || !kinds.has('HAZARD')) throw new Error(`Invalid semantic lanes in ${config.id}/${round.id}`);
    }
  }
}

assertMission10PathContracts();
