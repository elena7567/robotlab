import { clampValue, fluidValue } from './fluidSizing';
import { CHILD_UI } from './childUi';
import type { ProgressSizing, RectLayout, ResponsiveLayout } from './responsiveLayout';
import {
  LOGICAL_SCENE_HEIGHT,
  LOGICAL_SCENE_WIDTH,
  PLATFORM_CENTER_X,
  PLATFORM_CONTACT_Y,
} from './sceneLayout';
import { DesktopCharacterRole, resolveWorldCharacterScale } from '../characters/CharacterSizingPolicy';
import { CHARACTER_VISUAL_PROFILES } from '../characters/characterVisualProfiles';

export const SEMANTIC_REGIONS = [
  'HEADER',
  'PRIMARY_GAMEPLAY',
  'CHARACTER',
  'SECONDARY_CHARACTER',
  'FEEDBACK',
  'PRIMARY_ACTIONS',
  'SECONDARY_ACTIONS',
  'STATUS',
  'MODAL',
] as const;

export type SemanticRegionName = (typeof SEMANTIC_REGIONS)[number];
export type MissionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'MISSION5_TRANSITION';
export type MissionCharacterRole =
  | 'PRIMARY_CHARACTER'
  | 'SUPPORTING_CHARACTER'
  | 'BOARD_ACTOR'
  | 'HIDDEN_FOR_MECHANIC_FOCUS';
export type CharacterPresentation = 'FULL_BODY' | 'REACTION_PORTRAIT' | 'BOARD_CELL' | 'HIDDEN';
export type CharacterCoordinateSpace = 'SCREEN' | 'LOGICAL_WORLD' | 'BOARD_LOCAL';
export type ComponentContractName =
  | 'taskCard'
  | 'wireBoard'
  | 'programBoard'
  | 'statusPanel'
  | 'actionRow'
  | 'modal'
  | 'characterZone';

export interface Size2D {
  readonly width: number;
  readonly height: number;
}

export interface ComponentSizeContract {
  readonly min: Size2D;
  readonly ideal: Size2D;
  readonly max: Size2D;
}

export interface ResolvedComponent {
  readonly contract: ComponentContractName;
  readonly rect: RectLayout;
}

export interface CharacterDeclaration {
  readonly id: 'HELPER' | 'REPAIRED' | 'BOARD_ROBOT';
  readonly role: MissionCharacterRole;
  readonly presentation: CharacterPresentation;
  readonly region: 'CHARACTER' | 'SECONDARY_CHARACTER' | 'PRIMARY_GAMEPLAY';
  readonly coordinateSpace: CharacterCoordinateSpace;
  readonly visibleBoundsId: 'ROBOT_V2_HELPER' | 'ROBOT_V2_ASSEMBLED';
  readonly visible: boolean;
  readonly occupancy: { readonly min: number; readonly ideal: number; readonly max: number };
}

export interface Mission7SceneLayout {
  readonly showHeader: boolean;
  readonly showHelper: boolean;
  readonly systems: { readonly x: number; readonly y: number; readonly width: number };
  readonly board: RectLayout;
  readonly helper: { readonly x: number; readonly feetY: number; readonly scale: number };
  readonly repaired: { readonly x: number; readonly feetY: number; readonly scale: number };
  readonly showRepaired: boolean;
  readonly hint: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly fontSize: number };
  readonly platform?: {
    readonly centerX: number;
    readonly topY: number;
    readonly surfaceAtRobotX: number;
    readonly surfaceAtCardX: number;
    readonly surfaceAtHintX: number;
  };
}

export interface Mission6SceneLayout {
  readonly systems: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly card: RectLayout;
  readonly helper: { readonly x: number; readonly feetY: number; readonly scale: number };
  readonly assembled: { readonly x: number; readonly feetY: number; readonly scale: number };
  readonly helperZone: RectLayout;
  readonly assembledZone: RectLayout;
  readonly platform: {
    readonly centerX: number;
    readonly topY: number;
    readonly surfaceAtCardX: number;
    readonly surfaceAtHelperX: number;
    readonly surfaceAtAssembledX: number;
    readonly cardClearance: number;
  };
}

export interface Mission8SceneLayout {
  readonly board: RectLayout;
  readonly helper: { readonly x: number; readonly feetY: number; readonly scale: number };
  readonly systemsY: number;
  readonly routeY: number;
  readonly stripY: number;
  readonly arrowsY: number;
  readonly actionsY: number;
  readonly primaryCtaY?: number;
  readonly controlPanelHeight?: number;
  readonly controlCenterX: number;
  readonly controlWidth: number;
  readonly arrowSize: number;
  readonly actionHeight: number;
}

export interface Mission9SceneLayout {
  readonly showHeader: boolean;
  /** Stage title, independent from transient instructional feedback. */
  readonly title: RectLayout;
  /** Compact three-dot mission progress. Status is retained as its legacy alias. */
  readonly progress: RectLayout;
  /** Active puzzle art, centered on the physical laboratory platform. */
  readonly puzzleStage: RectLayout;
  /** Grounded Robot v2 side region. */
  readonly robot: RectLayout;
  /** Three candidate slots below the physical platform contact line. */
  readonly choices: RectLayout;
  readonly platformCenterX: number;
  readonly platformContactY: number;
  readonly status: RectLayout;
  readonly world: RectLayout;
  readonly controls: RectLayout;
  readonly feedback: RectLayout;
  readonly controlGap: number;
  readonly controlHeight: number;
  readonly robotScale: number;
}

export interface Mission10SignalRegions {
  readonly TITLE: RectLayout;
  readonly PROGRESS: RectLayout;
  /** Bounded beam grid; apparatus bodies may extend beyond aperture anchors. */
  readonly APPARATUS_FIELD: RectLayout;
  readonly ROBOT_VISIBLE: RectLayout;
  readonly ROBOT_GROUND_Y: number;
  readonly PROP_VISIBLE_HEIGHT: number;
  readonly BEAM_CORE_WIDTH: number;
}
export interface Mission10EnergyStageLayout {
  /** Bounded semantic group holding the whole ENERGY composition (desktop only). */
  readonly group: RectLayout;
  readonly groupCenterX: number;
  readonly groupCenterY: number;
  readonly relaySize: number;
  readonly terminalRadius: number;
  readonly beamCoreWidth: number;
  readonly beamGlowWidth: number;
  readonly robotCenterX: number;
  readonly robotScale: number;
  readonly robotTargetVisibleHeight: number;
  readonly gapToGroup: number;
  readonly platformCenterX: number;
}

export interface Mission10SceneLayout {
  readonly signalRegions: Mission10SignalRegions;
  readonly introRegions: Readonly<Record<'TOP_LEFT_CONTROL' | 'TOP_CENTER_TITLE' | 'TOP_RIGHT_CONTROL' | 'INTRO_MESSAGE' | 'HERO_GROUP' | 'CTA', RectLayout>>;
  readonly introGroundY: number;
  readonly launchGroundY: number;
  readonly launchRobotZone: RectLayout;
  readonly portraitGate: boolean;
  readonly showExtendedHeader: boolean;
  readonly title: RectLayout;
  readonly progress: RectLayout;
  readonly feedback: RectLayout;
  readonly world: RectLayout;
  readonly robot: RectLayout;
  readonly puzzleStage: RectLayout;
  readonly pathChoiceGroup: RectLayout;
  readonly platformCenterX: number;
  readonly pathLanes: readonly [RectLayout, RectLayout, RectLayout];
  readonly relayBoard: RectLayout;
  /** Desktop-only bounded ENERGY composition; undefined keeps the legacy full-band render. */
  readonly energyStage?: Mission10EnergyStageLayout;
  readonly signalBoard: RectLayout;
  readonly launchConsole: RectLayout;
  readonly beacon: RectLayout;
  readonly platformContactY: number;
  readonly robotScale: number;
  readonly targetGap: number;
}

export interface TransitionSceneLayout {
  readonly phonePortrait: boolean;
  readonly titleY: number;
  readonly titleSize: number;
  readonly subtitleY: number;
  readonly buttonHeight: number;
  readonly buttonY: number;
  readonly actorFeetY: number;
  readonly pairScale: number;
  readonly pairSpan: number;
}

export interface SceneSurfaceLayout {
  readonly outer: RectLayout;
  readonly support: RectLayout;
}

export interface SceneComposition {
  readonly missionId: MissionId;
  readonly policyId: string;
  readonly semanticMode: ResponsiveLayout['semanticMode'];
  readonly regions: Readonly<Record<SemanticRegionName, RectLayout>>;
  readonly sizeContracts: Readonly<Record<ComponentContractName, ComponentSizeContract>>;
  readonly components: Readonly<Partial<Record<ComponentContractName, ResolvedComponent>>>;
  readonly characters: readonly CharacterDeclaration[];
  readonly whitespaceAllocation: readonly ('CHARACTER_PRESENCE' | 'SUPPORT_REACTION' | 'BREATHING_ROOM' | 'BACKGROUND_VISIBILITY')[];
  readonly taskCard: RectLayout;
  readonly progress: RectLayout & { readonly horizontal: boolean; readonly sizing: ProgressSizing };
  readonly mission6?: Mission6SceneLayout;
  readonly mission7?: Mission7SceneLayout;
  readonly mission8?: Mission8SceneLayout;
  readonly mission9?: Mission9SceneLayout;
  readonly mission10?: Mission10SceneLayout;
  readonly transition?: TransitionSceneLayout;
  readonly surface?: SceneSurfaceLayout;
}

