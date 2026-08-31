/** Shared accessibility contract for every child-facing game screen. */
export const CHILD_UI = {
  typography: {
    taskLabelMin: 14,
    titleMin: 20,
    instructionMin: 16,
    feedbackMin: 14,
    controlMin: 16,
    statusMin: 14,
    tutorialMin: 14,
  },
  touch: {
    minimum: 56,
    preferred: 64,
    gapMinimum: 8,
  },
  visuals: {
    choiceMin: 48,
    referenceMin: 56,
  },
  flow: {
    selectionResolveMs: 90,
    correctHoldMs: 720,
    finalCorrectHoldMs: 1550,
  },
} as const;
