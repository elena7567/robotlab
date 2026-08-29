import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { energyMechanic } from '../mechanics/energy';
import { preferencesState } from '../state/preferencesState';
import { sessionState } from '../state/sessionState';
import { addIconControl } from '../ui/controls';
import { EnergyTaskCard } from '../ui/EnergyTaskCard';
import { createGroundedRobot } from '../ui/robotGrounding';
import { RobotAssemblyPreview } from '../ui/RobotAssemblyPreview';
import { RobotDialogue } from '../ui/RobotDialogue';
import { createResponsiveLayout } from '../ui/responsiveLayout';
import { configureResponsiveCamera } from '../ui/responsiveCamera';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';

const CORRECT_LINES = ['ЕСТЬ ЭНЕРГИЯ!', 'ТОЧНО!', 'ОТЛИЧНО!'] as const;

export class Mission6Scene extends Phaser.Scene {
  constructor() { super('Mission6Scene'); }

  create(): void {
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    const portrait = layout.mode !== 'landscape';
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const state = sessionState.snapshot;
    this.game.registry.set('sessionSnapshot', state);
    this.cameras.main.setBackgroundColor('#173b52');
    const worldLayer = this.add.container(0, 0).setName('logical-world').setDepth(-2);
    const actorLayer = this.add.container(0, 0).setName('mission6-actors');
    addLogicalLaboratoryImage(this, worldLayer, 'bg-main-laboratory');
    const conduits = this.add.graphics().setName('energy-conduits').setBlendMode(Phaser.BlendModes.ADD);
    conduits.lineStyle(15, 0x42dff5, 0.72).beginPath().moveTo(390, 550).lineTo(500, 510).lineTo(640, 540)
      .lineTo(780, 510).lineTo(890, 550).strokePath();
    conduits.lineStyle(5, 0xe3fbff, 0.9).beginPath().moveTo(390, 550).lineTo(500, 510).lineTo(640, 540)
      .lineTo(780, 510).lineTo(890, 550).strokePath();
    conduits.setAlpha(state.powerActivated ? 0.72 : 0.08).setData('active', state.powerActivated);
    actorLayer.add(conduits);
    const helper = createGroundedRobot(this, actorLayer, 5);
    const pairScale = portrait ? 0.17 : 0.19;
    const pairSpan = portrait ? 245 : 275;
    if (helper) helper.setPosition(640 - pairSpan / 2, 560).setScale(pairScale).setData({
      baseX: 640 - pairSpan / 2, baseY: 560, groundedScale: pairScale,
    });
    const repaired = new RobotAssemblyPreview(this, 640 + pairSpan / 2, 560, 5, { scale: pairScale, blueprintAlpha: 0 })
      .setName('mission6-repaired-robot');
    repaired.setPowered(state.powerActivated);
    actorLayer.add(repaired);
    const frame = configureResponsiveCamera(this, worldLayer, layout);
    actorLayer.setPosition(frame.offsetX, frame.offsetY).setScale(frame.scale);
    this.add.rectangle(0, 0, width, height, 0x163852, portrait ? 0.12 : 0.05).setOrigin(0).setDepth(-1);

    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    addIconControl(this, layout.safe.left + layout.iconWidth / 2, layout.headerY, '⌂ Домой', () => this.scene.start('StartScene'), UI_COLORS.purple, iconSizing);
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing);
    if (!portrait) {
      this.add.text(width / 2, layout.headerY, 'ОЖИВИ РОБОТА', {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${layout.headerFontSize}px`, fontStyle: 'bold', stroke: '#31567a', strokeThickness: 5,
      }).setOrigin(0.5).setName('mission6-header');
    }
    const systemsX = portrait ? width / 2 : layout.progress.x + layout.progress.width / 2;
    const systemsY = portrait ? layout.progress.y + 22 : layout.progress.y + 28;
    const systems = this.add.container(systemsX, systemsY).setName('systems-progress');
    const systemsWidth = Math.min(portrait ? width - 128 : layout.progress.width, 270);
    const systemsBody = this.add.graphics().fillStyle(0x174e71, 0.94).fillRoundedRect(-systemsWidth / 2, -20, systemsWidth, 58, 16)
      .lineStyle(2, 0x67e9f5, 0.85).strokeRoundedRect(-systemsWidth / 2, -20, systemsWidth, 58, 16);
    const systemsLabel = this.add.text(0, -7, 'СИСТЕМЫ 1/4', { color: '#ffffff', fontFamily: UI_FONT, fontSize: `${portrait ? 14 : 17}px`, fontStyle: 'bold' }).setOrigin(0.5);
    const energyLabel = this.add.text(0, 18, 'ЭНЕРГИЯ', { color: '#77f3ff', fontFamily: UI_FONT, fontSize: `${portrait ? 12 : 14}px`, fontStyle: 'bold' }).setOrigin(0.5);
    systems.add([systemsBody, systemsLabel, energyLabel]);

    const dialogue = helper ? new RobotDialogue(this, helper, layout) : undefined;
    let transitionLocked = false;
    const render = (): void => {
      if (transitionLocked) return;
      transitionLocked = true;
      this.scene.restart();
    };
    new EnergyTaskCard(this, {
      ...layout.taskCard,
      sizing: layout.taskCardSizing,
      snapshot: energyMechanic.snapshot,
      onSelect: (level) => { dialogue?.hide(); energyMechanic.select(level); },
      onOrder: (level) => { dialogue?.hide(); energyMechanic.toggleOrder(level); },
      onHint: () => {
        audioManager.playHint();
        const level = energyMechanic.hint();
        dialogue?.show(energyMechanic.snapshot.challenge.kind === 'order' ? 'НАЧНИ С САМОЙ ПУСТОЙ' : 'ПОСМОТРИ НА УРОВЕНЬ ЗАРЯДА');
        void helper?.playHint();
        return level;
      },
      onCheck: () => {
        const result = energyMechanic.check();
        if (result === 'correct') {
          audioManager.playCorrect();
          dialogue?.show(CORRECT_LINES[energyMechanic.snapshot.challengeIndex]);
          void helper?.playCorrect();
          const finalChallenge = energyMechanic.snapshot.challengeIndex === 2;
          this.time.delayedCall(reducedMotion ? 260 : 620, () => {
            if (!this.sys.isActive()) return;
            energyMechanic.continue();
            if (!finalChallenge) {
              render();
              return;
            }
            if (!sessionState.snapshot.powerActivated) sessionState.completeCurrentTask();
            const poweredState = sessionState.snapshot;
            this.game.registry.set('sessionSnapshot', poweredState);
            audioManager.playRepairReward();
            conduits.setData('active', true);
            this.tweens.add({ targets: conduits, alpha: 0.72, duration: reducedMotion ? 180 : 600, ease: 'Sine.easeOut' });
            void repaired.playPowerActivation(reducedMotion).then(() => {
              if (!this.sys.isActive()) return;
              dialogue?.show('УРА! ЭНЕРГИЯ ЕСТЬ!');
              this.game.registry.set('mission6Complete', true);
            });
          });
        } else if (result === 'wrong') {
          audioManager.playWrong();
          dialogue?.show(energyMechanic.snapshot.challenge.kind === 'order' ? 'ПОПРОБУЙ ЕЩЁ' : 'ПОСМОТРИ, ГДЕ БОЛЬШЕ ЗАРЯДА');
          void helper?.playWrong();
        }
        return result;
      },
    });
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}
