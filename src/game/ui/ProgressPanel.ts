import Phaser from 'phaser';
import {
  ROBOT_ASSEMBLY_INSTALL_MESSAGES,
  deriveAssemblyProgress,
  type RobotAssemblyProgress,
} from '../state/robotAssemblyState';
import { RobotAssemblyPreview } from './RobotAssemblyPreview';
import { UI_COLORS, UI_FONT } from './visualTheme';
import type { ProgressSizing } from './responsiveLayout';

export interface ProgressPanelConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  total?: number;
  horizontal?: boolean;
  sizing: ProgressSizing;
}

const ASSEMBLY_DESIGN_HEIGHT = 1260;
const ASSEMBLY_DESIGN_WIDTH = 650;

export class ProgressPanel extends Phaser.GameObjects.Container {
  private readonly progressLayer: Phaser.GameObjects.Container;
  private readonly config: ProgressPanelConfig;
  private readonly label: Phaser.GameObjects.Text;
  private readonly assemblyRobot: RobotAssemblyPreview;
  private value: RobotAssemblyProgress;
  private animationActive = false;

  constructor(scene: Phaser.Scene, config: ProgressPanelConfig) {
    super(scene, config.x, config.y);
    scene.add.existing(this);
    this.setName('progress-panel').setDepth(12);
    this.config = config;
    this.value = deriveAssemblyProgress(config.value);
    this.progressLayer = scene.add.container(0, 0).setName('assembly-progress-layer');
    this.add(this.progressLayer);

    const horizontal = config.horizontal ?? false;
    this.drawStation(horizontal);
    const robotArea = horizontal
      ? { x: config.width - Math.max(34, config.height * 0.62), feetY: config.height - 6, width: Math.max(48, config.height * 1.25), height: config.height - 9 }
      : { x: config.width / 2, feetY: config.height - 17, width: config.width - 18, height: config.height - 62 };
    const robotScale = Math.min(robotArea.width / ASSEMBLY_DESIGN_WIDTH, robotArea.height / ASSEMBLY_DESIGN_HEIGHT);
    this.assemblyRobot = new RobotAssemblyPreview(scene, robotArea.x, robotArea.feetY, this.value, {
      scale: robotScale,
      blueprintAlpha: 0.055,
    });
    this.assemblyRobot.setName('assembly-progress-robot');
    this.progressLayer.add(this.assemblyRobot);

    this.label = scene.add.text(horizontal ? 12 : config.width / 2, horizontal ? config.height / 2 : 27, '', {
      color: '#243548', fontFamily: UI_FONT, fontSize: `${config.sizing.titleFontSize}px`, fontStyle: 'bold',
      align: horizontal ? 'left' : 'center',
    }).setOrigin(horizontal ? 0 : 0.5, 0.5).setName('assembly-progress-label');
    this.progressLayer.add(this.label);
    this.syncLabel();
    this.setData({
      assemblyProgress: this.value,
      compact: true,
      animationActive: false,
      panelWidth: config.width,
      panelHeight: config.height,
    });
  }

  setValue(value: number): void {
    this.value = deriveAssemblyProgress(value);
    this.assemblyRobot.setAssemblyState(this.value);
    this.syncLabel();
    this.setData('assemblyProgress', this.value);
  }

  async playInstall(previousValue: number, nextValue: number, reducedMotion = false): Promise<void> {
    if (this.animationActive) return;
    const previous = deriveAssemblyProgress(previousValue);
    const next = deriveAssemblyProgress(nextValue);
    if (next === 0 || next <= previous) {
      this.setValue(next);
      return;
    }
    this.animationActive = true;
    this.value = next;
    this.setData({ animationActive: true, installingProgress: next });
    this.label.setText(ROBOT_ASSEMBLY_INSTALL_MESSAGES[next]);
    this.fitLabel();

    const base = { x: this.x, y: this.y, scale: this.scaleX };
    const focusScale = reducedMotion ? 1.04 : (this.config.horizontal ? 1.14 : 1.1);
    const focusX = this.config.horizontal
      ? base.x - this.config.width * (focusScale - 1) / 2
      : base.x - this.config.width * (focusScale - 1);
    const focusY = base.y - this.config.height * (focusScale - 1) / 2;
    await this.tweenPanel({ x: focusX, y: focusY, scaleX: focusScale, scaleY: focusScale }, reducedMotion ? 90 : 220);
    if (!this.active || !this.scene.sys.isActive()) return;
    await this.assemblyRobot.playInstall(previous, next as Exclude<RobotAssemblyProgress, 0>, reducedMotion);
    if (!this.active || !this.scene.sys.isActive()) return;
    await this.tweenPanel({ x: base.x, y: base.y, scaleX: base.scale, scaleY: base.scale }, reducedMotion ? 90 : 240);
    if (!this.active || !this.scene.sys.isActive()) return;
    this.syncLabel();
    this.animationActive = false;
    this.setData({ assemblyProgress: next, animationActive: false, installingProgress: null });
  }

  private drawStation(horizontal: boolean): void {
    const { width, height, sizing } = this.config;
    const graphics = this.scene.add.graphics().setName('assembly-progress-station');
    graphics.fillStyle(0x26364b, 0.2).fillRoundedRect(5, 7, width, height, sizing.borderRadius);
    graphics.fillStyle(UI_COLORS.cream, 0.97).fillRoundedRect(0, 0, width, height, sizing.borderRadius);
    graphics.lineStyle(3, UI_COLORS.creamEdge, 1).strokeRoundedRect(0, 0, width, height, sizing.borderRadius);
    const stationLeft = horizontal ? width - Math.max(72, height * 1.35) : 8;
    const stationTop = horizontal ? 5 : 48;
    graphics.fillStyle(0x173b52, 0.94).fillRoundedRect(stationLeft, stationTop, width - stationLeft - 5, height - stationTop - 5, 12);
    graphics.lineStyle(2, 0x52cede, 0.75).strokeRoundedRect(stationLeft, stationTop, width - stationLeft - 5, height - stationTop - 5, 12);
    graphics.lineStyle(1, 0x8df2ff, 0.32);
    graphics.lineBetween(stationLeft + 8, stationTop + 8, width - 12, height - 10);
    graphics.lineBetween(width - 12, stationTop + 8, stationLeft + 8, height - 10);
    this.progressLayer.add(graphics);
  }

  private syncLabel(): void {
    this.label.setText(`СБОРКА ${this.value}/5`);
    this.fitLabel();
  }

  private fitLabel(): void {
    this.label.setScale(1);
    const horizontal = this.config.horizontal ?? false;
    const maxWidth = horizontal
      ? this.config.width - Math.max(92, this.config.height * 1.55)
      : this.config.width - 14;
    if (this.label.width > maxWidth) this.label.setScale(maxWidth / this.label.width);
  }

  private tweenPanel(
    targets: { x: number; y: number; scaleX: number; scaleY: number },
    duration: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const scene = this.scene;
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
        resolve();
      };
      const cancel = (): void => {
        scene.tweens.killTweensOf(this);
        finish();
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
      scene.tweens.add({ targets: this, ...targets, duration, ease: 'Sine.easeInOut', onComplete: () => finish() });
    });
  }
}
