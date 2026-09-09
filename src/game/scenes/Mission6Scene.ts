import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { energyMechanic } from '../mechanics/energy';
import { preferencesState } from '../state/preferencesState';
import { sessionState } from '../state/sessionState';
import { addControl, addIconControl } from '../ui/controls';
import { EnergyTaskCard } from '../ui/EnergyTaskCard';
import { createGroundedRobot } from '../ui/robotGrounding';
import { RobotAssemblyPreview } from '../ui/RobotAssemblyPreview';
import { RobotDialogue } from '../ui/RobotDialogue';
import { createResponsiveLayout } from '../ui/responsiveLayout';
import { composeScene } from '../ui/sceneCompositionDirector';
import { configureResponsiveCamera } from '../ui/responsiveCamera';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';
import { CHILD_UI } from '../ui/childUi';

const CORRECT_LINES = ['ЕСТЬ ЭНЕРГИЯ!', 'ТОЧНО!', 'ОТЛИЧНО!'] as const;

export class Mission6Scene extends Phaser.Scene {
  constructor() { super('Mission6Scene'); }

  create(): void {
    const { width, height } = this.scale;
    const baseLayout = createResponsiveLayout(width, height);
    const composition = composeScene(baseLayout, 6);
    const layout = {
      ...baseLayout,
      taskCard: composition.taskCard,
      progress: composition.progress,
      characterZone: composition.regions.CHARACTER,
      zones: { ...baseLayout.zones, characterZone: composition.regions.CHARACTER },
    };
    this.game.registry.set('responsiveLayout', layout);
    this.game.registry.set('sceneComposition', composition);
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
      baseX: 640 - pairSpan / 2, baseY: 560, groundedScale: pairScale, characterRole: 'SUPPORTING_CHARACTER',
      compositionRegion: 'SECONDARY_CHARACTER', visibleBoundsId: 'ROBOT_V2_HELPER',
    });
    const repaired = new RobotAssemblyPreview(this, 640 + pairSpan / 2, 560, 5, { scale: pairScale, blueprintAlpha: 0 })
      .setName('mission6-repaired-robot');
    repaired.setPowered(state.powerActivated);
    repaired.setData({ characterRole: 'PRIMARY_CHARACTER', compositionRegion: 'CHARACTER', visibleBoundsId: 'ROBOT_V2_ASSEMBLED' });
    actorLayer.add(repaired);
    const frame = configureResponsiveCamera(this, worldLayer, layout);
    actorLayer.setPosition(frame.offsetX, frame.offsetY).setScale(frame.scale);
    if (layout.semanticMode === 'PHONE_LANDSCAPE_SHORT') {
      const zone = composition.regions.CHARACTER;
      const desiredVisibleHeight = Math.min(228, zone.height * 0.76);
      const repairedScale = desiredVisibleHeight / Math.max(1, 1402 * frame.scale);
      const logicalX = (zone.x + zone.width / 2 - frame.offsetX) / frame.scale;
      const logicalY = (zone.y + zone.height - 4 - frame.offsetY) / frame.scale;
      repaired.setPosition(logicalX, logicalY).setScale(repairedScale).setData({
        groundedScale: repairedScale,
        platformContactX: logicalX,
        platformContactY: logicalY,
      });
      helper?.setVisible(false).setData('characterRole', 'HIDDEN_FOR_MECHANIC_FOCUS');
    }
    this.add.rectangle(0, 0, width, height, 0x163852, portrait ? 0.12 : 0.05).setOrigin(0).setDepth(-1);
    if (composition.surface) {
      const { outer, support } = composition.surface;
      this.add.graphics().setName('mission6-game-surface').setDepth(-0.8)
        .fillStyle(0x123e58, 0.94).fillRoundedRect(outer.x, outer.y, outer.width, outer.height, 22)
        .lineStyle(3, 0x72d9ec, 0.72).strokeRoundedRect(outer.x, outer.y, outer.width, outer.height, 22)
        .fillStyle(0x164d67, 0.9).fillRoundedRect(support.x, support.y, support.width, support.height, 18)
        .lineStyle(2, 0x72d9ec, 0.42).strokeRoundedRect(support.x, support.y, support.width, support.height, 18)
        .setData('auditBounds', outer);
    }

    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    addIconControl(this, layout.safe.left + layout.iconWidth / 2, layout.headerY, '⌂ Домой', () => this.scene.start('StartScene'), UI_COLORS.purple, iconSizing).setName('mission6-home');
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing).setName('mission6-sound');
    if (!portrait) {
      this.add.text(width / 2, layout.headerY, 'ОЖИВИ РОБОТА', {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${layout.headerFontSize}px`, fontStyle: 'bold', stroke: '#31567a', strokeThickness: 5,
      }).setOrigin(0.5).setName('mission6-header');
    }
    const systemsX = portrait ? width / 2 : layout.progress.x + layout.progress.width / 2;
    const systemsY = portrait ? layout.statusY : layout.progress.y + 28;
    const systems = this.add.container(systemsX, systemsY).setName('systems-progress');
    systems.setVisible(layout.semanticMode !== 'PHONE_LANDSCAPE_SHORT');
    const systemsWidth = Math.min(portrait ? layout.headerZone.width : layout.progress.width, 270);
    const systemsHeight = portrait ? 38 : 58;
    const systemsBody = this.add.graphics().fillStyle(0x174e71, 0.94).fillRoundedRect(-systemsWidth / 2, -systemsHeight / 2, systemsWidth, systemsHeight, 14)
      .lineStyle(2, 0x67e9f5, 0.85).strokeRoundedRect(-systemsWidth / 2, -systemsHeight / 2, systemsWidth, systemsHeight, 14);
    systems.add(portrait ? [
      systemsBody,
      this.add.text(0, 0, 'СИСТЕМЫ 1/4  •  ЭНЕРГИЯ', { color: '#ffffff', fontFamily: UI_FONT, fontSize: `${CHILD_UI.typography.statusMin}px`, fontStyle: 'bold' }).setOrigin(0.5),
    ] : [
      systemsBody,
      this.add.text(0, -7, 'СИСТЕМЫ 1/4', { color: '#ffffff', fontFamily: UI_FONT, fontSize: '17px', fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(0, 18, 'ЭНЕРГИЯ', { color: '#77f3ff', fontFamily: UI_FONT, fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5),
    ]);

    const dialogue = helper?.visible ? new RobotDialogue(this, helper, layout, {
      placement: 'above-robot',
      onVisibilityChange: (visible) => {
        if (portrait) systems.setVisible(!visible);
      },
    }) : undefined;
    let transitionLocked = false;
    let continueShown = false;
    const showContinue = (): void => {
      if (continueShown) return;
      continueShown = true;
      const buttonHeight = Math.min(60, Math.max(50, height * 0.075));
      addControl(this, width / 2, height - layout.safe.bottom - buttonHeight / 2, 'ПРОДОЛЖИТЬ', () => {
        this.scene.start('Mission7Scene');
      }, { width: Math.min(270, width - 40), height: buttonHeight, fontSize: Math.min(24, Math.max(17, width * 0.052)) })
        .setName('mission6-continue');
    };
    const render = (): void => {
      if (transitionLocked) return;
      transitionLocked = true;
      this.scene.restart();
    };
    new EnergyTaskCard(this, {
      ...layout.taskCard,
      sizing: layout.taskCardSizing,
      actionRect: layout.semanticMode === 'PHONE_LANDSCAPE_SHORT' ? composition.regions.PRIMARY_ACTIONS : undefined,
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
              showContinue();
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
    if (state.powerActivated) {
      this.game.registry.set('mission6Complete', true);
      showContinue();
    }
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}
