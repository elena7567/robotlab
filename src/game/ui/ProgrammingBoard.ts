import Phaser from 'phaser';
import type { GridCell, ProgrammingChallenge, ProgrammingStep } from '../mechanics/programming';
import { RobotAssemblyPreview } from './RobotAssemblyPreview';
import { UI_FONT } from './visualTheme';

export interface ProgrammingBoardOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly challenge: ProgrammingChallenge;
  readonly robotPosition: GridCell;
}

export class ProgrammingBoard extends Phaser.GameObjects.Container {
  readonly robot: RobotAssemblyPreview;
  private readonly cellSize: number;
  private readonly gridLeft: number;
  private readonly gridTop: number;
  private readonly targetGlow: Phaser.GameObjects.Rectangle;
  private hintTile?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, options: ProgrammingBoardOptions) {
    super(scene, options.x, options.y);
    scene.add.existing(this);
    this.setName('programming-board').setSize(options.width, options.height);
    const innerWidth = options.width - 24;
    const innerHeight = options.height - 24;
    this.cellSize = Math.floor(Math.min(innerWidth / options.challenge.columns, innerHeight / options.challenge.rows));
    const gridWidth = this.cellSize * options.challenge.columns;
    const gridHeight = this.cellSize * options.challenge.rows;
    this.gridLeft = (options.width - gridWidth) / 2;
    this.gridTop = (options.height - gridHeight) / 2;

    const panel = scene.add.graphics();
    panel.fillStyle(0x102f4b, 0.97).fillRoundedRect(0, 0, options.width, options.height, 20)
      .lineStyle(3, 0x65dff2, 0.92).strokeRoundedRect(0, 0, options.width, options.height, 20);
    this.add(panel);

    for (let row = 0; row < options.challenge.rows; row += 1) {
      for (let column = 0; column < options.challenge.columns; column += 1) {
        const x = this.gridLeft + column * this.cellSize;
        const y = this.gridTop + row * this.cellSize;
        const tile = scene.add.rectangle(x, y, this.cellSize - 4, this.cellSize - 4, (row + column) % 2 ? 0x164461 : 0x123b58, 0.98)
          .setOrigin(0).setStrokeStyle(2, 0x42cbe1, 0.65).setName(`programming-tile-${column}-${row}`);
        this.add(tile);
      }
    }

    const start = this.centerOf(options.challenge.start);
    const target = this.centerOf(options.challenge.target);
    const startPad = scene.add.rectangle(start.x, start.y, this.cellSize * 0.7, this.cellSize * 0.7, 0x56d9ed, 0.18)
      .setStrokeStyle(3, 0x72ecff, 0.92).setName('programming-start-pad');
    const startLabel = scene.add.text(start.x, start.y + this.cellSize * 0.32, 'СТАРТ', {
      color: '#a9f8ff', fontFamily: UI_FONT, fontSize: `${Math.max(8, Math.min(12, this.cellSize * 0.16))}px`, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.targetGlow = scene.add.rectangle(target.x, target.y, this.cellSize * 0.74, this.cellSize * 0.74, 0x7affb5, 0.22)
      .setStrokeStyle(4, 0xb9ffd5, 1).setName('programming-target-pad');
    const targetIcon = scene.add.text(target.x, target.y, '⚡', {
      color: '#e9ff89', fontFamily: UI_FONT, fontSize: `${Math.max(22, this.cellSize * 0.42)}px`, fontStyle: 'bold',
    }).setOrigin(0.5).setName('programming-target-icon');
    this.add([startPad, startLabel, this.targetGlow, targetIcon]);

    for (const [index, obstacle] of options.challenge.obstacles.entries()) {
      const point = this.centerOf(obstacle);
      const crate = scene.add.container(point.x, point.y).setName(`programming-obstacle-${index}`);
      crate.add([
        scene.add.rectangle(0, 0, this.cellSize * 0.62, this.cellSize * 0.62, 0xa75c36, 1).setStrokeStyle(3, 0xffb16d, 0.9),
        scene.add.rectangle(0, 0, this.cellSize * 0.46, 5, 0x5b2f27, 0.9).setAngle(35),
        scene.add.rectangle(0, 0, this.cellSize * 0.46, 5, 0x5b2f27, 0.9).setAngle(-35),
      ]);
      this.add(crate);
    }

    const robotPoint = this.centerOf(options.robotPosition);
    const robotScale = Math.max(0.038, Math.min(0.075, this.cellSize / 1420));
    this.robot = new RobotAssemblyPreview(scene, robotPoint.x, robotPoint.y + this.cellSize * 0.42, 5, { scale: robotScale, blueprintAlpha: 0 })
      .setName('programming-robot');
    this.robot.setPowered(true);
    this.robot.setSystemsConnected(true);
    this.robot.setData({ gridColumn: options.robotPosition.column, gridRow: options.robotPosition.row, groundedScale: robotScale });
    this.add(this.robot);
    this.setData({
      columns: options.challenge.columns, rows: options.challenge.rows, cellSize: this.cellSize,
      challengeId: options.challenge.id, maxCommands: options.challenge.maxCommands,
    });
  }

  centerOf(cell: GridCell): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.gridLeft + (cell.column + 0.5) * this.cellSize,
      this.gridTop + (cell.row + 0.5) * this.cellSize,
    );
  }

  moveRobot(step: ProgrammingStep, duration: number): Promise<void> {
    const point = this.centerOf(step.to);
    if (step.collision) return this.bumpRobot(step.command, duration);
    return this.runTween({
      targets: this.robot,
      x: point.x,
      y: point.y + this.cellSize * 0.42,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.robot.setData('moving', true),
    }).then(() => {
      if (this.robot.active) this.robot.setData({ gridColumn: step.to.column, gridRow: step.to.row, moving: false });
    });
  }

  resetRobot(cell: GridCell, duration: number): Promise<void> {
    const point = this.centerOf(cell);
    return this.runTween({ targets: this.robot, x: point.x, y: point.y + this.cellSize * 0.42, duration, ease: 'Sine.easeInOut' })
      .then(() => { if (this.robot.active) this.robot.setData({ gridColumn: cell.column, gridRow: cell.row, moving: false }); });
  }

  pulseHint(cell: GridCell, reducedMotion: boolean): void {
    this.hintTile?.destroy();
    const point = this.centerOf(cell);
    this.hintTile = this.scene.add.rectangle(point.x, point.y, this.cellSize * 0.82, this.cellSize * 0.82, 0xffe873, 0.08)
      .setStrokeStyle(4, 0xffef82, 1).setName('programming-hint-tile');
    this.addAt(this.hintTile, 1);
    this.scene.tweens.add({
      targets: this.hintTile, alpha: { from: 0.2, to: 0.75 },
      duration: reducedMotion ? 160 : 360, yoyo: true, repeat: reducedMotion ? 0 : 2,
      onComplete: () => { this.hintTile?.destroy(); this.hintTile = undefined; },
    });
  }

  pulseTarget(reducedMotion: boolean): Promise<void> {
    return this.runTween({
      targets: this.targetGlow,
      scaleX: { from: 1, to: 1.12 }, scaleY: { from: 1, to: 1.12 },
      alpha: { from: 0.72, to: 1 }, duration: reducedMotion ? 160 : 330, yoyo: true, repeat: reducedMotion ? 0 : 1,
      ease: 'Sine.easeInOut',
    }).then(() => { if (this.targetGlow.active) this.targetGlow.setScale(1).setAlpha(1); });
  }

  private bumpRobot(command: ProgrammingStep['command'], duration: number): Promise<void> {
    const dx = command === 'RIGHT' ? this.cellSize * 0.12 : command === 'LEFT' ? -this.cellSize * 0.12 : 0;
    const dy = command === 'DOWN' ? this.cellSize * 0.12 : command === 'UP' ? -this.cellSize * 0.12 : 0;
    return this.runTween({ targets: this.robot, x: this.robot.x + dx, y: this.robot.y + dy, duration: duration / 2, yoyo: true, ease: 'Sine.easeOut' });
  }

  private runTween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      const scene = this.scene;
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
        resolve();
      };
      const cancel = (): void => { scene.tweens.killTweensOf(config.targets); finish(); };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
      scene.tweens.add({ ...config, onComplete: finish });
    });
  }
}