export const COMPONENT_SIZE_CONTRACTS: Readonly<Record<ComponentContractName, ComponentSizeContract>> = {
  taskCard: { min: { width: 300, height: 224 }, ideal: { width: 430, height: 390 }, max: { width: 500, height: 480 } },
  wireBoard: { min: { width: 300, height: 250 }, ideal: { width: 620, height: 440 }, max: { width: 680, height: 590 } },
  programBoard: { min: { width: 300, height: 210 }, ideal: { width: 590, height: 340 }, max: { width: 640, height: 430 } },
  statusPanel: { min: { width: 180, height: 38 }, ideal: { width: 250, height: 50 }, max: { width: 300, height: 58 } },
  actionRow: { min: { width: 180, height: CHILD_UI.touch.minimum }, ideal: { width: 390, height: 60 }, max: { width: 500, height: 68 } },
  modal: { min: { width: 280, height: 190 }, ideal: { width: 520, height: 300 }, max: { width: 560, height: 360 } },
  characterZone: { min: { width: 120, height: 130 }, ideal: { width: 260, height: 310 }, max: { width: 380, height: 520 } },
};

function rect(x: number, y: number, width: number, height: number): RectLayout {
  return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
}

function emptyRect(layout: ResponsiveLayout): RectLayout {
  return rect(layout.safe.left, layout.safe.top, 1, 1);
}

function createPlatformSurfaceResolver(width: number, height: number): {
  readonly centerX: number;
  readonly topY: number;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly surfaceYAt: (worldX: number) => number;
} {
  const scale = Math.max(width / LOGICAL_SCENE_WIDTH, height / LOGICAL_SCENE_HEIGHT);
  const offsetX = (width - LOGICAL_SCENE_WIDTH * scale) / 2;
  const offsetY = (height - LOGICAL_SCENE_HEIGHT * scale) / 2;
  const centerX = offsetX + PLATFORM_CENTER_X * scale;
  const topY = offsetY + PLATFORM_CONTACT_Y * scale;
  const radiusX = 640 * scale;
  const radiusY = 24 * scale;
  const centerY = topY + radiusY;
  return {
    centerX,
    topY,
    scale,
    offsetX,
    offsetY,
    surfaceYAt: (worldX: number) => {
      const normalizedX = clampValue(-1, (worldX - centerX) / radiusX, 1);
      return centerY - radiusY * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX));
    },
  };
}

export function resolveComponentSize(contract: ComponentSizeContract, available: RectLayout): Size2D {
  const preferredWidth = Math.min(contract.ideal.width, available.width);
  const preferredHeight = Math.min(contract.ideal.height, available.height);
  return {
    width: Math.min(available.width, clampValue(contract.min.width, preferredWidth, contract.max.width)),
    height: Math.min(available.height, clampValue(contract.min.height, preferredHeight, contract.max.height)),
  };
}

function commonRegions(layout: ResponsiveLayout): Record<SemanticRegionName, RectLayout> {
  const feedbackHeight = clampValue(24, layout.taskCardSizing.feedbackFontSize * 1.6, 34);
  const feedback = rect(
    layout.taskCard.x + layout.taskCardSizing.horizontalPadding,
    layout.taskCard.y + layout.taskCard.height - layout.taskCardSizing.actionHeight - feedbackHeight - 14,
    layout.taskCard.width - layout.taskCardSizing.horizontalPadding * 2,
    feedbackHeight,
  );
  return {
    HEADER: layout.headerZone,
    PRIMARY_GAMEPLAY: layout.gameplayZone,
    CHARACTER: layout.characterZone,
    SECONDARY_CHARACTER: emptyRect(layout),
    FEEDBACK: feedback,
    PRIMARY_ACTIONS: layout.controlsZone,
    SECONDARY_ACTIONS: layout.controlsZone,
    STATUS: rect(layout.progress.x, layout.progress.y, layout.progress.width, layout.progress.height),
    MODAL: layout.modalZone,
  };
}

function composeSharedMission(layout: ResponsiveLayout, missionId: 1 | 2 | 3 | 4 | 5 | 6): SceneComposition {
  const regions = commonRegions(layout);
  const shortLandscape = layout.semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const desktopAssembly = layout.semanticMode === 'DESKTOP' && missionId >= 1 && missionId <= 5;
  let taskCard = layout.taskCard;
  let progress = layout.progress;
  let surface: SceneSurfaceLayout | undefined;
  if (shortLandscape) {
    const content = rect(layout.safe.left, layout.gameplayZone.y + layout.gapS, layout.safeRect.width - layout.margin * 2, layout.gameplayZone.height + layout.controlsZone.height - layout.gapS);
    const desiredCardWidth = clampValue(390, content.width * 0.6, COMPONENT_SIZE_CONTRACTS.taskCard.max.width);
    const supportWidth = content.width - desiredCardWidth - layout.gapM;
    const desiredCardHeight = Math.min(COMPONENT_SIZE_CONTRACTS.taskCard.max.height, content.height);
    taskCard = rect(content.x, content.y, desiredCardWidth, desiredCardHeight);
    const support = rect(taskCard.x + taskCard.width + layout.gapM, content.y, supportWidth, content.height);
    const surfaceInset = layout.gapXS / 2;
    surface = {
      outer: rect(
        layout.safeRect.x + surfaceInset,
        layout.safeRect.y + surfaceInset,
        layout.safeRect.width - surfaceInset * 2,
        layout.safeRect.height - surfaceInset * 2,
      ),
      support,
    };
    const externalSecondaryAction = missionId === 6 || taskCard.height < 260;
    const supportActionHeight = layout.taskCardSizing.actionHeight;
    const supportActionWidth = missionId === 6 ? support.width : Math.min(124, support.width);
    const supportAction = rect(
      support.x + (support.width - supportActionWidth) / 2,
      support.y,
      supportActionWidth,
      supportActionHeight,
    );
    regions.PRIMARY_GAMEPLAY = taskCard;
    regions.CHARACTER = externalSecondaryAction
      ? rect(
        support.x,
        supportAction.y + supportAction.height + layout.gapS,
        support.width,
        Math.max(1, support.height - supportAction.height - layout.gapS),
      )
      : support;
    regions.SECONDARY_CHARACTER = rect(support.x, support.y, support.width, Math.max(1, support.height * 0.32));
    regions.STATUS = regions.SECONDARY_CHARACTER;
    regions.FEEDBACK = rect(
      taskCard.x + layout.taskCardSizing.horizontalPadding,
      taskCard.y + taskCard.height - layout.taskCardSizing.actionHeight - 46,
      taskCard.width - layout.taskCardSizing.horizontalPadding * 2,
      28,
    );
    regions.PRIMARY_ACTIONS = missionId === 6 && externalSecondaryAction
      ? supportAction
      : rect(taskCard.x, taskCard.y + taskCard.height - layout.taskCardSizing.actionHeight - 8, taskCard.width, layout.taskCardSizing.actionHeight);
    regions.SECONDARY_ACTIONS = externalSecondaryAction ? supportAction : regions.PRIMARY_ACTIONS;
    progress = { ...progress, x: support.x, y: support.y, width: support.width, height: Math.min(progress.height, support.height * 0.34) };
  } else if (desktopAssembly) {
    const platform = createPlatformSurfaceResolver(layout.viewportWidth, layout.viewportHeight);
    const centerGap = clampValue(64, layout.viewportWidth * 0.06, 112);
    const card = rect(
      platform.centerX - layout.taskCard.width / 2,
      layout.taskCard.y,
      layout.taskCard.width,
      layout.taskCard.height,
    );
    const panelX = Math.min(
      layout.viewportWidth - layout.safe.right - 48 - layout.progress.width,
      card.x + card.width + centerGap,
    );
    progress = {
      ...layout.progress,
      x: panelX,
      y: card.y + clampValue(44, card.height * 0.16, 72),
      width: layout.progress.width,
      height: layout.progress.height,
    };
    const helperSizing = resolveWorldCharacterScale({
      profile: CHARACTER_VISUAL_PROFILES.helper,
      role: DesktopCharacterRole.ASSEMBLY_ENVELOPE,
      viewportHeight: layout.viewportHeight,
      parentScale: platform.scale,
    });
    const helperVisibleWidth = CHARACTER_VISUAL_PROFILES.helper.visibleWidthAtScale1 * helperSizing.resolvedScale * platform.scale;
    const leftDoorClearX = platform.offsetX + 170 * platform.scale;
    const robotSafeLeft = Math.max(layout.safe.left + layout.gapL + helperVisibleWidth / 2, leftDoorClearX);
    const robotSafeRight = Math.max(robotSafeLeft, card.x - centerGap - helperVisibleWidth / 2);
    const robotX = robotSafeLeft + Math.max(0, robotSafeRight - robotSafeLeft) * 0.56;
    const robotFeetY = platform.surfaceYAt(robotX);
    const robotTopY = Math.min(taskCard.y, robotFeetY - helperSizing.targetVisibleHeight);

    taskCard = card;
    regions.PRIMARY_GAMEPLAY = taskCard;
    regions.STATUS = rect(progress.x, progress.y, progress.width, progress.height);
    regions.CHARACTER = rect(
      robotX - helperVisibleWidth / 2,
      robotTopY,
      helperVisibleWidth,
      Math.max(1, robotFeetY - robotTopY),
    );
    regions.SECONDARY_CHARACTER = regions.STATUS;
    regions.FEEDBACK = rect(
      taskCard.x + layout.taskCardSizing.horizontalPadding,
      taskCard.y + taskCard.height - layout.taskCardSizing.actionHeight - 46,
      taskCard.width - layout.taskCardSizing.horizontalPadding * 2,
      28,
    );
    regions.PRIMARY_ACTIONS = rect(taskCard.x, taskCard.y + taskCard.height - layout.taskCardSizing.actionHeight - 8, taskCard.width, layout.taskCardSizing.actionHeight);
    regions.SECONDARY_ACTIONS = regions.PRIMARY_ACTIONS;
  } else {
    regions.PRIMARY_GAMEPLAY = taskCard;
    regions.STATUS = rect(progress.x, progress.y, progress.width, progress.height);
    if (layout.mode === 'landscape') {
      const left = taskCard.x + taskCard.width + layout.gapM;
      const right = progress.x - layout.gapM;
      regions.CHARACTER = rect(left, taskCard.y, Math.max(1, right - left), Math.min(taskCard.height, layout.viewportHeight - layout.safe.bottom - taskCard.y));
      regions.SECONDARY_CHARACTER = regions.STATUS;
    }
  }
  const helperVisible = missionId !== 6 || !shortLandscape;
  const characters: CharacterDeclaration[] = [
    {
      id: missionId === 6 ? 'REPAIRED' : 'HELPER',
      role: missionId === 1 || missionId === 5 || missionId === 6 ? 'PRIMARY_CHARACTER' : 'SUPPORTING_CHARACTER',
      presentation: shortLandscape ? 'REACTION_PORTRAIT' : 'FULL_BODY',
      region: 'CHARACTER', coordinateSpace: 'LOGICAL_WORLD',
      visibleBoundsId: missionId === 6 ? 'ROBOT_V2_ASSEMBLED' : 'ROBOT_V2_HELPER',
      visible: true, occupancy: { min: 0.48, ideal: 0.72, max: 0.86 },
    },
  ];
  if (missionId === 6) characters.push({
    id: 'HELPER',
    role: helperVisible ? 'SUPPORTING_CHARACTER' : 'HIDDEN_FOR_MECHANIC_FOCUS',
    presentation: helperVisible ? 'FULL_BODY' : 'HIDDEN',
    region: 'SECONDARY_CHARACTER', coordinateSpace: 'LOGICAL_WORLD', visibleBoundsId: 'ROBOT_V2_HELPER',
    visible: helperVisible, occupancy: { min: 0.34, ideal: 0.46, max: 0.58 },
  });
  return {
    missionId, policyId: `MISSION_${missionId}_${layout.semanticMode}`, semanticMode: layout.semanticMode,
    regions, sizeContracts: COMPONENT_SIZE_CONTRACTS,
    components: {
      taskCard: { contract: 'taskCard', rect: taskCard },
      statusPanel: { contract: 'statusPanel', rect: regions.STATUS },
      actionRow: { contract: 'actionRow', rect: regions.PRIMARY_ACTIONS },
      modal: { contract: 'modal', rect: regions.MODAL },
      characterZone: { contract: 'characterZone', rect: regions.CHARACTER },
    },
    characters,
    whitespaceAllocation: shortLandscape
      ? ['CHARACTER_PRESENCE', 'SUPPORT_REACTION', 'BACKGROUND_VISIBILITY']
      : ['CHARACTER_PRESENCE', 'BREATHING_ROOM', 'BACKGROUND_VISIBILITY'],
    taskCard, progress, surface,
  };
}

