import Phaser from 'phaser';
import { fitImageByVisibleAlpha, getImageVisibleAlphaBounds, OBJECT_VISIBLE_BOUNDS, type VisibleTextureBounds } from '../assets/objectBounds';
import { audioManager } from '../audio/AudioManager';
import { getMission10EnergyConfig, solveMission10Energy } from '../mechanics/mission10/energyRelayPuzzle.ts';
import { mission10Controller } from '../mechanics/mission10/mission10Controller.ts';
import type { Mission10Snapshot } from '../mechanics/mission10/mission10State.ts';
import { getMission10PathConfig, type Mission10LaneId, type Mission10PathKind } from '../mechanics/mission10/safePathPuzzle.ts';
import { getMission10SignalConfig, normalizeSignalOrientation, solveMission10Signal } from '../mechanics/mission10/signalPuzzle.ts';
import { preferencesState } from '../state/preferencesState';
import { sessionState } from '../state/sessionState';
import { addIconControl } from '../ui/controls';
import { RobotAssemblyPreview, createAssembledRobotPreview } from '../ui/RobotAssemblyPreview';
import { DesktopCharacterRole, resolveWorldCharacterScale } from '../characters/CharacterSizingPolicy';
import { CHARACTER_VISUAL_PROFILES } from '../characters/characterVisualProfiles';
import { publishCharacterTelemetry } from '../characters/CharacterTelemetry';
import { createResponsiveLayout } from '../ui/responsiveLayout';
import { composeScene, type Mission10SceneLayout } from '../ui/sceneCompositionDirector';
import {
  addLogicalLaboratoryImage,
  restartOnViewportResize,
} from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';

const TITLES = {
  INTRO: 'ПЕРВЫЙ ЗАПУСК',
  PATH: 'ВЫБЕРИ БЕЗОПАСНЫЙ ПУТЬ',
  ENERGY: 'СОЕДИНИ ЭНЕРГИЮ',
  SIGNAL: 'НАСТРОЙ СИГНАЛ',
  LAUNCH: 'ЗАПУСТИ МАЯК',
  FINALE: 'МАЯК ЗАПУСКАЕТСЯ',
  COMPLETE: 'МИССИЯ ВЫПОЛНЕНА',
} as const;
const PATH_TEXTURES: Readonly<Record<Mission10PathKind, string>> = {
  SAFE: 'MISSION10_PATH_SAFE', LASER: 'MISSION10_PATH_LASER', HAZARD: 'MISSION10_PATH_HAZARD',
};
const INTRO_ROBOT_BOUNDS = { sourceWidth: 991, sourceHeight: 1495, x: 17, y: 17, width: 958, height: 1462 } as const;
const INTRO_BEACON_BOUNDS = { sourceWidth: 1086, sourceHeight: 1448, x: 61, y: 64, width: 964, height: 1337 } as const;

export class Mission10Scene extends Phaser.Scene {
  private missionLayout?: Mission10SceneLayout;
  private stageRoot?: Phaser.GameObjects.Container;
  private titleText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private progressRoot?: Phaser.GameObjects.Container;
  private robot?: RobotAssemblyPreview;
  private interactionLocked = false;
  private pointerOwner: number | null = null;
  private pointerTarget?: Phaser.GameObjects.GameObject;
  private generation = 0;
  private timers: Phaser.Time.TimerEvent[] = [];
  private finaleStarted = false;
  private finalLaboratoryVisible = false;

  constructor() { super('Mission10Scene'); }

