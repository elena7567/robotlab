export const MEMORY_PAIR_IDS = ['apple', 'banana', 'star', 'battery'] as const;

export type MemoryPairId = (typeof MEMORY_PAIR_IDS)[number];
export type MemoryCardState = 'FACE_DOWN' | 'FACE_UP' | 'MATCHED';

export interface MemoryCardStateData {
  readonly id: string;
  readonly pairId: MemoryPairId;
  readonly textureKey: 'odd-apple' | 'odd-banana' | 'sequence-star' | 'size-battery';
  state: MemoryCardState;
}

export interface MemorySnapshot {
  readonly cards: readonly MemoryCardStateData[];
  readonly firstCardId: string | null;
  readonly secondCardId: string | null;
  readonly matchedPairs: number;
  readonly totalPairs: 4;
  readonly locked: boolean;
  readonly completed: boolean;
}

export type MemorySelectionResult = 'ignored' | 'first' | 'second';
export type MemoryResolution = 'none' | 'match' | 'mismatch' | 'complete';

const TEXTURES: Readonly<Record<MemoryPairId, MemoryCardStateData['textureKey']>> = {
  apple: 'odd-apple',
  banana: 'odd-banana',
  star: 'sequence-star',
  battery: 'size-battery',
};

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createsAdjacentPair(cards: readonly MemoryCardStateData[]): boolean {
  return cards.some((card, index) => index % 4 !== 3 && cards[index + 1]?.pairId === card.pairId);
}

function createCards(): MemoryCardStateData[] {
  const deck = MEMORY_PAIR_IDS.flatMap((pairId) => [0, 1].map((copy) => ({
    id: `${pairId}-${copy}`,
    pairId,
    textureKey: TEXTURES[pairId],
    state: 'FACE_DOWN' as const,
  })));
  let shuffled = shuffle(deck);
  for (let attempt = 0; attempt < 24 && createsAdjacentPair(shuffled); attempt += 1) shuffled = shuffle(deck);
  return shuffled;
}

export class MemoryMechanic {
  private cards: MemoryCardStateData[] = createCards();
  private firstCardId: string | null = null;
  private secondCardId: string | null = null;
  private matchedPairs = 0;
  private locked = false;
  private completed = false;

  get snapshot(): MemorySnapshot {
    return {
      cards: this.cards.map((card) => ({ ...card })),
      firstCardId: this.firstCardId,
      secondCardId: this.secondCardId,
      matchedPairs: this.matchedPairs,
      totalPairs: 4,
      locked: this.locked,
      completed: this.completed,
    };
  }

  reset(): MemorySnapshot {
    this.cards = createCards();
    this.firstCardId = null;
    this.secondCardId = null;
    this.matchedPairs = 0;
    this.locked = false;
    this.completed = false;
    return this.snapshot;
  }

  select(cardId: string): MemorySelectionResult {
    const card = this.cards.find((candidate) => candidate.id === cardId);
    if (!card || this.locked || this.completed || card.state !== 'FACE_DOWN') return 'ignored';
    card.state = 'FACE_UP';
    if (!this.firstCardId) {
      this.firstCardId = cardId;
      return 'first';
    }
    if (this.firstCardId === cardId) return 'ignored';
    this.secondCardId = cardId;
    this.locked = true;
    return 'second';
  }

  resolvePair(): MemoryResolution {
    if (!this.locked || !this.firstCardId || !this.secondCardId) return 'none';
    const first = this.cards.find((card) => card.id === this.firstCardId);
    const second = this.cards.find((card) => card.id === this.secondCardId);
    if (!first || !second) return 'none';
    const matched = first.pairId === second.pairId;
    first.state = matched ? 'MATCHED' : 'FACE_DOWN';
    second.state = matched ? 'MATCHED' : 'FACE_DOWN';
    this.firstCardId = null;
    this.secondCardId = null;
    this.locked = false;
    if (!matched) return 'mismatch';
    this.matchedPairs += 1;
    this.completed = this.matchedPairs === 4;
    return this.completed ? 'complete' : 'match';
  }

  hintCardIds(): readonly string[] {
    if (this.locked || this.completed) return [];
    const unmatched = this.cards.filter((card) => card.state !== 'MATCHED');
    if (this.firstCardId) {
      const first = unmatched.find((card) => card.id === this.firstCardId);
      const partner = unmatched.find((card) => card.pairId === first?.pairId && card.id !== first.id);
      return partner ? [partner.id] : [];
    }
    return shuffle(unmatched.filter((card) => card.state === 'FACE_DOWN')).slice(0, 2).map((card) => card.id);
  }
}

export const memoryMechanic = new MemoryMechanic();
