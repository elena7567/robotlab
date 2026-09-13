import { clampValue, fluidValue } from './fluidSizing';
import { CHILD_UI } from './childUi';
import type { ProgressSizing, RectLayout, ResponsiveLayout } from './responsiveLayout';
import {
  LOGICAL_SCENE_HEIGHT,
  LOGICAL_SCENE_WIDTH,
  PLATFORM_CENTER_X,
  PLATFORM_CONTACT_Y,
} from './sceneLayout';

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
}

export interface Mission8SceneLayout {
  readonly board: RectLayout;
  readonly helper: { readonly x: number; readonly feetY: number; readonly scale: number };
  readonly systemsY: number;
  readonly routeY: number;
  readonly stripY: number;
  readonly arrowsY: number;
  readonly actionsY: number;
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

export interface Mission10SceneLayout {
  readonly signalRegions: Mission10SignalRegions;
  readonly introRegions: Readonly<Record<'TOP_LEFT_CONTROL' | 'TOP_CENTER_TITLE' | 'TOP_RIGHT_CONTROL' | 'INTRO_MESSAGE' | 'HERO_GROUP' | 'CTA', RectLayout>>;
  readonly introGroundY: number;
  readonly launchGroundY: number;
  readonly portraitGate: boolean;
  readonly showExtendedHeader: boolean;
  readonly title: RectLayout;
  readonly progress: RectLayout;
  readonly feedback: RectLayout;
  readonly world: RectLayout;
  readonly robot: RectLayout;
  readonly puzzleStage: RectLayout;
  readonly pathLanes: readonly [RectLayout, RectLayout, RectLayout];
  readonly relayBoard: RectLayout;
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
    const contentTop = shortLandscape ? layout.gameplayZone.y + 18 : layout.headerZone.y + (semanticMode === 'DESKTOP' ? layout.headerHeight : 0) + layout.gapS + 78;
    const contentBottom = height - safe.bottom;
    const available = rect(safe.left, contentTop, width - safe.left - safe.right, contentBottom - contentTop);
    const supportWidth = shortLandscape
      ? clampValue(170, available.width * 0.28, 230)
      : clampValue(210, available.width * 0.24, 300);
    const boardAvailable = rect(available.x, available.y, available.width - supportWidth - layout.gapM, available.height);
    const boardWidth = Math.min(COMPONENT_SIZE_CONTRACTS.wireBoard.max.width, boardAvailable.width);
    const boardHeight = Math.min(COMPONENT_SIZE_CONTRACTS.wireBoard.max.height, boardAvailable.height);
    const board = rect(boardAvailable.x + Math.max(0, boardAvailable.width - boardWidth), boardAvailable.y, boardWidth, boardHeight);
    const support = rect(board.x + board.width + layout.gapM, available.y, supportWidth, available.height);
    const hintHeight = shortLandscape ? 52 : 56;
    const hintWidth = Math.min(support.width, shortLandscape ? 190 : 230);
    const hint = {
      x: support.x + support.width / 2, y: support.y + support.height - hintHeight / 2,
      width: hintWidth, height: hintHeight, fontSize: shortLandscape ? 16 : 19,
    };
    const characterHeight = Math.max(110, hint.y - hintHeight / 2 - layout.gapS - support.y);
    const repairedVisibleHeight = clampValue(132, characterHeight * 0.78, shortLandscape ? 190 : 240);
    const repairedScale = repairedVisibleHeight / 1402;
    mission7 = {
      showHeader: semanticMode === 'DESKTOP', showHelper: false,
      systems: { x: width / 2, y: contentTop - 52, width: systemsWidth },
      board,
      helper: { x: support.x + support.width / 2, feetY: hint.y - hint.height / 2 - layout.gapS, scale: 0 },
      repaired: { x: support.x + support.width / 2, feetY: hint.y - hint.height / 2 - layout.gapS, scale: repairedScale },
      showRepaired: true, hint,
    };
    regions.PRIMARY_GAMEPLAY = board;
    regions.CHARACTER = rect(support.x, support.y, support.width, characterHeight);
    regions.SECONDARY_CHARACTER = emptyRect(layout);
    regions.STATUS = rect(width / 2 - systemsWidth / 2, mission7.systems.y - 26, systemsWidth, 52);
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
    const contentTop = shortLandscape ? layout.gameplayZone.y + 18 : layout.headerZone.y + layout.headerZone.height + layout.gapL + 32;
    const contentBottom = height - safe.bottom;
    const available = rect(safe.left, contentTop, width - safe.left - safe.right, contentBottom - contentTop);
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

  const feedbackHeight = shortLandscape ? 26 : 30;
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
  const choicesTop = Math.max(
    platformContactY + layout.gapXS,
    safeBottom - controlHeight - (shortLandscape ? 0 : layout.gapM),
  );
  const choices = rect(contentLeft, choicesTop, contentWidth, controlHeight);

