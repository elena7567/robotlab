import Phaser from 'phaser';
import { memoryMechanic } from '../mechanics/memory';
import { sequenceMechanic } from '../mechanics/sequence';
import { shadowMatchingMechanic } from '../mechanics/shadowMatching';
import { sizeComparisonMechanic } from '../mechanics/sizeComparison';
import { sessionState } from '../state/sessionState';
import { addControl } from '../ui/controls';
import { fluidValue } from '../ui/fluidSizing';
import { restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_FONT } from '../ui/visualTheme';
import { energyMechanic } from '../mechanics/energy';
import { oddOneOutMechanic } from '../mechanics/oddOneOut';
import { connectionsMechanic } from '../mechanics/connections';
import { programmingMechanic } from '../mechanics/programming';
import { robotTestCourse } from '../mechanics/robotTestCourse';
import { mission10Controller } from '../mechanics/mission10/mission10Controller.ts';
import { audioManager } from '../audio/AudioManager';

const LABORATORY_SOURCE_WIDTH = 1672;
const LABORATORY_SOURCE_HEIGHT = 941;
const VICTORY_PLATFORM_SOURCE_X = 836;
const VICTORY_PLATFORM_CONTACT_SOURCE_Y = 700;
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
  robotTestCourse.reset();
  mission10Controller.reset();
};

export class VictoryScene extends Phaser.Scene {
  constructor() { super('VictoryScene'); }

  create(): void {
    const { width, height } = this.scale;
    const portrait = width < height;
    this.cameras.main.setBackgroundColor('#173b52');
    const buttonHeight = fluidValue(50, height, 0.078, 60);
    const buttonWidth = portrait ? Math.min(270, width - 44) : fluidValue(220, width, 0.2, 280);
    const buttonsY = portrait ? height - 30 - buttonHeight * 1.5 : height - 34 - buttonHeight / 2;
    const controlsTop = buttonsY - buttonHeight / 2;
    const platform = getVictoryPlatformPlacement(width, height, controlsTop);
    this.add.image(platform.offsetX, platform.offsetY, 'MISSION10_FINAL_LAB_ACTIVE')
      .setOrigin(0)
      .setScale(platform.scale)
      .setAlpha(1)
      .setName('victory-background')
      .setData({
        platformContactX: platform.contactX,
        platformContactY: platform.contactY,
        platformSourceX: VICTORY_PLATFORM_SOURCE_X,
        platformSourceY: VICTORY_PLATFORM_CONTACT_SOURCE_Y,
      });

    const titleY = portrait ? height * 0.105 : height * 0.13;
    const titleSize = portrait ? fluidValue(27, width, 0.085, 48) : fluidValue(32, height, 0.065, 48);
    const title = this.add.text(width / 2, titleY, 'МИССИЯ ВЫПОЛНЕНА!', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${titleSize}px`, fontStyle: 'bold', align: 'center',
      stroke: '#31567a', strokeThickness: 7,
    }).setOrigin(0.5).setName('victory-title');
    if (title.width > width - 32) title.setScale((width - 32) / title.width);
    const subtitle = this.add.text(width / 2, title.getBounds().bottom + 10, 'ТЫ СОБРАЛ, ОЖИВИЛ И ЗАПУСТИЛ РОБОТА!', {
      color: '#fff8e7', fontFamily: UI_FONT,
      fontSize: `${portrait ? fluidValue(14, width, 0.043, 21) : fluidValue(15, height, 0.032, 23)}px`,
      fontStyle: 'bold', align: 'center', wordWrap: { width: width - 38 },
      stroke: '#31567a', strokeThickness: 4,
    }).setOrigin(0.5, 0).setName('victory-subtitle');

    const robot = this.add.image(platform.contactX, platform.contactY, 'robot-v2-repaired')
      .setOrigin(0.5, 1)
      .setName('victory-robot-v2')
      .setData({ role: 'repaired', platformContactX: platform.contactX, platformContactY: platform.contactY });
    const robotTop = subtitle.getBounds().bottom + 24;
    const robotHeight = Math.max(108, Math.min(platform.contactY - robotTop, portrait ? 250 : 330));
    robot.setScale(Math.min(robotHeight / robot.height, (width * (portrait ? 0.54 : 0.3)) / robot.width));
    const shadow = this.add.ellipse(platform.contactX, platform.contactY + 1, robot.displayWidth * 0.55,
      Math.max(6, robot.displayHeight * 0.035), 0x031522, 0.3).setName('victory-robot-shadow');
    this.children.moveBelow(shadow, robot);
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!reducedMotion) {
      this.tweens.add({
        targets: robot,
        y: robot.y - Math.min(12, robot.displayHeight * 0.065),
        duration: 240,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeOut',
      });
      this.tweens.add({ targets: shadow, scaleX: 0.82, alpha: 0.6, duration: 240, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    }

    const startAgain = (): void => {
      audioManager.stopMission10Audio();
      resetFullSession();
      this.scene.start('GameScene');
    };
    addControl(this, width / 2, buttonsY, 'ИГРАТЬ ЕЩЁ РАЗ', startAgain, {
      width: portrait ? buttonWidth : Math.min(340, buttonWidth * 1.25),
      height: buttonHeight,
      fontSize: portrait ? fluidValue(16, width, 0.05, 20) : fluidValue(18, height, 0.036, 23),
    }).setName('victory-play-again').setData('victoryContentCta', true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.releaseMission10AudioAfterSceneShutdown());
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}
