import Phaser from 'phaser';
import type { BatteryLevel, EnergyResult, EnergySnapshot } from '../mechanics/energy';
import { addControl, setControlEnabled } from './controls';
import type { TaskCardSizing } from './responsiveLayout';
import { UI_COLORS, UI_FONT } from './visualTheme';

export interface EnergyTaskCardConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly sizing: TaskCardSizing;
  readonly snapshot: EnergySnapshot;
  readonly onSelect: (level: BatteryLevel) => void;
  readonly onOrder: (level: BatteryLevel) => void;
  readonly onCheck: () => EnergyResult;
  readonly onHint: () => BatteryLevel;
}

interface BatteryView {
  readonly container: Phaser.GameObjects.Container;
  readonly frame: Phaser.GameObjects.Graphics;
  readonly fill: Phaser.GameObjects.Rectangle;
}

const LEVELS: readonly BatteryLevel[] = ['low', 'medium', 'full'];
const FILL: Readonly<Record<BatteryLevel, number>> = { low: 0.2, medium: 0.55, full: 1 };
const FILL_COLOR: Readonly<Record<BatteryLevel, number>> = { low: 0xffb84d, medium: 0xffdd67, full: 0x71dd75 };
const LEVEL_GLYPH: Readonly<Record<BatteryLevel, string>> = { low: '▂', medium: '▅', full: '█' };

export class EnergyTaskCard extends Phaser.GameObjects.Container {
  private readonly views = new Map<BatteryLevel, BatteryView>();
  private readonly orderLabels: Phaser.GameObjects.Text[] = [];
  private readonly feedback: Phaser.GameObjects.Text;
  private readonly checkButton: Phaser.GameObjects.Container;
  private locked = false;
  private snapshot: EnergySnapshot;

