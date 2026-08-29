export type BatteryLevel = 'low' | 'medium' | 'full';
export type EnergyResult = 'idle' | 'correct' | 'wrong';

export interface EnergyChallenge {
  readonly id: 'fullest' | 'lowest' | 'order';
  readonly instruction: string;
  readonly kind: 'select' | 'order';
  readonly correctSelection?: BatteryLevel;
  readonly correctOrder?: readonly BatteryLevel[];
}

export interface EnergySnapshot {
  readonly challengeIndex: number;
  readonly challengeCount: 3;
  readonly challenge: EnergyChallenge;
  readonly selection: BatteryLevel | null;
  readonly order: readonly BatteryLevel[];
  readonly result: EnergyResult;
  readonly hintShown: boolean;
  readonly completed: boolean;
}

const CHALLENGES: readonly EnergyChallenge[] = [
  { id: 'fullest', instruction: 'КАКАЯ БАТАРЕЯ ПОЛНАЯ?', kind: 'select', correctSelection: 'full' },
  { id: 'lowest', instruction: 'КАКАЯ БАТАРЕЯ ПОЧТИ ПУСТАЯ?', kind: 'select', correctSelection: 'low' },
  { id: 'order', instruction: 'РАССТАВЬ БАТАРЕИ ПО ПОРЯДКУ', kind: 'order', correctOrder: ['low', 'medium', 'full'] },
] as const;

interface MutableEnergyState {
  challengeIndex: number;
  selection: BatteryLevel | null;
  order: BatteryLevel[];
  result: EnergyResult;
  hintShown: boolean;
  completed: boolean;
}

const initial = (): MutableEnergyState => ({ challengeIndex: 0, selection: null, order: [], result: 'idle', hintShown: false, completed: false });
let state = initial();

export const energyMechanic = {
  get snapshot(): Readonly<EnergySnapshot> {
    return { ...state, order: [...state.order], challengeCount: 3, challenge: CHALLENGES[state.challengeIndex] };
  },
  reset(): void { state = initial(); },
  select(level: BatteryLevel): void {
    if (state.completed || state.result === 'correct' || CHALLENGES[state.challengeIndex].kind !== 'select') return;
    state.selection = level;
    state.result = 'idle';
  },
  toggleOrder(level: BatteryLevel): void {
    if (state.completed || state.result === 'correct' || CHALLENGES[state.challengeIndex].kind !== 'order') return;
    const existing = state.order.indexOf(level);
    if (existing >= 0) state.order.splice(existing, 1);
    else if (state.order.length < 3) state.order.push(level);
    state.result = 'idle';
  },
  hint(): BatteryLevel {
    state.hintShown = true;
    const challenge = CHALLENGES[state.challengeIndex];
    return challenge.kind === 'order' ? 'low' : challenge.correctSelection!;
  },
  check(): EnergyResult {
    if (state.completed || state.result === 'correct') return state.result;
    const challenge = CHALLENGES[state.challengeIndex];
    if (challenge.kind === 'select' && !state.selection) return 'idle';
    if (challenge.kind === 'order' && state.order.length < 3) return 'idle';
    const correct = challenge.kind === 'select'
      ? state.selection === challenge.correctSelection
      : state.order.every((level, index) => level === challenge.correctOrder?.[index]);
    state.result = correct ? 'correct' : 'wrong';
    if (!correct) {
      state.selection = null;
      state.order = [];
    }
    return state.result;
  },
  continue(): boolean {
    if (state.result !== 'correct') return false;
    if (state.challengeIndex === CHALLENGES.length - 1) {
      state.completed = true;
      return true;
    }
    state.challengeIndex += 1;
    state.selection = null;
    state.order = [];
    state.result = 'idle';
    state.hintShown = false;
    return true;
  },
};
