import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { Mission9InteractionController } from '../mechanics/Mission9InteractionController.ts';
import { MISSION9_PUZZLES, type Mission9CandidateId, type Mission9PlayStage, type Mission9PuzzleDefinition } from '../mechanics/mission9Puzzles.ts';
import { robotTestCourse, type RobotTestCourseStage } from '../mechanics/robotTestCourse';
import { preferencesState } from '../state/preferencesState';
import { sessionState } from '../state/sessionState';
import { addControl, addIconControl } from '../ui/controls';
import { createResponsiveLayout, type RectLayout } from '../ui/responsiveLayout';
import { composeScene, type Mission9SceneLayout } from '../ui/sceneCompositionDirector';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { CHILD_UI } from '../ui/childUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';

interface Bounds { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
interface GroundingAudit { readonly visibleBottomY: number; readonly groundY: number; readonly delta: number }

const ROBOT_VISIBLE_BOUNDS = { sourceWidth: 991, sourceHeight: 1495, x: 16, y: 16, width: 959, height: 1463 } as const;
const STAGE_PROGRESS: Readonly<Record<RobotTestCourseStage, number>> = { START: 0, BRIDGE: 0, GATE: 1, POWER: 2, COMPLETE: 3 };
const FEEDBACK: Readonly<Record<Mission9PlayStage, { readonly wrong: string; readonly solved: string }>> = {
  BRIDGE: { wrong: 'НЕ ПОДХОДИТ', solved: 'МОСТ ГОТОВ' },
  GATE: { wrong: 'НЕ ТОТ КЛЮЧ', solved: 'ВОРОТА ОТКРЫТЫ' },
  POWER: { wrong: 'НЕ ПОДХОДИТ', solved: 'СТАНЦИЯ ЗАПУЩЕНА' },
};

export class Mission9Scene extends Phaser.Scene {
  private missionLayout?: Mission9SceneLayout;
  private controller?: Mission9InteractionController;
  private stageRoot?: Phaser.GameObjects.Container;
  private candidates: Phaser.GameObjects.Container[] = [];
  private targetZone?: Phaser.GameObjects.Zone;
  private targetPulse?: Phaser.GameObjects.Graphics;
  private targetPoint?: Phaser.Math.Vector2;
  private targetImage?: Phaser.GameObjects.Image;
  private robot?: Phaser.GameObjects.Container;
  private stageTweens: Phaser.Tweens.Tween[] = [];
  private stageTimers: Phaser.Time.TimerEvent[] = [];
  private titleText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private progressRoot?: Phaser.GameObjects.Container;
  private reducedMotion = false;
  private stageDisposing = false;

  constructor() { super('Mission9Scene'); }

  create(): void {
    this.resetSceneReferences();
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    const composition = composeScene(layout, 9);
    this.missionLayout = composition.mission9!;
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (sessionState.snapshot.robotTested) robotTestCourse.markCompleted();
    this.applyQaStageShortcut();

    this.game.registry.set('responsiveLayout', layout);
    this.game.registry.set('sceneComposition', composition);
    this.game.registry.set('sessionSnapshot', sessionState.snapshot);
    this.game.registry.set('mission9DragEnabled', false);
    this.cameras.main.setBackgroundColor('#173b52');

    const background = this.add.container(0, 0).setDepth(-4).setName('mission9-laboratory-background');
    addLogicalLaboratoryImage(this, background, 'bg-main-laboratory');
    const backgroundScale = Math.max(width / 1280, height / 720);
    background.setPosition((width - 1280 * backgroundScale) / 2, (height - 720 * backgroundScale) / 2).setScale(backgroundScale);
    this.add.rectangle(0, 0, width, height, 0x09253c, layout.portrait ? 0.22 : 0.1).setOrigin(0).setDepth(-3);

    const iconSize = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    addIconControl(this, layout.safe.left + layout.iconWidth / 2, layout.headerY, '⌂ Домой', () => this.scene.start('StartScene'), UI_COLORS.purple, iconSize).setName('mission9-home');
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSize).setName('mission9-sound');