function composeMission6(layout: ResponsiveLayout): SceneComposition {
  if (layout.semanticMode !== 'DESKTOP') return composeSharedMission(layout, 6);

  const { viewportWidth: width, viewportHeight: height, safe } = layout;
  const regions = commonRegions(layout);
  const platform = createPlatformSurfaceResolver(width, height);
  const responsiveFactor = clampValue(0.88, Math.min(width / 1600, height / 900), 1.2);
  const cardClearanceTarget = clampValue(60, 70 * responsiveFactor, 75);
  const cardHeight = Math.min(layout.taskCard.height, clampValue(336, height * 0.39, 390));
  const card = rect(
    platform.centerX - layout.taskCard.width / 2,
    platform.surfaceYAt(platform.centerX) - cardClearanceTarget - cardHeight,
    layout.taskCard.width,
    cardHeight,
  );
  const cardClearance = platform.surfaceYAt(platform.centerX) - (card.y + card.height);
  const helperSizing = resolveWorldCharacterScale({
    profile: CHARACTER_VISUAL_PROFILES.helper,
    role: DesktopCharacterRole.WORLD_PRIMARY,
    viewportHeight: height,
    parentScale: platform.scale,
  });
  const assembledSizing = resolveWorldCharacterScale({
    profile: CHARACTER_VISUAL_PROFILES.assembled,
    role: DesktopCharacterRole.WORLD_SECONDARY,
    viewportHeight: height,
    parentScale: platform.scale,
  });
  const helperScale = helperSizing.resolvedScale;
  const assembledScale = assembledSizing.resolvedScale;
  const assembledVisibleWidth = CHARACTER_VISUAL_PROFILES.assembled.visibleWidthAtScale1 * assembledScale * platform.scale;
  const helperVisibleWidth = CHARACTER_VISUAL_PROFILES.helper.visibleWidthAtScale1 * helperScale * platform.scale;
  const sideGap = clampValue(38, width * 0.035, 64);
  const contentLeft = safe.left + layout.gapL;
  const contentRight = width - safe.right - layout.gapL;
  const helperZone = rect(
    contentLeft,
    card.y,
    Math.max(1, card.x - sideGap - contentLeft),
    card.height,
  );
  const assembledZone = rect(
    card.x + card.width + sideGap,
    card.y,
    Math.max(1, contentRight - (card.x + card.width + sideGap)),
    card.height,
  );
  const helperX = clampValue(
    helperZone.x + helperVisibleWidth / 2,
    helperZone.x + helperZone.width * 0.5,
    helperZone.x + helperZone.width - helperVisibleWidth / 2,
  );
  const assembledX = clampValue(
    assembledZone.x + assembledVisibleWidth / 2,
    assembledZone.x + assembledZone.width * 0.5,
    assembledZone.x + assembledZone.width - assembledVisibleWidth / 2,
  );
  const helperFeetY = platform.surfaceYAt(helperX);
  const assembledFeetY = platform.surfaceYAt(assembledX);
  const systemsWidth = Math.min(270, Math.max(230, width * 0.17));
  const systemsHeight = 38;
  const systemsY = layout.headerY + layout.headerFontSize * 0.72 + systemsHeight * 0.55;
  const mission6: Mission6SceneLayout = {
    systems: { x: platform.centerX, y: systemsY, width: systemsWidth, height: systemsHeight },
    card,
    helper: { x: helperX, feetY: helperFeetY, scale: helperScale },
    assembled: { x: assembledX, feetY: assembledFeetY, scale: assembledScale },
    helperZone,
    assembledZone,
    platform: {
      centerX: platform.centerX,
      topY: platform.topY,
      surfaceAtCardX: platform.surfaceYAt(platform.centerX),
      surfaceAtHelperX: helperFeetY,
      surfaceAtAssembledX: assembledFeetY,
      cardClearance,
    },
  };

  regions.PRIMARY_GAMEPLAY = card;
  regions.CHARACTER = assembledZone;
  regions.SECONDARY_CHARACTER = helperZone;
  regions.STATUS = rect(
    mission6.systems.x - mission6.systems.width / 2,
    mission6.systems.y - mission6.systems.height / 2,
    mission6.systems.width,
    mission6.systems.height,
  );
  regions.FEEDBACK = rect(
    card.x + layout.taskCardSizing.horizontalPadding,
    card.y + card.height - layout.taskCardSizing.actionHeight - 48,
    card.width - layout.taskCardSizing.horizontalPadding * 2,
    28,
  );
  regions.PRIMARY_ACTIONS = rect(card.x, card.y + card.height - layout.taskCardSizing.actionHeight - 8, card.width, layout.taskCardSizing.actionHeight);
  regions.SECONDARY_ACTIONS = regions.PRIMARY_ACTIONS;
  const progress = {
    ...layout.progress,
    x: regions.STATUS.x,
    y: regions.STATUS.y,
    width: regions.STATUS.width,
    height: regions.STATUS.height,
  };

  return {
    missionId: 6, policyId: `MISSION_6_${layout.semanticMode}`, semanticMode: layout.semanticMode,
    regions, sizeContracts: COMPONENT_SIZE_CONTRACTS,
    components: {
      taskCard: { contract: 'taskCard', rect: card },
      statusPanel: { contract: 'statusPanel', rect: regions.STATUS },
      actionRow: { contract: 'actionRow', rect: regions.PRIMARY_ACTIONS },
      modal: { contract: 'modal', rect: regions.MODAL },
      characterZone: { contract: 'characterZone', rect: regions.CHARACTER },
    },
    characters: [
      { id: 'HELPER', role: 'SUPPORTING_CHARACTER', presentation: 'FULL_BODY', region: 'SECONDARY_CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_HELPER', visible: true, occupancy: { min: 0.34, ideal: 0.46, max: 0.58 } },
      { id: 'REPAIRED', role: 'PRIMARY_CHARACTER', presentation: 'FULL_BODY', region: 'CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', visible: true, occupancy: { min: 0.48, ideal: 0.72, max: 0.86 } },
    ],
    whitespaceAllocation: ['CHARACTER_PRESENCE', 'SUPPORT_REACTION', 'BACKGROUND_VISIBILITY'],
    taskCard: card,
    progress,
    mission6,
  };
}
function composeMission7(layout: ResponsiveLayout): SceneComposition {
  const { viewportWidth: width, viewportHeight: height, safe, semanticMode } = layout;
  const regions = commonRegions(layout);
  const phonePortrait = semanticMode.startsWith('PHONE_PORTRAIT');
  const shortLandscape = semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const systemsWidth = phonePortrait ? Math.min(270, layout.headerZone.width) : fluidValue(210, width, 0.19, 260);
  let mission7: Mission7SceneLayout;

  if (phonePortrait) {
    const hintHeight = clampValue(48, layout.controlsZone.height * 0.34, 56);
    const hintY = layout.controlsZone.y + layout.controlsZone.height - hintHeight / 2;
    const boardY = layout.gameplayZone.y + 18;
    const board = rect(layout.gameplayZone.x, boardY, layout.gameplayZone.width, hintY - hintHeight / 2 - layout.gapS - boardY);
    mission7 = {
      showHeader: false, showHelper: false,
      systems: { x: width / 2, y: layout.statusY, width: systemsWidth },
      board,
      helper: { x: width / 2, feetY: board.y + board.height, scale: 0 },
      repaired: { x: width / 2, feetY: board.y + board.height, scale: 0 },
      showRepaired: false,
      hint: { x: width / 2, y: hintY, width: Math.min(230, layout.controlsZone.width), height: hintHeight, fontSize: fluidValue(15, width, 0.045, 19) },
    };
    regions.PRIMARY_GAMEPLAY = board;
    regions.CHARACTER = emptyRect(layout);
    regions.SECONDARY_CHARACTER = emptyRect(layout);
    regions.STATUS = rect(width / 2 - systemsWidth / 2, layout.statusY - 19, systemsWidth, 38);
    regions.SECONDARY_ACTIONS = rect(mission7.hint.x - mission7.hint.width / 2, mission7.hint.y - mission7.hint.height / 2, mission7.hint.width, mission7.hint.height);
    regions.PRIMARY_ACTIONS = regions.SECONDARY_ACTIONS;
  } else {
    const desktop = semanticMode === 'DESKTOP';
    const platform = createPlatformSurfaceResolver(width, height);
    const platformCenterX = platform.centerX;
    const contentTop = shortLandscape ? layout.gameplayZone.y + 18 : layout.headerZone.y + layout.headerHeight + (desktop ? layout.gapM + 14 : layout.gapL + 52);
    const contentBottom = height - safe.bottom;
    const available = rect(safe.left, contentTop, width - safe.left - safe.right, contentBottom - contentTop);
    const responsiveFactor = clampValue(0.8, Math.min(width / 1600, height / 900), 1.2);
    const hintHeight = desktop ? 54 : shortLandscape ? 52 : 56;
    const hintGap = desktop ? clampValue(12, 14 * responsiveFactor, 18) : layout.gapM;
    const supportGap = desktop ? clampValue(40, width * 0.036, 64) : layout.gapM;
    const compositionWidth = desktop
      ? Math.min(980, Math.max(820, available.width * 0.78))
      : available.width;
    const compositionLeft = desktop
      ? clampValue(available.x, platformCenterX - compositionWidth * 0.5, available.x + Math.max(0, available.width - compositionWidth))
      : available.x;
    const supportWidth = shortLandscape
      ? clampValue(170, compositionWidth * 0.28, 230)
      : desktop ? clampValue(230, compositionWidth * 0.27, 285) : clampValue(210, compositionWidth * 0.24, 300);
    const boardAvailableWidth = Math.max(1, compositionWidth - supportWidth - (desktop ? supportGap : layout.gapM));
    const boardWidth = desktop
      ? Math.min(600, Math.max(520, boardAvailableWidth * 0.92))
      : Math.min(COMPONENT_SIZE_CONTRACTS.wireBoard.max.width, boardAvailableWidth);
    const maxBoardHeight = Math.max(260, available.height - hintHeight - hintGap);
    const boardHeight = desktop
      ? Math.min(370, Math.max(340, maxBoardHeight), boardWidth * 0.72)
      : Math.min(COMPONENT_SIZE_CONTRACTS.wireBoard.max.height, maxBoardHeight);
    const boardCenterX = desktop
      ? platformCenterX
      : compositionLeft + boardAvailableWidth - boardWidth / 2;
    const boardX = desktop
      ? platformCenterX - boardWidth / 2
      : clampValue(compositionLeft, boardCenterX - boardWidth / 2, compositionLeft + Math.max(0, boardAvailableWidth - boardWidth));
    const repairedSizing = desktop
      ? resolveWorldCharacterScale({
        profile: CHARACTER_VISUAL_PROFILES.assembled,
        role: DesktopCharacterRole.WORLD_SUPPORT,
        viewportHeight: height,
      })
      : undefined;
    const repairedVisibleHeight = repairedSizing?.targetVisibleHeight
      ?? clampValue(132, Math.max(110, boardHeight) * 0.78, shortLandscape ? 190 : 240);
    const repairedScale = repairedSizing?.resolvedScale ?? repairedVisibleHeight / CHARACTER_VISUAL_PROFILES.assembled.visibleHeightAtScale1;
    const assembledRobotVisibleWidth = CHARACTER_VISUAL_PROFILES.assembled.visibleWidthAtScale1 * repairedScale;
    const leftDoorClearX = platform.offsetX + 170 * platform.scale;
    const sideZoneRightX = platformCenterX - 290 * platform.scale;
    const sideZoneCardLimitX = boardX - clampValue(48, width * 0.032, 64) - assembledRobotVisibleWidth / 2;
    const sideZoneLeftX = Math.max(safe.left + assembledRobotVisibleWidth / 2 + layout.gapL, leftDoorClearX);
    const sideZoneMaxX = Math.max(sideZoneLeftX, Math.min(sideZoneRightX, sideZoneCardLimitX));
    const sideZonePreferredX = sideZoneLeftX + Math.max(0, sideZoneMaxX - sideZoneLeftX) * 0.58;
    const robotX = desktop ? clampValue(sideZoneLeftX, sideZonePreferredX, sideZoneMaxX) : 0;
    const cardCenterX = boardX + boardWidth / 2;
    const cardSurfaceY = platform.surfaceYAt(cardCenterX);
    const cardClearance = clampValue(72, 72 * responsiveFactor, 76);
    const boardY = desktop
      ? clampValue(available.y, cardSurfaceY - cardClearance - boardHeight, contentBottom - hintHeight - hintGap - boardHeight)
      : available.y;
    const board = rect(boardX, boardY, boardWidth, boardHeight);
    const support = desktop
      ? rect(board.x - supportGap - supportWidth, board.y, supportWidth, board.height)
      : rect(board.x + board.width + supportGap, board.y, supportWidth, board.height);
    const hintWidth = desktop ? Math.min(230, board.width * 0.42) : Math.min(support.width, shortLandscape ? 190 : 230);
    const hint = desktop
      ? {
        x: board.x + board.width / 2,
        y: board.y + board.height + hintGap + hintHeight / 2,
        width: hintWidth, height: hintHeight, fontSize: 19,
      }
      : {
        x: support.x + support.width / 2, y: support.y + support.height - hintHeight / 2,
        width: hintWidth, height: hintHeight, fontSize: shortLandscape ? 16 : 19,
      };
    const characterHeight = desktop ? board.height : Math.max(110, hint.y - hintHeight / 2 - layout.gapS - support.y);
    const leftFloorSurfaceYAt = (worldX: number): number => {
      const localX = clampValue(0, (worldX - leftDoorClearX) / Math.max(1, sideZoneRightX - leftDoorClearX), 1);
      return platform.topY + platform.scale * (6 - localX * 3);
    };
    const robotGroundY = desktop ? leftFloorSurfaceYAt(robotX) : hint.y - hint.height / 2 - layout.gapS;
    const robotFeetY = robotGroundY;
    const surfaceAtHintX = platform.surfaceYAt(hint.x);
    mission7 = {
      showHeader: false, showHelper: false,
      systems: { x: width / 2, y: contentTop - (desktop ? 42 : 52), width: systemsWidth },
      board,
      helper: { x: support.x + support.width / 2, feetY: robotFeetY, scale: 0 },
      repaired: { x: desktop ? robotX : support.x + support.width / 2, feetY: robotFeetY, scale: repairedScale },
      showRepaired: true, hint,
      platform: desktop ? {
        centerX: platformCenterX,
        topY: platform.topY,
        surfaceAtRobotX: robotGroundY,
        surfaceAtCardX: cardSurfaceY,
        surfaceAtHintX,
      } : undefined,
    };
    regions.PRIMARY_GAMEPLAY = board;
    regions.CHARACTER = rect(support.x, support.y, support.width, characterHeight);
    regions.SECONDARY_CHARACTER = emptyRect(layout);
    regions.STATUS = rect(width / 2 - systemsWidth / 2, mission7.systems.y - (desktop ? 19 : 26), systemsWidth, desktop ? 38 : 52);
    regions.SECONDARY_ACTIONS = rect(hint.x - hint.width / 2, hint.y - hint.height / 2, hint.width, hint.height);
    regions.PRIMARY_ACTIONS = regions.SECONDARY_ACTIONS;
  }

  const hiddenCharacters: CharacterDeclaration[] = phonePortrait ? [
    { id: 'HELPER', role: 'HIDDEN_FOR_MECHANIC_FOCUS', presentation: 'HIDDEN', region: 'CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_HELPER', visible: false, occupancy: { min: 0, ideal: 0, max: 0 } },
    { id: 'REPAIRED', role: 'HIDDEN_FOR_MECHANIC_FOCUS', presentation: 'HIDDEN', region: 'SECONDARY_CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', visible: false, occupancy: { min: 0, ideal: 0, max: 0 } },
  ] : [
    { id: 'REPAIRED', role: 'PRIMARY_CHARACTER', presentation: shortLandscape ? 'REACTION_PORTRAIT' : 'FULL_BODY', region: 'CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', visible: true, occupancy: { min: 0.45, ideal: 0.72, max: 0.88 } },
    { id: 'HELPER', role: 'HIDDEN_FOR_MECHANIC_FOCUS', presentation: 'HIDDEN', region: 'SECONDARY_CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_HELPER', visible: false, occupancy: { min: 0, ideal: 0, max: 0 } },
  ];
  return {
    missionId: 7, policyId: `MISSION_7_${semanticMode}`, semanticMode,
    regions, sizeContracts: COMPONENT_SIZE_CONTRACTS,
    components: {
      wireBoard: { contract: 'wireBoard', rect: mission7.board }, statusPanel: { contract: 'statusPanel', rect: regions.STATUS },
      actionRow: { contract: 'actionRow', rect: regions.SECONDARY_ACTIONS }, modal: { contract: 'modal', rect: regions.MODAL },
      characterZone: { contract: 'characterZone', rect: regions.CHARACTER },
    },
    characters: hiddenCharacters,
    whitespaceAllocation: phonePortrait ? ['BREATHING_ROOM'] : ['CHARACTER_PRESENCE', 'SUPPORT_REACTION', 'BACKGROUND_VISIBILITY'],
    taskCard: layout.taskCard, progress: layout.progress, mission7,
  };
}

