import { getMission9Puzzle, isMission9CandidateForStage, type Mission9CandidateId, type Mission9PlayStage, type Mission9TargetId } from './mission9Puzzles.ts';

export type Mission9InteractionState = 'IDLE' | 'SELECTED' | 'PLACING' | 'REJECTING' | 'SNAPPING' | 'TRANSITIONING' | 'LOCKED';
export interface Mission9InteractionSnapshot {
  readonly stage: Mission9PlayStage;
  readonly state: Mission9InteractionState;
  readonly selectedCandidateId: Mission9CandidateId | null;
  readonly targetHighlighted: boolean;
}
export type Mission9PlacementAttempt =
  | { readonly status: 'ignored' }
  | { readonly status: 'ready'; readonly candidateId: Mission9CandidateId; readonly targetId: Mission9TargetId; readonly matches: boolean };

export class Mission9InteractionController {
  private currentStage: Mission9PlayStage;
  private currentState: Mission9InteractionState = 'IDLE';
  private selected: Mission9CandidateId | null = null;

  constructor(stage: Mission9PlayStage) { this.currentStage = stage; }
  get snapshot(): Readonly<Mission9InteractionSnapshot> {
    return { stage: this.currentStage, state: this.currentState, selectedCandidateId: this.selected, targetHighlighted: this.currentState === 'SELECTED' };
  }
  selectCandidate(candidateId: Mission9CandidateId): boolean {
    if ((this.currentState !== 'IDLE' && this.currentState !== 'SELECTED') || !isMission9CandidateForStage(this.currentStage, candidateId)) return false;
    this.selected = candidateId;
    this.currentState = 'SELECTED';
    return true;
  }
  clearSelection(): boolean {
    if (this.currentState !== 'IDLE' && this.currentState !== 'SELECTED') return false;
    this.selected = null;
    this.currentState = 'IDLE';
    return true;
  }
  highlightTarget(): boolean { return this.currentState === 'SELECTED' && this.selected !== null; }
  attemptPlacement(targetId: Mission9TargetId): Mission9PlacementAttempt {
    const puzzle = getMission9Puzzle(this.currentStage);
    if (this.currentState !== 'SELECTED' || !this.selected || targetId !== puzzle.targetId) return { status: 'ignored' };
    this.currentState = 'PLACING';
    return { status: 'ready', candidateId: this.selected, targetId, matches: this.selected === puzzle.correctCandidateId };
  }
  rejectCandidate(): boolean {
    if (this.currentState !== 'PLACING') return false;
    this.currentState = 'REJECTING';
    return true;
  }
  finishRejection(keepSelection = false): boolean {
    if (this.currentState !== 'REJECTING') return false;
    if (!keepSelection) this.selected = null;
    this.currentState = this.selected ? 'SELECTED' : 'IDLE';
    return true;
  }
  confirmPlacement(): boolean {
    if (this.currentState !== 'PLACING') return false;
    this.currentState = 'SNAPPING';
    return true;
  }
  beginTransition(): boolean {
    if (this.currentState !== 'SNAPPING') return false;
    this.currentState = 'TRANSITIONING';
    return true;
  }
  lockInput(): void { this.currentState = 'LOCKED'; }
  unlockInput(stage: Mission9PlayStage = this.currentStage): void {
    this.currentStage = stage;
    this.selected = null;
    this.currentState = 'IDLE';
  }
}