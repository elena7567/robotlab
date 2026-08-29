import Phaser from 'phaser';
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

export class ProgressPanel extends Phaser.GameObjects.Container {
  private readonly progressLayer: Phaser.GameObjects.Container;
  private readonly config: ProgressPanelConfig;

  constructor(scene: Phaser.Scene, config: ProgressPanelConfig) {
    super(scene, config.x, config.y);
    scene.add.existing(this);
    this.setName('progress-panel');
    this.config = config;
    this.progressLayer = scene.add.container(0, 0);
    this.add(this.progressLayer);
    this.draw(config.value);
  }

  setValue(value: number): void {
    this.draw(value);
  }

  private draw(value: number): void {
    this.progressLayer.removeAll(true);
    const scene = this.scene;
    const config = this.config;
    const total = config.total ?? 5;
    const horizontal = config.horizontal ?? false;
    const graphics = scene.add.graphics();
    const sizing = config.sizing;
    graphics.fillStyle(0x26364b, 0.2).fillRoundedRect(5, 7, config.width, config.height, sizing.borderRadius);
    graphics.fillStyle(UI_COLORS.cream, 0.97).fillRoundedRect(0, 0, config.width, config.height, sizing.borderRadius);
    graphics.lineStyle(3, UI_COLORS.creamEdge, 1).strokeRoundedRect(0, 0, config.width, config.height, sizing.borderRadius);
    this.progressLayer.add(graphics);

    const horizontalTitleWidth = horizontal ? Math.min(96, config.width * 0.25) : 0;
    this.progressLayer.add(scene.add.text(horizontal ? 12 : config.width / 2, horizontal ? config.height / 2 : 31, 'РЕМОНТ', {
      color: '#243548', fontFamily: UI_FONT, fontSize: `${sizing.titleFontSize}px`, fontStyle: 'bold',
    }).setOrigin(horizontal ? 0 : 0.5, 0.5).setName('repair-title'));

    for (let index = 0; index < total; index += 1) {
      const active = index < value;
      const radius = sizing.stepRadius;
      const horizontalStart = horizontalTitleWidth + 10 + radius;
      const horizontalEnd = config.width - 12 - radius;
      const x = horizontal
        ? horizontalStart + index * ((horizontalEnd - horizontalStart) / Math.max(1, total - 1))
        : config.width / 2;
      const verticalStart = 58 + radius;
      const verticalEnd = config.height - 28 - radius;
      const y = horizontal ? config.height / 2 : verticalStart + index * ((verticalEnd - verticalStart) / Math.max(1, total - 1));
      const step = scene.add.graphics().setName(active ? 'repair-indicator-complete' : 'repair-indicator-pending');
      step.fillStyle(active ? UI_COLORS.cyan : 0xd6d4ce, 1).fillCircle(x, y, radius);
      step.lineStyle(3, active ? 0x238da3 : 0xaaa9a4, 1).strokeCircle(x, y, radius);
      if (active) {
        step.lineStyle(4, 0xffffff, 1).beginPath().moveTo(x - 8, y).lineTo(x - 2, y + 7).lineTo(x + 10, y - 8).strokePath();
      } else {
        step.fillStyle(0x8b8d8e, 1).fillCircle(x, y, Math.max(4, radius * 0.28));
      }
      this.progressLayer.add(step);
    }
  }
}