    if (layout.mode !== 'landscape') {
      this.drawOrientationGate(layout);
      this.installLifecycle();
      return;
    }

    if (this.missionLayout.showHeader) {
      this.add.text(width / 2, layout.headerY, 'ИСПЫТАЙ РОБОТА', {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(31, layout.headerFontSize)}px`,
        fontStyle: 'bold', stroke: '#31567a', strokeThickness: 5,
      }).setOrigin(0.5).setName('mission9-header');
    }

    this.createHud(this.missionLayout);
    const stage = this.playStage(robotTestCourse.snapshot.courseStage);
    if (stage === 'COMPLETE') this.completeMission(layout);
    else this.renderStage(stage);
    this.installLifecycle();
  }

  private installLifecycle(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposeStage(true);
      this.progressRoot?.destroy(true);
      this.progressRoot = undefined;
      this.controller = undefined;
      this.game.registry.set('mission9SelectedAction', null);
      this.game.registry.set('mission9InteractionState', 'LOCKED');
    });
    restartOnViewportResize(this);
    markSceneReady(this);
  }

  private resetSceneReferences(): void {
    this.missionLayout = undefined;
    this.controller = undefined;
    this.stageRoot = undefined;
    this.candidates = [];
    this.targetZone = undefined;
    this.targetPulse = undefined;
    this.targetPoint = undefined;
    this.targetImage = undefined;
    this.robot = undefined;
    this.stageTweens = [];
    this.stageTimers = [];
    this.titleText = undefined;
    this.feedbackText = undefined;
    this.progressRoot = undefined;
    this.stageDisposing = false;
  }

  private playStage(stage: RobotTestCourseStage): Mission9PlayStage | 'COMPLETE' {
    return stage === 'START' ? 'BRIDGE' : stage;
  }

  private applyQaStageShortcut(): void {
    const query = new URLSearchParams(globalThis.location?.search ?? '');
    if (query.get('qaMission') !== '9') return;
    const requested = query.get('stage')?.toUpperCase();
    if (requested !== 'BRIDGE' && requested !== 'GATE' && requested !== 'POWER') return;
    const order: readonly Mission9PlayStage[] = ['BRIDGE', 'GATE', 'POWER'];
    const desired = order.indexOf(requested);
    for (let guard = 0; guard < 2; guard += 1) {
      const current = this.playStage(robotTestCourse.snapshot.courseStage);
      if (current === 'COMPLETE' || current === requested) return;
      const index = order.indexOf(current);
      if (index < 0 || index >= desired) return;
      robotTestCourse.act(MISSION9_PUZZLES[current].correctCandidateId);
      robotTestCourse.continue();
    }
  }

  private createHud(layout: Mission9SceneLayout): void {
    const title = layout.title;
    this.add.graphics().setName('mission9-stage-title-plate').setDepth(19)
      .fillStyle(0x071f35, 0.78).fillRoundedRect(title.x, title.y, title.width, title.height, 14)
      .lineStyle(2, 0x7af3c0, 0.64).strokeRoundedRect(title.x, title.y, title.width, title.height, 14);
    this.titleText = this.add.text(title.x + title.width / 2, title.y + title.height / 2, '', {
      color: '#f7fdff', fontFamily: UI_FONT, fontSize: `${Math.min(28, Math.max(19, this.scale.width * 0.032))}px`,
      stroke: '#06243b', strokeThickness: 6, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setName('mission9-stage-title').setDepth(20);
    const feedback = layout.feedback;
    this.feedbackText = this.add.text(feedback.x + feedback.width / 2, feedback.y + feedback.height / 2, '', {
      color: '#c6f8ff', fontFamily: UI_FONT, fontSize: `${Math.min(18, Math.max(CHILD_UI.typography.statusMin, this.scale.height * 0.027))}px`,
      stroke: '#06243b', strokeThickness: 4, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setName('mission9-feedback').setDepth(20);
  }
  private renderStage(stage: Mission9PlayStage): void {
    const layout = this.missionLayout;
    if (!layout) return;
    this.disposeStage();
    this.stageDisposing = false;
    const puzzle = MISSION9_PUZZLES[stage];
    this.controller = new Mission9InteractionController(stage);
    this.stageRoot = this.add.container(0, 0).setName('mission9-stage-root').setDepth(3)
      .setData('courseStage', stage).setData('auditBounds', layout.world);
    this.titleText?.setText(puzzle.title);
    this.feedbackText?.setText('');
    this.drawProgress(layout.progress);
    if (stage === 'BRIDGE') this.renderBridge(layout, puzzle);
    else if (stage === 'GATE') this.renderGate(layout, puzzle);
    else this.renderPower(layout, puzzle);
    this.renderRobot(layout, stage);
    this.renderChoices(layout, puzzle);
    this.publishAudit(puzzle);
  }

  private renderBridge(layout: Mission9SceneLayout, puzzle: Mission9PuzzleDefinition): void {
    const stage = layout.puzzleStage;
    const left = this.add.image(layout.platformCenterX - stage.width * 0.255, layout.platformContactY, 'MISSION9_BRIDGE_LEFT')
      .setOrigin(0.5, 0.58).setName('mission9-bridge-platform-left');
    const right = this.add.image(layout.platformCenterX + stage.width * 0.255, layout.platformContactY, 'MISSION9_BRIDGE_RIGHT')
      .setOrigin(0.5, 0.58).setName('mission9-bridge-platform-right');
    this.fitImage(left, stage.width * 0.43, stage.height * 0.82);
    right.setScale(left.scaleX, left.scaleY);
    const gap = this.add.image(layout.platformCenterX, layout.platformContactY - Math.max(12, stage.height * 0.12), puzzle.targetTextureKey)
      .setName('mission9-bridge-gap-target');
    this.fitImage(gap, stage.width * 0.29, stage.height * 0.34);
    this.stageRoot!.add([left, right, gap]);
    this.createSemanticTarget(puzzle, this.boundsForImage(gap), gap);
  }

  private renderGate(layout: Mission9SceneLayout, puzzle: Mission9PuzzleDefinition): void {
    const stage = layout.puzzleStage;
    const gate = this.add.image(layout.platformCenterX, layout.platformContactY, 'MISSION9_GATE_CLOSED')
      .setOrigin(0.5, 1).setName('mission9-security-gate-closed');
    this.fitImage(gate, stage.width * 0.67, stage.height * 0.94);
    this.stageRoot!.add(gate);
    this.createSemanticTarget(puzzle, {
      x: gate.x - gate.displayWidth * 0.17,
      y: gate.y - gate.displayHeight * 0.64,
      width: gate.displayWidth * 0.34,
      height: gate.displayHeight * 0.38,
    }, gate);
  }

  private renderPower(layout: Mission9SceneLayout, puzzle: Mission9PuzzleDefinition): void {
    const stage = layout.puzzleStage;
    const station = this.add.image(layout.platformCenterX, layout.platformContactY, 'MISSION9_POWER_STATION_OFF')
      .setOrigin(0.5, 1).setName('mission9-power-station-inactive');
    this.fitImage(station, stage.width * 0.66, stage.height * 0.94);
    this.stageRoot!.add(station);
    this.createSemanticTarget(puzzle, {
      x: station.x - station.displayWidth * 0.21,
      y: station.y - station.displayHeight * 0.64,
      width: station.displayWidth * 0.42,
      height: station.displayHeight * 0.28,
    }, station);
  }

  private createSemanticTarget(puzzle: Mission9PuzzleDefinition, bounds: Bounds, image: Phaser.GameObjects.Image): void {
    this.targetImage = image;
    this.targetPoint = new Phaser.Math.Vector2(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    this.targetPulse = this.add.graphics().setName('mission9-target-pulse').setAlpha(0)
      .lineStyle(4, 0x68f8ff, 1)
      .strokeRoundedRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8, Math.min(18, bounds.height * 0.3));
    this.targetZone = this.add.zone(this.targetPoint.x, this.targetPoint.y, Math.max(CHILD_UI.touch.minimum, bounds.width), Math.max(CHILD_UI.touch.minimum, bounds.height))
      .setName('mission9-drop-target-hitarea')
      .setData('auditBounds', Object.freeze({ ...bounds }))
      .setData('targetId', puzzle.targetId)
      .setData('clueId', puzzle.clueId)
      .setData('inputMode', 'TAP_SELECT_THEN_TARGET')
      .setInteractive({ useHandCursor: true });
    this.targetZone.on('pointerup', () => this.handleTargetTap(puzzle));
    this.stageRoot!.add([this.targetPulse, this.targetZone]);
  }

  private renderRobot(layout: Mission9SceneLayout, stage: Mission9PlayStage): void {
    const visibleScale = Math.min(layout.robotScale, layout.robot.width / ROBOT_VISIBLE_BOUNDS.width, layout.robot.height / ROBOT_VISIBLE_BOUNDS.height);
    const originY = this.robotOriginYForGround(layout.platformContactY, visibleScale);
    const robot = this.add.container(layout.robot.x + layout.robot.width / 2, originY)
      .setName('mission9-repaired-robot')
      .setData({ characterRole: 'PRIMARY_CHARACTER', visibleBoundsId: 'ROBOT_V2_ASSEMBLED', courseStage: stage });
    const shadowWidth = Math.min(76, ROBOT_VISIBLE_BOUNDS.width * visibleScale * 0.32);
    const shadow = this.add.ellipse(0, -7 * visibleScale, shadowWidth, Math.max(5, shadowWidth * 0.13), 0x041829, 0.28)
      .setName('mission9-robot-contact-shadow');
    const actor = this.add.image(0, 0, 'robot-v2-repaired').setOrigin(0.5, 1).setScale(visibleScale)
      .setName('mission9-repaired-robot-image');
    robot.add([shadow, actor]);
    const grounding = this.robotGrounding(robot.y, visibleScale, layout.platformContactY);
    robot.setData('visibleBottomY', grounding.visibleBottomY).setData('visibleFeetGroundY', grounding.groundY).setData('groundingDelta', grounding.delta);
    this.robot = robot;
    this.stageRoot!.add(robot);
    this.game.registry.set('mission9Grounding', Object.freeze({ ...grounding }));
  }

  private renderChoices(layout: Mission9SceneLayout, puzzle: Mission9PuzzleDefinition): void {
    const area = layout.choices;
    const gap = Math.min(layout.controlGap, Math.max(8, area.width * 0.018));
    const width = Math.min(220, (area.width - gap * 2) / 3);
    const total = width * 3 + gap * 2;
    const startX = area.x + (area.width - total) / 2 + width / 2;
    puzzle.candidates.forEach((candidate, index) => {
      const x = startX + index * (width + gap);
      const baseY = area.y + area.height / 2;
      const card = this.add.container(x, baseY).setName('mission9-choice-' + candidate.id).setSize(width, area.height)
        .setData({
          candidateId: candidate.id, courseAction: candidate.id, assetKey: candidate.textureKey, assetFamily: candidate.family,
          baseX: x, baseY, auditBounds: Object.freeze({ x: x - width / 2, y: baseY - area.height / 2, width, height: area.height }),
        });
      const panel = this.add.graphics().setName(`${card.name}-panel`);
      const image = this.add.image(0, 0, candidate.textureKey).setName(`${card.name}-asset`);
      this.fitImage(image, width * 0.82, area.height * 0.78);
      card.add([panel, image]);
      this.drawChoicePanel(card, false);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerup', () => this.selectCandidate(card, candidate.id));
      this.candidates.push(card);
      this.stageRoot!.add(card);
    });
  }
  private selectCandidate(card: Phaser.GameObjects.Container, id: Mission9CandidateId): void {
    if (!this.controller?.selectCandidate(id)) return;
    for (const candidate of this.candidates) {
      const selected = candidate === card;
      candidate.setAlpha(selected ? 1 : 0.45);
      candidate.setY((candidate.getData('baseY') as number) - (selected ? 6 : 0));
      candidate.setDepth(selected ? 32 : 22);
      this.drawChoicePanel(candidate, selected);
    }
    this.startTargetPulse();
    this.feedbackText?.setText('ТЕПЕРЬ НАЖМИ НА МЕСТО');
    this.publishInteractionSnapshot();
  }

  private handleTargetTap(puzzle: Mission9PuzzleDefinition): void {
    const attempt = this.controller?.attemptPlacement(puzzle.targetId);
    if (!attempt || attempt.status === 'ignored') return;
    const selected = this.candidates.find((candidate) => candidate.getData('candidateId') === attempt.candidateId);
    if (!selected) return;
    const result = robotTestCourse.act(attempt.candidateId);
    const mechanicMatches = result === 'correct' || result === 'complete';
    if (attempt.matches !== mechanicMatches) throw new Error(`Mission 9 ${puzzle.stage}: controller/mechanic contract mismatch`);
    if (!attempt.matches) this.rejectCandidate(selected, puzzle);
    else this.confirmPlacement(selected, puzzle);
  }

  private rejectCandidate(card: Phaser.GameObjects.Container, puzzle: Mission9PuzzleDefinition): void {
    this.controller?.rejectCandidate();
    audioManager.playWrong();
    this.stopTargetPulse();
    this.feedbackText?.setText(FEEDBACK[puzzle.stage].wrong);
    this.publishInteractionSnapshot();
    const baseX = card.getData('baseX') as number;
    const tween = this.tweens.add({
      targets: card, x: baseX + 9, duration: this.reducedMotion ? 50 : 75, yoyo: true, repeat: this.reducedMotion ? 1 : 3,
      onComplete: () => {
        if (!this.stageRoot?.active) return;
        card.setX(baseX);
        this.controller?.finishRejection();
        this.resetChoiceVisuals();
        this.feedbackText?.setText('');
        this.publishInteractionSnapshot();
      },
    });
    this.trackStageTween(tween);
  }

  private confirmPlacement(card: Phaser.GameObjects.Container, puzzle: Mission9PuzzleDefinition): void {
    if (!this.controller?.confirmPlacement() || !this.targetPoint) return;
    for (const candidate of this.candidates) candidate.disableInteractive();
    this.targetZone?.disableInteractive();
    this.stopTargetPulse();
    audioManager.playCorrect();
    this.feedbackText?.setText(FEEDBACK[puzzle.stage].solved);
    this.publishInteractionSnapshot();
    const tween = this.tweens.add({
      targets: card, x: this.targetPoint.x, y: this.targetPoint.y,
      scale: puzzle.stage === 'BRIDGE' ? 0.92 : 0.58,
      duration: this.reducedMotion ? 90 : 300, ease: 'Sine.easeInOut',
      onComplete: () => this.playWorldReaction(puzzle),
    });
    this.trackStageTween(tween);
  }

  private playWorldReaction(puzzle: Mission9PuzzleDefinition): void {
    if (puzzle.stage === 'BRIDGE') this.targetImage?.setAlpha(0);
    else if (puzzle.stage === 'GATE') this.targetImage?.setTexture('MISSION9_GATE_OPEN').setName('mission9-security-gate-open');
    else {
      this.targetImage?.setTexture('MISSION9_POWER_STATION_ON').setName('mission9-power-station-active');
      audioManager.playRepairReward();
    }
    if (!this.reducedMotion && this.robot) {
      const tween = this.tweens.add({
        targets: this.robot, x: this.robot.x + Math.min(18, this.missionLayout!.robot.width * 0.12),
        angle: 3, duration: 320, yoyo: true, ease: 'Sine.easeInOut',
      });
      this.trackStageTween(tween);
    }
    this.controller?.beginTransition();
    this.publishInteractionSnapshot();
    this.stageTimers.push(this.time.delayedCall(this.reducedMotion ? 150 : 620, () => this.advanceStage()));
  }

  private advanceStage(): void {
    this.controller?.lockInput();
    this.publishInteractionSnapshot();
    this.disposeStage();
    const next = this.playStage(robotTestCourse.continue());
    if (next === 'COMPLETE') {
      this.drawProgress(this.missionLayout!.progress);
      this.titleText?.setText('ИСПЫТАНИЕ ПРОЙДЕНО');
      this.completeMission(createResponsiveLayout(this.scale.width, this.scale.height));
      return;
    }
    this.renderStage(next);
  }

  private disposeStage(duringShutdown = false): void {
    if (this.stageDisposing) return;
    this.stageDisposing = true;
    this.targetZone?.removeAllListeners();
    if (!duringShutdown) this.targetZone?.disableInteractive();
    for (const candidate of this.candidates) {
      candidate.removeAllListeners();
      if (!duringShutdown) candidate.disableInteractive();
    }
    for (const tween of this.stageTweens) { tween.stop(); tween.remove(); }
    for (const timer of this.stageTimers) timer.remove(false);
    this.stageTweens = [];
    this.stageTimers = [];
    this.stageRoot?.destroy(true);
    this.stageRoot = undefined;
    this.candidates = [];
    this.targetZone = undefined;
    this.targetPulse = undefined;
    this.targetPoint = undefined;
    this.targetImage = undefined;
    this.robot = undefined;
    this.controller = undefined;
    this.game.registry.set('mission9SelectedAction', null);
    this.game.registry.set('mission9StageObjectCount', 0);
  }

  private drawChoicePanel(card: Phaser.GameObjects.Container, selected: boolean): void {
    const panel = card.getAt(0) as Phaser.GameObjects.Graphics;
    panel.clear()
      .fillStyle(selected ? 0xdffcff : 0xbdefff, selected ? 0.96 : 0.76)
      .fillRoundedRect(-card.width / 2, -card.height / 2, card.width, card.height, 16)
      .lineStyle(selected ? 5 : 3, selected ? 0x68f8ff : 0x7df2ff, 1)
      .strokeRoundedRect(-card.width / 2, -card.height / 2, card.width, card.height, 16);
  }

  private resetChoiceVisuals(): void {
    for (const card of this.candidates) {
      card.setPosition(card.getData('baseX') as number, card.getData('baseY') as number).setAlpha(1).setDepth(22);
      this.drawChoicePanel(card, false);
    }
  }

  private startTargetPulse(): void {
    if (!this.targetPulse) return;
    this.stopTargetPulse();
    this.targetPulse.setAlpha(this.reducedMotion ? 0.86 : 0.56);
    if (this.reducedMotion) return;
    this.stageTweens.push(this.tweens.add({
      targets: this.targetPulse, alpha: 1, scaleX: 1.045, scaleY: 1.045,
      duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
  }

  private trackStageTween(tween: Phaser.Tweens.Tween): Phaser.Tweens.Tween {
    this.stageTweens.push(tween);
    tween.once('complete', () => {
      const index = this.stageTweens.indexOf(tween);
      if (index >= 0) this.stageTweens.splice(index, 1);
    });
    return tween;
  }

  private stopTargetPulse(): void {
    if (!this.targetPulse) return;
    const pulses = this.stageTweens.filter((tween) => tween.targets?.includes(this.targetPulse!) ?? false);
    for (const tween of pulses) { tween.stop(); tween.remove(); }
    this.stageTweens = this.stageTweens.filter((tween) => !pulses.includes(tween));
    this.targetPulse.setAlpha(0).setScale(1);
  }

  private drawProgress(bounds: RectLayout): void {
    this.progressRoot?.destroy(true);
    const root = this.add.container(bounds.x, bounds.y).setName('mission9-status').setDepth(20)
      .setData('auditBounds', Object.freeze({ ...bounds }));
    const stage = robotTestCourse.snapshot.courseStage;
    const filled = STAGE_PROGRESS[stage];
    const gap = Math.min(32, Math.max(26, bounds.width * 0.29));
    const start = bounds.width / 2 - gap;
    for (let index = 0; index < 3; index += 1) {
      const done = index < filled;
      const active = index === filled && stage !== 'COMPLETE';
      root.add(this.add.circle(start + gap * index, bounds.height / 2, active ? 8 : 7, done ? 0x7af3c0 : active ? 0x68f8ff : 0xffffff, done || active ? 1 : 0.28)
        .setStrokeStyle(2, done || active ? 0xffffff : 0x9ad7e8, 0.75).setName(`mission9-progress-dot-${index}`));
    }
    this.progressRoot = root;
  }

  private publishAudit(puzzle: Mission9PuzzleDefinition): void {
    this.game.registry.set('mission9PuzzleContract', Object.freeze({
      stage: puzzle.stage, clueId: puzzle.clueId, targetId: puzzle.targetId,
      correctCandidateId: puzzle.correctCandidateId, targetTextureKey: puzzle.targetTextureKey,
      candidateIds: Object.freeze(puzzle.candidates.map((item) => item.id)),
      candidateTextures: Object.freeze(puzzle.candidates.map((item) => item.textureKey)),
      assetFamily: puzzle.family, dragEnabled: false,
    }));
    this.game.registry.set('mission9StageObjectCount', this.stageRoot?.getAll().length ?? 0);
    this.publishInteractionSnapshot();
  }

  private publishInteractionSnapshot(): void {
    const value = this.controller?.snapshot;
    const snapshot = Object.freeze(value ? { ...value } : {
      stage: this.playStage(robotTestCourse.snapshot.courseStage), state: 'LOCKED',
      selectedCandidateId: null, targetHighlighted: false,
    });
    this.game.registry.set('mission9InteractionSnapshot', snapshot);
    this.game.registry.set('mission9InteractionState', snapshot.state);
    this.game.registry.set('mission9SelectedAction', snapshot.selectedCandidateId);
  }
  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    image.setScale(Math.min(maxWidth / source.width, maxHeight / source.height));
  }

  private boundsForImage(image: Phaser.GameObjects.Image): Bounds {
    return {
      x: image.x - image.displayWidth * image.originX,
      y: image.y - image.displayHeight * image.originY,
      width: image.displayWidth,
      height: image.displayHeight,
    };
  }

  private robotOriginYForGround(groundY: number, scale: number): number {
    const visibleBottomSourceY = ROBOT_VISIBLE_BOUNDS.y + ROBOT_VISIBLE_BOUNDS.height - 1;
    return groundY + (ROBOT_VISIBLE_BOUNDS.sourceHeight - visibleBottomSourceY) * scale;
  }

  private robotGrounding(robotY: number, scale: number, groundY: number): GroundingAudit {
    const visibleBottomSourceY = ROBOT_VISIBLE_BOUNDS.y + ROBOT_VISIBLE_BOUNDS.height - 1;
    const visibleBottomY = robotY + (visibleBottomSourceY - ROBOT_VISIBLE_BOUNDS.sourceHeight) * scale;
    return Object.freeze({ visibleBottomY, groundY, delta: visibleBottomY - groundY });
  }

  private drawOrientationGate(layout: ReturnType<typeof createResponsiveLayout>): void {
    const centerX = layout.safeRect.x + layout.safeRect.width / 2;
    const centerY = layout.safeRect.y + layout.safeRect.height / 2;
    const panelWidth = Math.min(350, layout.safeRect.width - layout.gapM * 2);
    const panelHeight = Math.min(292, layout.safeRect.height - layout.headerZone.height - layout.gapM * 2);
    const gate = this.add.container(centerX, centerY).setName('mission9-orientation-gate').setDepth(12);
    const panel = this.add.graphics();
    panel.fillStyle(0x071f35, 0.94).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24)
      .lineStyle(4, 0x7af3c0, 0.95).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
    const phone = this.createOrientationPhoneIcon(Math.min(98, panelHeight * 0.34)).setY(-panelHeight * 0.23);
    gate.add([
      panel,
      phone,
      this.add.text(0, panelHeight * 0.1, 'ПОВЕРНИ ТЕЛЕФОН', {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(28, Math.max(23, layout.viewportWidth * 0.07))}px`,
        stroke: '#06243b', strokeThickness: 5, fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5),
      this.add.text(0, panelHeight * 0.29, 'ИГРАЕМ ГОРИЗОНТАЛЬНО', {
        color: '#c6f8ff', fontFamily: UI_FONT, fontSize: `${Math.min(17, Math.max(CHILD_UI.typography.statusMin, layout.viewportWidth * 0.04))}px`,
        fontStyle: 'bold',
      }).setOrigin(0.5),
    ]);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: phone, angle: 88, duration: 760, hold: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else phone.setAngle(90);
  }

  private createOrientationPhoneIcon(size: number): Phaser.GameObjects.Container {
    const icon = this.add.container(0, 0).setName('mission9-orientation-phone-icon');
    const phone = this.add.graphics();
    phone.fillStyle(0xffffff, 0.08).fillRoundedRect(-size * 0.26, -size * 0.48, size * 0.52, size * 0.96, 11)
      .lineStyle(7, 0x8df4ff, 0.96).strokeRoundedRect(-size * 0.26, -size * 0.48, size * 0.52, size * 0.96, 11)
      .lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(-size * 0.18, -size * 0.36, size * 0.36, size * 0.68, 7);
    icon.add(phone);
    return icon;
  }

  private completeMission(layout: ReturnType<typeof createResponsiveLayout>): void {
    if (this.children.getByName('mission9-completion')) return;
    if (!sessionState.snapshot.robotTested) sessionState.completeCurrentTask();
    this.game.registry.set('sessionSnapshot', sessionState.snapshot);
    this.game.registry.set('mission9Complete', true);
    this.game.registry.set('mission9InteractionState', 'LOCKED');
    this.add.rectangle(0, 0, layout.viewportWidth, layout.viewportHeight, 0x071a2b, 0.58)
      .setOrigin(0).setInteractive().setName('mission9-modal-blocker').setDepth(29);
    const width = Math.min(620, layout.modalZone.width);
    const height = Math.min(330, Math.max(248, layout.modalZone.height * 0.7));
    const centerX = layout.modalZone.x + layout.modalZone.width / 2;
    const centerY = layout.modalZone.y + layout.modalZone.height / 2;
    const overlay = this.add.container(centerX, centerY).setName('mission9-completion').setDepth(30);
    const robotHeight = Math.min(96, height * 0.28);
    overlay.add([
      this.add.graphics().fillStyle(0x123650, 0.98).fillRoundedRect(-width / 2, -height / 2, width, height, 24)
        .lineStyle(4, 0x7af3c0, 1).strokeRoundedRect(-width / 2, -height / 2, width, height, 24),
      this.add.text(0, -height * 0.32, 'ИСПЫТАНИЕ ПРОЙДЕНО', {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(30, Math.max(20, layout.viewportWidth * 0.05))}px`,
        fontStyle: 'bold', align: 'center', wordWrap: { width: width - 32 },
      }).setOrigin(0.5).setData('completionRegion', 'TITLE'),
      this.add.text(0, -height * 0.13, 'РОБОТ ГОТОВ К ПЕРВОМУ ЗАПУСКУ', {
        color: '#bfffea', fontFamily: UI_FONT, fontSize: `${Math.min(19, Math.max(CHILD_UI.typography.instructionMin, layout.viewportWidth * 0.03))}px`,
        fontStyle: 'bold', align: 'center', wordWrap: { width: width - 42 },
      }).setOrigin(0.5).setData('completionRegion', 'SUBTITLE'),
      this.add.image(0, height * 0.28, 'robot-v2-repaired').setOrigin(0.5, 1).setScale(robotHeight / 1402)
        .setName('mission9-completion-robot').setData('completionRegion', 'CHARACTER'),
    ]);
    addControl(this, centerX, centerY + height * 0.39, 'К МАЯКУ', () => this.scene.start('Mission10Scene'), {
      width: Math.min(260, width - 48), height: 54,
      fontSize: Math.min(22, Math.max(17, layout.viewportWidth * 0.04)),
    }).setName('mission9-continue-mission10').setDepth(31).setData('completionRegion', 'ACTION');
  }
}