function composeMission8(layout: ResponsiveLayout): SceneComposition {
  const { viewportWidth: width, viewportHeight: height, safe, semanticMode } = layout;
  const regions = commonRegions(layout);
  const phonePortrait = semanticMode.startsWith('PHONE_PORTRAIT');
  const shortLandscape = semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const ultra = semanticMode === 'PHONE_PORTRAIT_SHORT';
  let mission8: Mission8SceneLayout;
  if (phonePortrait) {
    const boardWidth = layout.gameplayZone.width;
    // Keep the board title visually separate from the compact systems ribbon.
    // Android browser chrome can leave only a few pixels between these regions,
    // so the gap is part of the composition contract rather than a text offset.
    const boardY = layout.gameplayZone.y + (ultra ? 42 : 46);
    const boardHeight = layout.gameplayZone.y + layout.gameplayZone.height - boardY;
    const arrowSize = CHILD_UI.touch.minimum;
    const actionHeight = CHILD_UI.touch.minimum;
    const stripY = layout.controlsZone.y + 25;
    mission8 = {
      board: rect((width - boardWidth) / 2, boardY, boardWidth, boardHeight),
      helper: { x: 0, feetY: 0, scale: 0 }, systemsY: layout.statusY, routeY: layout.statusY,
      stripY, arrowsY: stripY + 84,
      actionsY: layout.controlsZone.y + layout.controlsZone.height - actionHeight / 2,
      controlCenterX: width / 2, controlWidth: layout.controlsZone.width, arrowSize, actionHeight,
    };
  } else {
    const desktop = semanticMode === 'DESKTOP';
    const contentTop = shortLandscape ? layout.gameplayZone.y + 18 : layout.headerZone.y + layout.headerZone.height + layout.gapL + (desktop ? 18 : 32);
    const contentBottom = height - safe.bottom;
    const available = rect(safe.left, contentTop, width - safe.left - safe.right, contentBottom - contentTop);
    if (desktop) {
      const backgroundScale = Math.max(width / LOGICAL_SCENE_WIDTH, height / LOGICAL_SCENE_HEIGHT);
      const backgroundOffsetX = (width - LOGICAL_SCENE_WIDTH * backgroundScale) / 2;
      const platformCenterX = backgroundOffsetX + PLATFORM_CENTER_X * backgroundScale;
      const compositionWidth = Math.min(1210, Math.max(1040, available.width * 0.86));
      const controlWidth = clampValue(460, compositionWidth * 0.39, 500);
      const boardControlGap = 32;
      const boardWidth = Math.min(COMPONENT_SIZE_CONTRACTS.programBoard.max.width, compositionWidth - controlWidth - boardControlGap);
      const boardHeight = Math.min(COMPONENT_SIZE_CONTRACTS.programBoard.max.height, Math.max(360, available.height * 0.72), boardWidth * 0.66);
      const actualCompositionWidth = boardWidth + boardControlGap + controlWidth;
      const compositionLeft = clampValue(
        available.x,
        platformCenterX - actualCompositionWidth / 2,
        available.x + Math.max(0, available.width - actualCompositionWidth),
      );
      const boardCenterY = clampValue(
        available.y + boardHeight / 2,
        height * 0.5,
        Math.min(height * 0.82 - boardHeight / 2, contentBottom - height * 0.08 - boardHeight / 2),
      );
      const boardY = boardCenterY - boardHeight / 2;
      const board = rect(compositionLeft, boardY, boardWidth, boardHeight);
      const controlCenterX = board.x + board.width + boardControlGap + controlWidth / 2;
      const boardCenter = board.y + board.height / 2;
      const arrowSize = clampValue(62, board.height * 0.16, 70);
      const actionHeight = 54;
      const controlPanelHeight = clampValue(362, board.height * 0.96, 400);
      const panelTop = boardCenter - controlPanelHeight / 2;
      const stripY = panelTop + 66;
      const arrowsY = stripY + 120;
      const actionsY = arrowsY + 74;
      const primaryCtaY = actionsY + actionHeight + 12;
      mission8 = {
        board,
        helper: { x: 0, feetY: 0, scale: 0 },
        systemsY: contentTop - 46, routeY: contentTop - 18,
        stripY, arrowsY, actionsY, primaryCtaY, controlPanelHeight,
        controlCenterX, controlWidth, arrowSize, actionHeight,
      };
    } else {
      const controlWidth = shortLandscape ? clampValue(250, available.width * 0.36, 320) : clampValue(300, available.width * 0.34, 430);
      const boardAvailable = rect(available.x, available.y, available.width - controlWidth - layout.gapL, available.height);
      const boardWidth = Math.min(COMPONENT_SIZE_CONTRACTS.programBoard.max.width, boardAvailable.width);
      const boardHeight = Math.min(COMPONENT_SIZE_CONTRACTS.programBoard.max.height, boardAvailable.height);
      const board = rect(boardAvailable.x + Math.max(0, (boardAvailable.width - boardWidth) / 2), boardAvailable.y, boardWidth, boardHeight);
      const controlX = boardAvailable.x + boardAvailable.width + layout.gapL;
      const controlCenterX = controlX + controlWidth / 2;
      const stripY = available.y + (shortLandscape ? 28 : 42);
      const arrowSize = shortLandscape ? CHILD_UI.touch.minimum : 62;
      const actionsY = Math.min(contentBottom - CHILD_UI.touch.minimum / 2, stripY + (shortLandscape ? 190 : 230));
      mission8 = {
        board,
        helper: { x: 0, feetY: 0, scale: 0 },
        systemsY: contentTop - (shortLandscape ? 51 : 58), routeY: contentTop - 24,
        stripY, arrowsY: stripY + (shortLandscape ? 88 : 104), actionsY,
        controlCenterX, controlWidth, arrowSize, actionHeight: CHILD_UI.touch.minimum,
      };
    }
  }
  regions.PRIMARY_GAMEPLAY = mission8.board;
  const boardRight = mission8.board.x + mission8.board.width;
  regions.CHARACTER = mission8.board;
  regions.SECONDARY_CHARACTER = emptyRect(layout);
  const systemsHeight = phonePortrait || shortLandscape ? 34 : 50;
  regions.STATUS = rect(width / 2 - 150, mission8.systemsY - systemsHeight / 2, 300, systemsHeight);
  const controlLeft = mission8.controlCenterX - mission8.controlWidth / 2;
  regions.FEEDBACK = rect(controlLeft, mission8.stripY + 28, mission8.controlWidth, 28);
  regions.PRIMARY_ACTIONS = rect(controlLeft, mission8.actionsY - mission8.actionHeight / 2, mission8.controlWidth, mission8.actionHeight);
  regions.SECONDARY_ACTIONS = rect(controlLeft, mission8.arrowsY - mission8.arrowSize / 2, mission8.controlWidth, mission8.arrowSize);
  if (!phonePortrait) {
    regions.SECONDARY_CHARACTER = rect(boardRight + layout.gapM, mission8.board.y, Math.max(1, controlLeft - boardRight - layout.gapM), mission8.board.height);
  }
  return {
    missionId: 8, policyId: `MISSION_8_${semanticMode}`, semanticMode,
    regions, sizeContracts: COMPONENT_SIZE_CONTRACTS,
    components: {
      programBoard: { contract: 'programBoard', rect: mission8.board }, statusPanel: { contract: 'statusPanel', rect: regions.STATUS },
      actionRow: { contract: 'actionRow', rect: regions.PRIMARY_ACTIONS }, modal: { contract: 'modal', rect: regions.MODAL },
      characterZone: { contract: 'characterZone', rect: regions.CHARACTER },
    },
    characters: [
      { id: 'BOARD_ROBOT', role: 'BOARD_ACTOR', presentation: 'BOARD_CELL', region: 'PRIMARY_GAMEPLAY', coordinateSpace: 'BOARD_LOCAL', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', visible: true, occupancy: { min: 0.65, ideal: 0.74, max: 0.8 } },
      { id: 'HELPER', role: 'HIDDEN_FOR_MECHANIC_FOCUS', presentation: 'HIDDEN', region: 'SECONDARY_CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_HELPER', visible: false, occupancy: { min: 0, ideal: 0, max: 0 } },
    ],
    whitespaceAllocation: phonePortrait ? ['BREATHING_ROOM'] : ['SUPPORT_REACTION', 'BREATHING_ROOM', 'BACKGROUND_VISIBILITY'],
    taskCard: layout.taskCard, progress: layout.progress, mission8,
  };
}

function composeMission9(layout: ResponsiveLayout): SceneComposition {
  const { viewportWidth: width, viewportHeight: height, safe, semanticMode } = layout;
  const regions = commonRegions(layout);
  const portrait = layout.mode !== 'landscape';
  const phonePortrait = semanticMode.startsWith('PHONE_PORTRAIT');
  const shortLandscape = semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const desktop = semanticMode === 'DESKTOP';

  const backgroundScale = Math.max(width / LOGICAL_SCENE_WIDTH, height / LOGICAL_SCENE_HEIGHT);
  const backgroundOffsetX = (width - LOGICAL_SCENE_WIDTH * backgroundScale) / 2;
  const backgroundOffsetY = (height - LOGICAL_SCENE_HEIGHT * backgroundScale) / 2;
  const platformCenterX = backgroundOffsetX + PLATFORM_CENTER_X * backgroundScale;
  const platformContactY = backgroundOffsetY + PLATFORM_CONTACT_Y * backgroundScale;

  const safeLeft = safe.left;
  const safeRight = width - safe.right;
  const safeBottom = height - safe.bottom;
  const safeWidth = Math.max(1, safeRight - safeLeft);
  const horizontalInset = desktop ? Math.max(layout.gapM, (safeWidth - Math.min(1180, safeWidth)) / 2) : layout.gapXS;
  const contentLeft = safeLeft + horizontalInset;
  const contentRight = safeRight - horizontalInset;
  const contentWidth = Math.max(1, contentRight - contentLeft);

  const titleHeight = shortLandscape ? 30 : clampValue(30, height * 0.042, 38);
  const statusHeight = shortLandscape ? 28 : 34;
  const statusWidth = shortLandscape ? 94 : 118;
  const titleTop = shortLandscape
    ? safe.top + Math.max(layout.iconHeight, layout.headerHeight) + layout.gapXS
    : layout.headerZone.y + layout.headerZone.height + layout.gapS;
  const titleSideReserve = shortLandscape ? layout.iconWidth + layout.gapS : 0;
  const titleAvailableWidth = Math.max(1, contentWidth - titleSideReserve * 2);
  const titleWidth = Math.min(shortLandscape ? 430 : 560, titleAvailableWidth);
  const title = rect(platformCenterX - titleWidth / 2, titleTop, titleWidth, titleHeight);
  const progress = shortLandscape
    ? rect(contentRight - statusWidth, title.y + title.height + layout.gapXS, statusWidth, statusHeight)
    : rect(contentRight - statusWidth, title.y, statusWidth, statusHeight);

  const feedbackHeight = shortLandscape ? 26 : desktop ? 22 : 30;
  const feedbackTop = title.y + title.height + layout.gapXS;
  const feedbackRight = shortLandscape ? progress.x - layout.gapS : contentRight;
  const feedbackWidth = Math.min(shortLandscape ? 360 : 520, Math.max(1, feedbackRight - contentLeft));
  const feedback = rect(platformCenterX - feedbackWidth / 2, feedbackTop, feedbackWidth, feedbackHeight);

  const desiredControlHeight = shortLandscape
    ? clampValue(56, height * 0.15, 64)
    : phonePortrait ? 58 : clampValue(62, height * 0.075, 72);
  const belowPlatformHeight = Math.max(CHILD_UI.touch.minimum, safeBottom - platformContactY - layout.gapXS);
  const controlHeight = Math.min(desiredControlHeight, belowPlatformHeight);
  const controlGap = shortLandscape ? 8 : 12;
  const gameplayLift = shortLandscape ? 16 : 28;
  const choicesTop = Math.max(
    platformContactY + layout.gapXS - gameplayLift,
    safeBottom - controlHeight - (shortLandscape ? 0 : layout.gapL),
  );
  const choices = rect(contentLeft, choicesTop, contentWidth, controlHeight);

  const stageTop = Math.max(feedback.y + feedback.height, progress.y + progress.height) + layout.gapXS;
  const stageBottom = Math.min(platformContactY, choices.y - layout.gapS);
  const stageHeight = Math.max(1, stageBottom - stageTop);
  const puzzleWidth = Math.min(
    shortLandscape ? 540 : 700,
    contentWidth * (shortLandscape ? 0.62 : 0.58),
  );
  const puzzleStage = rect(platformCenterX - puzzleWidth / 2, stageTop, puzzleWidth, stageHeight);
  const robotGap = shortLandscape ? layout.gapXS : Math.max(8, layout.gapS - 4);
  const robotRight = puzzleStage.x - robotGap;
  const mission9Sizing = desktop
    ? resolveWorldCharacterScale({
      profile: CHARACTER_VISUAL_PROFILES.assembled,
      role: DesktopCharacterRole.WORLD_PRIMARY,
      viewportHeight: height,
    })
    : undefined;
  const robotVisibleHeight = mission9Sizing?.targetVisibleHeight
    ?? (shortLandscape ? clampValue(118, stageHeight * 0.64, 172) : clampValue(128, stageHeight * 0.52, 270));
  const desiredRobotWidth = CHARACTER_VISUAL_PROFILES.assembled.visibleWidthAtScale1
    * (mission9Sizing?.resolvedScale ?? robotVisibleHeight / CHARACTER_VISUAL_PROFILES.assembled.visibleHeightAtScale1);
  const robotWidth = Math.min(
    shortLandscape ? 138 : Math.max(230, desiredRobotWidth),
    Math.max(1, robotRight - contentLeft),
  );
  const robot = rect(robotRight - robotWidth, stageTop, robotWidth, stageHeight);
  const world = rect(contentLeft, stageTop, contentWidth, stageHeight);

  regions.PRIMARY_GAMEPLAY = puzzleStage;
  regions.CHARACTER = robot;
  regions.STATUS = progress;
  regions.FEEDBACK = feedback;
  regions.PRIMARY_ACTIONS = choices;
  regions.SECONDARY_ACTIONS = choices;
  const mission9: Mission9SceneLayout = {
    showHeader: !phonePortrait && !shortLandscape,
    title,
    progress,
    status: progress,
    puzzleStage,
    robot,
    choices,
    world,
    controls: choices,
    feedback,
    platformCenterX,
    platformContactY,
    controlGap,
    controlHeight,
    robotScale: mission9Sizing?.resolvedScale ?? robotVisibleHeight / CHARACTER_VISUAL_PROFILES.assembled.visibleHeightAtScale1,
  };
  return {
    missionId: 9, policyId: `MISSION_9_${semanticMode}`, semanticMode,
    regions, sizeContracts: COMPONENT_SIZE_CONTRACTS,
    components: {
      taskCard: { contract: 'taskCard', rect: puzzleStage }, statusPanel: { contract: 'statusPanel', rect: progress },
      actionRow: { contract: 'actionRow', rect: choices }, modal: { contract: 'modal', rect: regions.MODAL },
      characterZone: { contract: 'characterZone', rect: robot },
    },
    characters: [
      { id: 'REPAIRED', role: 'PRIMARY_CHARACTER', presentation: phonePortrait ? 'REACTION_PORTRAIT' : 'FULL_BODY', region: 'CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', visible: true, occupancy: { min: 0.45, ideal: 0.7, max: 0.86 } },
      { id: 'HELPER', role: 'HIDDEN_FOR_MECHANIC_FOCUS', presentation: 'HIDDEN', region: 'SECONDARY_CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_HELPER', visible: false, occupancy: { min: 0, ideal: 0, max: 0 } },
    ],
    whitespaceAllocation: portrait ? ['BREATHING_ROOM'] : ['CHARACTER_PRESENCE', 'BACKGROUND_VISIBILITY'],
    taskCard: puzzleStage, progress: layout.progress, mission9,
  };
}

function composeMission10(layout: ResponsiveLayout): SceneComposition {
  const { viewportWidth: width, viewportHeight: height, safe, semanticMode } = layout;
  const regions = commonRegions(layout);
  const portraitGate = layout.mode !== 'landscape';
  const shortLandscape = semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const desktop = semanticMode === 'DESKTOP';
  const safeLeft = safe.left + (shortLandscape ? layout.gapXS : layout.gapS);
  const safeRight = width - safe.right - (shortLandscape ? layout.gapXS : layout.gapS);
  const safeBottom = height - safe.bottom;
  const safeWidth = Math.max(1, safeRight - safeLeft);
  const headerBottom = layout.headerZone.y + layout.headerZone.height;
  const titleHeight = shortLandscape ? 28 : clampValue(30, height * 0.05, 42);
  const titleTop = headerBottom + (shortLandscape ? 2 : layout.gapXS);
  const progressWidth = shortLandscape ? 112 : 148;
  const progress = rect(safeRight - progressWidth, titleTop, progressWidth, titleHeight);
  const titleSideReserve = progressWidth + layout.gapS;
  const title = rect(
    safeLeft + titleSideReserve,
    titleTop,
    Math.max(1, safeWidth - titleSideReserve * 2),
    titleHeight,
  );
  const feedbackHeight = shortLandscape ? 24 : 30;
  const feedback = rect(
    safeLeft,
    title.y + title.height + (shortLandscape ? 1 : layout.gapXS),
    safeWidth,
    feedbackHeight,
  );
  const worldTop = feedback.y + feedback.height + (shortLandscape ? 1 : layout.gapXS);
  const worldBottom = safeBottom - (shortLandscape ? 4 : layout.gapXS);
  const world = rect(safeLeft, worldTop, safeWidth, Math.max(1, worldBottom - worldTop));
  const mission10Sizing = desktop
    ? resolveWorldCharacterScale({
      profile: CHARACTER_VISUAL_PROFILES.assembled,
      role: DesktopCharacterRole.WORLD_PRIMARY,
      viewportHeight: height,
    })
    : undefined;
  const mission10VisibleWidth = mission10Sizing
    ? CHARACTER_VISUAL_PROFILES.assembled.visibleWidthAtScale1 * mission10Sizing.resolvedScale
    : 0;
  const robotWidth = Math.min(
    desktop ? Math.max(250, mission10VisibleWidth) : shortLandscape ? 112 : 180,
    world.width * (desktop ? 0.32 : shortLandscape ? 0.22 : 0.24),
  );
  const targetGap = shortLandscape ? 8 : 12;
  const consoleWidth = Math.min(desktop ? 460 : shortLandscape ? 340 : 400, world.width * 0.48);
  const launchConsoleVisibleLeft = width / 2 - consoleWidth / 2;
  const launchRobotDesiredLeft = width * 0.12;
  const launchRobotMaxLeft = launchConsoleVisibleLeft - 64 - robotWidth;
  const launchRobotLeft = desktop
    ? Math.min(launchRobotMaxLeft, Math.max(safeLeft + layout.gapL, launchRobotDesiredLeft))
    : world.x;
  const launchRobotZone = rect(launchRobotLeft, world.y, robotWidth, world.height);
  const robot = launchRobotZone;
  const puzzleStage = rect(
    robot.x + robot.width + targetGap,
    world.y,
    Math.max(1, world.width - robot.width - targetGap),
    world.height,
  );
  const platform = createPlatformSurfaceResolver(width, height);
  // Wide path artwork must remain subordinate to the WORLD_SUPPORT robot.
  const desktopCardWidth = clampValue(184, width * 0.145, 246);
  const desktopCardHeight = clampValue(138, height * 0.17, 184);
  const desktopLaneGap = clampValue(18, width * 0.016, 30);
  const desktopGroupWidth = desktopCardWidth * 3 + desktopLaneGap * 2;
  const desktopGroupHeight = desktopCardHeight;
  const desktopGroupCenterY = Math.min(
    world.y + world.height * 0.58,
    platform.topY - desktopCardHeight * 0.12,
  );
  const pathChoiceGroup = desktop
    ? rect(platform.centerX - desktopGroupWidth / 2, desktopGroupCenterY - desktopGroupHeight / 2, desktopGroupWidth, desktopGroupHeight)
    : puzzleStage;
  const laneGap = desktop ? desktopLaneGap : targetGap;
  const laneWidth = desktop ? desktopCardWidth : (puzzleStage.width - laneGap * 2) / 3;
  const laneHeight = desktop ? desktopCardHeight : puzzleStage.height;
  const pathLanes = [0, 1, 2].map((index) =>
    rect(pathChoiceGroup.x + index * (laneWidth + laneGap), pathChoiceGroup.y, laneWidth, laneHeight),
  ) as unknown as readonly [RectLayout, RectLayout, RectLayout];
  const relayBoard = rect(puzzleStage.x, puzzleStage.y, puzzleStage.width, puzzleStage.height);
  const signalBoard = rect(puzzleStage.x, puzzleStage.y, puzzleStage.width, puzzleStage.height);
  // ENERGY keeps a compact bounded semantic group centered on the central platform.
  // Extra desktop viewport width becomes breathing room, never puzzle stretching.
  const energyGroupWidth = clampValue(620, width * 0.44, 780);
  const energyGroupHeight = clampValue(220, height * 0.3, 320);
  const energyGroupCenterX = platform.centerX;
  const energyStageBottomY = platform.topY - clampValue(20, height * 0.035, 36);
  const energyGroupCenterY = energyStageBottomY - energyGroupHeight / 2;
  const energyRelaySize = clampValue(100, height * 0.125, 120);
  const energyRobotSizing = resolveWorldCharacterScale({ profile: CHARACTER_VISUAL_PROFILES.assembled, role: DesktopCharacterRole.WORLD_SUPPORT, viewportHeight: height });
  const energyGroup = rect(energyGroupCenterX - energyGroupWidth / 2, energyGroupCenterY - energyGroupHeight / 2, energyGroupWidth, energyGroupHeight);
  const energyStage: Mission10EnergyStageLayout | undefined = desktop ? {
    group: energyGroup,
    groupCenterX: energyGroupCenterX,
    groupCenterY: energyGroupCenterY,
    relaySize: energyRelaySize,
    terminalRadius: Math.round(energyRelaySize * 0.28),
    beamCoreWidth: clampValue(4, width * 0.0032, 6),
    beamGlowWidth: clampValue(9, width * 0.0075, 14),
    robotCenterX: energyGroup.x - clampValue(50, width * 0.04, 100) - CHARACTER_VISUAL_PROFILES.assembled.visibleRightLocal * energyRobotSizing.resolvedScale,
    robotScale: energyRobotSizing.resolvedScale,
    robotTargetVisibleHeight: energyRobotSizing.targetVisibleHeight,
    gapToGroup: clampValue(50, width * 0.04, 100),
    platformCenterX: platform.centerX,
  } : undefined;
  const laboratoryScale = Math.max(width / LOGICAL_SCENE_WIDTH, height / LOGICAL_SCENE_HEIGHT);
  const introPlatformY = (height - LOGICAL_SCENE_HEIGHT * laboratoryScale) / 2 + PLATFORM_CONTACT_Y * laboratoryScale;
  const launchGroundY = Math.min(worldBottom, introPlatformY + layout.gapL);
  const launchHeight = Math.max(1, launchGroundY - world.y);
  const consoleVisibleWidth = Math.min(consoleWidth, launchHeight * 1091 / 958);
  const beaconHeight = Math.min(desktop ? 360 : shortLandscape ? 220 : 320, launchHeight * 0.92);
  const beaconWidth = beaconHeight * 964 / 1337;
  const beacon = rect(Math.min(safeRight - beaconWidth, width / 2 + consoleVisibleWidth / 2 + targetGap * 2),
    launchGroundY - beaconHeight, beaconWidth, beaconHeight);
  const launchConsole = rect(width / 2 - consoleWidth / 2, world.y, consoleWidth, launchHeight);
  const platformContactY = world.y + world.height;
  const robotVisibleHeight = mission10Sizing?.targetVisibleHeight ?? clampValue(shortLandscape ? 118 : 150, world.height * 0.86, desktop ? 320 : 240);
  // Intro hierarchy starts at the controls, independently of actor dimensions.
  const introTitleHeight = shortLandscape ? 28 : 40;
  const introTitle = rect(safe.left + layout.iconWidth + layout.gapM, layout.headerY - introTitleHeight / 2,
    width - safe.left - safe.right - 2 * (layout.iconWidth + layout.gapM), introTitleHeight);
  const introMessageWidth = Math.min(introTitle.width, shortLandscape ? 410 : 540);
  const introMessage = rect((width - introMessageWidth) / 2, introTitle.y + introTitle.height + layout.gapXS,
    introMessageWidth, shortLandscape ? 48 : 70);
  const introCtaHeight = shortLandscape ? 48 : 58;
  const introCtaWidth = shortLandscape ? 230 : 276;
  const introCtaTop = Math.min(worldBottom - introCtaHeight - 2, introPlatformY + layout.gapM);
  const introGroundY = Math.min(introPlatformY, introCtaTop - layout.gapS);
  const heroWidth = Math.min(safeWidth, 600 * laboratoryScale);
  const heroTop = introMessage.y + introMessage.height + layout.gapM;
  const introRegions: Mission10SceneLayout['introRegions'] = {
    TOP_LEFT_CONTROL: rect(safe.left, layout.headerY - layout.iconHeight / 2, layout.iconWidth, layout.iconHeight),
    TOP_CENTER_TITLE: introTitle,
    TOP_RIGHT_CONTROL: rect(width - safe.right - layout.iconWidth, layout.headerY - layout.iconHeight / 2, layout.iconWidth, layout.iconHeight),
    INTRO_MESSAGE: introMessage,
    HERO_GROUP: rect((width - heroWidth) / 2, heroTop, heroWidth, Math.max(1, introGroundY - heroTop)),
    CTA: rect((width - introCtaWidth) / 2, introCtaTop, introCtaWidth, introCtaHeight),
  };
  // SIGNAL has a compact world composition and its own HUD, leaving other stages intact.
  // Short phone landscape gets a dedicated enlarged apparatus policy because
  // the signal chain is the primary learning object on this stage.
  const signalScale = shortLandscape
    ? clampValue(0.92, Math.min(width / 844, height / 390), 1.08)
    : Math.min(1.45, laboratoryScale);
  const signalPropHeight = shortLandscape
    ? clampValue(88, 104 * signalScale, 118)
    : desktop
      ? clampValue(112, height * 0.15, 145)
      : clampValue(60, 98 * signalScale, 128);
  const signalProgressWidth = clampValue(88, (shortLandscape ? 100 : 108) * signalScale, 138);
  const signalProgress = rect((width - signalProgressWidth) / 2,
    introTitle.y + introTitle.height + layout.gapXS, signalProgressWidth, 22);
  const signalFieldWidth = shortLandscape
    ? Math.min(safeWidth * 0.78, 632 * signalScale)
    : desktop
      ? clampValue(470, width * 0.36, 620)
      : Math.min(760, 530 * signalScale, safeWidth * 0.69);
  // Desktop SIGNAL is a bounded installation on the laboratory platform.  The authored
  // route still has meaningful vertical turns, but must not grow with the laboratory.
  // Non-desktop branches deliberately retain their approved composition.
  const signalFieldHeight = shortLandscape
    ? Math.min(Math.max(244 * signalScale, signalPropHeight * 2.72), Math.max(1, safeBottom - signalProgress.y - signalProgress.height - layout.gapXS * 2))
    : desktop
      ? clampValue(190, height * 0.221, 200)
      : Math.max(205 * signalScale, signalPropHeight * 2.7);
  const signalGroundY = Math.min(safeBottom, introPlatformY + (shortLandscape ? 2 : 3) * signalScale);
  const signalFieldTop = shortLandscape
    ? Math.max(signalProgress.y + signalProgress.height + layout.gapXS, signalGroundY - signalFieldHeight - layout.gapXS)
    : desktop
      ? platform.topY - clampValue(40, height * 0.049, 52) - signalFieldHeight
      : Math.max(signalProgress.y + signalProgress.height + signalPropHeight * 0.4,
        introPlatformY - signalFieldHeight + 31 * signalScale);
  const signalFieldCenterX = shortLandscape
    ? width / 2 + safeWidth * 0.035
    : desktop
      // SIGNAL_B's authored end devices occupy 5 of 6 columns. Offset the field
      // by half that residual column so the actual visible apparatus, not an empty
      // grid cell, is centered over the platform.
      ? platform.centerX + signalFieldWidth / 24
      : width / 2 + 58 * signalScale;
  const signalField = rect(signalFieldCenterX - signalFieldWidth / 2,
    signalFieldTop, signalFieldWidth, signalFieldHeight);
  const signalRobotSizing = desktop
    ? resolveWorldCharacterScale({
      profile: CHARACTER_VISUAL_PROFILES.assembled,
      role: DesktopCharacterRole.WORLD_SUPPORT,
      viewportHeight: height,
    })
    : undefined;
  const signalRobotHeight = signalRobotSizing?.targetVisibleHeight
    ?? (shortLandscape ? clampValue(112, signalFieldHeight * 0.58, 142) : 190 * signalScale);
  const signalRobotWidth = signalRobotHeight * CHARACTER_VISUAL_PROFILES.assembled.visibleWidthAtScale1 / CHARACTER_VISUAL_PROFILES.assembled.visibleHeightAtScale1;
  const signalRobotRight = shortLandscape ? Math.max(safeLeft + signalRobotWidth, signalField.x - layout.gapXS) : signalField.x - signalPropHeight * 0.55;
  const signalRegions: Mission10SignalRegions = {
    TITLE: introTitle,
    PROGRESS: signalProgress,
    APPARATUS_FIELD: signalField,
    ROBOT_VISIBLE: rect(signalRobotRight - signalRobotWidth, signalGroundY - signalRobotHeight,
      signalRobotWidth, signalRobotHeight),
    ROBOT_GROUND_Y: signalGroundY,
    PROP_VISIBLE_HEIGHT: signalPropHeight,
    BEAM_CORE_WIDTH: shortLandscape ? clampValue(6, 7 * signalScale, 8) : clampValue(3, 4 * signalScale, 5),
  };
  const mission10: Mission10SceneLayout = {
    signalRegions,
    introRegions,
    introGroundY,
    launchGroundY,
    launchRobotZone,
    portraitGate,
    showExtendedHeader: !shortLandscape && !portraitGate,
    title,
    progress,
    feedback,
    world,
    robot,
    puzzleStage,
    pathChoiceGroup,
    platformCenterX: platform.centerX,
    pathLanes,
    relayBoard,
    energyStage,
    signalBoard,
    launchConsole,
    beacon,
    platformContactY,
    robotScale: mission10Sizing?.resolvedScale ?? Math.min(robotVisibleHeight / 1463, robot.width / 958),
    targetGap,
  };
  regions.HEADER = layout.headerZone;
  regions.PRIMARY_GAMEPLAY = puzzleStage;
  regions.CHARACTER = robot;
  regions.FEEDBACK = feedback;
  regions.STATUS = progress;
  regions.PRIMARY_ACTIONS = puzzleStage;
  regions.SECONDARY_ACTIONS = puzzleStage;
  return {
    missionId: 10,
    policyId: `MISSION_10_${semanticMode}`,
    semanticMode,
    regions,
    sizeContracts: COMPONENT_SIZE_CONTRACTS,
    components: {
      taskCard: { contract: 'taskCard', rect: puzzleStage },
      statusPanel: { contract: 'statusPanel', rect: progress },
      actionRow: { contract: 'actionRow', rect: puzzleStage },
      modal: { contract: 'modal', rect: regions.MODAL },
      characterZone: { contract: 'characterZone', rect: robot },
    },
    characters: [
      { id: 'REPAIRED', role: 'PRIMARY_CHARACTER', presentation: portraitGate ? 'REACTION_PORTRAIT' : 'FULL_BODY', region: 'CHARACTER', coordinateSpace: 'SCREEN', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', visible: true, occupancy: { min: 0.52, ideal: 0.72, max: 0.9 } },
    ],
    whitespaceAllocation: portraitGate ? ['BREATHING_ROOM'] : ['CHARACTER_PRESENCE', 'BACKGROUND_VISIBILITY'],
    taskCard: puzzleStage,
    progress: layout.progress,
    mission10,
  };
}

function composeTransition(layout: ResponsiveLayout): SceneComposition {
  const { viewportWidth: width, viewportHeight: height, semanticMode, safe } = layout;
  const regions = commonRegions(layout);
  const portrait = layout.mode !== 'landscape';
  const phonePortrait = semanticMode.startsWith('PHONE_PORTRAIT');
  const screenActors = phonePortrait || semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const buttonHeight = fluidValue(54, height, 0.082, 64);
  const titleSize = phonePortrait ? fluidValue(28, width, 0.09, 42) : portrait ? fluidValue(28, width, 0.09, 46) : fluidValue(32, height, 0.07, 50);
  const titleY = phonePortrait ? layout.headerZone.y + layout.headerZone.height + layout.gapL + titleSize / 2 : height * 0.16;
  const subtitleY = titleY + titleSize * 1.12;
  const buttonY = height - safe.bottom - buttonHeight / 2;
  const pairTop = subtitleY + titleSize * 0.62 + layout.gapS;
  const actorFeetY = buttonY - buttonHeight / 2 - layout.gapM - (phonePortrait ? fluidValue(74, height, 0.11, 100) : 0);
  const actorAvailableHeight = Math.max(150, actorFeetY - pairTop);
  const pairSpan = phonePortrait ? Math.min(165, width * 0.44) : portrait ? 270 : 320;
  const transitionParentScale = Math.max(width / LOGICAL_SCENE_WIDTH, height / LOGICAL_SCENE_HEIGHT);
  const transitionDesktopSizing = !portrait && semanticMode === 'DESKTOP'
    ? resolveWorldCharacterScale({
      profile: CHARACTER_VISUAL_PROFILES.assembled,
      role: DesktopCharacterRole.WORLD_SECONDARY,
      viewportHeight: height,
      parentScale: transitionParentScale,
    })
    : undefined;
  const pairScale = transitionDesktopSizing?.resolvedScale
    ?? Math.min(phonePortrait ? 0.21 : portrait ? 0.22 : 0.24, actorAvailableHeight / 1402);
  const transition: TransitionSceneLayout = { phonePortrait, titleY, titleSize, subtitleY, buttonHeight, buttonY, actorFeetY, pairScale, pairSpan };
  regions.STATUS = rect(layout.safe.left, titleY - titleSize / 2, width - layout.safe.left - layout.safe.right, subtitleY + titleSize * 0.5 - (titleY - titleSize / 2));
  regions.CHARACTER = rect(layout.safe.left, pairTop, width - layout.safe.left - layout.safe.right, actorFeetY - pairTop);
  regions.SECONDARY_CHARACTER = regions.CHARACTER;
  regions.PRIMARY_ACTIONS = rect(width / 2 - Math.min(280, width - layout.safe.left - layout.safe.right - 30) / 2, buttonY - buttonHeight / 2, Math.min(280, width - layout.safe.left - layout.safe.right - 30), buttonHeight);
  regions.SECONDARY_ACTIONS = regions.PRIMARY_ACTIONS;
  return {
    missionId: 'MISSION5_TRANSITION', policyId: `MISSION_5_TRANSITION_${semanticMode}`, semanticMode,
    regions, sizeContracts: COMPONENT_SIZE_CONTRACTS,
    components: { actionRow: { contract: 'actionRow', rect: regions.PRIMARY_ACTIONS }, modal: { contract: 'modal', rect: regions.MODAL }, characterZone: { contract: 'characterZone', rect: regions.CHARACTER } },
    characters: [
      { id: 'HELPER', role: 'PRIMARY_CHARACTER', presentation: 'FULL_BODY', region: 'CHARACTER', coordinateSpace: screenActors ? 'SCREEN' : 'LOGICAL_WORLD', visibleBoundsId: 'ROBOT_V2_HELPER', visible: true, occupancy: { min: 0.5, ideal: 0.72, max: 0.9 } },
      { id: 'REPAIRED', role: 'PRIMARY_CHARACTER', presentation: 'FULL_BODY', region: 'SECONDARY_CHARACTER', coordinateSpace: screenActors ? 'SCREEN' : 'LOGICAL_WORLD', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', visible: true, occupancy: { min: 0.5, ideal: 0.72, max: 0.9 } },
    ],
    whitespaceAllocation: ['CHARACTER_PRESENCE', 'BREATHING_ROOM', 'BACKGROUND_VISIBILITY'],
    taskCard: layout.taskCard, progress: layout.progress, transition,
  };
}

export function composeScene(layout: ResponsiveLayout, missionId: MissionId): SceneComposition {
  if (missionId === 6) return composeMission6(layout);
  if (missionId === 7) return composeMission7(layout);
  if (missionId === 8) return composeMission8(layout);
  if (missionId === 9) return composeMission9(layout);
  if (missionId === 10) return composeMission10(layout);
  if (missionId === 'MISSION5_TRANSITION') return composeTransition(layout);
  return composeSharedMission(layout, missionId);
}

export function createMission7SceneLayout(layout: ResponsiveLayout): Mission7SceneLayout {
  return composeMission7(layout).mission7!;
}

export function createMission8SceneLayout(layout: ResponsiveLayout): Mission8SceneLayout {
  return composeMission8(layout).mission8!;
}

export function createTransitionSceneLayout(layout: ResponsiveLayout): TransitionSceneLayout {
  return composeTransition(layout).transition!;
}
