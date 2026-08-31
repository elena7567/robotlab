import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { programmingMechanic, simulateProgram, type RobotCommand } from '../mechanics/programming';
import { preferencesState } from '../state/preferencesState';
import { sessionState } from '../state/sessionState';
import { addControl, addIconControl, setControlEnabled } from '../ui/controls';
import { ProgrammingBoard } from '../ui/ProgrammingBoard';
import { RobotAssemblyPreview } from '../ui/RobotAssemblyPreview';
import { createMission8SceneLayout, createResponsiveLayout, type ResponsiveLayout } from '../ui/responsiveLayout';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';
import { CHILD_UI } from '../ui/childUi';

const COMMAND_LABELS: Readonly<Record<RobotCommand, string>> = { UP: '↑', RIGHT: '→', DOWN: '↓', LEFT: '←' };
const COMMAND_ORDER: readonly RobotCommand[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

export class Mission8Scene extends Phaser.Scene {
  constructor() { super('Mission8Scene'); }

  create(): void {
    programmingMechanic.recoverInterruptedRun();
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    this.game.registry.set('responsiveLayout', layout);
    const portrait = layout.semanticMode.startsWith('PHONE_PORTRAIT') || layout.semanticMode === 'TABLET_PORTRAIT';
    const ultra = layout.semanticMode === 'PHONE_PORTRAIT_SHORT';
    const compactMobile = layout.semanticMode.startsWith('PHONE_');
    const composition = createMission8SceneLayout(layout);
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const session = sessionState.snapshot;
    const snapshot = programmingMechanic.snapshot;
    const scene = this;
    this.game.registry.set('sessionSnapshot', session);
    this.cameras.main.setBackgroundColor('#173b52');

    const world = this.add.container(0, 0).setDepth(-4).setName('mission8-world');
    addLogicalLaboratoryImage(this, world, 'bg-main-laboratory');
    const worldScale = Math.max(width / 1280, height / 720);
    world.setPosition((width - 1280 * worldScale) / 2, (height - 720 * worldScale) / 2).setScale(worldScale);
    this.add.rectangle(0, 0, width, height, 0x0d2d48, portrait ? 0.34 : 0.2).setOrigin(0).setDepth(-3);

    const navigationLights = this.add.graphics().setName('programming-lab-lights').setDepth(-1).setBlendMode(Phaser.BlendModes.ADD);
    navigationLights.lineStyle(10, 0x55eaff, 0.68).beginPath().moveTo(width * 0.08, height * 0.88)
      .lineTo(width * 0.28, height * 0.82).lineTo(width * 0.48, height * 0.88).lineTo(width * 0.7, height * 0.81).lineTo(width * 0.92, height * 0.87).strokePath();
    navigationLights.setAlpha(session.programmingCompleted ? 0.78 : 0.08).setData('active', session.programmingCompleted);

    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    addIconControl(this, layout.safe.left + layout.iconWidth / 2, layout.headerY, '⌂ Домой', () => {
      programmingMechanic.recoverInterruptedRun();
      this.scene.start('StartScene');
    }, UI_COLORS.purple, iconSizing).setName('mission8-home');
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing).setName('mission8-sound');
    if (!compactMobile) this.add.text(width / 2, layout.headerY, 'ЗАПРОГРАММИРУЙ РОБОТА', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(30, layout.headerFontSize)}px`, fontStyle: 'bold', stroke: '#31567a', strokeThickness: 5,
    }).setOrigin(0.5).setName('mission8-header');

    const systemsWidth = layout.semanticMode.startsWith('PHONE_PORTRAIT')
      ? Math.min(300, layout.headerZone.width)
      : Math.min(260, width - layout.iconWidth * 2.45);
    const systems = this.add.container(width / 2, composition.systemsY).setName('systems-progress').setDepth(8);
    const systemsHeight = compactMobile ? 38 : 50;
    systems.add(compactMobile ? [
      this.add.graphics().fillStyle(0x174e71, 0.96).fillRoundedRect(-systemsWidth / 2, -systemsHeight / 2, systemsWidth, systemsHeight, 14)
        .lineStyle(2, 0x67e9f5, 0.85).strokeRoundedRect(-systemsWidth / 2, -systemsHeight / 2, systemsWidth, systemsHeight, 14),
      this.add.text(0, 0, `СИСТЕМЫ 3/4  •  МАРШРУТ ${snapshot.challengeIndex + 1}/3`, { color: '#ffffff', fontFamily: UI_FONT, fontSize: `${CHILD_UI.typography.statusMin}px`, fontStyle: 'bold' }).setOrigin(0.5),
    ] : [
      this.add.graphics().fillStyle(0x174e71, 0.96).fillRoundedRect(-systemsWidth / 2, -18, systemsWidth, 50, 15)
        .lineStyle(2, 0x67e9f5, 0.85).strokeRoundedRect(-systemsWidth / 2, -18, systemsWidth, 50, 15),
      this.add.text(0, -5, 'СИСТЕМЫ 3/4', { color: '#ffffff', fontFamily: UI_FONT, fontSize: '16px', fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(0, 17, `МАРШРУТ ${snapshot.challengeIndex + 1}/3`, { color: '#77f3ff', fontFamily: UI_FONT, fontSize: '13px', fontStyle: 'bold' }).setOrigin(0.5),
    ]);
    this.add.text(width / 2, composition.routeY, `МАРШРУТ ${snapshot.challengeIndex + 1} ИЗ 3`, {
      color: '#fff7cc', fontFamily: UI_FONT, fontSize: `${ultra ? CHILD_UI.typography.statusMin : 16}px`, fontStyle: 'bold', stroke: '#173b52', strokeThickness: 3,
    }).setOrigin(0.5).setName('programming-route-label').setDepth(9).setVisible(false);

    const board = new ProgrammingBoard(this, { ...composition.board, challenge: snapshot.challenge, robotPosition: snapshot.robotPosition }).setDepth(4);
    const instruction = this.add.text(composition.board.x + composition.board.width / 2, composition.board.y - 18, compactMobile ? 'ДОВЕДИ РОБОТА ДО ЗАРЯДКИ' : 'ДОВЕДИ РОБОТА ДО ЗАРЯДКИ  •  СОСТАВЬ ПУТЬ И НАЖМИ «ЗАПУСТИТЬ»', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${CHILD_UI.typography.instructionMin}px`, fontStyle: 'bold', stroke: '#102f4b', strokeThickness: 4,
    }).setOrigin(0.5).setName('programming-instruction').setDepth(7);

    const stripWidth = Math.min(composition.controlWidth, compactMobile ? 500 : 520);
    const stripHeight = ultra ? 52 : 60;
    const strip = this.add.container(composition.controlCenterX, composition.stripY).setName('program-strip').setDepth(8);
    const stripBackground = this.add.graphics();
    strip.add([stripBackground, this.add.text(compactMobile ? 0 : -stripWidth / 2 + 14, -stripHeight / 2 + (compactMobile ? 2 : 8), 'ТВОЙ ПУТЬ', {
      color: '#8ceeff', fontFamily: UI_FONT, fontSize: `${CHILD_UI.typography.statusMin}px`, fontStyle: 'bold',
    }).setOrigin(compactMobile ? 0.5 : 0, 0).setName('programming-strip-label')]);
    const slotObjects: Phaser.GameObjects.Container[] = [];
    const feedback = this.add.text(composition.controlCenterX, composition.stripY + stripHeight / 2 + 4, '', {
      color: '#fff3a6', fontFamily: UI_FONT, fontSize: `${CHILD_UI.typography.statusMin}px`, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0).setName('programming-feedback').setDepth(9);

    const controls: Phaser.GameObjects.Container[] = [];
    const arrowButtons = new Map<RobotCommand, Phaser.GameObjects.Container>();
    let tutorialActive = snapshot.challengeIndex === 0 && snapshot.commands.length === 0;
    let tutorialTween: Phaser.Tweens.Tween | undefined;
    let tutorialMessage: Phaser.GameObjects.Container | undefined;
    let runButton!: Phaser.GameObjects.Container;
    const gap = ultra ? 7 : 10;
    const totalArrowWidth = composition.arrowSize * 4 + gap * 3;
    COMMAND_ORDER.forEach((command, index) => {
      const button = addControl(this, composition.controlCenterX - totalArrowWidth / 2 + composition.arrowSize / 2 + index * (composition.arrowSize + gap), composition.arrowsY,
        COMMAND_LABELS[command], () => {
          if (programmingMechanic.add(command)) {
            if (tutorialActive && command === 'RIGHT') stopTutorial();
            feedback.setText(''); refreshStrip();
          }
          else if (programmingMechanic.snapshot.commands.length >= programmingMechanic.snapshot.challenge.maxCommands) feedback.setText('КОМАНДЫ ЗАПОЛНЕНЫ');
        }, { width: composition.arrowSize, height: composition.arrowSize, fontSize: composition.arrowSize * 0.55, hitPadding: 2 })
        .setName(`program-command-${command}`).setData('command', command).setDepth(10);
      controls.push(button); arrowButtons.set(command, button);
    });

    const actionGap = ultra ? 7 : 12;
    const usableWidth = Math.min(composition.controlWidth, compactMobile ? 390 : 460);
    const hintWidth = Math.floor(usableWidth * 0.27);
    const deleteWidth = Math.floor(usableWidth * 0.27);
    const runWidth = usableWidth - hintWidth - deleteWidth - actionGap * 2;
    const actionLeft = composition.controlCenterX - usableWidth / 2;
    const hintButton = addControl(this, actionLeft + hintWidth / 2, composition.actionsY, 'ПОДСКАЗКА', () => {
      const hint = programmingMechanic.hint();
      if (!hint) { feedback.setText('ИСПРАВЬ ПОСЛЕДНЮЮ КОМАНДУ'); return; }
      audioManager.playHint();
      board.pulseHint(hint.to, reducedMotion);
      const arrow = arrowButtons.get(hint.command);
      if (arrow) this.tweens.add({ targets: arrow, scale: 1.12, duration: reducedMotion ? 120 : 230, yoyo: true, repeat: reducedMotion ? 0 : 1 });
      feedback.setText(`ПОПРОБУЙ ${COMMAND_LABELS[hint.command]}`);
    }, { width: hintWidth, height: composition.actionHeight, fontSize: CHILD_UI.typography.controlMin }).setName('programming-hint-button').setDepth(10);
    const deleteButton = addControl(this, actionLeft + hintWidth + actionGap + deleteWidth / 2, composition.actionsY, 'УДАЛИТЬ', () => {
      if (programmingMechanic.removeLast()) { feedback.setText(''); refreshStrip(); }
    }, { width: deleteWidth, height: composition.actionHeight, fontSize: CHILD_UI.typography.controlMin, fill: UI_COLORS.purple, hoverFill: 0x916ee1, stroke: UI_COLORS.purpleDark })
      .setName('programming-delete-button').setDepth(10);
    let runLocked = false;
    runButton = addControl(this, actionLeft + hintWidth + deleteWidth + actionGap * 2 + runWidth / 2, composition.actionsY, 'ЗАПУСТИТЬ', () => {
      if (runLocked) return;
      const execution = programmingMechanic.beginRun();
      if (!execution) return;
      runLocked = true;
      setEditing(false);
      board.renderPreview(execution, true);
      feedback.setText('РОБОТ ВЫПОЛНЯЕТ ПРОГРАММУ');
      void executeProgram(execution);
    }, { width: runWidth, height: composition.actionHeight, fontSize: Math.max(CHILD_UI.typography.controlMin, ultra ? 13 : 17) }).setName('programming-run-button').setDepth(10);
    controls.push(hintButton, deleteButton, runButton);

    function refreshStrip(): void {
      for (const object of slotObjects) object.destroy();
      slotObjects.length = 0;
      const current = programmingMechanic.snapshot;
      stripBackground.clear().fillStyle(0x143b58, 0.98).fillRoundedRect(-stripWidth / 2, -stripHeight / 2, stripWidth, stripHeight, 16)
        .lineStyle(2, 0x61dcea, 0.84).strokeRoundedRect(-stripWidth / 2, -stripHeight / 2, stripWidth, stripHeight, 16);
      const slotGap = compactMobile ? 4 : 8;
      const slotSize = Math.min(compactMobile ? 34 : 40, Math.floor((stripWidth - 16 - (current.challenge.maxCommands - 1) * slotGap) / current.challenge.maxCommands));
      const slotsWidth = current.challenge.maxCommands * slotSize + (current.challenge.maxCommands - 1) * slotGap;
      const startX = compactMobile ? -slotsWidth / 2 : Math.max(-stripWidth / 2 + 88, -slotsWidth / 2);
      for (let index = 0; index < current.challenge.maxCommands; index += 1) {
        const command = current.commands[index];
        const slot = scene.add.container(startX + index * (slotSize + slotGap) + slotSize / 2, compactMobile ? 10 : 7).setName(`program-slot-${index}`);
        slot.add([
          scene.add.rectangle(0, 0, slotSize, slotSize, command ? 0x2e7290 : 0x102c45, 1).setStrokeStyle(2, command ? 0xa6f6ff : 0x49778d, 0.9),
          scene.add.text(0, -1, command ? COMMAND_LABELS[command] : '·', { color: command ? '#ffffff' : '#6c91a3', fontFamily: UI_FONT, fontSize: `${slotSize * 0.62}px`, fontStyle: 'bold' }).setOrigin(0.5),
        ]);
        strip.add(slot); slotObjects.push(slot);
      }
      strip.setData({ commands: [...current.commands], maxCommands: current.challenge.maxCommands });
      board.renderPreview(simulateProgram(current.challenge, current.commands));
      setControlEnabled(deleteButton, current.commands.length > 0 && !current.running);
      setControlEnabled(runButton, current.commands.length > 0 && !current.running);
    }

    function setEditing(enabled: boolean): void {
      for (const control of controls) setControlEnabled(control, enabled);
      if (enabled) {
        const current = programmingMechanic.snapshot;
        setControlEnabled(deleteButton, current.commands.length > 0);
        setControlEnabled(runButton, current.commands.length > 0);
      }
    }

    function setExecutionCommand(index: number): void {
      slotObjects.forEach((slot, slotIndex) => {
        scene.tweens.killTweensOf(slot);
        slot.setScale(slotIndex === index ? 1.14 : 1).setAlpha(slotIndex === index ? 1 : 0.7);
      });
    }

    function stopTutorial(): void {
      if (!tutorialActive) return;
      tutorialActive = false;
      tutorialTween?.stop(); tutorialTween = undefined;
      const right = arrowButtons.get('RIGHT');
      right?.setScale(1);
      board.clearTutorialTarget();
      tutorialMessage?.destroy(); tutorialMessage = undefined;
    }

    const wait = (delay: number): Promise<void> => new Promise((resolve) => this.time.delayedCall(delay, resolve));
    const executeProgram = async (execution: ReturnType<typeof programmingMechanic.beginRun> & {}): Promise<void> => {
      if (!execution) return;
      const moveDuration = reducedMotion ? 95 : 330;
      for (const [index, step] of execution.steps.entries()) {
        if (!this.sys.isActive()) return;
        setExecutionCommand(index);
        board.setExecutionStep(index);
        await board.moveRobot(step, moveDuration);
        if (!this.sys.isActive()) return;
        programmingMechanic.applyStep(step);
        if (step.collision) break;
      }
      if (!this.sys.isActive()) return;
      const result = programmingMechanic.finishRun(execution);
      setExecutionCommand(-1);
      if (result === 'success') {
        audioManager.playCorrect();
        feedback.setText('ПРОГРАММА РАБОТАЕТ!');
        await board.pulseTarget(reducedMotion);
        if (!this.sys.isActive()) return;
        await wait(reducedMotion ? 180 : 600);
        if (!this.sys.isActive()) return;
        advanceRoute();
        return;
      }
      audioManager.playWrong();
      feedback.setText(result === 'collision' ? 'ТУДА НЕЛЬЗЯ' : 'ПОПРОБУЙ ИЗМЕНИТЬ КОМАНДЫ');
      await wait(reducedMotion ? 160 : 500);
      if (!this.sys.isActive()) return;
      await board.resetRobot(snapshot.challenge.start, reducedMotion ? 100 : 320);
      if (!this.sys.isActive()) return;
      runLocked = false;
      setEditing(true);
      refreshStrip();
    };

    const advanceRoute = (): void => {
      const outcome = programmingMechanic.continue();
      if (outcome === 'next') { this.scene.restart(); return; }
      if (outcome !== 'mission-complete') return;
      if (!sessionState.snapshot.programmingCompleted) sessionState.completeCurrentTask();
      const completed = sessionState.snapshot;
      this.game.registry.set('sessionSnapshot', completed);
      this.game.registry.set('mission8Complete', true);
      navigationLights.setData('active', true);
      this.tweens.add({ targets: navigationLights, alpha: 0.82, duration: reducedMotion ? 160 : 520, ease: 'Sine.easeOut' });
      audioManager.playRepairReward();
      this.showCompletion(layout, reducedMotion);
    };

    refreshStrip();
    if (tutorialActive) {
      const firstStep = simulateProgram(snapshot.challenge, ['RIGHT']).steps[0];
      if (firstStep && !firstStep.collision) board.showTutorialTarget(firstStep.to, reducedMotion);
      const right = arrowButtons.get('RIGHT');
      if (right) tutorialTween = this.tweens.add({ targets: right, scale: { from: 1, to: 1.12 }, duration: reducedMotion ? 160 : 380, yoyo: true, repeat: reducedMotion ? 0 : -1 });
      const messageWidth = Math.min(390, composition.board.width - 16);
      tutorialMessage = this.add.container(composition.board.x + composition.board.width / 2,
        composition.board.y + composition.board.height - (ultra ? 18 : 22)).setName('programming-tutorial-message').setDepth(12);
      tutorialMessage.add([
        this.add.rectangle(0, 0, messageWidth, 42, 0x173f5e, 0.96).setStrokeStyle(2, 0xffec83, 1),
        this.add.text(0, 0, 'НАЖМИ → И СОСТАВЬ ПУТЬ', { color: '#ffffff', fontFamily: UI_FONT, fontSize: `${CHILD_UI.typography.tutorialMin}px`, fontStyle: 'bold' }).setOrigin(0.5),
      ]);
    }
    if (session.programmingCompleted || snapshot.completed) {
      this.game.registry.set('mission8Complete', true);
      this.showCompletion(layout, reducedMotion, true);
    } else if (snapshot.routeComplete) {
      this.time.delayedCall(120, advanceRoute);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => programmingMechanic.recoverInterruptedRun());
    restartOnViewportResize(this);
    markSceneReady(this);
    instruction.setData('taskNumber', 8);
  }

  private showCompletion(layout: ResponsiveLayout, reducedMotion: boolean, alreadyComplete = false): void {
    if (this.children.getByName('mission8-completion')) return;
    const { viewportWidth: width, viewportHeight: height, modalZone } = layout;
    this.add.rectangle(0, 0, width, height, 0x071a2b, 0.58).setOrigin(0).setInteractive().setName('mission8-modal-blocker').setDepth(29);
    const panelWidth = Math.min(560, modalZone.width);
    const panelHeight = Math.min(330, Math.max(240, modalZone.height * 0.58));
    const centerX = modalZone.x + modalZone.width / 2;
    const centerY = modalZone.y + modalZone.height / 2;
    const overlay = this.add.container(centerX, centerY).setName('mission8-completion').setDepth(30);
    overlay.add([
      this.add.graphics().fillStyle(0x123650, 0.98).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24)
        .lineStyle(4, 0x7af3c0, 1).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24),
      this.add.text(0, -panelHeight * 0.35, 'РОБОТ УМЕЕТ ДВИГАТЬСЯ!', {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(29, Math.max(19, width * 0.054))}px`, fontStyle: 'bold', align: 'center',
        wordWrap: { width: panelWidth - 28 },
      }).setOrigin(0.5),
      this.add.text(0, -panelHeight * 0.17, 'ТЫ НАПИСАЛ ПРОГРАММУ!', {
      color: '#a9ffcf', fontFamily: UI_FONT, fontSize: `${Math.min(18, Math.max(CHILD_UI.typography.statusMin, width * 0.035))}px`, fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5),
    ]);
    const stripY = panelHeight * 0.08;
    const testStrip = this.add.graphics().fillStyle(0x0d2942, 1).fillRoundedRect(-panelWidth * 0.36, stripY - 25, panelWidth * 0.72, 80, 18)
      .lineStyle(3, 0x5ee8f4, 0.9).strokeRoundedRect(-panelWidth * 0.36, stripY - 25, panelWidth * 0.72, 80, 18)
      .lineStyle(5, 0x8dffd0, 0.7).beginPath().moveTo(-panelWidth * 0.28, stripY + 15).lineTo(panelWidth * 0.28, stripY + 15).strokePath();
    overlay.add(testStrip);
    const rewardRobot = new RobotAssemblyPreview(this, -panelWidth * 0.22, stripY + 37, 5, { scale: Math.min(0.075, panelWidth / 7000), blueprintAlpha: 0 })
      .setName('mission8-autonomous-robot');
    rewardRobot.setPowered(true); rewardRobot.setSystemsConnected(true); rewardRobot.setData({ programmed: true, lifecycleState: 'programmed', characterRole: 'ASSEMBLY_PREVIEW' });
    overlay.add(rewardRobot);
    const subtitle = this.add.text(0, panelHeight * 0.31, 'ОСТАЛОСЬ ПРОВЕРИТЬ ВСЕ СИСТЕМЫ', {
      color: '#c6f8ff', fontFamily: UI_FONT, fontSize: `${Math.min(16, Math.max(CHILD_UI.typography.statusMin, width * 0.03))}px`, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    overlay.add(subtitle);
    const buttonY = Math.min(modalZone.y + modalZone.height - 29, centerY + panelHeight * 0.42);
    const continueButton = addControl(this, centerX, buttonY, 'ПРОДОЛЖИТЬ', () => undefined, {
      width: Math.min(260, panelWidth - 48), height: 52, fontSize: Math.min(21, Math.max(16, width * 0.044)),
    }).setName('mission8-continue').setDepth(31).setData('nextMission', 9);
    setControlEnabled(continueButton, alreadyComplete);
    const finish = (): void => {
      if (!this.sys.isActive()) return;
      rewardRobot.setData({ autonomousRewardPlayed: true, programmed: true, lifecycleState: 'programmed' });
      setControlEnabled(continueButton, true);
    };
    if (alreadyComplete || reducedMotion) {
      rewardRobot.setX(panelWidth * 0.18);
      finish();
    } else {
      this.tweens.add({
        targets: rewardRobot, x: panelWidth * 0.18, duration: 900, ease: 'Sine.easeInOut', yoyo: true,
        onYoyo: () => rewardRobot.setAngle(4), onComplete: () => { rewardRobot.setAngle(0); finish(); },
      });
    }
  }
}
