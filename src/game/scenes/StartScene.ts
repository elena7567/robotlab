import Phaser from 'phaser';
import { sessionState } from '../state/sessionState';
import { preferencesState } from '../state/preferencesState';
import { addControl, addIconControl } from '../ui/controls';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_FONT } from '../ui/visualTheme';
import { createResponsiveLayout, createStartSceneLayout } from '../ui/responsiveLayout';
import { clampValue } from '../ui/fluidSizing';
import { sequenceMechanic } from '../mechanics/sequence';
import { sizeComparisonMechanic } from '../mechanics/sizeComparison';
import { LOGICAL_SCENE_WIDTH, PLATFORM_CENTER_X, PLATFORM_CONTACT_Y } from '../ui/sceneLayout';
import { audioManager } from '../audio/AudioManager';

const COMPLETE_ROBOT_SOURCE_HEIGHT = 1448;
const COMPLETE_ROBOT_BOTTOM_TRANSPARENT_PX = 25;

export class StartScene extends Phaser.Scene {
  constructor() { super('StartScene'); }
  create(): void {
    audioManager.startMusic();
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    const startLayout = createStartSceneLayout(layout);
    const portrait = layout.mode !== 'landscape';
    this.cameras.main.setBackgroundColor('#173b52');
    const worldLayer = this.add.container(0, 0).setDepth(-2);
    addLogicalLaboratoryImage(this, worldLayer, 'bg-start-laboratory');
    const worldScale = portrait
      ? clampValue(0.5, width / 610, 0.9)
      : Math.min(width / LOGICAL_SCENE_WIDTH, height / 720);
    worldLayer.setPosition(
      width / 2 - PLATFORM_CENTER_X * worldScale,
      startLayout.platformY - PLATFORM_CONTACT_Y * worldScale,
    ).setScale(worldScale);
    this.add.rectangle(0, 0, width, height, 0x17334d, portrait ? 0.18 : 0.08).setOrigin(0).setDepth(-1);

    const heroScale = startLayout.robotHeight / COMPLETE_ROBOT_SOURCE_HEIGHT;
    const robot = this.add.image(
      width / 2,
      startLayout.platformY + COMPLETE_ROBOT_BOTTOM_TRANSPARENT_PX * heroScale,
      'robot-complete',
    ).setOrigin(0.5, 1).setScale(heroScale).setName('start-hero-robot');
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!reducedMotion) {
      this.tweens.add({
        targets: robot,
        y: robot.y - 2.5,
        scaleX: heroScale * 1.008,
        scaleY: heroScale * 1.008,
        duration: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      const label = soundControl.getAt(1) as Phaser.GameObjects.Text;
      label.setText(soundLabel());
    }, undefined, { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize });

    const title = this.add.text(width / 2, startLayout.titleY, 'Почини робота', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${startLayout.titleFontSize}px`, fontStyle: 'bold', align: 'center',
      stroke: '#31567a', strokeThickness: 7,
    }).setOrigin(0.5).setName('start-title');
    if (title.width > startLayout.titleMaxWidth) title.setScale(startLayout.titleMaxWidth / title.width);
    this.add.text(width / 2, startLayout.subtitleY, 'Выполни 5 заданий и помоги\nроботу снова заработать', {
      color: '#fff8e7', fontFamily: UI_FONT, fontSize: `${startLayout.subtitleFontSize}px`, align: 'center',
      lineSpacing: 7, stroke: '#31567a', strokeThickness: 4,
      wordWrap: { width: startLayout.subtitleMaxWidth },
    }).setOrigin(0.5).setName('start-subtitle');

    const playButton = addControl(this, width / 2, startLayout.playY, 'Играть', () => {
      audioManager.stopMusic(180);
      sessionState.reset();
      sequenceMechanic.reset();
      sizeComparisonMechanic.reset();
      this.scene.start('GameScene');
    }, {
      width: startLayout.playWidth,
      height: startLayout.playHeight,
      fontSize: startLayout.playFontSize,
    }).setName('start-play-button');
    playButton.setData('platformY', startLayout.platformY);
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}
