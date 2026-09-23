import { clampValue, fluidValue, lerpClamped } from './fluidSizing';
import { readViewportMetrics, type ViewportMetrics } from './viewport';
import { CHILD_UI } from './childUi';
import { composeScene, type Mission7SceneLayout, type Mission8SceneLayout, type Mission9SceneLayout, type TransitionSceneLayout } from './sceneCompositionDirector';

export type CompositionMode = 'ultra-narrow-portrait' | 'portrait' | 'large-portrait-tablet' | 'landscape';
export type SemanticCompositionMode =
  | 'PHONE_PORTRAIT_SHORT'
  | 'PHONE_PORTRAIT'
  | 'PHONE_PORTRAIT_TALL'
  | 'PHONE_LANDSCAPE_SHORT'
  | 'TABLET_PORTRAIT'
  | 'TABLET_LANDSCAPE'
  | 'DESKTOP';
export type DeviceLayoutClass = 'DESKTOP' | 'MOBILE_OR_TABLET';
export type HeightPressure = 'compact' | 'regular' | 'tall';
export type CharacterRole = 'HERO' | 'HELPER' | 'BOARD_ACTOR' | 'ASSEMBLY_PREVIEW';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RectLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type VisibleSafeRect = RectLayout;

export interface SemanticZones {
  readonly headerZone: RectLayout;
  readonly gameplayZone: RectLayout;
  readonly controlsZone: RectLayout;
  readonly characterZone: RectLayout;
  readonly modalZone: RectLayout;
}

export interface TaskCardSizing {
  radius: number;
  ribbonHeight: number;
  ribbonWidth: number;
  taskFontSize: number;
  titleFontSize: number;
  instructionFontSize: number;
  feedbackFontSize: number;
  titleY: number;
  instructionY: number;
  areaTop: number;
  footerSpace: number;
  cellGap: number;
  cellMaxWidth: number;
  cellMaxHeight: number;
  sequenceGap: number;
  sequenceIconMaxSize: number;
  sequenceOptionMaxHeight: number;
  actionHeight: number;
  actionFontSize: number;
  actionGap: number;
  horizontalPadding: number;
  internalProgressPlacement: 'feedback' | 'ribbon';
}

export interface ProgressSizing {
  titleFontSize: number;
  stepRadius: number;
  borderRadius: number;
}

export interface ResponsiveLayout {
  viewport: ViewportMetrics;
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: number;
  deviceLayoutClass: DeviceLayoutClass;
  mode: CompositionMode;
  semanticMode: SemanticCompositionMode;
  compositionName: 'portrait-compact' | 'portrait-regular' | 'portrait-tall' | 'large-portrait-tablet' | 'short-landscape' | 'landscape';
  heightPressure: HeightPressure;
  portrait: boolean;
  safe: SafeAreaInsets;
  safeRect: VisibleSafeRect;
  zones: SemanticZones;
  headerZone: RectLayout;
  gameplayZone: RectLayout;
  controlsZone: RectLayout;
  characterZone: RectLayout;
  modalZone: RectLayout;
  statusY: number;
  gapXS: number;
  gapS: number;
  gapM: number;
  gapL: number;
  margin: number;
  headerY: number;
  headerWidth: number;
  headerHeight: number;
  headerFontSize: number;
  iconWidth: number;
  iconHeight: number;
  iconFontSize: number;
  taskCard: RectLayout;
  taskCardSizing: TaskCardSizing;
  progress: RectLayout & { horizontal: boolean; sizing: ProgressSizing };
  dialogue: { width: number; height: number; fontSize: number; gap: number };
}

export interface StartSceneLayout {
  readonly titleY: number;
  readonly titleFontSize: number;
  readonly titleMaxWidth: number;
  readonly subtitleY: number;
  readonly subtitleFontSize: number;
  readonly subtitleMaxWidth: number;
  readonly robotHeight: number;
  readonly platformY: number;
  readonly playY: number;
  readonly playWidth: number;
  readonly playHeight: number;
  readonly playFontSize: number;
}

function viewportForLayout(width: number, height: number): ViewportMetrics {
  if (typeof window !== 'undefined') return { ...readViewportMetrics(), visualViewportWidth: width, visualViewportHeight: height, aspectRatio: width / Math.max(1, height) };
  return {
    innerWidth: width, innerHeight: height, visualViewportWidth: width, visualViewportHeight: height,
    visualViewportOffsetLeft: 0, visualViewportOffsetTop: 0, safeTop: 0, safeRight: 0, safeBottom: 0, safeLeft: 0,
    orientation: height >= width ? 'portrait' : 'landscape', aspectRatio: width / Math.max(1, height), devicePixelRatio: 1,
  };
}

