export const ODD_ONE_OUT_OBJECTS = [
  { key: 'odd-apple', edible: true },
  { key: 'odd-banana', edible: true },
  { key: 'odd-carrot', edible: true },
  { key: 'odd-ball', edible: false },
] as const;

export type OddOneOutObjectKey = (typeof ODD_ONE_OUT_OBJECTS)[number]['key'];
export type OddOneOutResult = 'idle' | 'wrong' | 'correct';

export interface OddOneOutSnapshot {
  readonly selectedKey: OddOneOutObjectKey | null;
  readonly result: OddOneOutResult;
  readonly hintShown: boolean;
  readonly completed: boolean;
}

const CORRECT_KEY: OddOneOutObjectKey = 'odd-ball';

export class OddOneOutMechanic {
  private selectedKey: OddOneOutObjectKey | null = null;
  private result: OddOneOutResult;
  private hintShown = false;
  private completed: boolean;

  constructor(completed = false) {
    this.completed = completed;
    this.result = completed ? 'correct' : 'idle';
    this.selectedKey = completed ? CORRECT_KEY : null;
  }

  get snapshot(): OddOneOutSnapshot {
    return {
      selectedKey: this.selectedKey,
      result: this.result,
      hintShown: this.hintShown,
      completed: this.completed,
    };
  }

  select(key: OddOneOutObjectKey): OddOneOutSnapshot {
    if (this.completed) return this.snapshot;
    this.selectedKey = key;
    this.result = 'idle';
    return this.snapshot;
  }

  check(): OddOneOutSnapshot {
    if (!this.selectedKey || this.completed) return this.snapshot;
    this.result = this.selectedKey === CORRECT_KEY ? 'correct' : 'wrong';
    this.completed = this.result === 'correct';
    if (this.result === 'wrong') this.selectedKey = null;
    return this.snapshot;
  }

  showHint(): OddOneOutSnapshot {
    if (!this.completed) this.hintShown = true;
    return this.snapshot;
  }
}
