import { normalizeOrientation, type CardinalDirection, type Mission10GridPoint } from './energyRelayPuzzle.ts';

export interface Mission10ReflectorDefinition { readonly id: string; readonly position: Mission10GridPoint }
export interface Mission10SignalConfig {
  readonly id: string;
  readonly bounds: { readonly width: number; readonly height: number };
  readonly emitter: Mission10GridPoint;
  readonly emitterDirection: CardinalDirection;
  readonly receiver: Mission10GridPoint;
  readonly reflectors: readonly Mission10ReflectorDefinition[];
  readonly initialOrientations: Readonly<Record<string, number>>;
}
export interface Mission10SignalSegment { readonly from: Mission10GridPoint; readonly to: Mission10GridPoint; readonly direction: CardinalDirection }
export interface Mission10SignalSolution { readonly segments: readonly Mission10SignalSegment[]; readonly firstIncompleteReflectorId: string | null; readonly receiverHit: boolean }

const delta: Readonly<Record<CardinalDirection, Mission10GridPoint>> = {
  N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 },
};
const slashReflection: Readonly<Record<CardinalDirection, CardinalDirection>> = { N: 'E', E: 'N', S: 'W', W: 'S' };
const backslashReflection: Readonly<Record<CardinalDirection, CardinalDirection>> = { N: 'W', W: 'N', S: 'E', E: 'S' };

function key(point: Mission10GridPoint): string { return `${point.x},${point.y}`; }
function samePoint(a: Mission10GridPoint, b: Mission10GridPoint): boolean { return a.x === b.x && a.y === b.y; }
function inBounds(point: Mission10GridPoint, config: Mission10SignalConfig): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < config.bounds.width && point.y < config.bounds.height;
}
export function normalizeSignalOrientation(orientation: number): 0 | 1 {
  return (normalizeOrientation(orientation) % 2) as 0 | 1;
}

export const MISSION10_SIGNAL_CONFIGS: readonly Mission10SignalConfig[] = [
  {
    id: 'SIGNAL_A', bounds: { width: 5, height: 5 }, emitter: { x: 0, y: 1 }, emitterDirection: 'E', receiver: { x: 0, y: 3 },
    reflectors: [{ id: 'M1', position: { x: 2, y: 1 } }, { id: 'M2', position: { x: 2, y: 3 } }], initialOrientations: { M1: 0, M2: 1 },
  },
  {
    id: 'SIGNAL_B', bounds: { width: 6, height: 5 }, emitter: { x: 0, y: 3 }, emitterDirection: 'E', receiver: { x: 5, y: 1 },
    reflectors: [{ id: 'M1', position: { x: 2, y: 3 } }, { id: 'M2', position: { x: 2, y: 1 } }], initialOrientations: { M1: 1, M2: 1 },
  },
  {
    id: 'SIGNAL_C', bounds: { width: 6, height: 6 }, emitter: { x: 0, y: 1 }, emitterDirection: 'E', receiver: { x: 4, y: 1 },
    reflectors: [{ id: 'M1', position: { x: 2, y: 1 } }, { id: 'M2', position: { x: 2, y: 4 } }, { id: 'M3', position: { x: 4, y: 4 } }],
    initialOrientations: { M1: 0, M2: 0, M3: 1 },
  },
] as const;

export function getMission10SignalConfig(configId: string): Mission10SignalConfig {
  const config = MISSION10_SIGNAL_CONFIGS.find((candidate) => candidate.id === configId);
  if (!config) throw new Error(`Unknown Mission 10 signal config: ${configId}`);
  return config;
}