export function getDeviceLayoutClass(): DeviceLayoutClass {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'MOBILE_OR_TABLET';
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches ? 'DESKTOP' : 'MOBILE_OR_TABLET';
}

export function getSemanticCompositionMode(width: number, height: number, deviceLayoutClass: DeviceLayoutClass = getDeviceLayoutClass()): SemanticCompositionMode {
  const portrait = height >= width;
  if (deviceLayoutClass === 'DESKTOP' && width >= 900) return 'DESKTOP';
  if (portrait && width < 600) {
    if (height < 700) return 'PHONE_PORTRAIT_SHORT';
    if (height >= 840) return 'PHONE_PORTRAIT_TALL';
    return 'PHONE_PORTRAIT';
  }
  if (!portrait && height < 500 && width < 1000) return 'PHONE_LANDSCAPE_SHORT';
  if (portrait) return 'TABLET_PORTRAIT';
  if (width >= 1200) return 'DESKTOP';
  return 'TABLET_LANDSCAPE';
}

export function getCompositionMode(width: number, height: number, deviceLayoutClass: DeviceLayoutClass = getDeviceLayoutClass()): CompositionMode {
  const semantic = getSemanticCompositionMode(width, height, deviceLayoutClass);
  if (semantic === 'PHONE_PORTRAIT_SHORT') return 'ultra-narrow-portrait';
  if (semantic === 'PHONE_PORTRAIT' || semantic === 'PHONE_PORTRAIT_TALL') return 'portrait';
  if (semantic === 'TABLET_PORTRAIT') return 'large-portrait-tablet';
  return 'landscape';
}

