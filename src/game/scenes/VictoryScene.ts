import Phaser from 'phaser';
import { memoryMechanic } from '../mechanics/memory';
import { sequenceMechanic } from '../mechanics/sequence';
import { shadowMatchingMechanic } from '../mechanics/shadowMatching';
import { sizeComparisonMechanic } from '../mechanics/sizeComparison';
import { sessionState } from '../state/sessionState';
import { addControl } from '../ui/controls';
import { clampValue, fluidValue } from '../ui/fluidSizing';
import { restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';

const resetFullSession = (): void => {
  sessionState.reset();
  sequenceMechanic.reset();
  sizeComparisonMechanic.reset();
  shadowMatchingMechanic.reset();
  memoryMechanic.reset();
};

export class VictoryScene extends Phaser.Scene {
  constructor() { super('VictoryScene'); }

  create(): void {
    const { width, height } = this.scale;
    const portrait = width < height;
    this.cameras.main.setBackgroundColor('#173b52');
    const background = this.add.image(width / 2, height / 2, 'bg-main-laboratory').setName('victory-background');
    background.setScale(Math.max(width / background.width, height / background.height)).setAlpha(0.72);
    this.add.rectangle(0, 0, width, height, 0x102b47, 0.26).setOrigin(0);

    const titleY = portrait ? height * 0.105 : height * 0.13;
    const titleSize = portrait ? fluidValue(27, width, 0.085, 48) : fluidValue(32, height, 0.065, 48);
    const title = this.add.text(width / 2, titleY, 'РОБОТ ПОЧИНЕН!', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${titleSize}px`, fontStyle: 'bold', align: 'center',
      stroke: '#31567a', strokeThickness: 7,
    }).setOrigin(0.5).setName('victory-title');
    if (title.width > width - 32) title.setScale((width - 32) / title.width);
    this.add.text(width / 2, titleY + titleSize * 0.9, 'ТЫ ВЫПОЛНИЛ ВСЕ ЗАДАНИЯ', {
      color: '#fff8e7', fontFamily: UI_FONT,
      fontSize: `${portrait ? fluidValue(14, width, 0.043, 21) : fluidValue(15, height, 0.032, 23)}px`,
      fontStyle: 'bold', align: 'center', wordWrap: { width: width - 38 },
      stroke: '#31567a', strokeThickness: 4,
    }).setOrigin(0.5).setName('victory-subtitle');

    const buttonHeight = fluidValue(50, height, 0.078, 60);
    const buttonWidth = portrait ? Math.min(250, width - 44) : fluidValue(190, width, 0.18, 250);
    const buttonsY = portrait ? height - 30 - buttonHeight * 1.5 : height - 34 - buttonHeight / 2;
    const robotTop = titleY + titleSize * 1.45;
    const robotBottom = portrait ? buttonsY - buttonHeight - 22 : height - buttonHeight - 36;
    const robotHeight = clampValue(128, robotBottom - robotTop, portrait ? 260 : 360);
    const robot = this.add.image(width / 2, robotBottom, 'robot-complete')
      .setOrigin(0.5, 1)
      .setScale(robotHeight / 1448)
      .setName('victory-robot');
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!reducedMotion) {
      this.tweens.add({
        targets: robot, y: robot.y - 7, scaleX: robot.scaleX * 1.018, scaleY: robot.scaleY * 1.018,
        duration: 620, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
      });
    }

    const startAgain = (): void => {
      resetFullSession();
      this.scene.start('GameScene');
    };
    const goHome = (): void => {
      resetFullSession();
      this.scene.start('StartScene');
    };
    if (portrait) {
      addControl(this, width / 2, buttonsY, 'Играть ещё', startAgain, {
        width: buttonWidth, height: buttonHeight, fontSize: fluidValue(18, width, 0.058, 24),
      }).setName('victory-play-again');
      addControl(this, width / 2, buttonsY + buttonHeight + 12, 'На главную', goHome, {
        width: buttonWidth, height: buttonHeight, fontSize: fluidValue(17, width, 0.052, 22),
        fill: UI_COLORS.purple, hoverFill: 0x916ee1, stroke: UI_COLORS.purpleDark,
      }).setName('victory-home');
    } else {
      const gap = 18;
      addControl(this, width / 2 - buttonWidth / 2 - gap / 2, buttonsY, 'Играть ещё', startAgain, {
        width: buttonWidth, height: buttonHeight, fontSize: fluidValue(18, height, 0.036, 24),
      }).setName('victory-play-again');
      addControl(this, width / 2 + buttonWidth / 2 + gap / 2, buttonsY, 'На главную', goHome, {
        width: buttonWidth, height: buttonHeight, fontSize: fluidValue(17, height, 0.033, 22),
        fill: UI_COLORS.purple, hoverFill: 0x916ee1, stroke: UI_COLORS.purpleDark,
      }).setName('victory-home');
    }
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}
