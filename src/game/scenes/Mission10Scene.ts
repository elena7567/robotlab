import Phaser from 'phaser';
import { fitImageByVisibleAlpha, getImageVisibleAlphaBounds, OBJECT_VISIBLE_BOUNDS } from '../assets/objectBounds';
import { audioManager } from '../audio/AudioManager';
import { getMission10EnergyConfig, solveMission10Energy } from '../mechanics/mission10/energyRelayPuzzle.ts';
import { mission10Controller } from '../mechanics/mission10/mission10Controller.ts';
import { getMission10PathConfig, type Mission10LaneId, type Mission10PathKind } from '../mechanics/mission10/safePathPuzzle.ts';
import { getMission10SignalConfig, normalizeSignalOrientation, solveMission10Signal } from '../mechanics/mission10/signalPuzzle.ts';
import { preferencesState } from '../state/preferencesState';
import { sessionState } from '../state/sessionState';
import { addIconControl } from '../ui/controls';
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
  private robot?: Phaser.GameObjects.Image;
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
    this.robot = this.add.image(box.x + box.width / 2, this.missionLayout!.platformContactY, 'robot-v2-repaired')
      .setOrigin(0.5, 1).setScale(this.missionLayout!.robotScale)
      .setName('mission10-robot-v2').setDepth(6)
      .setData({ characterRole: 'PRIMARY_CHARACTER', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', grounded: true });
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
    const robotVisibleHeight = Math.min(compact ? 164 : 375, regions.HERO_GROUP.height / 1.1,
      (compositionWidth - actorGap) / pairWidthPerRobotHeight);
    const beaconVisibleHeight = robotVisibleHeight * 1.1;
    const robotVisibleWidth = robotVisibleHeight * INTRO_ROBOT_BOUNDS.width / INTRO_ROBOT_BOUNDS.height;
    const beaconVisibleWidth = beaconVisibleHeight * INTRO_BEACON_BOUNDS.width / INTRO_BEACON_BOUNDS.height;
    const actorsWidth = robotVisibleWidth + actorGap + beaconVisibleWidth;
    const actorsLeft = centerX - actorsWidth / 2;
    const robotCenterX = actorsLeft + robotVisibleWidth / 2;
    const beaconCenterX = actorsLeft + robotVisibleWidth + actorGap + beaconVisibleWidth / 2;

    const robotScale = robotVisibleHeight / INTRO_ROBOT_BOUNDS.height;
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
      .setPosition(robotX, robotY).setOrigin(0.5, 1).setScale(robotScale).setAngle(robotAngle).setAlpha(1)
      .setName('mission10-intro-robot')
      .setData({
        characterRole: 'PRIMARY_CHARACTER', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', grounded: true,
        introVisibleBottomY: groundY, introGroundY: groundY, introGroundingDelta: 0, reactingTo: 'BEACON',
      });

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
  }

  private renderPath(): void {
    const snapshot = mission10Controller.snapshot;
    const round = getMission10PathConfig(snapshot.pathConfigId).rounds[snapshot.pathDecisionIndex];
    if (!round) return;
    this.feedbackText?.setText(`ШАГ ${snapshot.pathDecisionIndex + 1} ИЗ 3`);
    const lanes = this.missionLayout!.pathLanes;
    const padding = this.missionLayout!.targetGap;
    const deckAspect = Math.max(...Object.values(PATH_TEXTURES).map((key) => {
      const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
      return source.height / source.width;
    }));
    const cardHeight = Math.min(lanes[0].height, (lanes[0].width - padding * 2) * deckAspect + padding * 2);
    const robot = this.robot!;
    const shadow = this.add.ellipse(robot.x, robot.y - 16 * robot.scaleY,
      robot.displayWidth * 0.55, Math.max(6, robot.displayHeight * 0.035), 0x031522, 0.3)
      .setName('mission10-path-robot-shadow');
    this.stageRoot!.add(shadow);
    for (let index = 0; index < lanes.length; index += 1) {
      const lane = round.lanes[index];
      const box = lanes[index];
      const image = this.add.image(box.x + box.width / 2, box.y + box.height / 2, PATH_TEXTURES[lane.kind])
        .setName(`mission10-path-${lane.id.toLowerCase()}`).setData({ laneId: lane.id, hazardKind: lane.kind });
      const fit = Math.min((box.width - padding * 2) / image.width, (cardHeight - padding * 2) / image.height);
      image.setScale(fit);
      const cardTop = image.y - cardHeight / 2;
      const frame = this.add.graphics().fillStyle(0x071f35, 0.35)
        .fillRoundedRect(box.x + 2, cardTop + 2, box.width - 4, cardHeight - 4, 18)
        .lineStyle(3, lane.kind === 'SAFE' ? 0x73f8d0 : lane.kind === 'LASER' ? 0xff5d70 : 0xffa54d, 0.9)
        .strokeRoundedRect(box.x + 2, cardTop + 2, box.width - 4, cardHeight - 4, 18);
      const target = this.add.zone(box.x + box.width / 2, image.y, box.width, cardHeight)
        .setName(`mission10-path-target-${lane.id.toLowerCase()}`).setData({ laneId: lane.id, hazardKind: lane.kind });
      this.bindTap(target, () => this.choosePath(lane.id, target, frame));
      this.stageRoot!.add([frame, image, target]);
    }
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

  private createEnergyTerminal(x: number, y: number, glyph: string, lit: boolean): Phaser.GameObjects.Container {
    const root = this.add.container(x, y);
    const g = this.add.graphics().fillStyle(0x183b55, 0.98).fillCircle(0, 0, 30)
      .lineStyle(5, lit ? 0x66f5ff : 0x45677b, 1).strokeCircle(0, 0, 30);
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
    const mapPoint = (point: { x: number; y: number }): Phaser.Math.Vector2 => new Phaser.Math.Vector2(
      field.x + (point.x + 0.5) / config.bounds.width * field.width,
      field.y + (point.y + 0.5) / config.bounds.height * field.height,
    );
    const signalPuzzleGroup = this.add.container(0, 0).setName('SIGNAL_PUZZLE_GROUP');
    this.stageRoot!.add(signalPuzzleGroup);
    const robotBox = regions.ROBOT_VISIBLE;
    if (this.robot) {
      this.robot.setScale(robotBox.height / INTRO_ROBOT_BOUNDS.height).setAngle(0).setAlpha(1)
        .setPosition(robotBox.x + robotBox.width / 2, regions.ROBOT_GROUND_Y + 16 * robotBox.height / INTRO_ROBOT_BOUNDS.height)
        .setData({ grounded: true, reactingTo: 'SIGNAL', signalGroundY: regions.ROBOT_GROUND_Y });
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
    const emitterPoint = mapPoint(config.emitter);
    const receiverPoint = mapPoint(config.receiver);
    const emitter = this.add.image(emitterPoint.x, emitterPoint.y, 'MISSION10_SIGNAL_EMITTER')
      .setOrigin(0.77, 0.31).setName('mission10-signal-emitter');
    emitter.setScale(propSize / emitter.height);
    const receiver = this.add.image(receiverPoint.x, receiverPoint.y, 'MISSION10_SIGNAL_RECEIVER')
      .setOrigin(0.41, 0.32).setName('mission10-signal-receiver').setData('active', solution.receiverHit);
    receiver.setScale(propSize / receiver.height);
    if (!solution.receiverHit) receiver.setTint(0x8fa7b5);
    const sourceHalo = this.add.circle(emitterPoint.x, emitterPoint.y, propSize * 0.19, 0x19d8ec, 0.20)
      .setStrokeStyle(2, 0x54f6ff, 0.7).setName('mission10-signal-source-halo');
    const sourceAperture = this.add.circle(emitterPoint.x, emitterPoint.y, propSize * 0.075, 0xe4ffff, 1)
      .setStrokeStyle(3, 0x27d9ef, 1).setName('mission10-signal-source-aperture');
    const receiverAperture = this.add.circle(receiverPoint.x, receiverPoint.y, propSize * 0.17,
      solution.receiverHit ? 0xbafff4 : 0x062b40, 1).setStrokeStyle(3, solution.receiverHit ? 0xf0fffb : 0x80c5d4, 1)
      .setName('mission10-signal-receiver-aperture');
    const targetRing = this.add.circle(receiverPoint.x, receiverPoint.y, propSize * 0.20, 0x32eacf, solution.receiverHit ? 0.34 : 0)
      .setStrokeStyle(solution.receiverHit ? 4 : 2, solution.receiverHit ? 0xaffff1 : 0x63aaba, 1)
      .setName('mission10-signal-receiver-powered').setData('active', solution.receiverHit);
    signalPuzzleGroup.add([emitter, receiver, sourceHalo, targetRing, receiverAperture]);
    const beam = this.add.graphics().setName('mission10-signal-beam').setBlendMode(Phaser.BlendModes.NORMAL);
    const core = regions.BEAM_CORE_WIDTH;
    const points = solution.segments.map((segment) => ({ from: mapPoint(segment.from), to: mapPoint(segment.to) }));
    // Three opaque strokes preserve contrast even over the brightest laboratory panel.
    for (const [width, color, alpha] of [[core + 11, 0x052c44, 0.95], [core + 5, 0x18c9ee, 1],
      [core + (solution.receiverHit ? 1 : 0), solution.receiverHit ? 0xffffff : 0xd1ffff, 1]]) {
      beam.lineStyle(width, color, alpha);
      for (const segment of points) beam.beginPath().moveTo(segment.from.x, segment.from.y).lineTo(segment.to.x, segment.to.y).strokePath();
    }
    signalPuzzleGroup.add([beam, sourceAperture]);
    const endpoint = points.at(-1)?.to;
    if (endpoint && !solution.receiverHit) signalPuzzleGroup.add(this.add.circle(endpoint.x, endpoint.y, core + 1, 0xc4ffff)
      .setStrokeStyle(2, 0x123e53).setName('mission10-signal-miss'));
    config.reflectors.forEach((reflector) => {
      const point = mapPoint(reflector.position);
      const orientation = normalizeSignalOrientation(snapshot.reflectorOrientations[reflector.id] ?? 0);
      const mirror = this.add.container(point.x, point.y).setName(`mission10-reflector-${reflector.id.toLowerCase()}`)
        .setData({ reflectorId: reflector.id, orientation });
      const texture = this.textures.get('MISSION10_SIGNAL_REFLECTOR').getSourceImage();
      const scale = propSize / texture.height;
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
        this.tweens.add({ targets: [targetRing, platformEnergy], alpha: 0.5, duration: 220, yoyo: true, repeat: 2 });
      } else pulse.setPosition(receiverPoint.x, receiverPoint.y);
    }
    this.game.registry.set('mission10SignalEvaluation', solution);
    this.game.registry.set('mission10SignalPresentation', { field, propSize, coreWidth: core, points,
      source: emitterPoint, receiver: receiverPoint, groupName: 'SIGNAL_PUZZLE_GROUP',
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
        this.robot.displayWidth * 0.55, Math.max(6, this.robot.displayHeight * 0.035), 0x031522, 0.3));
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