export function createResponsiveLayout(width: number, height: number, viewportOverride?: ViewportMetrics): ResponsiveLayout {
  const viewport = viewportOverride ?? viewportForLayout(width, height);
  const usableWidth = Math.max(1, width - viewport.safeLeft - viewport.safeRight);
  const usableHeight = Math.max(1, height - viewport.safeTop - viewport.safeBottom);
  const deviceLayoutClass = getDeviceLayoutClass();
  const semanticMode = getSemanticCompositionMode(usableWidth, usableHeight, deviceLayoutClass);
  const mode = getCompositionMode(usableWidth, usableHeight, deviceLayoutClass);
  const margin = fluidValue(12, Math.min(width, height), 0.035, 28);
  const safe = {
    top: viewport.safeTop + margin,
    right: viewport.safeRight + margin,
    bottom: viewport.safeBottom + margin,
    left: viewport.safeLeft + margin,
  };
  const safeRect: VisibleSafeRect = {
    x: viewport.safeLeft, y: viewport.safeTop,
    width: Math.max(1, width - viewport.safeLeft - viewport.safeRight),
    height: Math.max(1, height - viewport.safeTop - viewport.safeBottom),
  };
  const gapXS = fluidValue(4, Math.min(width, height), 0.012, 8);
  const gapS = fluidValue(8, Math.min(width, height), 0.022, 14);
  const gapM = fluidValue(14, Math.min(width, height), 0.035, 22);
  const gapL = fluidValue(22, Math.min(width, height), 0.055, 36);
  const iconWidth = fluidValue(76, width, 0.075, 92);
  const iconHeight = fluidValue(52, height, 0.075, 60);
  const iconFontSize = fluidValue(16, width, 0.015, 18);
  const headerHeight = semanticMode === 'PHONE_LANDSCAPE_SHORT'
    ? fluidValue(44, height, 0.07, 50)
    : fluidValue(52, height, 0.078, 62);
  const headerY = safe.top + headerHeight / 2;
  const portrait = mode !== 'landscape';
  const ultra = mode === 'ultra-narrow-portrait';
  const largePortrait = mode === 'large-portrait-tablet';
  const heightPressure: HeightPressure = height < (portrait ? 720 : 620) ? 'compact' : height >= (portrait ? 840 : 760) ? 'tall' : 'regular';
  const compositionName = largePortrait
    ? 'large-portrait-tablet'
    : portrait
      ? (`portrait-${heightPressure}` as const)
      : heightPressure === 'compact' ? 'short-landscape' : 'landscape';
  const phonePortrait = semanticMode.startsWith('PHONE_PORTRAIT');
  const phoneLandscape = semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const statusHeight = phonePortrait ? 34 : 0;
  const headerZoneHeight = phonePortrait ? iconHeight + gapS + statusHeight : Math.max(iconHeight, headerHeight);
  const headerZone: RectLayout = { x: safe.left, y: safe.top, width: width - safe.left - safe.right, height: headerZoneHeight };
  const controlsHeight = phonePortrait
    ? clampValue(205, height * 0.26, 240)
    : phoneLandscape ? clampValue(104, height * 0.31, 128) : clampValue(100, height * 0.17, 160);
  const controlsZone: RectLayout = {
    x: safe.left, y: height - safe.bottom - controlsHeight,
    width: width - safe.left - safe.right, height: controlsHeight,
  };
  const gameplayTop = headerZone.y + headerZone.height + gapS;
  const gameplayZone: RectLayout = {
    x: safe.left, y: gameplayTop, width: width - safe.left - safe.right,
    height: Math.max(1, controlsZone.y - gapS - gameplayTop),
  };
  const characterZone: RectLayout = phonePortrait
    ? { x: gameplayZone.x, y: gameplayZone.y + gameplayZone.height * 0.68, width: gameplayZone.width, height: gameplayZone.height * 0.32 }
    : { x: gameplayZone.x, y: gameplayZone.y, width: gameplayZone.width, height: gameplayZone.height };
  const modalMargin = phoneLandscape ? gapS : gapM;
  const modalZone: RectLayout = {
    x: safeRect.x + modalMargin, y: safeRect.y + modalMargin,
    width: Math.max(1, safeRect.width - modalMargin * 2), height: Math.max(1, safeRect.height - modalMargin * 2),
  };
  const zones: SemanticZones = { headerZone, gameplayZone, controlsZone, characterZone, modalZone };
  const taskRibbonOverhang = fluidValue(17, height, 0.025, 21);
  const taskControlGap = fluidValue(14, height, 0.02, 20);

  let taskCard: RectLayout;
  let progress: RectLayout & { horizontal: boolean; sizing: ProgressSizing };
  if (largePortrait) {
    const top = safe.top + iconHeight + taskRibbonOverhang + taskControlGap;
    const stationWidth = fluidValue(220, width, 0.31, 260);
    const stationHeight = stationWidth / 1.32;
    const gap = fluidValue(16, width, 0.028, 24);
    const availableWidth = width - safe.left - safe.right - stationWidth - gap;
    const cardWidth = Math.min(430, availableWidth);
    const cardHeight = clampValue(350, height * 0.41, 430);
    taskCard = { x: safe.left, y: top, width: cardWidth, height: cardHeight };
    progress = {
      x: width - safe.right - stationWidth,
      y: top + fluidValue(20, height, 0.035, 42),
      width: stationWidth,
      height: stationHeight,
      horizontal: false,
      sizing: {
        titleFontSize: fluidValue(CHILD_UI.typography.statusMin, stationWidth, 0.06, 17),
        stepRadius: fluidValue(14, stationWidth, 0.065, 19),
        borderRadius: fluidValue(18, stationWidth, 0.085, 24),
      },
    };
  } else if (portrait) {
    const cardY = phonePortrait ? gameplayTop + taskRibbonOverhang : safe.top + iconHeight + fluidValue(18, height, 0.027, 25);
    const cardWidth = Math.min(width - safe.left - safe.right, 430);
    const supportHeight = ultra ? clampValue(160, height * 0.27, 185) : clampValue(170, height * 0.25, 205);
    const availableCardHeight = height - safe.bottom - cardY - supportHeight;
    const cardHeight = clampValue(292, availableCardHeight, heightPressure === 'tall' ? 430 : 405);
    const progressWidth = ultra ? 92 : clampValue(98, width * 0.28, 118);
    const progressHeight = clampValue(120, supportHeight - 10, 164);
    taskCard = { x: (width - cardWidth) / 2, y: cardY, width: cardWidth, height: cardHeight };
    progress = {
      x: width - safe.right - progressWidth,
      y: Math.min(height - safe.bottom - progressHeight, cardY + cardHeight + fluidValue(8, height, 0.014, 14)),
      width: progressWidth,
      height: progressHeight,
      horizontal: false,
      sizing: {
        titleFontSize: CHILD_UI.typography.statusMin,
        stepRadius: 14,
        borderRadius: 16,
      },
    };
  } else {
    const top = phoneLandscape
      ? safe.top + Math.max(headerHeight, iconHeight) + taskRibbonOverhang / 2 + gapXS
      : safe.top + Math.max(headerHeight, iconHeight) + taskRibbonOverhang + taskControlGap;
    const availableHeight = height - top - safe.bottom;
    const cardWidth = phoneLandscape
      ? clampValue(390, safeRect.width * 0.62, 540)
      : fluidValue(210, width, 0.28, 400);
    const contentDrivenHeight = cardWidth * 1.28;
    const panelHeight = phoneLandscape
      ? Math.min(300, availableHeight)
      : clampValue(224, contentDrivenHeight, Math.min(480, availableHeight));
    taskCard = { x: safe.left, y: top, width: cardWidth, height: panelHeight };
    const progressWidth = phoneLandscape
      ? clampValue(150, safeRect.width * 0.25, 190)
      : fluidValue(220, width, 0.2, 300);
    const progressHeight = Math.min(progressWidth / 1.32, availableHeight);
    const edgeBreathingRoom = fluidValue(12, width, 0.014, 24);
    progress = {
      x: width - safe.right - (phoneLandscape ? 0 : edgeBreathingRoom) - progressWidth,
      y: top + Math.min(fluidValue(52, height, 0.09, 82), Math.max(0, panelHeight - progressHeight) / 2),
      width: progressWidth,
      height: progressHeight,
      horizontal: false,
      sizing: {
        titleFontSize: fluidValue(CHILD_UI.typography.statusMin, progressWidth, 0.06, 18),
        stepRadius: fluidValue(14, progressWidth, 0.065, 20),
        borderRadius: fluidValue(18, progressWidth, 0.085, 24),
      },
    };
  }

  const density = clampValue(0, (taskCard.height - 230) / 240, 1);
  const taskCardSizing: TaskCardSizing = {
    radius: phoneLandscape ? 20 : lerpClamped(20, 27, density, 0, 1),
    ribbonHeight: phoneLandscape ? 34 : lerpClamped(34, 42, density, 0, 1),
    ribbonWidth: phoneLandscape
      ? taskCard.width - 20
      : Math.min(taskCard.width - 34, fluidValue(188, taskCard.width, 0.68, 250)),
    taskFontSize: phoneLandscape ? CHILD_UI.typography.taskLabelMin : lerpClamped(15, 20, density, 0, 1),
    titleFontSize: phoneLandscape ? CHILD_UI.typography.titleMin : lerpClamped(CHILD_UI.typography.titleMin, 24, density, 0, 1),
    instructionFontSize: phoneLandscape ? CHILD_UI.typography.instructionMin : lerpClamped(CHILD_UI.typography.instructionMin, 18, density, 0, 1),
    feedbackFontSize: phoneLandscape ? CHILD_UI.typography.feedbackMin : lerpClamped(CHILD_UI.typography.feedbackMin, 16, density, 0, 1),
    titleY: phoneLandscape ? 20 : lerpClamped(29, 48, density, 0, 1),
    instructionY: phoneLandscape ? 44 : lerpClamped(52, 86, density, 0, 1),
    areaTop: phoneLandscape ? 64 : lerpClamped(72, 125, density, 0, 1),
    footerSpace: phoneLandscape ? 78 : lerpClamped(70, 116, density, 0, 1),
    cellGap: phoneLandscape ? 6 : lerpClamped(6, 12, density, 0, 1),
    cellMaxWidth: phoneLandscape ? 88 : lerpClamped(98, 142, density, 0, 1),
    cellMaxHeight: phoneLandscape ? 80 : lerpClamped(64, 112, density, 0, 1),
    sequenceGap: phoneLandscape ? 4 : lerpClamped(3, 9, density, 0, 1),
    sequenceIconMaxSize: phoneLandscape ? 72 : lerpClamped(48, 76, density, 0, 1),
    sequenceOptionMaxHeight: phoneLandscape ? 72 : lerpClamped(64, 92, density, 0, 1),
    actionHeight: phoneLandscape ? CHILD_UI.touch.minimum : lerpClamped(CHILD_UI.touch.minimum, 64, density, 0, 1),
    actionFontSize: phoneLandscape ? CHILD_UI.typography.controlMin : lerpClamped(CHILD_UI.typography.controlMin, 18, density, 0, 1),
    actionGap: phoneLandscape ? 8 : lerpClamped(8, 14, density, 0, 1),
    horizontalPadding: phoneLandscape ? 12 : lerpClamped(12, 18, density, 0, 1),
    internalProgressPlacement: phoneLandscape ? 'ribbon' : 'feedback',
  };

  return {
    viewport,
    viewportWidth: width,
    viewportHeight: height,
    aspectRatio: width / height,
    deviceLayoutClass,
    mode,
    semanticMode,
    compositionName,
    heightPressure,
    portrait,
    safe,
    safeRect,
    zones,
    headerZone,
    gameplayZone,
    controlsZone,
    characterZone,
    modalZone,
    statusY: phonePortrait ? safe.top + iconHeight + gapS + statusHeight / 2 : headerY,
    gapXS, gapS, gapM, gapL,
    margin,
    headerY,
    headerWidth: fluidValue(300, width, 0.33, 440),
    headerHeight,
    headerFontSize: fluidValue(25, width, 0.024, 32),
    iconWidth,
    iconHeight,
    iconFontSize,
    taskCard,
    taskCardSizing,
    progress,
    dialogue: {
      width: portrait ? fluidValue(146, width, 0.45, 230) : fluidValue(150, width, 0.16, 225),
      height: fluidValue(72, height, 0.1, 86),
      fontSize: fluidValue(14, width, 0.037, 17),
      gap: fluidValue(8, width, 0.025, 16),
    },
  };
}

