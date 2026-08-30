import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { connectionsMechanic } from '../mechanics/connections';
import { preferencesState } from '../state/preferencesState';
import { sessionState } from '../state/sessionState';
import { addControl, addIconControl } from '../ui/controls';
import { ConnectionTaskCard } from '../ui/ConnectionTaskCard';
import { createGroundedRobot } from '../ui/robotGrounding';
import { RobotAssemblyPreview } from '../ui/RobotAssemblyPreview';
import { createMission7SceneLayout, createResponsiveLayout } from '../ui/responsiveLayout';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';

const CORRECT_LINES = ['ЕСТЬ КОНТАКТ!', 'ПОДКЛЮЧЕНО!', 'ОТЛИЧНО!'] as const;

export class Mission7Scene extends Phaser.Scene {
  constructor() { super('Mission7Scene'); }

  create(): void {
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    const missionLayout = createMission7SceneLayout(layout);
    const portrait = layout.mode !== 'landscape';
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const session = sessionState.snapshot;
    this.game.registry.set('sessionSnapshot', session);
    this.cameras.main.setBackgroundColor('#173b52');
    const world = this.add.container(0, 0).setDepth(-3).setName('mission7-world');
    addLogicalLaboratoryImage(this, world, 'bg-main-laboratory');
    const worldScale = Math.max(width / 1280, height / 720);
    world.setPosition((width - 1280 * worldScale) / 2, (height - 720 * worldScale) / 2).setScale(worldScale);
    this.add.rectangle(0, 0, width, height, 0x102f48, portrait ? 0.22 : 0.12).setOrigin(0).setDepth(-2);

    const labConduit = this.add.graphics().setName('connection-lab-conduit').setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    labConduit.lineStyle(18, 0x62f1cb, 0.2).beginPath().moveTo(0, height * 0.72).lineTo(width * 0.18, height * 0.66)
      .lineTo(width * 0.82, height * 0.66).lineTo(width, height * 0.58).strokePath();
    labConduit.lineStyle(5, 0xd4fff1, 0.8).beginPath().moveTo(0, height * 0.72).lineTo(width * 0.18, height * 0.66)
      .lineTo(width * 0.82, height * 0.66).lineTo(width, height * 0.58).strokePath();
    labConduit.setAlpha(session.connectionsCompleted ? 0.8 : 0.13).setData('active', session.connectionsCompleted);

    const actors = this.add.container(0, 0).setName('mission7-actors').setDepth(2);
    const helper = createGroundedRobot(this, actors, 5);
    helper?.setPosition(missionLayout.helper.x, missionLayout.helper.feetY).setScale(missionLayout.helper.scale).setData({
      baseX: missionLayout.helper.x,
      baseY: missionLayout.helper.feetY,
      groundedScale: missionLayout.helper.scale,
      platformContactX: missionLayout.helper.x,
      platformContactY: missionLayout.helper.feetY,
    });
    const repaired = new RobotAssemblyPreview(this, missionLayout.repaired.x, missionLayout.repaired.feetY, 5, {
      scale: missionLayout.repaired.scale,
      blueprintAlpha: 0,
    })
      .setName('mission7-repaired-robot');
    repaired.setData({
      groundedScale: missionLayout.repaired.scale,
      platformContactX: missionLayout.repaired.x,
      platformContactY: missionLayout.repaired.feetY,
    });
    repaired.setPowered(true);
    repaired.setSystemsConnected(session.connectionsCompleted);
    actors.add(repaired);

    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    addIconControl(this, layout.safe.left + layout.iconWidth / 2, layout.headerY, '⌂ Домой', () => this.scene.start('StartScene'), UI_COLORS.purple, iconSizing);
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing);
    if (missionLayout.showHeader) this.add.text(width / 2, layout.headerY, 'ОЖИВИ РОБОТА', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${layout.headerFontSize}px`, fontStyle: 'bold', stroke: '#31567a', strokeThickness: 5,
    }).setOrigin(0.5).setName('mission7-header');

    const systems = this.add.container(missionLayout.systems.x, missionLayout.systems.y).setName('systems-progress').setDepth(8);
    const systemsWidth = missionLayout.systems.width;
    const systemsBody = this.add.graphics().fillStyle(0x174e71, 0.96).fillRoundedRect(-systemsWidth / 2, -19, systemsWidth, 52, 15)
      .lineStyle(2, 0x67e9f5, 0.85).strokeRoundedRect(-systemsWidth / 2, -19, systemsWidth, 52, 15);
    systems.add([
      systemsBody,
      this.add.text(0, -6, 'СИСТЕМЫ 2/4', { color: '#ffffff', fontFamily: UI_FONT, fontSize: `${portrait ? 13 : 16}px`, fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(0, 17, 'СОЕДИНЕНИЯ', { color: '#77f3ff', fontFamily: UI_FONT, fontSize: `${portrait ? 11 : 13}px`, fontStyle: 'bold' }).setOrigin(0.5),
    ]);

    const { x: boardX, y: boardTop, width: boardWidth, height: boardHeight } = missionLayout.board;
    let resolving = false;
    let card: ConnectionTaskCard;
    const finishChallenge = (): void => {
      if (resolving) return;
      resolving = true;
      this.time.delayedCall(reducedMotion ? 300 : 900, () => {
        if (!this.sys.isActive()) return;
        const outcome = connectionsMechanic.continue();
        if (outcome === 'next') {
          this.scene.restart();
          return;
        }
        if (outcome !== 'mission-complete') return;
        if (!sessionState.snapshot.connectionsCompleted) sessionState.completeCurrentTask();
        const completedSession = sessionState.snapshot;
        this.game.registry.set('sessionSnapshot', completedSession);
        this.game.registry.set('mission7Complete', true);
        audioManager.playRepairReward();
        labConduit.setData('active', true);
        this.tweens.add({ targets: labConduit, alpha: 0.86, duration: reducedMotion ? 180 : 520, yoyo: !reducedMotion, repeat: reducedMotion ? 0 : 1 });
        void card.playCompletionPulse(reducedMotion).then(() => repaired.playSystemsConnection(reducedMotion)).then(() => {
          if (!this.sys.isActive()) return;
          void helper?.playCorrect();
          this.showCompletion(width, height, layout.safe.bottom);
        });
      });
    };
    card = new ConnectionTaskCard(this, {
      x: boardX,
      y: boardTop,
      width: boardWidth,
      height: boardHeight,
      snapshot: connectionsMechanic.snapshot,
      onConnect: (source, target) => {
        const result = connectionsMechanic.connect(source, target);
        if (result === 'correct') {
          audioManager.playCorrect();
          void helper?.playCorrect();
          card.refresh(connectionsMechanic.snapshot, CORRECT_LINES[connectionsMechanic.snapshot.connected.length % CORRECT_LINES.length]);
          if (connectionsMechanic.challengeComplete) finishChallenge();
        } else if (result === 'wrong') {
          audioManager.playWrong();
          void helper?.playWrong();
          card.refresh(connectionsMechanic.snapshot, 'ПОПРОБУЙ ЕЩЁ');
        }
        return result;
      },
      onCancel: () => card.refresh(connectionsMechanic.snapshot, ''),
    });
    addControl(this, missionLayout.hint.x, missionLayout.hint.y, 'ПОДСКАЗКА', () => {
      if (resolving) return;
      const color = connectionsMechanic.hint();
      if (!color) return;
      audioManager.playHint();
      card.pulseHint(color);
      void helper?.playHint();
    }, {
      width: missionLayout.hint.width,
      height: missionLayout.hint.height,
      fontSize: missionLayout.hint.fontSize,
    }).setName('connection-hint-button').setDepth(10);

    if (session.connectionsCompleted || connectionsMechanic.snapshot.completed) {
      this.game.registry.set('mission7Complete', true);
      this.showCompletion(width, height, layout.safe.bottom);
    }
    restartOnViewportResize(this);
    markSceneReady(this);
  }

  private showCompletion(width: number, height: number, safeBottom: number): void {
    if (this.children.getByName('mission7-completion')) return;
    const overlay = this.add.container(width / 2, height / 2).setName('mission7-completion').setDepth(30);
    const panelWidth = Math.min(520, width - 30);
    const panelHeight = Math.min(250, height * 0.38);
    const panel = this.add.graphics().fillStyle(0x153852, 0.97).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24)
      .lineStyle(4, 0x7af3c0, 1).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
    const title = this.add.text(0, -panelHeight * 0.24, 'СИСТЕМЫ СОЕДИНЕНЫ!', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(30, Math.max(20, width * 0.055))}px`, fontStyle: 'bold', align: 'center',
      wordWrap: { width: panelWidth - 30 },
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, 4, 'ДАЛЬШЕ НАУЧИМ РОБОТА ДВИГАТЬСЯ', {
      color: '#bfffea', fontFamily: UI_FONT, fontSize: `${Math.min(18, Math.max(13, width * 0.035))}px`, fontStyle: 'bold', align: 'center',
      wordWrap: { width: panelWidth - 38 },
    }).setOrigin(0.5);
    const button = addControl(this, width / 2, Math.min(height - safeBottom - 32, height / 2 + panelHeight * 0.3), 'ПРОДОЛЖИТЬ', () => undefined, {
      width: Math.min(260, panelWidth - 50), height: 54, fontSize: Math.min(22, Math.max(17, width * 0.045)),
    }).setName('mission7-continue').setDepth(31);
    overlay.add([panel, title, subtitle]);
    button.setData('nextMission', 8);
  }
}
