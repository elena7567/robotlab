import { clampValue, fluidValue, lerpClamped } from './fluidSizing';

export type CompositionMode = 'ultra-narrow-portrait' | 'portrait' | 'large-portrait-tablet' | 'landscape';

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
}

export interface ProgressSizing {
  titleFontSize: number;
  stepRadius: number;
  borderRadius: number;
}

export interface ResponsiveLayout {
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: number;
  mode: CompositionMode;
  safe: SafeAreaInsets;
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

function cssSafeArea(): SafeAreaInsets {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string): number => Number.parseFloat(styles.getPropertyValue(name)) || 0;
  return {
    top: read('--safe-area-top'),
    right: read('--safe-area-right'),
    bottom: read('--safe-area-bottom'),
    left: read('--safe-area-left'),
  };
}

export function getCompositionMode(width: number, height: number): CompositionMode {
  const portrait = width < height;
  if (portrait && width < 360) return 'ultra-narrow-portrait';
  if (portrait && width < 600) return 'portrait';
  if (portrait) return 'large-portrait-tablet';
  return 'landscape';
}

export function createResponsiveLayout(width: number, height: number): ResponsiveLayout {
  const mode = getCompositionMode(width, height);
  const safeInsets = cssSafeArea();
  const margin = fluidValue(12, Math.min(width, height), 0.035, 28);
  const safe = {
    top: safeInsets.top + margin,
    right: safeInsets.right + margin,
    bottom: safeInsets.bottom + margin,
    left: safeInsets.left + margin,
  };
  const iconWidth = fluidValue(76, width, 0.075, 92);
  const iconHeight = fluidValue(52, height, 0.075, 60);
  const iconFontSize = fluidValue(16, width, 0.015, 18);
  const headerHeight = fluidValue(52, height, 0.078, 62);
  const headerY = safe.top + headerHeight / 2;
  const portrait = mode !== 'landscape';
  const ultra = mode === 'ultra-narrow-portrait';
  const largePortrait = mode === 'large-portrait-tablet';

  let taskCard: RectLayout;
  let progress: RectLayout & { horizontal: boolean; sizing: ProgressSizing };
  if (largePortrait) {
    const top = safe.top + iconHeight + fluidValue(14, height, 0.018, 22);
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
        titleFontSize: fluidValue(13, stationWidth, 0.06, 17),
        stepRadius: fluidValue(14, stationWidth, 0.065, 19),
        borderRadius: fluidValue(18, stationWidth, 0.085, 24),
      },
    };
  } else if (portrait) {
    const progressY = safe.top + iconHeight + fluidValue(8, height, 0.012, 14);
    const progressWidth = ultra
      ? Math.min(width - safe.left - safe.right, fluidValue(160, width, 0.5, 176))
      : Math.min(width - safe.left - safe.right, fluidValue(190, width, 0.54, 218));
    const progressHeight = progressWidth / 1.32;
    const cardY = progressY + progressHeight + fluidValue(20, height, 0.026, 26);
    const cardWidth = Math.min(width - safe.left - safe.right, 430);
    const preferredHeight = ultra ? height * 0.36 : height * 0.39;
    const cardHeight = ultra
      ? clampValue(205, preferredHeight, 230)
      : clampValue(286, preferredHeight, 350);
    taskCard = { x: (width - cardWidth) / 2, y: cardY, width: cardWidth, height: cardHeight };
    progress = {
      x: (width - progressWidth) / 2,
      y: progressY,
      width: progressWidth,
      height: progressHeight,
      horizontal: true,
      sizing: {
        titleFontSize: fluidValue(12, width, 0.035, 16),
        stepRadius: fluidValue(14, width, 0.044, 19),
        borderRadius: fluidValue(18, width, 0.06, 24),
      },
    };
  } else {
    const top = safe.top + headerHeight + fluidValue(8, height, 0.018, 20);
    const availableHeight = height - top - safe.bottom;
    const cardWidth = fluidValue(210, width, 0.28, 400);
    const panelHeight = clampValue(224, availableHeight, 600);
    taskCard = { x: safe.left, y: top, width: cardWidth, height: panelHeight };
    const progressWidth = fluidValue(220, width, 0.2, 300);
    const progressHeight = progressWidth / 1.32;
    const edgeBreathingRoom = fluidValue(12, width, 0.014, 24);
    progress = {
      x: width - safe.right - edgeBreathingRoom - progressWidth,
      y: top + Math.min(fluidValue(52, height, 0.09, 82), Math.max(0, panelHeight - progressHeight) / 2),
      width: progressWidth,
      height: progressHeight,
      horizontal: false,
      sizing: {
        titleFontSize: fluidValue(13, progressWidth, 0.06, 18),
        stepRadius: fluidValue(14, progressWidth, 0.065, 20),
        borderRadius: fluidValue(18, progressWidth, 0.085, 24),
      },
    };
  }

  const density = clampValue(0, (taskCard.height - 230) / 240, 1);
  const taskCardSizing: TaskCardSizing = {
    radius: lerpClamped(20, 27, density, 0, 1),
    ribbonHeight: lerpClamped(34, 42, density, 0, 1),
    ribbonWidth: Math.min(taskCard.width - 34, fluidValue(188, taskCard.width, 0.68, 250)),
    taskFontSize: lerpClamped(15, 20, density, 0, 1),
    titleFontSize: lerpClamped(16, 24, density, 0, 1),
    instructionFontSize: lerpClamped(13, 18, density, 0, 1),
    feedbackFontSize: lerpClamped(12, 15, density, 0, 1),
    titleY: lerpClamped(29, 48, density, 0, 1),
    instructionY: lerpClamped(52, 86, density, 0, 1),
    areaTop: lerpClamped(72, 125, density, 0, 1),
    footerSpace: lerpClamped(70, 116, density, 0, 1),
    cellGap: lerpClamped(6, 12, density, 0, 1),
    cellMaxWidth: lerpClamped(98, 142, density, 0, 1),
    cellMaxHeight: lerpClamped(52, 112, density, 0, 1),
    sequenceGap: lerpClamped(3, 9, density, 0, 1),
    sequenceIconMaxSize: lerpClamped(28, 58, density, 0, 1),
    sequenceOptionMaxHeight: lerpClamped(36, 70, density, 0, 1),
    actionHeight: lerpClamped(48, 56, density, 0, 1),
    actionFontSize: lerpClamped(13, 18, density, 0, 1),
    actionGap: lerpClamped(8, 14, density, 0, 1),
    horizontalPadding: lerpClamped(12, 18, density, 0, 1),
  };

  return {
    viewportWidth: width,
    viewportHeight: height,
    aspectRatio: width / height,
    mode,
    safe,
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

export function createStartSceneLayout(layout: ResponsiveLayout): StartSceneLayout {
  const { viewportWidth: width, viewportHeight: height, mode, safe } = layout;
  const portrait = mode !== 'landscape';
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
  const titleGap = fluidValue(4, height, 0.01, 10);
  const robotGap = fluidValue(6, height, 0.016, 18);
  const buttonGap = fluidValue(8, height, 0.022, 22);
  const totalHeight = titleHeight + titleGap + subtitleHeight + robotGap + robotHeight + buttonGap + playHeight;
  const preferredTop = portrait ? height * 0.12 : Math.max(safe.top, (height - totalHeight) * 0.25);
  const top = clampValue(safe.top, preferredTop, Math.max(safe.top, height - safe.bottom - totalHeight));
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
