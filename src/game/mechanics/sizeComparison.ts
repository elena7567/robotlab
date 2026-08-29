export const SIZE_IDS = ['small', 'medium', 'large'] as const;

export type SizeId = (typeof SIZE_IDS)[number];
export type SizeChoiceKey = `size-${SizeId}`;
export type SizeComparisonResult = 'idle' | 'wrong' | 'correct';

export interface SizeComparisonChallenge {
  readonly id: string;
  readonly instruction: string;
  readonly sizes: readonly SizeId[];
  readonly correctSize: SizeId;
  readonly hint: string;
}

export const SIZE_SCALE_MULTIPLIERS: Readonly<Record<SizeId, number>> = {
  small: 0.7,
  medium: 1,
  large: 1.3,
};

export const SIZE_COMPARISON_CHALLENGES: readonly SizeComparisonChallenge[] = [
  {
    id: 'largest-battery',
    instruction: 'Найди самую большую батарейку',
    sizes: SIZE_IDS,
    correctSize: 'large',
    hint: 'Сравни, какая батарейка занимает больше места',
  },
  {
    id: 'smallest-battery',
    instruction: 'Найди самую маленькую батарейку',
    sizes: SIZE_IDS,
    correctSize: 'small',
    hint: 'Посмотри, какая батарейка меньше остальных',
  },
  {
    id: 'medium-battery',
    instruction: 'Какая батарейка среднего размера?',
    sizes: SIZE_IDS,
    correctSize: 'medium',
    hint: 'Она не самая большая и не самая маленькая',
  },
] as const;

export interface SizeComparisonSnapshot {
  readonly challengeIndex: number;
  readonly challengeCount: number;
  readonly challenge: SizeComparisonChallenge;
  readonly orderedKeys: readonly SizeChoiceKey[];
  readonly correctKey: SizeChoiceKey;
  readonly selectedKey: SizeChoiceKey | null;
  readonly result: SizeComparisonResult;
  readonly hintShown: boolean;
  readonly completed: boolean;
  readonly isFinalChallenge: boolean;
}

const toChoiceKey = (size: SizeId): SizeChoiceKey => `size-${size}`;

function shuffledSizes(sizes: readonly SizeId[], previousCorrectSlot = -1, correctSize?: SizeId): SizeId[] {
  const shuffled = [...sizes];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  if (correctSize && shuffled.indexOf(correctSize) === previousCorrectSlot) {
    const swapIndex = (previousCorrectSlot + 1) % shuffled.length;
    [shuffled[previousCorrectSlot], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[previousCorrectSlot]];
  }
  return shuffled;
}

export class SizeComparisonMechanic {
  private challengeIndex = 0;
  private selectedKey: SizeChoiceKey | null = null;
  private result: SizeComparisonResult = 'idle';
  private hintShown = false;
  private completed = false;
  private orders: SizeId[][] = [];

  constructor() {
    this.createOrders();
  }

  get snapshot(): SizeComparisonSnapshot {
    const challenge = SIZE_COMPARISON_CHALLENGES[this.challengeIndex];
    return {
      challengeIndex: this.challengeIndex,
      challengeCount: SIZE_COMPARISON_CHALLENGES.length,
      challenge,
      orderedKeys: this.orders[this.challengeIndex].map(toChoiceKey),
      correctKey: toChoiceKey(challenge.correctSize),
      selectedKey: this.selectedKey,
      result: this.result,
      hintShown: this.hintShown,
      completed: this.completed,
      isFinalChallenge: this.challengeIndex === SIZE_COMPARISON_CHALLENGES.length - 1,
    };
  }

  reset(): SizeComparisonSnapshot {
    this.challengeIndex = 0;
    this.selectedKey = null;
    this.result = 'idle';
    this.hintShown = false;
    this.completed = false;
    this.createOrders();
    return this.snapshot;
  }

  select(key: SizeChoiceKey): SizeComparisonSnapshot {
    if (this.result === 'correct' || this.completed) return this.snapshot;
    this.selectedKey = key;
    this.result = 'idle';
    return this.snapshot;
  }

  check(): SizeComparisonSnapshot {
    if (!this.selectedKey || this.result === 'correct' || this.completed) return this.snapshot;
    this.result = this.selectedKey === this.snapshot.correctKey ? 'correct' : 'wrong';
    if (this.result === 'wrong') this.selectedKey = null;
    if (this.result === 'correct' && this.snapshot.isFinalChallenge) this.completed = true;
    return this.snapshot;
  }

  showHint(): SizeComparisonSnapshot {
    if (this.result !== 'correct' && !this.completed) this.hintShown = true;
    return this.snapshot;
  }

  continue(): SizeComparisonSnapshot {
    if (this.result !== 'correct' || this.completed) return this.snapshot;
    this.challengeIndex += 1;
    this.selectedKey = null;
    this.result = 'idle';
    this.hintShown = false;
    return this.snapshot;
  }

  private createOrders(): void {
    let previousCorrectSlot = -1;
    this.orders = SIZE_COMPARISON_CHALLENGES.map((challenge) => {
      const order = shuffledSizes(challenge.sizes, previousCorrectSlot, challenge.correctSize);
      previousCorrectSlot = order.indexOf(challenge.correctSize);
      return order;
    });
  }
}

export const sizeComparisonMechanic = new SizeComparisonMechanic();