export function solveMission10Signal(config: Mission10SignalConfig, orientations: Readonly<Record<string, number>>): Mission10SignalSolution {
  const reflectorAt = new Map(config.reflectors.map((reflector) => [key(reflector.position), reflector]));
  const segments: Mission10SignalSegment[] = [];
  const visited = new Set<string>();
  let point = config.emitter;
  let direction = config.emitterDirection;
  let firstIncompleteReflectorId: string | null = config.reflectors[0]?.id ?? null;
  for (let guard = 0; guard < config.bounds.width * config.bounds.height * 4; guard += 1) {
    const offset = delta[direction];
    const next = { x: point.x + offset.x, y: point.y + offset.y };
    // Grid points are apparatus centres; the playfield ends half a cell beyond
    // its outer centres. Keep an incomplete beam visible up to that exact edge.
    if (!inBounds(next, config)) {
      segments.push({ from: point, to: { x: point.x + offset.x / 2, y: point.y + offset.y / 2 }, direction });
      return { segments, firstIncompleteReflectorId, receiverHit: false };
    }
    segments.push({ from: point, to: next, direction });
    if (samePoint(next, config.receiver)) return { segments, firstIncompleteReflectorId: null, receiverHit: true };
    const reflector = reflectorAt.get(key(next));
    if (reflector) {
      const stateKey = `${reflector.id}:${direction}`;
      if (visited.has(stateKey)) return { segments, firstIncompleteReflectorId: reflector.id, receiverHit: false };
      visited.add(stateKey);
      firstIncompleteReflectorId = reflector.id;
      const orientation = normalizeSignalOrientation(orientations[reflector.id] ?? 0);
      direction = orientation === 0 ? slashReflection[direction] : backslashReflection[direction];
    }
    point = next;
  }
  return { segments, firstIncompleteReflectorId, receiverHit: false };
}

export function findMission10SignalSolution(config: Mission10SignalConfig): Readonly<Record<string, number>> | null {
  const reflectorIds = config.reflectors.map((reflector) => reflector.id);
  for (let mask = 0; mask < 2 ** reflectorIds.length; mask += 1) {
    const orientations: Record<string, number> = {};
    reflectorIds.forEach((id, index) => { orientations[id] = (mask >> index) & 1; });
    if (solveMission10Signal(config, orientations).receiverHit) return orientations;
  }
  return null;
}

export function assertMission10SignalContracts(): void {
  if (MISSION10_SIGNAL_CONFIGS.length !== 3) throw new Error('Mission 10 signal requires exactly three authored configs');
  const ids = new Set<string>();
  for (const [index, config] of MISSION10_SIGNAL_CONFIGS.entries()) {
    if (ids.has(config.id) || config.reflectors.length !== [2, 2, 3][index]) throw new Error(`Invalid signal config ${config.id}`);
    ids.add(config.id);
    const devicePoints = [config.emitter, config.receiver, ...config.reflectors.map((reflector) => reflector.position)];
    if (!Number.isInteger(config.bounds.width) || !Number.isInteger(config.bounds.height)
      || devicePoints.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y) || !inBounds(point, config))
      || new Set(devicePoints.map(key)).size !== devicePoints.length
      || new Set(config.reflectors.map((reflector) => reflector.id)).size !== config.reflectors.length
      || config.reflectors.some((reflector) => !Number.isInteger(config.initialOrientations[reflector.id]))) {
      throw new Error(`Invalid signal apparatus ${config.id}`);
    }
    const taps = findMission10SignalOptimalTaps(config);
    if (taps === null || taps < 2 || taps > 6) throw new Error(`Signal config ${config.id} must require 2-6 taps`);
  }
}

/** A tap swaps slash/backslash, so each differing mirror parity costs one tap. */
export function findMission10SignalOptimalTaps(config: Mission10SignalConfig): number | null {
  let best = Infinity;
  for (let mask = 0; mask < 2 ** config.reflectors.length; mask += 1) {
    const orientations: Record<string, number> = {};
    let taps = 0;
    config.reflectors.forEach((reflector, index) => {
      orientations[reflector.id] = (mask >> index) & 1;
      if (normalizeSignalOrientation(config.initialOrientations[reflector.id] ?? 0) !== orientations[reflector.id]) taps += 1;
    });
    if (solveMission10Signal(config, orientations).receiverHit) best = Math.min(best, taps);
  }
  return Number.isFinite(best) ? best : null;
}

assertMission10SignalContracts();
