import Phaser from 'phaser';
import { preferencesState } from '../state/preferencesState';
import { addControl, addIconControl } from '../ui/controls';
import { createGroundedRobot } from '../ui/robotGrounding';
import { RobotAssemblyPreview } from '../ui/RobotAssemblyPreview';
import { createResponsiveLayout, createTransitionSceneLayout } from '../ui/responsiveLayout';
import { configureResponsiveCamera } from '../ui/responsiveCamera';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';
import { fluidValue } from '../ui/fluidSizing';
import { audioManager } from '../audio/AudioManager';

export class TransitionScene extends Phaser.Scene {
  constructor() { super('TransitionScene'); }
  create(): void {
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    this.game.registry.set('responsiveLayout', layout);
    const portrait = layout.mode !== 'landscape';
    const transitionLayout = createTransitionSceneLayout(layout);
    const { phonePortrait } = transitionLayout;
    this.cameras.main.setBackgroundColor('#173b52');
    const worldLayer = this.add.container(0, 0).setName('transition-world').setDepth(-2);
    const actorLayer = this.add.container(0, 0).setName('transition-actors');
    addLogicalLaboratoryImage(this, worldLayer, 'bg-main-laboratory');
    const frame = configureResponsiveCamera(this, worldLayer, layout);
    const { buttonHeight, titleSize, titleY, actorFeetY, pairScale, pairSpan } = transitionLayout;
    const helper = createGroundedRobot(this, actorLayer, 5);
    const helperX = phonePortrait ? width / 2 - pairSpan / 2 : 640 - pairSpan / 2;
    const repairedX = phonePortrait ? width / 2 + pairSpan / 2 : 640 + pairSpan / 2;
    const logicalFeetY = phonePortrait ? actorFeetY : 560;
    helper?.setPosition(helperX, logicalFeetY).setScale(pairScale).setData({ baseX: helperX, baseY: logicalFeetY, characterRole: 'HERO' });
    const repaired = new RobotAssemblyPreview(this, repairedX, logicalFeetY, 5, { scale: pairScale, blueprintAlpha: 0 })
      .setName('transition-assembled-robot');
    repaired.setData({ characterRole: 'HERO' });
    repaired.setPowered(false);
    actorLayer.add(repaired);
    if (!phonePortrait) actorLayer.setPosition(frame.offsetX, frame.offsetY).setScale(frame.scale);
    this.add.rectangle(0, 0, width, height, 0x102b47, portrait ? 0.3 : 0.22).setOrigin(0).setDepth(-1);

    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    addIconControl(this, layout.safe.left + layout.iconWidth / 2, layout.headerY, '⌂ Домой', () => this.scene.start('StartScene'), UI_COLORS.purple, iconSizing).setName('transition-home');
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing).setName('transition-sound');
    const title = this.add.text(width / 2, titleY, 'РОБОТ СОБРАН!', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${titleSize}px`, fontStyle: 'bold', align: 'center',
      stroke: '#31567a', strokeThickness: 7,
    }).setOrigin(0.5).setName('transition-title');
    if (title.width > width - 30) title.setScale((width - 30) / title.width);
    this.add.text(width / 2, transitionLayout.subtitleY, 'ТЕПЕРЬ ПОРА ЕГО ОЖИВИТЬ!', {
      color: '#fff8e7', fontFamily: UI_FONT, fontSize: `${portrait ? fluidValue(15, width, 0.045, 22) : fluidValue(16, height, 0.032, 24)}px`,
      fontStyle: 'bold', align: 'center', wordWrap: { width: width - 36 }, stroke: '#31567a', strokeThickness: 4,
    }).setOrigin(0.5).setName('transition-subtitle');
    addControl(this, width / 2, transitionLayout.buttonY, 'ПРОДОЛЖИТЬ', () => this.scene.start('Mission6Scene'), {
      width: Math.min(280, width - layout.safe.left - layout.safe.right - 30), height: buttonHeight,
      fontSize: fluidValue(19, width, 0.055, 26),
    }).setName('transition-continue');
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}
