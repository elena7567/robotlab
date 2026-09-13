export type CardinalDirection = 'N' | 'E' | 'S' | 'W';
export interface Mission10GridPoint { readonly x: number; readonly y: number }
export interface Mission10RelayDefinition { readonly id: string; readonly position: Mission10GridPoint; readonly baseInput: CardinalDirection; readonly baseOutput: CardinalDirection }
export interface Mission10EnergyConfig {
  readonly id: string;
  readonly source: Mission10GridPoint;
  readonly sourceDirection: CardinalDirection;
  readonly receiver: Mission10GridPoint;
  readonly relays: readonly [Mission10RelayDefinition, Mission10RelayDefinition, Mission10RelayDefinition];
  readonly initialOrientations: Readonly<Record<string, number>>;
}
export interface Mission10EnergySegment { readonly from: Mission10GridPoint; readonly to: Mission10GridPoint; readonly energized: boolean }
export interface Mission10EnergySolution {
  readonly connectedRelayCount: number;
  readonly breakRelayId: string | null;
  readonly receiverPowered: boolean;
  readonly energizedSegments: readonly Mission10EnergySegment[];
}

const directionOrder: readonly CardinalDirection[] = ['N', 'E', 'S', 'W'];
const directionDelta: Readonly<Record<CardinalDirection, Mission10GridPoint>> = {
  N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 },
};
const opposite: Readonly<Record<CardinalDirection, CardinalDirection>> = { N: 'S', E: 'W', S: 'N', W: 'E' };

export function normalizeOrientation(orientation: number): number { return ((Math.trunc(orientation) % 4) + 4) % 4; }
function rotateDirection(direction: CardinalDirection, turns: number): CardinalDirection {
  return directionOrder[(directionOrder.indexOf(direction) + normalizeOrientation(turns)) % 4];
}
function pointKey(point: Mission10GridPoint): string { return `${point.x},${point.y}`; }
function step(point: Mission10GridPoint, direction: CardinalDirection): Mission10GridPoint {
  const delta = directionDelta[direction];
  return { x: point.x + delta.x, y: point.y + delta.y };
}
function samePoint(a: Mission10GridPoint, b: Mission10GridPoint): boolean { return a.x === b.x && a.y === b.y; }

const horizontalRelays: readonly [Mission10RelayDefinition, Mission10RelayDefinition, Mission10RelayDefinition] = [
  { id: 'R1', position: { x: 1, y: 0 }, baseInput: 'W', baseOutput: 'E' },
  { id: 'R2', position: { x: 2, y: 0 }, baseInput: 'W', baseOutput: 'E' },
  { id: 'R3', position: { x: 3, y: 0 }, baseInput: 'W', baseOutput: 'E' },
];

export const MISSION10_ENERGY_CONFIGS: readonly Mission10EnergyConfig[] = [
  { id: 'ENERGY_A', source: { x: 0, y: 0 }, sourceDirection: 'E', receiver: { x: 4, y: 0 }, relays: horizontalRelays, initialOrientations: { R1: 3, R2: 3, R3: 3 } },
  { id: 'ENERGY_B', source: { x: 0, y: 0 }, sourceDirection: 'E', receiver: { x: 4, y: 0 }, relays: horizontalRelays, initialOrientations: { R1: 2, R2: 3, R3: 2 } },
  { id: 'ENERGY_C', source: { x: 0, y: 0 }, sourceDirection: 'E', receiver: { x: 4, y: 0 }, relays: horizontalRelays, initialOrientations: { R1: 1, R2: 1, R3: 3 } },
] as const;

export function getMission10EnergyConfig(configId: string): Mission10EnergyConfig {
  const config = MISSION10_ENERGY_CONFIGS.find((candidate) => candidate.id === configId);
  if (!config) throw new Error(`Unknown Mission 10 energy config: ${configId}`);
  return config;
}

export function solveMission10Energy(config: Mission10EnergyConfig, orientations: Readonly<Record<string, number>>): Mission10EnergySolution {
  const relayByPosition = new Map(config.relays.map((relay) => [pointKey(relay.position), relay]));
  const energizedSegments: Mission10EnergySegment[] = [];
  let position = config.source;
  let direction = config.sourceDirection;
  let connectedRelayCount = 0;
  const visited = new Set<string>();
  for (let guard = 0; guard < config.relays.length + 1; guard += 1) {
    const next = step(position, direction);
    energizedSegments.push({ from: position, to: next, energized: true });
    if (samePoint(next, config.receiver)) return { connectedRelayCount, breakRelayId: null, receiverPowered: true, energizedSegments };
    const relay = relayByPosition.get(pointKey(next));
    if (!relay || visited.has(relay.id)) return { connectedRelayCount, breakRelayId: relay?.id ?? null, receiverPowered: false, energizedSegments };
    visited.add(relay.id);
    const orientation = normalizeOrientation(orientations[relay.id] ?? 0);
    if (rotateDirection(relay.baseInput, orientation) !== opposite[direction]) return { connectedRelayCount, breakRelayId: relay.id, receiverPowered: false, energizedSegments };
    connectedRelayCount += 1;
    position = next;
    direction = rotateDirection(relay.baseOutput, orientation);
  }
  return { connectedRelayCount, breakRelayId: null, receiverPowered: false, energizedSegments };
}

export function findMission10EnergySolution(config: Mission10EnergyConfig): { readonly orientations: Readonly<Record<string, number>>; readonly taps: number } | null {
  const relayIds = config.relays.map((relay) => relay.id);
  const queue: Array<{ readonly values: Readonly<Record<string, number>>; readonly taps: number }> = [{ values: { ...config.initialOrientations }, taps: 0 }];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const key = relayIds.map((id) => normalizeOrientation(current.values[id] ?? 0)).join(',');
    if (visited.has(key)) continue;
    visited.add(key);
    if (solveMission10Energy(config, current.values).receiverPowered) return { orientations: current.values, taps: current.taps };
    for (const id of relayIds) queue.push({ values: { ...current.values, [id]: normalizeOrientation((current.values[id] ?? 0) + 1) }, taps: current.taps + 1 });
  }
  return null;
}

export function findMission10EnergyOptimalTaps(config: Mission10EnergyConfig): number {
  return findMission10EnergySolution(config)?.taps ?? Number.POSITIVE_INFINITY;
}

export function assertMission10EnergyContracts(): void {
  if (MISSION10_ENERGY_CONFIGS.length !== 3) throw new Error('Mission 10 energy requires exactly three authored configs');
  const ids = new Set<string>();
  for (const config of MISSION10_ENERGY_CONFIGS) {
    if (ids.has(config.id) || config.relays.length !== 3) throw new Error(`Invalid energy config ${config.id}`);
    ids.add(config.id);
    if (new Set(config.relays.map((relay) => relay.id)).size !== 3) throw new Error(`Duplicate relay in ${config.id}`);
    const taps = findMission10EnergyOptimalTaps(config);
    if (taps < 3 || taps > 7) throw new Error(`${config.id} optimal taps ${taps} outside 3-7`);
  }
}

assertMission10EnergyContracts();
