import type { RectLayout, SemanticCompositionMode } from './responsiveLayout';
import { clampValue } from './fluidSizing';
import { CHILD_UI } from './childUi';

export interface ChildInteractionSize {
  readonly width: number;
  readonly height: number;
}

export interface ChildInteractionMetrics {
  readonly visibleObjectMin: number;
  readonly visibleObjectIdeal: number;
  readonly answerCardMin: ChildInteractionSize;
  readonly answerCardIdeal: ChildInteractionSize;
  readonly memoryCardMin: ChildInteractionSize;
  readonly memoryCardIdeal: ChildInteractionSize;
  readonly touchTargetMin: number;
  readonly titleGap: number;
  readonly instructionGap: number;
  readonly feedbackHeight: number;
  readonly mechanicGap: number;
  readonly artworkHeightRatio: number;
  readonly secondaryActionWidth: number;
  readonly compactFooter: boolean;
}

export interface ChildInteractionMetricInput {
  readonly availableMechanicWidth: number;
  readonly availableMechanicHeight: number;
  readonly semanticMode: SemanticCompositionMode;
  readonly safeRect: RectLayout;
}

/**
 * Resolves child-facing visual geometry independently from interactive hit size.
 * It is intentionally pure and is called only while a scene is constructed or
 * reconstructed after a committed viewport/composition change.
 */
export function resolveChildInteractionMetrics(input: ChildInteractionMetricInput): ChildInteractionMetrics {
  const shortLandscape = input.semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const phonePortrait = input.semanticMode.startsWith('PHONE_PORTRAIT');
  const compactHeight = input.availableMechanicHeight < 320;

  if (shortLandscape) {
    const fourAcrossWidth = (input.availableMechanicWidth - 36) / 4;
    const twoRowHeight = (input.availableMechanicHeight * 0.54 - 8) / 2;
    const answerWidth = clampValue(80, fourAcrossWidth, 110);
    const answerHeight = clampValue(56, input.availableMechanicHeight * 0.22, 72);
    const memoryHeight = clampValue(58, twoRowHeight, 80);
    const memoryWidth = clampValue(90, memoryHeight * 1.25, Math.min(125, fourAcrossWidth));
    return {
      visibleObjectMin: 48,
      visibleObjectIdeal: clampValue(52, input.availableMechanicHeight * 0.21, 64),
      answerCardMin: { width: 80, height: 56 },
      answerCardIdeal: { width: answerWidth, height: answerHeight },
      memoryCardMin: { width: 90, height: 58 },
      memoryCardIdeal: { width: memoryWidth, height: memoryHeight },
      touchTargetMin: CHILD_UI.touch.minimum,
      titleGap: 4,
      instructionGap: 5,
      feedbackHeight: 20,
      mechanicGap: 6,
      artworkHeightRatio: 0.75,
      secondaryActionWidth: clampValue(104, input.safeRect.width * 0.14, 124),
      compactFooter: input.availableMechanicHeight < 280,
    };
  }

  const answerWidth = clampValue(78, (input.availableMechanicWidth - 42) / 4, phonePortrait ? 102 : 112);
  const answerHeight = clampValue(58, input.availableMechanicHeight * 0.2, phonePortrait ? 82 : 92);
  const memoryHeight = clampValue(68, input.availableMechanicHeight * (phonePortrait ? 0.19 : 0.22), 112);
  return {
    visibleObjectMin: phonePortrait ? 48 : 52,
    visibleObjectIdeal: clampValue(56, input.availableMechanicHeight * 0.17, 72),
    answerCardMin: { width: 78, height: 58 },
    answerCardIdeal: { width: answerWidth, height: answerHeight },
    memoryCardMin: { width: 76, height: 68 },
    memoryCardIdeal: {
      width: clampValue(82, memoryHeight * (phonePortrait ? 1.08 : 1.2), 118),
      height: memoryHeight,
    },
    touchTargetMin: CHILD_UI.touch.minimum,
    titleGap: compactHeight ? 5 : 8,
    instructionGap: compactHeight ? 6 : 9,
    feedbackHeight: compactHeight ? 22 : 26,
    mechanicGap: compactHeight ? 7 : 10,
    artworkHeightRatio: 0.74,
    secondaryActionWidth: clampValue(116, input.availableMechanicWidth * 0.34, 150),
    compactFooter: false,
  };
}