export function characterScaleForRole(role: CharacterRole, zoneHeight: number, sourceHeight = 1180): number {
  const heightShare: Readonly<Record<CharacterRole, number>> = {
    HERO: 0.56, HELPER: 0.28, BOARD_ACTOR: 0.78, ASSEMBLY_PREVIEW: 0.38,
  };
  return clampValue(role === 'BOARD_ACTOR' ? 0.055 : 0.09, (zoneHeight * heightShare[role]) / sourceHeight, role === 'HERO' ? 0.42 : 0.28);
}

export function createStartSceneLayout(layout: ResponsiveLayout): StartSceneLayout {
  const { viewportWidth: width, viewportHeight: height, mode, safe } = layout;
  const portrait = mode !== 'landscape';
  const phonePortrait = layout.semanticMode.startsWith('PHONE_PORTRAIT');
  const titleFontSize = portrait
    ? fluidValue(30, width, 0.09, 48)
    : fluidValue(30, height, 0.075, 54);
  const subtitleFontSize = portrait
    ? fluidValue(16, width, 0.045, 22)
    : fluidValue(15, height, 0.03, 24);
  const robotHeight = portrait
    ? fluidValue(235, width, 0.82, 360)
    : fluidValue(138, height, 0.46, 360);
  const playHeight = fluidValue(56, height, 0.085, 66);
  const playWidth = portrait
    ? Math.min(250, width - safe.left - safe.right - 34)
    : fluidValue(210, width, 0.19, 270);
  const titleHeight = titleFontSize * 1.12;
  const subtitleHeight = subtitleFontSize * 2.35;
  const titleGap = fluidValue(10, height, 0.018, 14);
  const robotGap = fluidValue(6, height, 0.016, 18);
  const buttonGap = fluidValue(8, height, 0.022, 22);
  const totalHeight = titleHeight + titleGap + subtitleHeight + robotGap + robotHeight + buttonGap + playHeight;
  const minimumTop = phonePortrait ? layout.headerZone.y + layout.headerZone.height + layout.gapS : safe.top;
  const preferredTop = portrait ? Math.max(minimumTop, height * 0.12) : Math.max(minimumTop, (height - totalHeight) * 0.25);
  const top = clampValue(minimumTop, preferredTop, Math.max(minimumTop, height - safe.bottom - totalHeight));
  const titleY = top + titleHeight / 2;
  const subtitleY = top + titleHeight + titleGap + subtitleHeight / 2;
  const robotTop = top + titleHeight + titleGap + subtitleHeight + robotGap;
  const platformY = robotTop + robotHeight;
  const playY = platformY + buttonGap + playHeight / 2;

  return {
    titleY,
    titleFontSize,
    titleMaxWidth: width - safe.left - safe.right - (portrait ? layout.iconWidth * 0.35 : layout.iconWidth * 1.1),
    subtitleY,
    subtitleFontSize,
    subtitleMaxWidth: Math.min(width - safe.left - safe.right - 20, portrait ? 520 : 620),
    robotHeight,
    platformY,
    playY,
    playWidth,
    playHeight,
    playFontSize: fluidValue(23, width, 0.023, 29),
  };
}

export function createMission7SceneLayout(layout: ResponsiveLayout): Mission7SceneLayout {
  return composeScene(layout, 7).mission7!;
}

export function createMission8SceneLayout(layout: ResponsiveLayout): Mission8SceneLayout {
  return composeScene(layout, 8).mission8!;
}

export function createMission9SceneLayout(layout: ResponsiveLayout): Mission9SceneLayout {
  return composeScene(layout, 9).mission9!;
}

export function createTransitionSceneLayout(layout: ResponsiveLayout): TransitionSceneLayout {
  return composeScene(layout, 'MISSION5_TRANSITION').transition!;
}
