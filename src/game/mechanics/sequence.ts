export const SEQUENCE_SYMBOLS = ['star', 'gear', 'lightning', 'planet'] as const;

export type SequenceSymbol = (typeof SEQUENCE_SYMBOLS)[number];
export type SequenceAssetKey = `sequence-${SequenceSymbol}`;
export type SequenceResult = 'idle' | 'wrong' | 'correct';

export interface SequenceChallenge {
  readonly id: string;
  readonly sequence: readonly SequenceSymbol[];
  readonly options: readonly SequenceSymbol[];
  readonly correctAnswer: SequenceSymbol;
  readonly hint: string;
  readonly difficulty: 1 | 2 | 3;
}

export const SEQUENCE_CHALLENGES: readonly SequenceChallenge[] = [
  {
    id: 'alternating-star-gear',
    sequence: ['star', 'gear', 'star', 'gear'],
    options: ['star', 'gear', 'lightning', 'planet'],
    correctAnswer: 'star',
    hint: 'Посмотри, какие картинки чередуются',
    difficulty: 1,
  },
  {
    id: 'two-lightning-one-planet',
    sequence: ['lightning', 'lightning', 'planet', 'lightning', 'lightning'],
    options: ['planet', 'star', 'gear', 'lightning'],
    correctAnswer: 'planet',
    hint: 'После двух молний появляется одна и та же картинка',
    difficulty: 2,
  },
  {
    id: 'three-symbol-repeat',
    sequence: ['star', 'lightning', 'planet', 'star', 'lightning'],
    options: ['planet', 'gear', 'star', 'lightning'],
    correctAnswer: 'planet',
    hint: 'Ряд повторяется по три картинки',
    difficulty: 2,
  },
] as const;

export interface SequenceSnapshot {
  readonly challengeIndex: number;
  readonly challengeCount: number;
  readonly challenge: SequenceChallenge;
  readonly sequenceKeys: readonly SequenceAssetKey[];
  readonly optionKeys: readonly SequenceAssetKey[];
  readonly correctKey: SequenceAssetKey;
  readonly selectedKey: SequenceAssetKey | null;
  readonly result: SequenceResult;
  readonly hintShown: boolean;
  readonly completed: boolean;
  readonly isFinalChallenge: boolean;
}

const toAssetKey = (symbol: SequenceSymbol): SequenceAssetKey => `sequence-${symbol}`;

function arrangeOptions(challenge: SequenceChallenge, challengeIndex: number): readonly SequenceSymbol[] {
  const shift = (challengeIndex % (challenge.options.length - 1)) + 1;
  return [...challenge.options.slice(shift), ...challenge.options.slice(0, shift)];
}

export class SequenceMechanic {
  private challengeIndex = 0;
  private selectedKey: SequenceAssetKey | null = null;
  private result: SequenceResult = 'idle';
  private hintShown = false;
  private completed = false;

  get snapshot(): SequenceSnapshot {
    const challenge = SEQUENCE_CHALLENGES[this.challengeIndex];
    return {
      challengeIndex: this.challengeIndex,
      challengeCount: SEQUENCE_CHALLENGES.length,
      challenge,
      sequenceKeys: challenge.sequence.map(toAssetKey),
      optionKeys: arrangeOptions(challenge, this.challengeIndex).map(toAssetKey),
      correctKey: toAssetKey(challenge.correctAnswer),
      selectedKey: this.selectedKey,
      result: this.result,
      hintShown: this.hintShown,
      completed: this.completed,
      isFinalChallenge: this.challengeIndex === SEQUENCE_CHALLENGES.length - 1,
    };
  }

  reset(): SequenceSnapshot {
    this.challengeIndex = 0;
    this.selectedKey = null;
    this.result = 'idle';
    this.hintShown = false;
    this.completed = false;
    return this.snapshot;
  }

  select(key: SequenceAssetKey): SequenceSnapshot {
    if (this.result === 'correct' || this.completed) return this.snapshot;
    this.selectedKey = key;
    this.result = 'idle';
    return this.snapshot;
  }

  check(): SequenceSnapshot {
    if (!this.selectedKey || this.result === 'correct' || this.completed) return this.snapshot;
    this.result = this.selectedKey === this.snapshot.correctKey ? 'correct' : 'wrong';
    if (this.result === 'wrong') this.selectedKey = null;
    if (this.result === 'correct' && this.snapshot.isFinalChallenge) this.completed = true;
    return this.snapshot;
  }

  showHint(): SequenceSnapshot {
    if (this.result !== 'correct' && !this.completed) this.hintShown = true;
    return this.snapshot;
  }

  continue(): SequenceSnapshot {
    if (this.result !== 'correct' || this.completed) return this.snapshot;
    this.challengeIndex += 1;
    this.selectedKey = null;
    this.result = 'idle';
    this.hintShown = false;
    return this.snapshot;
  }
}

export const sequenceMechanic = new SequenceMechanic();
