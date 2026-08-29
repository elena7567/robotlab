import Phaser from 'phaser';
import {
  ROBOT_ASSEMBLY_INSTALL_MESSAGES,
  deriveAssemblyProgress,
  type RobotAssemblyProgress,
} from '../state/robotAssemblyState';
import { RobotAssemblyPreview } from './RobotAssemblyPreview';
import { UI_FONT } from './visualTheme';
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

    this.drawStation();
    const labelBand = Math.max(25, config.height * 0.2);
    const robotArea = {
      x: config.width / 2,
      feetY: config.height - Math.max(9, config.height * 0.07),
      width: config.width - Math.max(24, config.width * 0.16),
      height: config.height - labelBand - Math.max(15, config.height * 0.12),
    };
    const robotScale = Math.min(robotArea.width / ASSEMBLY_DESIGN_WIDTH, robotArea.height / ASSEMBLY_DESIGN_HEIGHT);
    this.assemblyRobot = new RobotAssemblyPreview(scene, robotArea.x, robotArea.feetY, this.value, {
      scale: robotScale,
      blueprintAlpha: 0.024,
    });
    this.assemblyRobot.setName('assembly-progress-robot');
    this.progressLayer.add(this.assemblyRobot);

    this.label = scene.add.text(config.width / 2, Math.max(14, labelBand * 0.53), '', {
      color: '#d7f8ff', fontFamily: UI_FONT, fontSize: `${config.sizing.titleFontSize}px`, fontStyle: 'bold',
      align: 'center', letterSpacing: 1,
    }).setOrigin(0.5).setName('assembly-progress-label');
    this.progressLayer.add(this.label);
    this.syncLabel();
    this.setData({
      assemblyProgress: this.value,
      compact: true,
      animationActive: false,
      panelWidth: config.width,
      panelHeight: config.height,
      released: false,
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

  async playRelease(reducedMotion = false): Promise<void> {
    this.setData({ releaseActive: true, released: false });
    await this.tweenPanel(
      { x: this.x + this.config.width * 0.04, y: this.y - this.config.height * 0.03, scaleX: 0.96, scaleY: 0.96 },
      reducedMotion ? 120 : 520,
      0,
    );
    if (!this.active || !this.scene.sys.isActive()) return;
    this.setVisible(false).setAlpha(0);
    this.setData({ releaseActive: false, released: true });
  }

  private drawStation(): void {
    const { width, height, sizing } = this.config;
    const graphics = this.scene.add.graphics().setName('assembly-progress-station');
    graphics.fillStyle(0x0b1f35, 0.28).fillRoundedRect(5, 7, width, height, sizing.borderRadius);
    graphics.fillStyle(0x102d47, 0.98).fillRoundedRect(0, 0, width, height, sizing.borderRadius);
    graphics.lineStyle(2, 0x58d5e5, 0.72).strokeRoundedRect(0, 0, width, height, sizing.borderRadius);
    graphics.fillStyle(0x173b52, 0.94).fillRoundedRect(8, 8, width - 16, height - 16, Math.max(12, sizing.borderRadius - 6));
    graphics.lineStyle(1, 0x8aebf5, 0.22).strokeRoundedRect(8, 8, width - 16, height - 16, Math.max(12, sizing.borderRadius - 6));
    const labelDividerY = Math.max(28, height * 0.22);
    graphics.lineStyle(1, 0x73e6f2, 0.28).lineBetween(width * 0.18, labelDividerY, width * 0.82, labelDividerY);
    graphics.fillStyle(0x69e4f2, 0.38);
    graphics.fillCircle(18, 18, 2.5).fillCircle(width - 18, 18, 2.5);
    graphics.fillStyle(0x58d5e5, 0.08).fillEllipse(width / 2, height - 12, width * 0.56, Math.max(12, height * 0.09));
    this.progressLayer.add(graphics);
  }

  private syncLabel(): void {
    this.label.setText(`СБОРКА ${this.value}/5`);
    this.fitLabel();
  }

  private fitLabel(): void {
    this.label.setScale(1);
    const maxWidth = this.config.width - 28;
    if (this.label.width > maxWidth) this.label.setScale(maxWidth / this.label.width);
  }

  private tweenPanel(
    targets: { x: number; y: number; scaleX: number; scaleY: number },
    duration: number,
    alpha = 1,
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
      scene.tweens.add({ targets: this, ...targets, alpha, duration, ease: 'Sine.easeInOut', onComplete: () => finish() });
    });
  }
}