  constructor(scene: Phaser.Scene, config: EnergyTaskCardConfig) {
    super(scene, config.x, config.y);
    scene.add.existing(this);
    this.setName('energy-task-card');
    this.snapshot = config.snapshot;
    const { sizing } = config;
    const body = scene.add.graphics();
    body.fillStyle(0x253550, 0.22).fillRoundedRect(5, 8, config.width, config.height, sizing.radius);
    body.fillStyle(UI_COLORS.cream, 0.985).fillRoundedRect(0, 0, config.width, config.height, sizing.radius);
    body.lineStyle(4, UI_COLORS.purple, 1).strokeRoundedRect(0, 0, config.width, config.height, sizing.radius);
    const ribbonY = -sizing.ribbonHeight / 2;
    body.fillStyle(UI_COLORS.purple, 1).fillRoundedRect((config.width - sizing.ribbonWidth) / 2, ribbonY, sizing.ribbonWidth, sizing.ribbonHeight, 14);
    body.lineStyle(2, UI_COLORS.purpleDark, 1).strokeRoundedRect((config.width - sizing.ribbonWidth) / 2, ribbonY, sizing.ribbonWidth, sizing.ribbonHeight, 14);
    this.add(body);
    this.add(scene.add.text(config.width / 2, 1, 'ЗАДАНИЕ 6 ИЗ 10', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${sizing.taskFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0.5).setName('energy-task-label'));
    this.add(scene.add.text(config.width / 2, sizing.titleY, 'ЗАРЯДИ РОБОТА', {
      color: '#243548', fontFamily: UI_FONT, fontSize: `${sizing.titleFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setName('energy-title'));
    const instructionY = sizing.instructionY;
    const instruction = scene.add.text(config.width / 2, instructionY, config.snapshot.challenge.instruction, {
      color: '#425166', fontFamily: UI_FONT, fontSize: `${sizing.instructionFontSize}px`, fontStyle: 'bold',
      align: 'center', wordWrap: { width: config.width - 26 },
    }).setOrigin(0.5, 0).setName('energy-instruction');
    this.add(instruction);

    const compact = config.height < 260;
    const actionHeight = Math.min(sizing.actionHeight, compact ? 44 : 54);
    const footerY = config.height - actionHeight / 2 - (compact ? 8 : 14);
    const feedbackY = footerY - actionHeight / 2 - (compact ? 6 : 11);
    const areaTop = Math.max(sizing.areaTop, instructionY + instruction.height + 4);
    const areaBottom = feedbackY - sizing.feedbackFontSize - 3;
    const areaHeight = Math.max(48, areaBottom - areaTop);
    const contentWidth = config.width - sizing.horizontalPadding * 2;
    const gap = Math.max(5, Math.min(12, sizing.cellGap));
    const cardWidth = Math.max(62, Math.min(104, (contentWidth - gap * 2) / 3));
    const cardHeight = Math.max(50, Math.min(compact ? 61 : 92, areaHeight - (config.snapshot.challenge.kind === 'order' ? 22 : 0)));
    const rowWidth = cardWidth * 3 + gap * 2;
    const rowX = config.width / 2 - rowWidth / 2;
    const orderY = areaTop + 9;
    const cardY = config.snapshot.challenge.kind === 'order'
      ? areaTop + 22 + cardHeight / 2
      : areaTop + areaHeight / 2;

    if (config.snapshot.challenge.kind === 'order') {
      for (let index = 0; index < 3; index += 1) {
        const x = rowX + index * (cardWidth + gap) + cardWidth / 2;
        const slot = scene.add.text(x, orderY, `${index + 1}: —`, {
          color: '#7659bb', fontFamily: UI_FONT, fontSize: `${Math.max(11, sizing.feedbackFontSize)}px`, fontStyle: 'bold',
        }).setOrigin(0.5).setName(`energy-order-slot-${index + 1}`);
        this.orderLabels.push(slot);
        this.add(slot);
      }
    }

    LEVELS.forEach((level, index) => {
      const x = rowX + index * (cardWidth + gap) + cardWidth / 2;
      const view = this.createBattery(level, x, cardY, cardWidth, cardHeight);
      view.container.on('pointerdown', () => {
        if (this.locked) return;
        config.snapshot.challenge.kind === 'order' ? config.onOrder(level) : config.onSelect(level);
        this.snapshot = { ...this.snapshot,
          selection: config.snapshot.challenge.kind === 'select' ? level : this.snapshot.selection,
          order: config.snapshot.challenge.kind === 'order'
            ? (this.snapshot.order.includes(level) ? this.snapshot.order.filter((item) => item !== level) : [...this.snapshot.order, level])
            : this.snapshot.order,
          result: 'idle',
        };
        this.redraw();
      });
    });

    this.feedback = scene.add.text(config.width / 2, feedbackY, `ЭНЕРГИЯ ${config.snapshot.challengeIndex + 1} ИЗ 3`, {
      color: '#58697b', fontFamily: UI_FONT, fontSize: `${sizing.feedbackFontSize}px`, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setName('energy-progress');
    this.add(this.feedback);
    const buttonGap = Math.max(7, sizing.actionGap);
    const buttonWidth = Math.min(168, (config.width - sizing.horizontalPadding * 2 - buttonGap) / 2);
    const hintButton = addControl(scene, buttonWidth / 2 + sizing.horizontalPadding, footerY, 'ПОДСКАЗКА', () => {
      if (this.locked) return;
      const level = config.onHint();
      this.pulse(level);
    }, { width: buttonWidth, height: actionHeight, fontSize: Math.min(16, sizing.actionFontSize), fill: UI_COLORS.purple,
      hoverFill: 0x916ee1, stroke: UI_COLORS.purpleDark }).setName('energy-hint-button');
    this.add(hintButton);
    this.checkButton = addControl(scene, config.width - sizing.horizontalPadding - buttonWidth / 2, footerY, 'ПРОВЕРИТЬ', () => {
      if (this.locked) return;
      const result = config.onCheck();
      if (result === 'idle') {
        this.feedback.setText(config.snapshot.challenge.kind === 'order' ? 'ВЫБЕРИ ТРИ БАТАРЕИ' : 'ВЫБЕРИ БАТАРЕЮ');
        return;
      }
      if (result === 'correct') {
        this.locked = true;
        setControlEnabled(this.checkButton, false);
        this.feedback.setColor('#2d873d').setText('ОТЛИЧНО!');
      } else {
        this.snapshot = { ...this.snapshot, selection: null, order: [], result: 'wrong' };
        this.feedback.setColor('#a45a32').setText('ПОПРОБУЙ ЕЩЁ');
        this.redraw();
      }
    }, { width: buttonWidth, height: actionHeight, fontSize: Math.min(16, sizing.actionFontSize) }).setName('energy-check-button');
    this.add(this.checkButton);
    this.redraw();
    this.setData({ challengeIndex: config.snapshot.challengeIndex, challengeKind: config.snapshot.challenge.kind });
  }

  private createBattery(level: BatteryLevel, x: number, y: number, width: number, height: number): BatteryView {
    const container = this.scene.add.container(x, y).setName(`energy-battery-${level}`).setSize(width, Math.max(56, height)).setInteractive();
    const frame = this.scene.add.graphics();
    const batteryWidth = Math.min(width - 18, height * 0.74);
    const batteryHeight = Math.min(height - 8, batteryWidth * 1.18);
    const terminalHeight = Math.max(4, batteryHeight * 0.09);
    const bodyTop = -batteryHeight / 2 + terminalHeight;
    frame.fillStyle(0xf8fbf4, 1).fillRoundedRect(-batteryWidth / 2, bodyTop, batteryWidth, batteryHeight - terminalHeight, 8);
    frame.lineStyle(3, 0x4c5d6d, 1).strokeRoundedRect(-batteryWidth / 2, bodyTop, batteryWidth, batteryHeight - terminalHeight, 8);
    frame.fillStyle(0x4c5d6d, 1).fillRoundedRect(-batteryWidth * 0.22, -batteryHeight / 2, batteryWidth * 0.44, terminalHeight + 3, 3);
    const innerHeight = batteryHeight - terminalHeight - 10;
    const fillHeight = innerHeight * FILL[level];
    const fill = this.scene.add.rectangle(0, bodyTop + batteryHeight - terminalHeight - 5, batteryWidth - 10, fillHeight, FILL_COLOR[level])
      .setOrigin(0.5, 1).setName(`energy-fill-${level}`);
    container.add([frame, fill]);
    this.add(container);
    const view = { container, frame, fill };
    this.views.set(level, view);
    return view;
  }

  private redraw(): void {
    for (const [level, view] of this.views) {
      const selected = this.snapshot.challenge.kind === 'select'
        ? this.snapshot.selection === level
        : this.snapshot.order.includes(level);
      view.container.setScale(selected ? 1.06 : 1).setAlpha(selected ? 1 : 0.86);
      view.frame.lineStyle(selected ? 5 : 0, selected ? UI_COLORS.purple : 0, 1)
        .strokeRoundedRect(-view.container.width / 2 + 2, -view.container.height / 2 + 2,
          view.container.width - 4, view.container.height - 4, 12);
    }
    this.orderLabels.forEach((label, index) => {
      const level = this.snapshot.order[index];
      label.setText(`${index + 1}: ${level ? LEVEL_GLYPH[level] : '—'}`);
    });
  }

  private pulse(level: BatteryLevel): void {
    const fill = this.views.get(level)?.fill;
    if (!fill) return;
    this.scene.tweens.killTweensOf(fill);
    this.scene.tweens.add({ targets: fill, alpha: 0.25, scaleX: 1.16, duration: 180, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
  }
}
