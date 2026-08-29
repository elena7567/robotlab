import type { OddOneOutObjectKey } from './oddOneOut';

export const SHADOW_IDS = ['apple', 'banana', 'carrot', 'ball'] as const;

export type ShadowId = (typeof SHADOW_IDS)[number];
export type ShadowChoiceKey = `shadow-${ShadowId}`;
export type ShadowMatchingResult = 'idle' | 'wrong' | 'correct';

export interface ShadowMatchingChallenge {
  readonly id: string;
  readonly targetKey: OddOneOutObjectKey;
  readonly correctKey: ShadowChoiceKey;
  readonly distractorKeys: readonly [ShadowChoiceKey, ShadowChoiceKey];
  readonly hint: string;
}

export const SHADOW_MATCHING_CHALLENGES: readonly ShadowMatchingChallenge[] = [
  {
    id: 'apple-shadow',
    targetKey: 'odd-apple',
    correctKey: 'shadow-apple',
    distractorKeys: ['shadow-banana', 'shadow-ball'],
    hint: 'Сравни контур яблока',
  },
  {
    id: 'banana-shadow',
    targetKey: 'odd-banana',
    correctKey: 'shadow-banana',
    distractorKeys: ['shadow-carrot', 'shadow-apple'],
    hint: 'Сравни изгиб банана',
  },
  {
    id: 'ball-shadow',
    targetKey: 'odd-ball',
    correctKey: 'shadow-ball',
    distractorKeys: ['shadow-apple', 'shadow-carrot'],
    hint: 'Найди круглый контур',
  },
] as const;

export interface ShadowMatchingSnapshot {
  readonly challengeIndex: number;
  readonly challengeCount: number;
  readonly challenge: ShadowMatchingChallenge;
  readonly targetKey: OddOneOutObjectKey;
  readonly orderedKeys: readonly ShadowChoiceKey[];
  readonly correctKey: ShadowChoiceKey;
  readonly selectedKey: ShadowChoiceKey | null;
  readonly result: ShadowMatchingResult;
  readonly hintShown: boolean;
  readonly completed: boolean;
  readonly isFinalChallenge: boolean;
}

function shuffledOptions(
  challenge: ShadowMatchingChallenge,
  previousCorrectSlot: number,
): ShadowChoiceKey[] {
  const options = [challenge.correctKey, ...challenge.distractorKeys];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
  }
  const correctSlot = options.indexOf(challenge.correctKey);
  if (correctSlot === previousCorrectSlot) {
    const alternateSlots = options.map((_, index) => index).filter((index) => index !== correctSlot);
    const alternateSlot = alternateSlots[Math.floor(Math.random() * alternateSlots.length)];
    [options[correctSlot], options[alternateSlot]] = [options[alternateSlot], options[correctSlot]];
  }
  return options;
}

export class ShadowMatchingMechanic {
  private challengeIndex = 0;
  private selectedKey: ShadowChoiceKey | null = null;
  private result: ShadowMatchingResult = 'idle';
  private hintShown = false;
  private completed = false;
  private orders: ShadowChoiceKey[][] = [];

  constructor() {
    this.createOrders();
  }

  get snapshot(): ShadowMatchingSnapshot {
    const challenge = SHADOW_MATCHING_CHALLENGES[this.challengeIndex];
    return {
      challengeIndex: this.challengeIndex,
      challengeCount: SHADOW_MATCHING_CHALLENGES.length,
      challenge,
      targetKey: challenge.targetKey,
      orderedKeys: this.orders[this.challengeIndex],
      correctKey: challenge.correctKey,
      selectedKey: this.selectedKey,
      result: this.result,
      hintShown: this.hintShown,
      completed: this.completed,
      isFinalChallenge: this.challengeIndex === SHADOW_MATCHING_CHALLENGES.length - 1,
    };
  }

  reset(): ShadowMatchingSnapshot {
    this.challengeIndex = 0;
    this.selectedKey = null;
    this.result = 'idle';
    this.hintShown = false;
    this.completed = false;
    this.createOrders();
    return this.snapshot;
  }

  select(key: ShadowChoiceKey): ShadowMatchingSnapshot {
    if (this.result === 'correct' || this.completed) return this.snapshot;
    this.selectedKey = key;
    this.result = 'idle';
    return this.snapshot;
  }

  check(): ShadowMatchingSnapshot {
    if (!this.selectedKey || this.result === 'correct' || this.completed) return this.snapshot;
    this.result = this.selectedKey === this.snapshot.correctKey ? 'correct' : 'wrong';
    if (this.result === 'wrong') this.selectedKey = null;
    if (this.result === 'correct' && this.snapshot.isFinalChallenge) this.completed = true;
    return this.snapshot;
  }

  showHint(): ShadowMatchingSnapshot {
    if (this.result !== 'correct' && !this.completed) this.hintShown = true;
    return this.snapshot;
  }

  continue(): ShadowMatchingSnapshot {
    if (this.result !== 'correct' || this.completed) return this.snapshot;
    this.challengeIndex += 1;
    this.selectedKey = null;
    this.result = 'idle';
    this.hintShown = false;
    return this.snapshot;
  }

  private createOrders(): void {
    let previousCorrectSlot = -1;
    this.orders = SHADOW_MATCHING_CHALLENGES.map((challenge) => {
      const order = shuffledOptions(challenge, previousCorrectSlot);
      previousCorrectSlot = order.indexOf(challenge.correctKey);
      return order;
    });
  }
}

export const shadowMatchingMechanic = new ShadowMatchingMechanic();
