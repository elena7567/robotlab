export type WireColor = 'red' | 'blue' | 'green' | 'yellow';
export type ConnectionResult = 'correct' | 'wrong' | 'ignored';

export interface ConnectionChallenge {
  readonly id: 'basic' | 'crossed' | 'staggered';
  readonly colors: readonly WireColor[];
  readonly staggered: boolean;
}

export interface ConnectionsSnapshot {
  readonly challengeIndex: number;
  readonly challengeCount: 3;
  readonly challenge: ConnectionChallenge;
  readonly destinationOrder: readonly WireColor[];
  readonly connected: readonly WireColor[];
  readonly completed: boolean;
}

const CHALLENGES: readonly ConnectionChallenge[] = [
  { id: 'basic', colors: ['red', 'blue', 'green'], staggered: false },
  { id: 'crossed', colors: ['red', 'blue', 'green', 'yellow'], staggered: false },
  { id: 'staggered', colors: ['red', 'blue', 'green', 'yellow'], staggered: true },
] as const;

interface MutableConnectionsState {
  challengeIndex: number;
  destinationOrder: WireColor[];
  connected: WireColor[];
  completed: boolean;
}

function shuffledReadableOrder(colors: readonly WireColor[], previous: readonly WireColor[] = []): WireColor[] {
  const order = [...colors];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  const identical = (candidate: readonly WireColor[], reference: readonly WireColor[]): boolean =>
    candidate.length === reference.length && candidate.every((color, index) => color === reference[index]);
  if (identical(order, colors) || identical(order, previous)) order.push(order.shift()!);
  return order;
}

function initialState(): MutableConnectionsState {
  return {
    challengeIndex: 0,
    destinationOrder: shuffledReadableOrder(CHALLENGES[0].colors),
    connected: [],
    completed: false,
  };
}

let state = initialState();

export const connectionsMechanic = {
  get snapshot(): Readonly<ConnectionsSnapshot> {
    return {
      challengeIndex: state.challengeIndex,
      challengeCount: 3,
      challenge: CHALLENGES[state.challengeIndex],
      destinationOrder: [...state.destinationOrder],
      connected: [...state.connected],
      completed: state.completed,
    };
  },
  reset(): void { state = initialState(); },
  connect(source: WireColor, target: WireColor): ConnectionResult {
    if (state.completed || state.connected.includes(source) || state.connected.includes(target)) return 'ignored';
    if (source !== target) return 'wrong';
    state.connected.push(source);
    return 'correct';
  },
  hint(): WireColor | null {
    return CHALLENGES[state.challengeIndex].colors.find((color) => !state.connected.includes(color)) ?? null;
  },
  get challengeComplete(): boolean {
    return state.connected.length === CHALLENGES[state.challengeIndex].colors.length;
  },
  continue(): 'next' | 'mission-complete' | 'ignored' {
    if (!this.challengeComplete || state.completed) return 'ignored';
    if (state.challengeIndex === CHALLENGES.length - 1) {
      state.completed = true;
      return 'mission-complete';
    }
    const previous = state.destinationOrder;
    state.challengeIndex += 1;
    state.destinationOrder = shuffledReadableOrder(CHALLENGES[state.challengeIndex].colors, previous);
    state.connected = [];
    return 'next';
  },
};