  const stageTop = Math.max(feedback.y + feedback.height, progress.y + progress.height) + layout.gapXS;
  const stageBottom = Math.min(platformContactY, choices.y - layout.gapXS);
  const stageHeight = Math.max(1, stageBottom - stageTop);
  const puzzleWidth = Math.min(
    shortLandscape ? 540 : 760,
    contentWidth * (shortLandscape ? 0.62 : 0.61),
  );
  const puzzleStage = rect(platformCenterX - puzzleWidth / 2, stageTop, puzzleWidth, stageHeight);
  const robotGap = shortLandscape ? layout.gapXS : layout.gapS;
  const robotRight = puzzleStage.x - robotGap;
  const robotWidth = Math.min(
    shortLandscape ? 138 : 230,
    Math.max(1, robotRight - contentLeft),
  );
  const robot = rect(robotRight - robotWidth, stageTop, robotWidth, stageHeight);
  const world = rect(contentLeft, stageTop, contentWidth, stageHeight);
  const robotVisibleHeight = shortLandscape
    ? clampValue(118, stageHeight * 0.64, 172)
    : clampValue(128, stageHeight * 0.52, 270);

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
    robotScale: robotVisibleHeight / 1402,
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
  const robotWidth = Math.min(desktop ? 250 : shortLandscape ? 112 : 180, world.width * (shortLandscape ? 0.22 : 0.24));
  const robot = rect(world.x, world.y, robotWidth, world.height);
  const targetGap = shortLandscape ? 8 : 12;
  const puzzleStage = rect(
    robot.x + robot.width + targetGap,
    world.y,
    Math.max(1, world.width - robot.width - targetGap),
    world.height,
  );
  const laneGap = targetGap;
  const laneWidth = (puzzleStage.width - laneGap * 2) / 3;
  const pathLanes = [0, 1, 2].map((index) =>
    rect(puzzleStage.x + index * (laneWidth + laneGap), puzzleStage.y, laneWidth, puzzleStage.height),
  ) as unknown as readonly [RectLayout, RectLayout, RectLayout];
  const relayBoard = rect(puzzleStage.x, puzzleStage.y, puzzleStage.width, puzzleStage.height);
  const signalBoard = rect(puzzleStage.x, puzzleStage.y, puzzleStage.width, puzzleStage.height);
  const laboratoryScale = Math.max(width / LOGICAL_SCENE_WIDTH, height / LOGICAL_SCENE_HEIGHT);
  const introPlatformY = (height - LOGICAL_SCENE_HEIGHT * laboratoryScale) / 2 + PLATFORM_CONTACT_Y * laboratoryScale;
  const launchGroundY = Math.min(worldBottom, introPlatformY + layout.gapL);
  const launchHeight = Math.max(1, launchGroundY - world.y);
  const consoleWidth = Math.min(desktop ? 460 : shortLandscape ? 340 : 400, world.width * 0.48);
  const consoleVisibleWidth = Math.min(consoleWidth, launchHeight * 1091 / 958);
  const beaconHeight = Math.min(desktop ? 360 : shortLandscape ? 220 : 320, launchHeight * 0.92);
  const beaconWidth = beaconHeight * 964 / 1337;
  const beacon = rect(Math.min(safeRight - beaconWidth, width / 2 + consoleVisibleWidth / 2 + targetGap * 2),
    launchGroundY - beaconHeight, beaconWidth, beaconHeight);
  const launchConsole = rect(width / 2 - consoleWidth / 2, world.y, consoleWidth, launchHeight);
  const platformContactY = world.y + world.height;
  const robotVisibleHeight = clampValue(shortLandscape ? 118 : 150, world.height * 0.86, desktop ? 320 : 240);
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
    : clampValue(60, 98 * signalScale, 128);
  const signalProgressWidth = clampValue(88, (shortLandscape ? 100 : 108) * signalScale, 138);
  const signalProgress = rect((width - signalProgressWidth) / 2,
    introTitle.y + introTitle.height + layout.gapXS, signalProgressWidth, 22);
  const signalFieldWidth = shortLandscape
    ? Math.min(safeWidth * 0.78, 632 * signalScale)
    : Math.min(760, 530 * signalScale, safeWidth * 0.69);
  // Two occupied rows in A/B are 2/5 of the grid apart: reserve a full body plus air.
  const signalFieldHeight = shortLandscape
    ? Math.min(Math.max(244 * signalScale, signalPropHeight * 2.72), Math.max(1, safeBottom - signalProgress.y - signalProgress.height - layout.gapXS * 2))
    : Math.max(205 * signalScale, signalPropHeight * 2.7);
  const signalGroundY = Math.min(safeBottom, introPlatformY + (shortLandscape ? 2 : 3) * signalScale);
  const signalFieldTop = shortLandscape
    ? Math.max(signalProgress.y + signalProgress.height + layout.gapXS, signalGroundY - signalFieldHeight - layout.gapXS)
    : Math.max(signalProgress.y + signalProgress.height + signalPropHeight * 0.4,
      introPlatformY - signalFieldHeight + 31 * signalScale);
  const signalFieldCenterX = shortLandscape ? width / 2 + safeWidth * 0.035 : width / 2 + 58 * signalScale;
  const signalField = rect(signalFieldCenterX - signalFieldWidth / 2,
    signalFieldTop, signalFieldWidth, signalFieldHeight);
  const signalRobotHeight = shortLandscape ? clampValue(112, signalFieldHeight * 0.58, 142) : 190 * signalScale;
  const signalRobotWidth = signalRobotHeight * 958 / 1463;
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
    portraitGate,
    showExtendedHeader: !shortLandscape && !portraitGate,
    title,
    progress,
    feedback,
    world,
    robot,
    puzzleStage,
    pathLanes,
    relayBoard,
    signalBoard,
    launchConsole,
    beacon,
    platformContactY,
    robotScale: Math.min(robotVisibleHeight / 1463, robot.width / 958),
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
  const pairScale = Math.min(phonePortrait ? 0.21 : portrait ? 0.22 : 0.24, actorAvailableHeight / 1402);
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
