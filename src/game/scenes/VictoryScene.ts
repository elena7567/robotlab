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
import { RobotAssemblyPreview } from '../ui/RobotAssemblyPreview';
import { energyMechanic } from '../mechanics/energy';
import { oddOneOutMechanic } from '../mechanics/oddOneOut';
import { connectionsMechanic } from '../mechanics/connections';
import { programmingMechanic } from '../mechanics/programming';

const LABORATORY_SOURCE_WIDTH = 1672;
const LABORATORY_SOURCE_HEIGHT = 941;
const VICTORY_PLATFORM_SOURCE_X = 836;
const VICTORY_PLATFORM_CONTACT_SOURCE_Y = 700;
const HELPER_SOURCE_HEIGHT = 1534;
const HELPER_VISIBLE_HEIGHT = 1502;
const HELPER_FEET_CONTACT_SOURCE_Y = 1518;
const PLATFORM_TO_CONTROLS_GAP = 30;

interface VictoryPlatformPlacement {
  contactX: number;
  contactY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

const getVictoryPlatformPlacement = (
  width: number,
  height: number,
  controlsTop: number,
): VictoryPlatformPlacement => {
  const coverScale = Math.max(width / LABORATORY_SOURCE_WIDTH, height / LABORATORY_SOURCE_HEIGHT);
  const centeredOffsetY = (height - LABORATORY_SOURCE_HEIGHT * coverScale) / 2;
  const centeredContactY = centeredOffsetY + VICTORY_PLATFORM_CONTACT_SOURCE_Y * coverScale;
  const contactY = Math.min(centeredContactY, controlsTop - PLATFORM_TO_CONTROLS_GAP);
  const scale = Math.max(
    width / LABORATORY_SOURCE_WIDTH,
    contactY / VICTORY_PLATFORM_CONTACT_SOURCE_Y,
    (height - contactY) / (LABORATORY_SOURCE_HEIGHT - VICTORY_PLATFORM_CONTACT_SOURCE_Y),
  );
  const offsetX = (width - LABORATORY_SOURCE_WIDTH * scale) / 2;
  const offsetY = contactY - VICTORY_PLATFORM_CONTACT_SOURCE_Y * scale;

  return {
    contactX: offsetX + VICTORY_PLATFORM_SOURCE_X * scale,
    contactY,
    scale,
    offsetX,
    offsetY,
  };
};

const resetFullSession = (): void => {
  sessionState.reset();
  oddOneOutMechanic.reset();
  sequenceMechanic.reset();
  sizeComparisonMechanic.reset();
  shadowMatchingMechanic.reset();
  memoryMechanic.reset();
  energyMechanic.reset();
  connectionsMechanic.reset();
  programmingMechanic.reset();
};

export class VictoryScene extends Phaser.Scene {
  constructor() { super('VictoryScene'); }

  create(): void {
    const { width, height } = this.scale;
    const portrait = width < height;
    this.cameras.main.setBackgroundColor('#173b52');
    const buttonHeight = fluidValue(50, height, 0.078, 60);
    const buttonWidth = portrait ? Math.min(250, width - 44) : fluidValue(190, width, 0.18, 250);
    const buttonsY = portrait ? height - 30 - buttonHeight * 1.5 : height - 34 - buttonHeight / 2;
    const controlsTop = buttonsY - buttonHeight / 2;
    const platform = getVictoryPlatformPlacement(width, height, controlsTop);
    this.add.image(platform.offsetX, platform.offsetY, 'bg-main-laboratory')
      .setOrigin(0)
      .setScale(platform.scale)
      .setAlpha(0.72)
      .setName('victory-background')
      .setData({
        platformContactX: platform.contactX,
        platformContactY: platform.contactY,
        platformSourceX: VICTORY_PLATFORM_SOURCE_X,
        platformSourceY: VICTORY_PLATFORM_CONTACT_SOURCE_Y,
      });
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

    const robotTop = titleY + titleSize * 1.45;
    const pairWidthBudget = width - 36;
    const robotHeight = Math.min(
      clampValue(112, platform.contactY - robotTop, portrait ? 245 : 330),
      pairWidthBudget * (portrait ? 0.72 : 0.62),
    );
    const pairSpan = Math.min(pairWidthBudget * 0.52, robotHeight * 0.92, portrait ? 170 : 270);
    const helperX = platform.contactX - pairSpan / 2;
    const assembledX = platform.contactX + pairSpan / 2;
    const robot = this.add.image(helperX, platform.contactY, 'robot-v2-helper')
      .setOrigin(0.5, HELPER_FEET_CONTACT_SOURCE_Y / HELPER_SOURCE_HEIGHT)
      .setScale(robotHeight / HELPER_VISIBLE_HEIGHT)
      .setName('victory-robot')
      .setData({
        role: 'helper',
        platformContactX: helperX,
        platformContactY: platform.contactY,
        robotFeetContactX: helperX,
        robotFeetContactY: platform.contactY,
        feetContactSourceY: HELPER_FEET_CONTACT_SOURCE_Y,
      });
    const assembledScale = (robotHeight / HELPER_VISIBLE_HEIGHT) * 0.92;
    const assembledRobot = new RobotAssemblyPreview(this, assembledX, platform.contactY, 5, {
      scale: assembledScale,
      blueprintAlpha: 0,
    }).setName('victory-assembled-robot').setData({
      role: 'repaired',
      platformContactX: assembledX,
      platformContactY: platform.contactY,
      robotFeetContactX: assembledX,
      robotFeetContactY: platform.contactY,
      groundedScale: assembledScale,
    });
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!reducedMotion) {
      this.tweens.add({
        targets: robot, scaleX: robot.scaleX * 1.018, scaleY: robot.scaleY * 1.018,
        duration: 620, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: assembledRobot,
        scaleX: assembledScale * 1.025,
        scaleY: assembledScale * 1.025,
        duration: 300,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeOut',
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