  create(): void {
    this.resetPresentation();
    const layout = createResponsiveLayout(this.scale.width, this.scale.height);
    const composition = composeScene(layout, 10);
    this.missionLayout = composition.mission10!;
    this.game.registry.set('responsiveLayout', layout);
    this.game.registry.set('sceneComposition', composition);
    this.cameras.main.setBackgroundColor('#102d45');
    this.createBackground();
    this.createHeader(layout);
    if (this.missionLayout.portraitGate) this.renderOrientationGate();
    else {
      this.createRobot();
      this.renderStage();
    }
    this.publishQa();
    restartOnViewportResize(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
    markSceneReady(this);
  }

  private resetPresentation(): void {
    this.generation += 1;
    this.stageRoot = undefined;
    this.titleText = undefined;
    this.feedbackText = undefined;
    this.progressRoot = undefined;
    this.robot = undefined;
    this.interactionLocked = false;
    this.pointerOwner = null;
    this.pointerTarget = undefined;
    this.timers = [];
    this.finaleStarted = false;
  }

  private createBackground(): void {
    const snapshot = mission10Controller.snapshot;
    this.children.getByName('mission10-laboratory-background')?.destroy();
    const world = this.add.container(0, 0).setDepth(-5).setName('mission10-laboratory-background');
    this.finalLaboratoryVisible = snapshot.stage === 'COMPLETE' || (snapshot.stage === 'FINALE' && snapshot.finaleStep >= 4);
    if (this.finalLaboratoryVisible) {
      const image = this.add.image(this.scale.width / 2, this.scale.height / 2, 'MISSION10_FINAL_LAB_ACTIVE');
      image.setScale(Math.max(this.scale.width / image.width, this.scale.height / image.height));
      world.add(image);
    } else {
      addLogicalLaboratoryImage(this, world, 'bg-main-laboratory');
      const scale = Math.max(this.scale.width / 1280, this.scale.height / 720);
      world.setPosition((this.scale.width - 1280 * scale) / 2, (this.scale.height - 720 * scale) / 2).setScale(scale);
    }
  }

  private createHeader(layout: ReturnType<typeof createResponsiveLayout>): void {
    const mission = this.missionLayout!;
    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    addIconControl(this, layout.safe.left + layout.iconWidth / 2, layout.headerY, '⌂ Домой', () => {
      audioManager.stopMission10Audio();
      this.scene.start('StartScene');
    }, UI_COLORS.purple, iconSizing).setName('mission10-home').setDepth(20);
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let sound: Phaser.GameObjects.Container;
    sound = addIconControl(this, this.scale.width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      (sound.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing).setName('mission10-sound').setDepth(20);
    const titleSize = Math.min(mission.title.height * 0.78, Math.max(18, this.scale.width * 0.026));
    this.titleText = this.add.text(
      mission.title.x + mission.title.width / 2,
      mission.title.y + mission.title.height / 2,
      TITLES[mission10Controller.snapshot.stage],
      { color: '#ffffff', fontFamily: UI_FONT, fontSize: `${titleSize}px`, fontStyle: 'bold', align: 'center', stroke: '#254f72', strokeThickness: 5 },
    ).setOrigin(0.5).setName('mission10-title').setDepth(15);
    if (this.titleText.width > mission.title.width) this.titleText.setScale(mission.title.width / this.titleText.width);
    this.feedbackText = this.add.text(
      mission.feedback.x + mission.feedback.width / 2,
      mission.feedback.y + mission.feedback.height / 2,
      '',
      { color: '#caffef', fontFamily: UI_FONT, fontSize: `${Math.min(18, mission.feedback.height * 0.68)}px`, fontStyle: 'bold', align: 'center', stroke: '#173b52', strokeThickness: 4 },
    ).setOrigin(0.5).setName('mission10-feedback').setDepth(15);
    this.drawProgress();
  }

  private drawProgress(): void {
    this.progressRoot?.destroy(true);
    this.progressRoot = undefined;
    if (mission10Controller.snapshot.stage === 'INTRO') return;
    const box = mission10Controller.snapshot.stage === 'SIGNAL' ? this.missionLayout!.signalRegions.PROGRESS : this.missionLayout!.progress;
    const root = this.add.container(box.x + box.width / 2, box.y + box.height / 2).setName('mission10-progress').setDepth(16);
    const stage = mission10Controller.snapshot.stage;
    const completed = stage === 'PATH' ? 0 : stage === 'ENERGY' ? 1 : stage === 'SIGNAL' ? 3 : stage === 'LAUNCH' || stage === 'FINALE' || stage === 'COMPLETE' ? 3 : 0;
    const gap = Math.min(30, box.width / 4);
    for (let index = 0; index < 4; index += 1) {
      const x = (index - 1.5) * gap;
      const lit = index < completed || stage === 'COMPLETE';
      const dot = this.add.graphics().fillStyle(lit ? 0x69f6c0 : 0x21455f, 1)
        .fillCircle(x, 0, 8).lineStyle(2, lit ? 0xe6fff7 : 0x86a7b9, 1).strokeCircle(x, 0, 8);
      root.add(dot);
    }
    this.progressRoot = root;
  }

  private createRobot(): void {
    const box = this.missionLayout!.robot;
    this.robot = createAssembledRobotPreview(
      this,
      box.x + box.width / 2,
      this.missionLayout!.platformContactY,
      this.missionLayout!.robotScale,
      'mission10-robot-v2',
    ).setDepth(6).setData({ grounded: true });
    this.robot.setPowered(true);
    this.robot.setSystemsConnected(true);
  }

  private renderStage(): void {
    this.clearStagePresentation();
    this.stageRoot?.destroy(true);
    this.stageRoot = this.add.container(0, 0).setName('mission10-stage-root').setDepth(5);
    const stage = mission10Controller.snapshot.stage;
    if (!this.robot?.active) this.createRobot();
    if (stage !== 'INTRO') this.restoreRobotStageLayout();
    this.titleText?.setText(TITLES[stage]);
    this.feedbackText?.setText('');
    this.drawProgress();
    this.interactionLocked = false;
    if (stage === 'INTRO') this.renderIntro();
    else if (stage === 'PATH') this.renderPath();
    else if (stage === 'ENERGY') this.renderEnergy();
    else if (stage === 'SIGNAL') this.renderSignal();
    else if (stage === 'LAUNCH') this.renderLaunch(false);
    else if (stage === 'FINALE') this.renderLaunch(true);
    else this.finishMission();
    this.publishQa();
  }

  private renderIntro(): void {
    const regions = this.missionLayout!.introRegions;
    const compact = regions.INTRO_MESSAGE.height < 60;
    const centerX = regions.HERO_GROUP.x + regions.HERO_GROUP.width / 2;
    const compositionWidth = regions.HERO_GROUP.width;
    const messageHeight = regions.INTRO_MESSAGE.height;
    const messageWidth = regions.INTRO_MESSAGE.width;
    const messageY = regions.INTRO_MESSAGE.y + messageHeight / 2;
    const buttonHeight = regions.CTA.height;
    const buttonWidth = regions.CTA.width;
    const buttonY = regions.CTA.y + buttonHeight / 2;
    const groundY = this.missionLayout!.introGroundY;
    const actorGap = Math.min(compact ? 74 : 100, compositionWidth * 0.18);
    const pairWidthPerRobotHeight = INTRO_ROBOT_BOUNDS.width / INTRO_ROBOT_BOUNDS.height
      + 1.1 * INTRO_BEACON_BOUNDS.width / INTRO_BEACON_BOUNDS.height;
    const introSizing = createResponsiveLayout(this.scale.width, this.scale.height).semanticMode === 'DESKTOP'
      ? resolveWorldCharacterScale({
        profile: CHARACTER_VISUAL_PROFILES.assembled,
        role: DesktopCharacterRole.WORLD_PRIMARY,
        viewportHeight: this.scale.height,
      })
      : undefined;
    const robotVisibleHeight = introSizing?.targetVisibleHeight ?? Math.min(compact ? 164 : 375, regions.HERO_GROUP.height / 1.1,
      (compositionWidth - actorGap) / pairWidthPerRobotHeight);
    const beaconVisibleHeight = robotVisibleHeight * 1.1;
    const robotVisibleWidth = robotVisibleHeight * INTRO_ROBOT_BOUNDS.width / INTRO_ROBOT_BOUNDS.height;
    const beaconVisibleWidth = beaconVisibleHeight * INTRO_BEACON_BOUNDS.width / INTRO_BEACON_BOUNDS.height;
    const actorsWidth = robotVisibleWidth + actorGap + beaconVisibleWidth;
    const actorsLeft = centerX - actorsWidth / 2;
    const robotCenterX = actorsLeft + robotVisibleWidth / 2;
    const beaconCenterX = actorsLeft + robotVisibleWidth + actorGap + beaconVisibleWidth / 2;

    const robotScale = introSizing?.resolvedScale ?? robotVisibleHeight / INTRO_ROBOT_BOUNDS.height;
    const robotAngle = 4;
    const robotConcernAngle = 7;
    const robotX = robotCenterX + (INTRO_ROBOT_BOUNDS.sourceWidth / 2 - (INTRO_ROBOT_BOUNDS.x + INTRO_ROBOT_BOUNDS.width / 2)) * robotScale;
    const robotVisibleRight = (INTRO_ROBOT_BOUNDS.x + INTRO_ROBOT_BOUNDS.width - INTRO_ROBOT_BOUNDS.sourceWidth / 2) * robotScale;
    const robotVisibleBottom = (INTRO_ROBOT_BOUNDS.y + INTRO_ROBOT_BOUNDS.height - INTRO_ROBOT_BOUNDS.sourceHeight) * robotScale;
    const robotAngleRadians = Phaser.Math.DegToRad(robotAngle);
    const rotatedVisibleBottom = robotVisibleRight * Math.sin(robotAngleRadians) + robotVisibleBottom * Math.cos(robotAngleRadians);
    const robotY = groundY - rotatedVisibleBottom;
    const robotConcernRadians = Phaser.Math.DegToRad(robotConcernAngle);
    const concernVisibleBottom = robotVisibleRight * Math.sin(robotConcernRadians) + robotVisibleBottom * Math.cos(robotConcernRadians);
    const robotConcernY = groundY - concernVisibleBottom;
    const introRobot = this.robot!
      .setPosition(robotX, robotY).setScale(robotScale).setAngle(robotAngle).setAlpha(1)
      .setName('mission10-intro-robot')
      .setData({
        characterRole: 'PRIMARY_CHARACTER', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', grounded: true,
        introVisibleBottomY: groundY, introGroundY: groundY, introGroundingDelta: 0, reactingTo: 'BEACON',
      });
    if (introSizing) {
      publishCharacterTelemetry(this, [{
        characterId: 'mission10-intro-robot',
        object: introRobot,
        profileId: 'assembled',
        role: DesktopCharacterRole.WORLD_PRIMARY,
        sizing: introSizing,
        groundY,
      }]);
    }

    const beaconScale = beaconVisibleHeight / INTRO_BEACON_BOUNDS.height;
    const beaconX = beaconCenterX + (INTRO_BEACON_BOUNDS.sourceWidth / 2 - (INTRO_BEACON_BOUNDS.x + INTRO_BEACON_BOUNDS.width / 2)) * beaconScale;
    const beaconY = groundY + (INTRO_BEACON_BOUNDS.sourceHeight - (INTRO_BEACON_BOUNDS.y + INTRO_BEACON_BOUNDS.height)) * beaconScale;
    const beacon = this.add.image(beaconX, beaconY, 'MISSION10_BEACON_OFF')
      .setOrigin(0.5, 1).setScale(beaconScale).setTint(0x708087).setAlpha(1)
      .setName('mission10-intro-beacon')
      .setData({ visibleBottomY: groundY, groundY, groundingDelta: 0, objectiveState: 'WEAK_PULSE' });

    const robotShadow = this.add.ellipse(robotCenterX, groundY + 2, Math.max(42, robotVisibleWidth * 0.58), compact ? 7 : 11, 0x031522, 0.3)
      .setName('mission10-intro-robot-shadow');
    const beaconShadow = this.add.ellipse(beaconCenterX, groundY + 2, Math.max(44, beaconVisibleWidth * 0.56), compact ? 7 : 11, 0x031522, 0.28)
      .setName('mission10-intro-beacon-shadow');
    const failedPulse = this.add.ellipse(
      beaconCenterX,
      groundY - beaconVisibleHeight * 0.73,
      beaconVisibleWidth * 0.62,
      beaconVisibleHeight * 0.18,
      0x70edff,
      0,
    ).setBlendMode(Phaser.BlendModes.ADD).setName('mission10-intro-failed-pulse');

    const message = this.add.container(centerX, messageY).setName('mission10-intro-message');
    const messagePlate = this.add.graphics()
      .fillStyle(0x071f35, 0.86).fillRoundedRect(-messageWidth / 2, -messageHeight / 2, messageWidth, messageHeight, compact ? 14 : 18)
      .lineStyle(2, 0x70eaff, 0.72).strokeRoundedRect(-messageWidth / 2, -messageHeight / 2, messageWidth, messageHeight, compact ? 14 : 18);
    const headline = this.add.text(0, -messageHeight * 0.17, 'МАЯК ПОГАС!', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${compact ? 21 : 29}px`, fontStyle: 'bold',
      align: 'center', stroke: '#08243a', strokeThickness: compact ? 4 : 6,
    }).setOrigin(0.5).setName('mission10-intro-headline');
    const subtitle = this.add.text(0, messageHeight * 0.25, 'ПОМОГИ РОБОТУ ЗАПУСТИТЬ МАЯК', {
      color: '#c7f8ff', fontFamily: UI_FONT, fontSize: `${compact ? 13 : 18}px`, fontStyle: 'bold',
      align: 'center', wordWrap: { width: messageWidth - 24 }, stroke: '#08243a', strokeThickness: compact ? 3 : 4,
    }).setOrigin(0.5).setName('mission10-intro-subtitle');
    message.add([messagePlate, headline, subtitle]);
    this.titleText?.setPosition(
      regions.TOP_CENTER_TITLE.x + regions.TOP_CENTER_TITLE.width / 2,
      regions.TOP_CENTER_TITLE.y + regions.TOP_CENTER_TITLE.height / 2,
    );

    const target = this.add.container(centerX, buttonY).setSize(buttonWidth, buttonHeight)
      .setName('mission10-intro-start').setData('ready', false);
    const ctaGlow = this.add.graphics().lineStyle(compact ? 3 : 4, 0x9dffc0, 0.5)
      .strokeRoundedRect(-buttonWidth / 2 - 4, -buttonHeight / 2 - 4, buttonWidth + 8, buttonHeight + 8, compact ? 18 : 22)
      .setAlpha(0).setName('mission10-intro-cta-glow');
    const g = this.add.graphics().fillStyle(0x43c96b, 1).fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, compact ? 15 : 19)
      .lineStyle(3, 0xd9ffe6, 1).strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, compact ? 15 : 19);
    target.add([ctaGlow, g, this.add.text(0, 0, 'ВПЕРЁД!', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${compact ? 19 : 23}px`, fontStyle: 'bold',
      stroke: '#17613a', strokeThickness: 3,
    }).setOrigin(0.5)]);
    let ctaBound = false;
    const enableCta = (): void => {
      if (ctaBound) return;
      ctaBound = true;
      target.setAlpha(1).setData('ready', true);
      this.interactionLocked = false;
      this.bindTap(target, () => {
        if (this.interactionLocked) return;
        this.interactionLocked = true;
        target.disableInteractive();
        // Keep the pending cue until asynchronous audio unlock completes in PATH.
        mission10Controller.beginMission();
        this.renderStage();
        // A double tap on the departing CTA must not select the newly revealed path.
        this.interactionLocked = true;
        this.publishQa();
        this.delay(300, () => { this.interactionLocked = false; this.publishQa(); });
      });
      if (!this.prefersReducedMotion()) {
        this.tweens.add({ targets: ctaGlow, alpha: 0.78, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.publishQa();
    };
    const hero = this.add.container(0, 0, [robotShadow, beaconShadow, failedPulse, beacon, introRobot])
      .setName('mission10-intro-hero-group');
    const composition = this.add.container(0, 0, [message, hero, target])
      .setName('mission10-intro-composition').setData('storyPhase', 'ENTER');
    this.stageRoot!.add(composition);

    if (this.prefersReducedMotion()) {
      beacon.setData('objectiveState', 'OFF');
      introRobot.setAngle(robotConcernAngle).setY(robotConcernY)
        .setData({ concernReactionPlayed: true, reactionState: 'CONCERN_SETTLED' });
      composition.setData('storyPhase', 'READY');
      audioManager.requestMission10IntroFailureCue();
      enableCta();
      return;
    }

    this.interactionLocked = true;
    introRobot.setAlpha(0).setY(robotY - 8);
    beacon.setAlpha(0);
    messagePlate.setAlpha(0);
    headline.setAlpha(0);
    subtitle.setAlpha(0);
    target.setAlpha(0.38);
    this.delay(180, () => {
      this.tweens.add({ targets: beacon, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: introRobot, alpha: 1, y: robotY, duration: 180, ease: 'Sine.easeOut' });
    });
    this.delay(400, () => {
      composition.setData('storyPhase', 'WEAK_PULSE');
      beacon.setTint(0x91a8ad);
      failedPulse.setAlpha(0.12);
      this.tweens.add({ targets: failedPulse, alpha: 0.03, duration: 220, ease: 'Sine.easeOut' });
    });
    this.delay(700, () => {
      composition.setData('storyPhase', 'FLICKER');
      beacon.setTint(0xa2b9bd);
      this.delay(80, () => beacon.setTint(0x708087));
    });
    this.delay(900, () => {
      composition.setData('storyPhase', 'FAILED');
      failedPulse.setAlpha(0);
      beacon.setAlpha(1).setTint(0x708087).setData('objectiveState', 'OFF');
      audioManager.requestMission10IntroFailureCue();
    });
    this.delay(1000, () => {
      composition.setData('storyPhase', 'ROBOT_CONCERN');
      introRobot.setData({ concernReactionPlayed: true, reactionState: 'CONCERN_SETTLED' });
      this.tweens.add({
        targets: introRobot, x: robotX + (compact ? 7 : 10), y: robotConcernY + (compact ? 2 : 4), angle: robotConcernAngle + 1,
        duration: 120, yoyo: true, ease: 'Sine.easeInOut',
        onComplete: () => introRobot.setPosition(robotX + (compact ? 6 : 9), robotConcernY).setAngle(robotConcernAngle),
      });
    });
    this.delay(1100, () => this.tweens.add({ targets: [messagePlate, headline], alpha: 1, duration: 140, ease: 'Sine.easeOut' }));
    this.delay(1300, () => this.tweens.add({ targets: subtitle, alpha: 1, duration: 140, ease: 'Sine.easeOut' }));
    this.delay(1500, () => {
      composition.setData('storyPhase', 'READY');
      enableCta();
    });
  }

  private restoreRobotStageLayout(): void {
    if (!this.robot) return;
    const box = this.missionLayout!.robot;
    this.tweens.killTweensOf(this.robot);
    this.titleText?.setPosition(
      this.missionLayout!.title.x + this.missionLayout!.title.width / 2,
      this.missionLayout!.title.y + this.missionLayout!.title.height / 2,
    );
    this.robot.setPosition(box.x + box.width / 2, this.missionLayout!.platformContactY)
      .setScale(this.missionLayout!.robotScale).setAngle(0).setAlpha(1);
    if (createResponsiveLayout(this.scale.width, this.scale.height).semanticMode === 'DESKTOP') {
      publishCharacterTelemetry(this, [{
        characterId: `mission10-${mission10Controller.snapshot.stage.toLowerCase()}-robot`,
        object: this.robot,
        profileId: 'assembled',
        role: DesktopCharacterRole.WORLD_PRIMARY,
        sizing: resolveWorldCharacterScale({ profile: CHARACTER_VISUAL_PROFILES.assembled, role: DesktopCharacterRole.WORLD_PRIMARY, viewportHeight: this.scale.height }),
        groundY: this.missionLayout!.platformContactY,
      }]);
    }
  }

  private getTextureVisibleBounds(textureKey: string): VisibleTextureBounds {
    const cached = this.game.registry.get(`visibleBounds:${textureKey}`) as VisibleTextureBounds | undefined;
    if (cached) return cached;
    const source = this.textures.get(textureKey).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return { sourceWidth: source.width, sourceHeight: source.height, x: 0, y: 0, width: source.width, height: source.height };
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, source.width, source.height).data;
    let minX = source.width;
    let minY = source.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const alpha = pixels[(y * source.width + x) * 4 + 3];
        if (alpha < 16) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const measured = maxX >= minX && maxY >= minY
      ? { sourceWidth: source.width, sourceHeight: source.height, x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : { sourceWidth: source.width, sourceHeight: source.height, x: 0, y: 0, width: source.width, height: source.height };
    this.game.registry.set(`visibleBounds:${textureKey}`, measured);
    return measured;
  }

  private getVisibleTelemetry(object: Phaser.GameObjects.Image, source: VisibleTextureBounds): {
    visibleLeft: number; visibleRight: number; visibleTop: number; visibleBottom: number;
    visibleWidth: number; visibleHeight: number; parentScaleX: number; parentScaleY: number;
    localScaleX: number; localScaleY: number; effectiveWorldScaleX: number; effectiveWorldScaleY: number;
  } {
    object.setData('visibleAlphaSourceBounds', source);
    const visible = getImageVisibleAlphaBounds(object);
    const world = object.getWorldTransformMatrix();
    const parent = object.parentContainer?.getWorldTransformMatrix();
    return {
      visibleLeft: visible.left, visibleRight: visible.right,
      visibleTop: visible.top, visibleBottom: visible.bottom,
      visibleWidth: visible.width, visibleHeight: visible.height,
      parentScaleX: parent ? Math.hypot(parent.a, parent.b) : 1,
      parentScaleY: parent ? Math.hypot(parent.c, parent.d) : 1,
      localScaleX: object.scaleX, localScaleY: object.scaleY,
      effectiveWorldScaleX: Math.hypot(world.a, world.b),
      effectiveWorldScaleY: Math.hypot(world.c, world.d),
    };
  }
  private renderPath(): void {
    const snapshot = mission10Controller.snapshot;
    const round = getMission10PathConfig(snapshot.pathConfigId).rounds[snapshot.pathDecisionIndex];
    if (!round) return;
    this.feedbackText?.setText(`ШАГ ${snapshot.pathDecisionIndex + 1} ИЗ 3`);
    const lanes = this.missionLayout!.pathLanes;
    const choiceGroupBox = this.missionLayout!.pathChoiceGroup;
    const padding = this.missionLayout!.targetGap;
    const desktopPath = createResponsiveLayout(this.scale.width, this.scale.height).semanticMode === 'DESKTOP';
    const pathVisibleSources = Object.values(PATH_TEXTURES).map((key) => this.getTextureVisibleBounds(key));
    const deckAspect = Math.max(...pathVisibleSources.map((visible) => visible.height / visible.width));
    const cardHeight = desktopPath
      ? lanes[0].height
      : Math.min(lanes[0].height, (lanes[0].width - padding * 2) * deckAspect + padding * 2);
    const cardTop = lanes[0].y + (lanes[0].height - cardHeight) / 2;
    const robot = this.robot!;
    if (desktopPath) {
      const supportSizing = resolveWorldCharacterScale({
        profile: CHARACTER_VISUAL_PROFILES.assembled,
        role: DesktopCharacterRole.WORLD_SUPPORT,
        viewportHeight: this.scale.height,
      });
      const rightAtScale = CHARACTER_VISUAL_PROFILES.assembled.visibleRightLocal * supportSizing.resolvedScale;
      const robotX = lanes[0].x - Math.max(42, this.scale.width * 0.032) - rightAtScale;
      robot.setPosition(robotX, this.missionLayout!.platformContactY).setScale(supportSizing.resolvedScale).setAngle(0).setAlpha(1)
        .setData({ characterRole: 'SUPPORTING_CHARACTER', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', grounded: true });
      publishCharacterTelemetry(this, [{
        characterId: 'mission10-path-robot', object: robot, profileId: 'assembled',
        role: DesktopCharacterRole.WORLD_SUPPORT, sizing: supportSizing,
        groundY: this.missionLayout!.platformContactY,
      }]);
    }
    const shadow = this.add.ellipse(robot.x, robot.y - 16 * robot.scaleY,
      INTRO_ROBOT_BOUNDS.width * robot.scaleX * 0.55, Math.max(6, INTRO_ROBOT_BOUNDS.height * robot.scaleY * 0.035), 0x031522, 0.3)
      .setName('mission10-path-robot-shadow');
    this.stageRoot!.add(shadow);
    const choiceGroup = this.add.container(0, 0)
      .setName('MISSION10_PATH_CHOICE_GROUP')
      .setData({ semanticGroup: 'MISSION10_PATH_CHOICE_GROUP', slotCount: 3 });
    this.stageRoot!.add(choiceGroup);
    const cardMetrics: {
      id: Mission10LaneId;
      kind: Mission10PathKind;
      x: number;
      y: number;
      width: number;
      height: number;
      assetVisibleWidth: number;
      assetVisibleHeight: number;
      visibleLeft: number;
      visibleRight: number;
      visibleTop: number;
      visibleBottom: number;
      visibleWidth: number;
      visibleHeight: number;
      parentScaleX: number;
      parentScaleY: number;
      localScaleX: number;
      localScaleY: number;
      effectiveWorldScaleX: number;
      effectiveWorldScaleY: number;
    }[] = [];
    for (let index = 0; index < lanes.length; index += 1) {
      const lane = round.lanes[index];
      const box = lanes[index];
      const image = this.add.image(box.x + box.width / 2, cardTop + cardHeight / 2, PATH_TEXTURES[lane.kind])
        .setName(`mission10-path-${lane.id.toLowerCase()}`).setData({ laneId: lane.id, hazardKind: lane.kind });
      const visibleSource = this.getTextureVisibleBounds(image.texture.key);
      const innerCardWidth = Math.max(1, box.width - padding * 2);
      const innerCardHeight = Math.max(1, cardHeight - padding * 2);
      const commonVisibleHeight = Math.min(
        innerCardHeight,
        ...pathVisibleSources.map((visible) => innerCardWidth * visible.height / visible.width),
      );
      const fit = commonVisibleHeight / visibleSource.height;
      image.setScale(fit).setData('visibleAlphaSourceBounds', visibleSource);
      let visible = getImageVisibleAlphaBounds(image);
      image.x += box.x + box.width / 2 - visible.centerX;
      image.y += cardTop + cardHeight / 2 - visible.centerY;
      visible = getImageVisibleAlphaBounds(image);
      const frame = this.add.graphics().fillStyle(0x071f35, 0.22)
        .fillRoundedRect(box.x, cardTop, box.width, cardHeight, 16)
        .lineStyle(2, 0xa7f2ff, 0.28)
        .strokeRoundedRect(box.x, cardTop, box.width, cardHeight, 16)
        .setName(`mission10-path-card-${lane.id.toLowerCase()}`)
        .setData({ laneId: lane.id, hazardKind: lane.kind, productionCardShell: true });
      const target = this.add.zone(box.x + box.width / 2, cardTop + cardHeight / 2, box.width, cardHeight)
        .setName(`mission10-path-target-${lane.id.toLowerCase()}`).setData({ laneId: lane.id, hazardKind: lane.kind });
      this.bindTap(target, () => this.choosePath(lane.id, target, frame));
      choiceGroup.add([frame, image, target]);
      cardMetrics.push({
        id: lane.id,
        kind: lane.kind,
        x: box.x,
        y: cardTop,
        width: box.width,
        height: cardHeight,
        assetVisibleWidth: visible.width,
        assetVisibleHeight: visible.height,
        ...this.getVisibleTelemetry(image, visibleSource),
      });
    }
    const groupLeft = Math.min(...cardMetrics.map((card) => card.visibleLeft));
    const groupRight = Math.max(...cardMetrics.map((card) => card.visibleRight));
    const groupTop = Math.min(...cardMetrics.map((card) => card.visibleTop));
    const groupBottom = Math.max(...cardMetrics.map((card) => card.visibleBottom));
    const robotRight = this.robot
      ? this.robot.x + CHARACTER_VISUAL_PROFILES.assembled.visibleRightLocal * this.robot.scaleX
      : 0;
    this.game.registry.set('mission10PathPresentation', {
      platformCenterX: this.missionLayout!.platformCenterX,
      choiceGroupName: 'MISSION10_PATH_CHOICE_GROUP',
      choiceGroupLeft: groupLeft,
      choiceGroupRight: groupRight,
      choiceGroupCenterX: (groupLeft + groupRight) / 2,
      choiceGroupCenterDelta: (groupLeft + groupRight) / 2 - this.missionLayout!.platformCenterX,
      choiceGroupBounds: choiceGroupBox,
      cards: cardMetrics,
      gap12: cardMetrics[1].x - (cardMetrics[0].x + cardMetrics[0].width),
      gap23: cardMetrics[2].x - (cardMetrics[1].x + cardMetrics[1].width),
      groupVisibleLeft: groupLeft,
      groupVisibleRight: groupRight,
      groupVisibleTop: groupTop,
      groupVisibleBottom: groupBottom,
      groupVisibleCenterX: (groupLeft + groupRight) / 2,
      viewportWidth: this.scale.width,
      rightVisibleClearance: this.scale.width - groupRight,
      leftVisibleClearance: groupLeft,
      rightClearance: this.scale.width - groupRight,
      robotRight,
      robotToFirstCardGap: groupLeft - robotRight,
      robotScale: this.robot?.scaleX ?? 0,
      debugOverlaysVisible: false,
    });
  }

  private choosePath(laneId: Mission10LaneId, target: Phaser.GameObjects.Zone, frame: Phaser.GameObjects.Graphics): void {
    if (this.interactionLocked) return;
    const result = mission10Controller.choosePath(laneId);
    if (result.status !== 'path') return;
    if (!result.correct) {
      this.feedbackText?.setText(result.hazardKind === 'LASER' ? 'ЛАЗЕР! РОБОТ ОТОШЁЛ' : 'ЭНЕРГИЯ НЕСТАБИЛЬНА');
      this.interactionLocked = true;
      this.robotReaction(false);
      this.delay(560, () => { this.interactionLocked = false; this.publishQa(); });
      if (result.hintLaneId) {
        const hint = this.stageRoot?.getAll().find((item) => item.getData?.('laneId') === result.hintLaneId);
        if (hint) this.tweens.add({ targets: hint, alpha: 0.48, duration: 260, yoyo: true, repeat: 3 });
      } else this.tweens.add({ targets: frame, alpha: 0.35, duration: 160, yoyo: true, repeat: 2 });
      return;
    }
    this.interactionLocked = true;
    target.disableInteractive();
    this.feedbackText?.setText(result.stageAdvanced ? 'ПУТЬ ОТКРЫТ!' : 'РОБОТ ИДЁТ ДАЛЬШЕ');
    audioManager.playCorrect();
    this.moveRobotAlongSafePath(laneId);
    this.delay(this.prefersReducedMotion() ? 300 : 900, () => this.renderStage());
  }

  private moveRobotAlongSafePath(laneId: Mission10LaneId): void {
    const deck = this.stageRoot?.getAll().find((item) => item.name === `mission10-path-${laneId.toLowerCase()}`) as Phaser.GameObjects.Image | undefined;
    if (!deck || !this.robot) return;
    const shadow = this.stageRoot?.getAll().find((item) => item.name === 'mission10-path-robot-shadow');
    const travelScale = Math.min(this.missionLayout!.robotScale, this.missionLayout!.world.height * 0.42 / INTRO_ROBOT_BOUNDS.height);
    const contactY = deck.y - deck.displayHeight * 0.1;
    const destination = { x: deck.x + deck.displayWidth * 0.12,
      y: contactY + (INTRO_ROBOT_BOUNDS.sourceHeight - INTRO_ROBOT_BOUNDS.y - INTRO_ROBOT_BOUNDS.height) * travelScale,
      scaleX: travelScale, scaleY: travelScale, angle: 0 };
    this.tweens.killTweensOf(this.robot);
    if (this.prefersReducedMotion()) {
      this.robot.setPosition(destination.x, destination.y).setScale(travelScale).setAngle(0);
      if (shadow instanceof Phaser.GameObjects.Ellipse) shadow.setPosition(destination.x, contactY).setDisplaySize(958 * travelScale * 0.55, Math.max(6, 1462 * travelScale * 0.035));
    } else {
      this.tweens.add({ targets: this.robot, ...destination, duration: 560, ease: 'Sine.easeInOut' });
      if (shadow) this.tweens.add({ targets: shadow, x: destination.x, y: contactY,
        displayWidth: 958 * travelScale * 0.55, displayHeight: Math.max(6, 1462 * travelScale * 0.035), duration: 560, ease: 'Sine.easeInOut' });
    }
  }

  private renderEnergy(): void {
    const energyStage = this.missionLayout!.energyStage;
    if (energyStage) {
      this.renderEnergyDesktop(energyStage);
      return;
    }
    const box = this.missionLayout!.relayBoard;
    const snapshot = mission10Controller.snapshot;
    const config = getMission10EnergyConfig(snapshot.energyConfigId);
    const evaluation = solveMission10Energy(config, snapshot.relayOrientations);
    const y = box.y + box.height * 0.55;
    const xs = [0.12, 0.31, 0.5, 0.69, 0.88].map((ratio) => box.x + box.width * ratio);
    const beam = this.add.graphics().setName('mission10-energy-beam');
    beam.lineStyle(Math.max(5, box.height * 0.045), 0x193e55, 0.8).beginPath().moveTo(xs[0], y).lineTo(xs[4], y).strokePath();
    const energizedEnd = xs[Math.min(4, evaluation.connectedRelayCount + 1)];
    beam.lineStyle(Math.max(4, box.height * 0.032), 0x54edff, 1).beginPath().moveTo(xs[0], y).lineTo(energizedEnd, y).strokePath();
    const source = this.createEnergyTerminal(xs[0], y, '⚡', true).setName('mission10-energy-source');
    const receiver = this.createEnergyTerminal(xs[4], y, '★', evaluation.receiverPowered).setName('mission10-energy-receiver');
    this.stageRoot!.add([beam, source, receiver]);
    config.relays.forEach((relay, index) => {
      const orientation = snapshot.relayOrientations[relay.id] ?? 0;
      const node = this.createRelay(xs[index + 1], y, Math.min(120, box.height * 0.48, box.width * 0.15), orientation, index < evaluation.connectedRelayCount)
        .setName(`mission10-relay-${relay.id.toLowerCase()}`).setData({ relayId: relay.id, orientation });
      this.bindTap(node, () => {
        if (this.interactionLocked) return;
        audioManager.registerUserGesture();
        const result = mission10Controller.rotateRelay(relay.id);
        if (result.status !== 'energy') return;
        // Draw the accepted orientation and complete circuit before leaving ENERGY.
        this.clearStagePresentation();
        this.stageRoot!.removeAll(true);
        this.renderEnergy();
        this.feedbackText?.setText(result.stageAdvanced ? 'ЭНЕРГИЯ ПОДКЛЮЧЕНА!' : result.hintRelayId ? (this.prefersReducedMotion() ? 'ПОВЕРНИ ВЫДЕЛЕННОЕ РЕЛЕ' : 'ПОСМОТРИ НА МИГАЮЩЕЕ РЕЛЕ') : 'ЭНЕРГИЯ ИДЁТ ДО РАЗРЫВА');
        if (result.stageAdvanced) {
          this.interactionLocked = true;
          audioManager.playRepairReward();
          this.robotReaction(true);
          this.delay(this.prefersReducedMotion() ? 300 : 900, () => this.renderStage());
        }
        this.publishQa();
      });
      if (evaluation.breakRelayId === relay.id && snapshot.energyWrongAttempts >= 2) {
        if (this.prefersReducedMotion()) {
          (node.getAt(0) as Phaser.GameObjects.Graphics).lineStyle(3, 0xc7f8ff, 1).strokeCircle(0, 0, node.width * 0.49);
        } else this.tweens.add({ targets: node, alpha: 0.5, duration: 320, yoyo: true, repeat: -1 });
      }
      this.stageRoot!.add(node);
    });
    this.game.registry.set('mission10EnergyEvaluation', evaluation);
  }

  private renderEnergyDesktop(energyStage: NonNullable<Mission10SceneLayout['energyStage']>): void {
    const snapshot = mission10Controller.snapshot;
    const config = getMission10EnergyConfig(snapshot.energyConfigId);
    const evaluation = solveMission10Energy(config, snapshot.relayOrientations);
    const reduced = this.prefersReducedMotion();
    const { groupCenterX: cx, groupCenterY: cy, beamCoreWidth, beamGlowWidth } = energyStage;
    const group = this.add.container(0, 0).setName('MISSION10_ENERGY_PUZZLE_GROUP')
      .setData({ semanticGroup: 'MISSION10_ENERGY_PUZZLE_GROUP', nodeCount: 5 });
    this.stageRoot!.add(group);
    const spacing = Math.min(200, energyStage.group.width / 5);
    const xs = [-2, -1, 0, 1, 2].map((offset) => cx + offset * spacing);
    const y = cy;
    const drawSegment = (fromX: number, toX: number, powered: boolean): void => {
      const color = powered ? 0x54edff : 0x2c5670;
      if (powered) {
        const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setName('mission10-energy-glow');
        glow.lineStyle(beamGlowWidth, 0x19d8ec, 0.22).beginPath().moveTo(fromX, y).lineTo(toX, y).strokePath();
        group.add(glow);
      }
      const core = this.add.graphics().setName('mission10-energy-core');
      core.lineStyle(beamCoreWidth, color, powered ? 1 : 0.75).beginPath().moveTo(fromX, y).lineTo(toX, y).strokePath();
      group.add(core);
    };
    const segmentCount = config.relays.length + 1;
    const poweredSegmentCount = Math.min(segmentCount, evaluation.connectedRelayCount + 1);
    for (let index = 0; index < segmentCount; index += 1) {
      drawSegment(xs[index], xs[index + 1], index < poweredSegmentCount);
    }
    if (evaluation.breakRelayId && !evaluation.receiverPowered && !reduced) {
      const breakIndex = config.relays.findIndex((relay) => relay.id === evaluation.breakRelayId);
      if (breakIndex >= 0) {
        const spark = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setName('mission10-energy-break-spark');
        spark.fillStyle(0xbdf3ff, 0.9).fillCircle(xs[breakIndex + 1], y, 3)
          .fillCircle(xs[breakIndex + 1] - 7, y - 5, 2).fillCircle(xs[breakIndex + 1] + 7, y - 6, 2);
        group.add(spark);
      }
    }
    this.positionEnergyNodes(group, xs, y, config, evaluation, snapshot, reduced);
    this.game.registry.set('mission10EnergyEvaluation', evaluation);
    if (evaluation.breakRelayId && snapshot.energyWrongAttempts >= 2) {
      const hintNode = group.getAll().find((item) => item.getData?.('relayId') === evaluation.breakRelayId);
      if (hintNode instanceof Phaser.GameObjects.Container) {
        if (reduced) {
          (hintNode.getAt(0) as Phaser.GameObjects.Graphics).lineStyle(3, 0xc7f8ff, 1).strokeCircle(0, 0, hintNode.width * 0.49);
        } else {
          this.tweens.add({ targets: hintNode, alpha: 0.5, duration: 320, yoyo: true, repeat: -1 });
        }
      }
    }
    if (evaluation.receiverPowered && !reduced) {
      this.tweens.add({ targets: group, alpha: { from: 0.82, to: 1 }, duration: 320, ease: 'Sine.easeOut' });
    }
    this.publishEnergyQa();
  }

  private positionEnergyNodes(
    group: Phaser.GameObjects.Container,
    xs: number[],
    y: number,
    config: ReturnType<typeof getMission10EnergyConfig>,
    evaluation: ReturnType<typeof solveMission10Energy>,
    snapshot: Readonly<Mission10Snapshot>,
    reduced: boolean,
  ): void {
    const energyStage = this.missionLayout!.energyStage!;
    const { terminalRadius, beamGlowWidth, relaySize } = energyStage;
    const source = this.createEnergyTerminal(xs[0], y, '⚡', true, terminalRadius, beamGlowWidth).setName('mission10-energy-source');
    const receiver = this.createEnergyTerminal(xs[4], y, '★', evaluation.receiverPowered, terminalRadius, beamGlowWidth)
      .setName('mission10-energy-receiver');
    group.add([source, receiver]);
    if (evaluation.receiverPowered && !reduced) {
      const ring = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setName('mission10-energy-receiver-ring');
      ring.lineStyle(3, 0x9dfcff, 0.9).strokeCircle(xs[4], y, terminalRadius + 9);
      group.add(ring);
    }
    config.relays.forEach((relay, index) => {
      const orientation = snapshot.relayOrientations[relay.id] ?? 0;
      const node = this.createRelay(xs[index + 1], y, relaySize, orientation, index < evaluation.connectedRelayCount)
        .setName(`mission10-relay-${relay.id.toLowerCase()}`).setData({ relayId: relay.id, orientation });
      this.bindTap(node, () => this.tapEnergyRelayDesktop(relay.id, node));
      group.add(node);
    });
    this.applyEnergyRobotComposition(energyStage);
  }

  private applyEnergyRobotComposition(energyStage: NonNullable<Mission10SceneLayout['energyStage']>): void {
    const robot = this.robot;
    if (!robot) return;
    robot.setPosition(energyStage.robotCenterX, this.missionLayout!.platformContactY)
      .setScale(energyStage.robotScale).setAngle(0).setAlpha(1)
      .setData({ characterRole: 'SUPPORTING_CHARACTER', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', grounded: true });
    publishCharacterTelemetry(this, [{
      characterId: 'mission10-energy-robot', object: robot, profileId: 'assembled',
      role: DesktopCharacterRole.WORLD_SUPPORT,
      sizing: {
        role: DesktopCharacterRole.WORLD_SUPPORT,
        targetVisibleHeight: energyStage.robotTargetVisibleHeight,
        resolvedScale: energyStage.robotScale,
        minVisibleHeight: energyStage.robotTargetVisibleHeight * 0.9,
        maxVisibleHeight: energyStage.robotTargetVisibleHeight * 1.1,
        targetRatio: 0.36, minRatio: 0.33, maxRatio: 0.39,
      },
      groundY: this.missionLayout!.platformContactY,
    }]);
    let shadow = this.stageRoot?.getAll().find((item) => item.name === 'mission10-energy-robot-shadow') as Phaser.GameObjects.Ellipse | undefined;
    if (!shadow && this.stageRoot) {
      shadow = this.add.ellipse(robot.x, robot.y, 10, 6, 0x031522, 0.3).setName('mission10-energy-robot-shadow');
      this.stageRoot.add(shadow);
    }
    shadow?.setPosition(robot.x, robot.y - 16 * robot.scaleY)
      .setDisplaySize(INTRO_ROBOT_BOUNDS.width * robot.scaleX * 0.55, Math.max(6, INTRO_ROBOT_BOUNDS.height * robot.scaleY * 0.035));
  }

  private robotEnergyReaction(kind: 'tap' | 'progress' | 'concern' | 'success'): void {
    const robot = this.robot;
    if (!robot) return;
    this.tweens.killTweensOf(robot);
    if (this.prefersReducedMotion()) return;
    const baseX = this.missionLayout!.energyStage?.robotCenterX ?? robot.x;
    if (kind === 'tap' || kind === 'concern') {
      this.tweens.add({ targets: robot, x: baseX + 8, angle: 2.5, duration: 130, yoyo: true, ease: 'Sine.easeInOut' });
    } else if (kind === 'progress') {
      this.tweens.add({ targets: robot, y: robot.y - 8, duration: 140, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    } else {
      this.tweens.add({ targets: robot, y: robot.y - 14, duration: 150, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    }
  }

  private publishEnergyQa(): void {
    const energyStage = this.missionLayout!.energyStage;
    if (!energyStage) return;
    const robot = this.robot;
    const robotVisibleRight = robot ? robot.x + CHARACTER_VISUAL_PROFILES.assembled.visibleRightLocal * robot.scaleX : 0;
    this.game.registry.set('mission10EnergyLayout', {
      stage: 'ENERGY',
      semanticGroup: 'MISSION10_ENERGY_PUZZLE_GROUP',
      groupVisibleLeft: energyStage.group.x,
      groupVisibleRight: energyStage.group.x + energyStage.group.width,
      groupVisibleTop: energyStage.group.y,
      groupVisibleBottom: energyStage.group.y + energyStage.group.height,
      groupVisibleCenterX: energyStage.groupCenterX,
      groupVisibleWidth: energyStage.group.width,
      platformCenterX: energyStage.platformCenterX,
      centerDelta: Math.abs(energyStage.groupCenterX - energyStage.platformCenterX),
      leftClearance: energyStage.group.x,
      rightClearance: this.scale.width - (energyStage.group.x + energyStage.group.width),
      robotVisibleRight,
      robotToGroupGap: energyStage.group.x - robotVisibleRight,
      robotVisibleHeight: robot ? CHARACTER_VISUAL_PROFILES.assembled.visibleHeightAtScale1 * robot.scaleY : 0,
      relayVisibleExtent: energyStage.relaySize,
      terminalDiameter: energyStage.terminalRadius * 2,
      beamCoreWidth: energyStage.beamCoreWidth,
      beamGlowWidth: energyStage.beamGlowWidth,
      viewportWidth: this.scale.width,
      viewportHeight: this.scale.height,
      effectiveWorldScaleX: 1,
      effectiveWorldScaleY: 1,
    });
  }

  private tapEnergyRelayDesktop(relayId: string, node: Phaser.GameObjects.Container): void {
    if (this.interactionLocked) return;
    audioManager.registerUserGesture();
    const beforeSnapshot = mission10Controller.snapshot;
    const before = solveMission10Energy(getMission10EnergyConfig(beforeSnapshot.energyConfigId), beforeSnapshot.relayOrientations);
    const result = mission10Controller.rotateRelay(relayId);
    if (result.status !== 'energy') return;
    const reduced = this.prefersReducedMotion();
    const improved = result.evaluation.connectedRelayCount > before.connectedRelayCount;
    const degraded = result.evaluation.connectedRelayCount < before.connectedRelayCount;
    const path = node.getAt(2) as Phaser.GameObjects.Graphics | undefined;
    this.tweens.killTweensOf(node);
    if (path) {
      if (reduced) path.setAngle(path.angle + 90);
      else {
        this.tweens.add({ targets: path, angle: path.angle + 90, duration: 150, ease: 'Back.easeOut' });
        this.tweens.add({ targets: node, scaleX: node.scaleX * 1.08, scaleY: node.scaleY * 1.08, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
      }
    }
    audioManager.playUiClick();
    this.robotEnergyReaction(result.stageAdvanced ? 'success' : improved ? 'progress' : degraded ? 'concern' : 'tap');
    this.delay(reduced ? 60 : 170, () => this.refreshEnergyDesktop());
    this.feedbackText?.setText(result.stageAdvanced ? 'ЭНЕРГИЯ ПОДКЛЮЧЕНА!'
      : result.hintRelayId ? (reduced ? 'ПОВЕРНИ ВЫДЕЛЕННОЕ РЕЛЕ' : 'ПОСМОТРИ НА МИГАЮЩЕЕ РЕЛЕ')
      : improved ? 'ЭНЕРГИЯ ИДЁТ ДАЛЬШЕ' : 'ЭНЕРГИЯ ИДЁТ ДО РАЗРЫВА');
    if (result.stageAdvanced) {
      this.interactionLocked = true;
      audioManager.playRepairReward();
      this.delay(reduced ? 300 : 900, () => this.renderStage());
    }
    this.publishQa();
  }

  private refreshEnergyDesktop(): void {
    if (mission10Controller.snapshot.stage !== 'ENERGY') return;
    this.clearStagePresentation();
    this.stageRoot!.removeAll(true);
    this.renderEnergy();
    this.publishQa();
  }

  private createEnergyTerminal(x: number, y: number, glyph: string, lit: boolean, terminalRadius = 30, beamGlowWidth = 10): Phaser.GameObjects.Container {
    const root = this.add.container(x, y);
    const g = this.add.graphics().fillStyle(0x183b55, 0.98).fillCircle(0, 0, terminalRadius)
      .lineStyle(5, lit ? 0x66f5ff : 0x45677b, 1).strokeCircle(0, 0, terminalRadius);
    if (lit) {
      const halo = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      halo.lineStyle(beamGlowWidth, 0x19d8ec, 0.2).strokeCircle(0, 0, terminalRadius + beamGlowWidth * 0.6);
      root.add(halo);
    }
    root.add([g, this.add.text(0, 0, glyph, { fontFamily: UI_FONT, fontSize: '26px', color: lit ? '#dfffff' : '#7596a8' }).setOrigin(0.5)]);
    return root;
  }

  private createRelay(x: number, y: number, size: number, orientation: number, lit: boolean): Phaser.GameObjects.Container {
    const root = this.add.container(x, y).setSize(Math.max(60, size), Math.max(60, size));
    const radius = size * 0.45;
    const frame = this.add.graphics().fillStyle(0x102f48, 1).fillCircle(0, 0, radius)
      .lineStyle(5, lit ? 0x63f1ff : 0x80a7bb, 1).strokeCircle(0, 0, radius)
      .fillStyle(0xeff8fb, 1).fillCircle(-radius * 0.68, -radius * 0.68, 4)
      .fillCircle(radius * 0.68, -radius * 0.68, 4).fillCircle(-radius * 0.68, radius * 0.68, 4).fillCircle(radius * 0.68, radius * 0.68, 4);
    const conductorColor = lit ? 0x63f8ff : 0xb0cedb;
    const path = this.add.graphics().lineStyle(Math.max(6, size * 0.085), conductorColor, 1)
      .beginPath().moveTo(-radius * 0.58, 0).lineTo(radius * 0.35, 0).strokePath()
      .fillStyle(conductorColor, 1).fillTriangle(radius * 0.76, 0, radius * 0.2, -radius * 0.3, radius * 0.2, radius * 0.3)
      .lineStyle(3, conductorColor, 1).strokeCircle(-radius * 0.64, 0, radius * 0.12)
      .setAngle(orientation * 90).setName('mission10-relay-direction');
    const turn = this.add.graphics().lineStyle(2, 0x82bbc9, 0.9)
      .beginPath().arc(0, 0, radius * 0.88, Math.PI * 1.08, Math.PI * 1.78).strokePath()
      .fillStyle(0x82bbc9, 1).fillTriangle(radius * 0.74, -radius * 0.48, radius * 0.48, -radius * 0.55, radius * 0.68, -radius * 0.78)
      .setName('mission10-relay-turn-hint');
    root.add([frame, turn, path]);
    return root;
  }

  private renderSignal(rotatedId?: string, targets = new Map<string, Phaser.GameObjects.Zone>()): void {
    const regions = this.missionLayout!.signalRegions;
    const field = regions.APPARATUS_FIELD;
    const snapshot = mission10Controller.snapshot;
    const config = getMission10SignalConfig(snapshot.signalConfigId);
    const solution = solveMission10Signal(config, snapshot.reflectorOrientations);
    const propSize = regions.PROP_VISIBLE_HEIGHT;
    const desktopSignal = createResponsiveLayout(this.scale.width, this.scale.height).semanticMode === 'DESKTOP';
    const pointKey = (point: { x: number; y: number }): string => `${point.x},${point.y}`;
    const rawMapPoint = (point: { x: number; y: number }): Phaser.Math.Vector2 => new Phaser.Math.Vector2(
      field.x + (point.x + 0.5) / config.bounds.width * field.width,
      field.y + (point.y + 0.5) / config.bounds.height * field.height,
    );
    type SignalRole = 'SOURCE' | 'REFLECTOR_A' | 'REFLECTOR_B' | 'REFLECTOR_C' | 'RECEIVER';
    type SignalPresentationNode = {
      readonly role: SignalRole;
      readonly center: Phaser.Math.Vector2;
      readonly inputPort: Phaser.Math.Vector2;
      readonly outputPort: Phaser.Math.Vector2;
    };
    const presentationNodes = new Map<string, SignalPresentationNode>();
    const registerNode = (point: { x: number; y: number }, role: SignalRole, center: Phaser.Math.Vector2,
      inputPort = center, outputPort = center): void => {
      presentationNodes.set(pointKey(point), { role, center, inputPort, outputPort });
    };
    if (desktopSignal) {
      // Presentation deliberately follows the player-facing route order rather than
      // the serializable grid rows. SIGNAL_C gets its own three-reflector map so
      // its extra station is spaced across the platform rather than joining the
      // two-reflector A/B finish on the right.
      const at = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(
        field.x + field.width * x, field.y + field.height * y,
      );
      const source = at(0.08, 0.70);
      const signalCLayout = config.id === 'SIGNAL_C';
      const receiver = signalCLayout ? at(0.96, 0.30) : at(0.92, 0.30);
      registerNode(config.emitter, 'SOURCE', source,
        source, new Phaser.Math.Vector2(source.x + propSize * 0.20, source.y));
      config.reflectors.forEach((reflector, index) => {
        const role = (['REFLECTOR_A', 'REFLECTOR_B', 'REFLECTOR_C'] as const)[index];
        const position = signalCLayout
          ? index === 0 ? at(0.28, 0.28)
            : index === 1 ? at(0.47, 0.72)
              : at(0.69, 0.38)
          : index === 0 ? at(0.34, 0.30)
            : index === 1 ? at(0.63, 0.72)
              : at(0.76, 0.48);
        const rise = index === 0 ? -0.05 : index === 1 ? 0.05 : -0.03;
        registerNode(reflector.position, role, position,
          new Phaser.Math.Vector2(position.x - propSize * 0.34, position.y + propSize * rise),
          new Phaser.Math.Vector2(position.x + propSize * 0.34, position.y + propSize * rise));
      });
      registerNode(config.receiver, 'RECEIVER', receiver,
        new Phaser.Math.Vector2(receiver.x - propSize * 0.26, receiver.y), receiver);
    } else {
      registerNode(config.emitter, 'SOURCE', rawMapPoint(config.emitter));
      registerNode(config.receiver, 'RECEIVER', rawMapPoint(config.receiver));
      config.reflectors.forEach((reflector, index) => registerNode(reflector.position,
        (['REFLECTOR_A', 'REFLECTOR_B', 'REFLECTOR_C'] as const)[index], rawMapPoint(reflector.position)));
    }
    const mapPoint = (point: { x: number; y: number }): Phaser.Math.Vector2 => presentationNodes.get(pointKey(point))?.center ?? rawMapPoint(point);
    const signalPuzzleGroup = this.add.container(0, 0).setName('MISSION10_SIGNAL_PUZZLE_GROUP');
    this.stageRoot!.add(signalPuzzleGroup);
    const robotBox = regions.ROBOT_VISIBLE;
    if (this.robot) {
      const signalRobotScale = createResponsiveLayout(this.scale.width, this.scale.height).semanticMode === 'DESKTOP'
        ? robotBox.height / CHARACTER_VISUAL_PROFILES.assembled.visibleHeightAtScale1
        : robotBox.height / INTRO_ROBOT_BOUNDS.height;
      this.robot.setScale(signalRobotScale).setAngle(0).setAlpha(1)
        .setPosition(robotBox.x + robotBox.width / 2, regions.ROBOT_GROUND_Y + 16 * signalRobotScale)
        .setData({ grounded: true, reactingTo: 'SIGNAL', signalGroundY: regions.ROBOT_GROUND_Y });
      if (createResponsiveLayout(this.scale.width, this.scale.height).semanticMode === 'DESKTOP') {
        publishCharacterTelemetry(this, [{
          characterId: 'mission10-signal-robot',
          object: this.robot,
          profileId: 'assembled',
          role: DesktopCharacterRole.WORLD_SUPPORT,
          sizing: resolveWorldCharacterScale({ profile: CHARACTER_VISUAL_PROFILES.assembled, role: DesktopCharacterRole.WORLD_SUPPORT, viewportHeight: this.scale.height }),
          groundY: regions.ROBOT_GROUND_Y,
        }]);
      }
      this.stageRoot!.add(this.add.ellipse(this.robot.x, regions.ROBOT_GROUND_Y + 2,
        robotBox.width * 0.66, Math.max(6, robotBox.height * 0.035), 0x031522, 0.4).setName('mission10-signal-robot-shadow'));
    }
    this.titleText?.setPosition(regions.TITLE.x + regions.TITLE.width / 2, regions.TITLE.y + regions.TITLE.height / 2);
    this.feedbackText?.setText('');
    const platformEnergy = this.add.graphics().setName('mission10-signal-restored-energy');
    const ledY = regions.ROBOT_GROUND_Y + 4;
    for (let index = 0; index < 3; index += 1) {
      const x = field.x + field.width * 0.40 + index * 15;
      platformEnergy.fillStyle(0x052c3b, 0.95).fillRoundedRect(x - 6, ledY - 4, 12, 8, 3)
        .fillStyle(solution.receiverHit ? 0xbdfff5 : 0x43dac8, 1).fillRoundedRect(x - 4, ledY - 2, 8, 4, 2);
    }
    this.stageRoot!.add(platformEnergy);
    const emitterNode = presentationNodes.get(pointKey(config.emitter))!;
    const receiverNode = presentationNodes.get(pointKey(config.receiver))!;
    const emitterPoint = emitterNode.center;
    const receiverPoint = receiverNode.center;
    const emitter = this.add.image(emitterPoint.x, emitterPoint.y, 'MISSION10_SIGNAL_EMITTER')
      .setOrigin(0.77, 0.31).setName('mission10-signal-emitter');
    const emitterSource = this.getTextureVisibleBounds(emitter.texture.key);
    emitter.setScale(propSize / emitterSource.height).setData('visibleAlphaSourceBounds', emitterSource);
    const receiver = this.add.image(receiverPoint.x, receiverPoint.y, 'MISSION10_SIGNAL_RECEIVER')
      .setOrigin(0.41, 0.32).setName('mission10-signal-receiver').setData('active', solution.receiverHit);
    const receiverSource = this.getTextureVisibleBounds(receiver.texture.key);
    receiver.setScale(propSize / receiverSource.height).setData('visibleAlphaSourceBounds', receiverSource);
    if (!solution.receiverHit) receiver.setTint(0x8fa7b5);
    // Signal ports are semantic geometry only; rendering a receiver ring makes it
    // read as a separate floating device rather than part of the receiver artwork.
    signalPuzzleGroup.add([emitter, receiver]);
    const beam = this.add.graphics().setName('mission10-signal-beam').setBlendMode(Phaser.BlendModes.NORMAL);
    const core = regions.BEAM_CORE_WIDTH;
    const points: Array<{ from: Phaser.Math.Vector2; to: Phaser.Math.Vector2; fromRole: SignalRole; toRole: SignalRole }> = [];
    let lastReachedNode = presentationNodes.get(pointKey(solution.segments[0]?.from));
    for (const segment of solution.segments) {
      const from = presentationNodes.get(pointKey(segment.from));
      const to = presentationNodes.get(pointKey(segment.to));
      if (from) lastReachedNode = from;
      if (lastReachedNode && to && lastReachedNode !== to) {
        // Solver subdivisions between device cells collapse into one semantic
        // optical link, preserving the route without exposing grid scaffolding.
        points.push({ from: lastReachedNode.outputPort, to: to.inputPort, fromRole: lastReachedNode.role, toRole: to.role });
        lastReachedNode = to;
      }
    }
    // Three opaque strokes preserve contrast even over the brightest laboratory panel.
    for (const [width, color, alpha] of [[core + 11, 0x052c44, 0.95], [core + 5, 0x18c9ee, 1],
      [core + (solution.receiverHit ? 1 : 0), solution.receiverHit ? 0xffffff : 0xd1ffff, 1]]) {
      beam.lineStyle(width, color, alpha);
      for (const segment of points) beam.beginPath().moveTo(segment.from.x, segment.from.y).lineTo(segment.to.x, segment.to.y).strokePath();
    }
    signalPuzzleGroup.add(beam);
    const terminalSegment = solution.segments.at(-1);
    const terminalTo = terminalSegment ? presentationNodes.get(pointKey(terminalSegment.to)) : undefined;
    const endpoint = !solution.receiverHit
      ? (lastReachedNode && !terminalTo ? lastReachedNode.outputPort : points.at(-1)?.to)
      : undefined;
    if (endpoint && !solution.receiverHit) signalPuzzleGroup.add(this.add.circle(endpoint.x, endpoint.y, core + 1, 0xc4ffff)
      .setStrokeStyle(2, 0x123e53).setName('mission10-signal-miss'));
    config.reflectors.forEach((reflector) => {
      const point = mapPoint(reflector.position);
      const orientation = normalizeSignalOrientation(snapshot.reflectorOrientations[reflector.id] ?? 0);
      const mirror = this.add.container(point.x, point.y).setName(`mission10-reflector-${reflector.id.toLowerCase()}`)
        .setData({ reflectorId: reflector.id, orientation });
      const texture = this.textures.get('MISSION10_SIGNAL_REFLECTOR').getSourceImage();
      const reflectorSource = this.getTextureVisibleBounds('MISSION10_SIGNAL_REFLECTOR');
      const scale = propSize / reflectorSource.height;
      const split = Math.round(texture.height * 0.72);
      // The approved artwork supplies both pieces. The pedestal is stationary;
      // only its circular mirror assembly rotates about the optical centre.
      const base = this.add.image(0, 0, 'MISSION10_SIGNAL_REFLECTOR').setOrigin(0.5, 0.39).setScale(scale)
        .setCrop(0, split, texture.width, texture.height - split).setName('mission10-reflector-base');
      const face = this.add.image(0, 0, 'MISSION10_SIGNAL_REFLECTOR').setOrigin(0.5, 0.39).setScale(scale)
        .setCrop(0, 0, texture.width, split).setFlipX(orientation === 1).setName('mission10-reflector-face');
      const turnHint = this.add.graphics().lineStyle(2, 0xb5faff, 0.85)
        .beginPath().arc(0, 0, propSize * 0.40, Math.PI * 1.05, Math.PI * 1.68).strokePath()
        .fillStyle(0xb5faff, 1).fillTriangle(propSize * 0.23, -propSize * 0.32,
          propSize * 0.15, -propSize * 0.34, propSize * 0.21, -propSize * 0.41);
      mirror.add([base, face, turnHint]);
      if (rotatedId === reflector.id && !this.prefersReducedMotion()) {
        face.setScale(scale * 0.9, scale * 1.06);
        this.tweens.add({ targets: face, scaleX: scale, scaleY: scale, duration: 150, ease: 'Sine.easeOut' });
      }
      const hit = targets.get(reflector.id) ?? this.add.zone(point.x, point.y + propSize * 0.10, Math.max(72, propSize * 1.08), Math.max(72, propSize * 1.01))
        .setName(`mission10-reflector-target-${reflector.id.toLowerCase()}`).setData({ reflectorId: reflector.id });
      if (!targets.has(reflector.id)) this.bindTap(hit, () => {
        if (this.interactionLocked) return;
        audioManager.playUiClick();
        const result = mission10Controller.rotateReflector(reflector.id);
        if (result.status !== 'signal') return;
        this.clearStagePresentation();
        // Preserve registered input objects between taps. Recreating them here
        // can drop fast pointer events before Phaser refreshes its input list.
        for (const target of targets.values()) this.stageRoot!.remove(target, false);
        this.stageRoot!.removeAll(true);
        this.renderSignal(reflector.id, targets);
        if (result.stageAdvanced) {
          this.interactionLocked = true;
          audioManager.playRepairReward();
          this.robotReaction(true);
          this.delay(this.prefersReducedMotion() ? 1100 : 1500, () => this.renderStage());
        }
        this.publishQa();
      });
      targets.set(reflector.id, hit);
      signalPuzzleGroup.add(mirror);
      this.stageRoot!.add(hit);
    });
    if (solution.receiverHit && points.length > 0) {
      const pulse = this.add.circle(points[0].from.x, points[0].from.y, core + 4, 0xffffff)
        .setStrokeStyle(4, 0x58ffe6, 0.8).setName('mission10-signal-success-pulse');
      signalPuzzleGroup.add(pulse);
      if (!this.prefersReducedMotion()) {
        const path = new Phaser.Curves.Path(points[0].from.x, points[0].from.y);
        for (const segment of points) path.lineTo(segment.to.x, segment.to.y);
        this.tweens.add({ targets: pulse, angle: 1, duration: 950, ease: 'Linear',
          onUpdate: () => { const position = path.getPoint(pulse.angle); pulse.setPosition(position.x, position.y); },
          onComplete: () => { pulse.setVisible(false); } });
        this.tweens.add({ targets: [platformEnergy], alpha: 0.5, duration: 220, yoyo: true, repeat: 2 });
      } else pulse.setPosition(receiverPoint.x, receiverPoint.y);
    }
    const apparatus: Array<{
      id: string; visibleLeft: number; visibleRight: number; visibleTop: number; visibleBottom: number;
      visibleWidth: number; visibleHeight: number; parentScaleX: number; parentScaleY: number;
      localScaleX: number; localScaleY: number; effectiveWorldScaleX: number; effectiveWorldScaleY: number;
    }> = [
      { id: 'emitter', ...this.getVisibleTelemetry(emitter, emitterSource) },
      { id: 'receiver', ...this.getVisibleTelemetry(receiver, receiverSource) },
    ];
    for (const reflector of config.reflectors) {
      const mirror = signalPuzzleGroup.getByName(`mission10-reflector-${reflector.id.toLowerCase()}`) as Phaser.GameObjects.Container;
      const bounds = mirror.getBounds();
      const matrix = mirror.getWorldTransformMatrix();
      apparatus.push({
        id: reflector.id,
        visibleLeft: bounds.left, visibleRight: bounds.right, visibleTop: bounds.top, visibleBottom: bounds.bottom,
        visibleWidth: bounds.width, visibleHeight: bounds.height,
        parentScaleX: 1, parentScaleY: 1, localScaleX: mirror.scaleX, localScaleY: mirror.scaleY,
        effectiveWorldScaleX: Math.hypot(matrix.a, matrix.b), effectiveWorldScaleY: Math.hypot(matrix.c, matrix.d),
      });
    }
    const beamPoints = points.flatMap((segment) => [segment.from, segment.to]);
    const halfBeam = (core + 11) / 2;
    const beamLeft = Math.min(...beamPoints.map((point) => point.x - halfBeam));
    const beamRight = Math.max(...beamPoints.map((point) => point.x + halfBeam));
    const beamTop = Math.min(...beamPoints.map((point) => point.y - halfBeam));
    const beamBottom = Math.max(...beamPoints.map((point) => point.y + halfBeam));
    const groupVisibleLeft = Math.min(...apparatus.map((item) => item.visibleLeft), beamLeft);
    const groupVisibleRight = Math.max(...apparatus.map((item) => item.visibleRight), beamRight);
    const groupVisibleTop = Math.min(...apparatus.map((item) => item.visibleTop), beamTop);
    const groupVisibleBottom = Math.max(...apparatus.map((item) => item.visibleBottom), beamBottom);
    this.game.registry.set('mission10SignalEvaluation', solution);
    const presentationNodesTelemetry = [...presentationNodes.values()].map((node) => ({
      role: node.role, center: { x: node.center.x, y: node.center.y },
      inputPort: { x: node.inputPort.x, y: node.inputPort.y }, outputPort: { x: node.outputPort.x, y: node.outputPort.y },
    }));
    this.game.registry.set('mission10SignalPresentation', { field, propSize, coreWidth: core, points,
      source: emitterPoint, receiver: receiverPoint, groupName: 'MISSION10_SIGNAL_PUZZLE_GROUP', apparatus,
      nodes: presentationNodesTelemetry, stoppedPort: endpoint ? { x: endpoint.x, y: endpoint.y } : null,
      groupVisibleBounds: {
        visibleLeft: groupVisibleLeft, visibleRight: groupVisibleRight,
        visibleTop: groupVisibleTop, visibleBottom: groupVisibleBottom,
        visibleWidth: groupVisibleRight - groupVisibleLeft, visibleHeight: groupVisibleBottom - groupVisibleTop,
      },
      successHold: this.prefersReducedMotion() ? 1100 : 1500 });
  }
  private renderLaunch(finale: boolean): void {
    const layout = this.missionLayout!;
    const snapshot = mission10Controller.snapshot;
    const beaconOn = finale && snapshot.finaleStep >= 3;
    const beacon = this.add.image(layout.beacon.x + layout.beacon.width / 2, layout.beacon.y + layout.beacon.height, beaconOn ? 'MISSION10_BEACON_ON' : 'MISSION10_BEACON_OFF')
      .setOrigin(0.5, 1).setName(beaconOn ? 'mission10-beacon-on' : 'mission10-beacon-off');
    const beaconBounds = OBJECT_VISIBLE_BOUNDS[beacon.texture.key];
    beacon.setScale(layout.beacon.width / beaconBounds.width, layout.beacon.height / beaconBounds.height);
    const beaconVisible = getImageVisibleAlphaBounds(beacon);
    beacon.x += layout.beacon.x + layout.beacon.width / 2 - beaconVisible.centerX;
    beacon.y += layout.launchGroundY - beaconVisible.bottom;
    const consoleObject = this.add.image(layout.launchConsole.x + layout.launchConsole.width / 2, layout.launchGroundY, 'MISSION10_LAUNCH_CONSOLE')
      .setOrigin(0.5, 1).setName('mission10-launch-console');
    fitImageByVisibleAlpha(consoleObject, layout.launchConsole.width, layout.launchConsole.height);
    const consoleVisible = getImageVisibleAlphaBounds(consoleObject);
    consoleObject.x += this.scale.width / 2 - consoleVisible.centerX;
    consoleObject.y += layout.launchGroundY - consoleVisible.bottom;
    if (this.robot) {
      this.robot.setY(layout.launchGroundY + 16 * this.robot.scaleY);
      this.stageRoot!.add(this.add.ellipse(this.robot.x, layout.launchGroundY + 1,
        INTRO_ROBOT_BOUNDS.width * this.robot.scaleX * 0.55, Math.max(6, INTRO_ROBOT_BOUNDS.height * this.robot.scaleY * 0.035), 0x031522, 0.3));
    }
    this.stageRoot!.add([beacon, consoleObject]);
    if (!finale) ['ПУТЬ ✓', 'ЭНЕРГИЯ ✓', 'СИГНАЛ ✓'].forEach((label, index) => {
      const gap = Math.min(150, layout.feedback.width / 4);
      const badge = this.add.text(this.scale.width / 2 + (index - 1) * gap, layout.feedback.y + layout.feedback.height / 2, label, {
        color: '#d8fff0', backgroundColor: '#173f55', fontFamily: UI_FONT,
        fontSize: `${Math.min(16, layout.feedback.height * 0.5)}px`, padding: { x: 8, y: 3 },
      }).setOrigin(0.5).setName(`mission10-ready-${index}`);
      this.stageRoot!.add(badge);
    });
    if (!finale) {
      // The ellipse follows the painted launch cap and its physical rim.
      const buttonWidth = consoleObject.displayWidth * 0.23;
      const buttonHeight = consoleObject.displayHeight * 0.22;
      const target = this.add.zone(consoleObject.x, consoleObject.y - consoleObject.displayHeight * 0.44, buttonWidth, buttonHeight)
        .setName('mission10-launch-target').setData('action', 'launch');
      this.bindTap(target, () => {
        if (this.interactionLocked) return;
        audioManager.registerUserGesture();
        const result = mission10Controller.launchBeacon();
        if (result.status !== 'launched') return;
        this.interactionLocked = true;
        audioManager.stopMusic(180);
        audioManager.playMission10BeaconLaunch();
        this.renderStage();
      });
      target.setInteractive(new Phaser.Geom.Ellipse(buttonWidth / 2, buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Ellipse.Contains);
      this.stageRoot!.add(target);
    } else {
      this.renderFinaleEffects(snapshot.finaleStep, beacon, consoleObject);
      this.continueFinale();
    }
  }

  private renderFinaleEffects(step: number, beacon: Phaser.GameObjects.Image, consoleObject: Phaser.GameObjects.Image): void {
    const beaconBody = getImageVisibleAlphaBounds(beacon);
    const domeX = beaconBody.centerX;
    const domeY = beaconBody.y + beaconBody.height * 0.15;
    if (step >= 1) consoleObject.setTint(0xbffcff);
    if (step >= 2) {
      const line = this.add.graphics().lineStyle(10, 0x49efff, 0.7).beginPath()
        .moveTo(consoleObject.x, consoleObject.y - consoleObject.displayHeight * 0.45)
        .lineTo(beaconBody.centerX, beaconBody.y + beaconBody.height * 0.63).strokePath().setBlendMode(Phaser.BlendModes.ADD);
      this.stageRoot!.add(line);
    }
    if (step >= 3) {
      const rings = this.add.graphics().lineStyle(5, 0x8cffff, 0.75)
        .strokeCircle(domeX, domeY, Math.min(48, beacon.displayWidth * 0.6))
        .lineStyle(2, 0xdfffff, 0.5).strokeCircle(domeX, domeY, Math.min(70, beacon.displayWidth * 0.9))
        .setBlendMode(Phaser.BlendModes.ADD).setName('mission10-beacon-rings');
      this.stageRoot!.add(rings);
    }
    if (step >= 4) {
      if (!this.finalLaboratoryVisible) this.createBackground();
      this.feedbackText?.setText('ЛАБОРАТОРИЯ ОЖИЛА!');
    }
    if (step >= 5) this.feedbackText?.setText('РОБОТ ВЫПОЛНИЛ ПЕРВУЮ МИССИЮ!');
  }

  private continueFinale(): void {
    if (this.finaleStarted) return;
    this.finaleStarted = true;
    const current = mission10Controller.snapshot.finaleStep;
    if (current >= 5) return this.finishMission();
    const timings = this.prefersReducedMotion() ? [90, 100, 110, 120, 180] : [220, 580, 700, 720, 760];
    this.delay(timings[current] ?? 400, () => {
      const result = mission10Controller.advanceFinale();
      if (result.status !== 'finale') return;
      if (result.finaleStep === 4) audioManager.playMission10VictoryTheme();
      if (result.completed) this.finishMission();
      else {
        this.finaleStarted = false;
        this.renderStage();
      }
    });
  }

  private finishMission(): void {
    if (!sessionState.snapshot.completedTasks || sessionState.snapshot.completedTasks < 10) sessionState.completeCurrentTask();
    this.game.registry.set('mission10Complete', true);
    this.publishQa();
    this.delay(this.prefersReducedMotion() ? 80 : 360, () => this.scene.start('VictoryScene'));
  }

  private renderOrientationGate(): void {
    const { width, height } = this.scale;
    this.titleText?.setVisible(false);
    this.feedbackText?.setVisible(false);
    this.progressRoot?.setVisible(false);
    const root = this.add.container(width / 2, height / 2).setName('mission10-orientation-gate').setDepth(30);
    const phone = this.add.graphics().fillStyle(0xffffff, 0.08).fillRoundedRect(-42, -76, 84, 152, 16)
      .lineStyle(7, 0x80f3ff, 1).strokeRoundedRect(-42, -76, 84, 152, 16)
      .lineStyle(3, 0xffffff, 0.8).strokeRoundedRect(-30, -55, 60, 104, 10);
    root.add([
      phone,
      this.add.text(0, -112, 'ПОВЕРНИ ТЕЛЕФОН', { color: '#fff', fontFamily: UI_FONT, fontSize: '27px', fontStyle: 'bold', align: 'center', stroke: '#173b52', strokeThickness: 5 }).setOrigin(0.5),
      this.add.text(0, 112, 'ИГРАЕМ ГОРИЗОНТАЛЬНО', { color: '#bffff3', fontFamily: UI_FONT, fontSize: '18px', fontStyle: 'bold', align: 'center', stroke: '#173b52', strokeThickness: 4 }).setOrigin(0.5),
    ]);
    if (!this.prefersReducedMotion()) this.tweens.add({ targets: phone, angle: 90, duration: 760, hold: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private bindTap(target: Phaser.GameObjects.Container | Phaser.GameObjects.Zone | Phaser.GameObjects.Image, activate: () => void): void {
    target.setInteractive();
    target.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.interactionLocked || this.pointerOwner !== null) return;
      this.pointerOwner = pointer.id;
      this.pointerTarget = target;
      audioManager.registerUserGesture();
    });
    target.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (this.pointerOwner !== pointer.id || this.pointerTarget !== target) return;
      this.pointerOwner = null;
      this.pointerTarget = undefined;
      activate();
    });
    target.on(Phaser.Input.Events.POINTER_OUT, (pointer: Phaser.Input.Pointer) => {
      if (this.pointerOwner === pointer.id && this.pointerTarget === target) {
        this.pointerOwner = null;
        this.pointerTarget = undefined;
      }
    });
  }

  private robotReaction(success: boolean): void {
    if (!this.robot || this.prefersReducedMotion()) return;
    this.tweens.killTweensOf(this.robot);
    if (success) this.tweens.add({ targets: this.robot, y: this.robot.y - 12, duration: 150, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    else this.tweens.add({ targets: this.robot, x: this.robot.x - 10, angle: -4, duration: 130, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
  }

  private delay(ms: number, action: () => void): void {
    const generation = this.generation;
    const timer = this.time.delayedCall(ms, () => {
      if (!this.sys.isActive() || generation !== this.generation) return;
      action();
    });
    this.timers.push(timer);
  }

  private clearStagePresentation(): void {
    this.generation += 1;
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
    if (!this.stageRoot) return;
    const descendants: Phaser.GameObjects.GameObject[] = [];
    const collect = (item: Phaser.GameObjects.GameObject): void => {
      descendants.push(item);
      if (item instanceof Phaser.GameObjects.Container) item.list.forEach(collect);
    };
    collect(this.stageRoot);
    this.tweens.killTweensOf(descendants);
  }

  private prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private publishQa(): void {
    this.game.registry.set('mission10Snapshot', mission10Controller.snapshot);
    this.game.registry.set('mission10SceneContract', {
      stage: mission10Controller.snapshot.stage,
      interactionLocked: this.interactionLocked,
      pointerOwner: this.pointerOwner,
      generation: this.generation,
      targetCount: this.stageRoot?.getAll().filter((item) => Boolean(item.input?.enabled)).length ?? 0,
      timerCount: this.timers.filter((timer) => !timer.hasDispatched).length,
    });
    this.game.registry.set('sessionSnapshot', sessionState.snapshot);
  }

  private shutdownScene(): void {
    this.generation += 1;
    this.interactionLocked = true;
    this.pointerOwner = null;
    this.pointerTarget = undefined;
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
    audioManager.releaseMission10AudioAfterSceneShutdown();
    this.tweens.killAll();
  }
}
