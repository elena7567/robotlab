import Phaser from 'phaser';
import { commandDelta, type GridCell, type ProgrammingChallenge, type ProgrammingStep } from '../mechanics/programming';
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
  private readonly robotCellOffsetY: number;
  private readonly previewLayer: Phaser.GameObjects.Container;
  private hintTile?: Phaser.GameObjects.Rectangle;
  private tutorialTile?: Phaser.GameObjects.Rectangle;
  private previewObjects: Phaser.GameObjects.GameObject[] = [];
  private executionMarker?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, options: ProgrammingBoardOptions) {
    super(scene, options.x, options.y);
    scene.add.existing(this);
    this.setName('programming-board').setSize(options.width, options.height).setData('auditBounds', {
      x: options.x, y: options.y, width: options.width, height: options.height,
    });
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
        const blocked = options.challenge.obstacles.some((cell) => cell.column === column && cell.row === row);
        const tile = scene.add.rectangle(x, y, this.cellSize - 4, this.cellSize - 4, blocked ? 0x4b3040 : ((row + column) % 2 ? 0x164461 : 0x123b58), 0.98)
          .setOrigin(0).setStrokeStyle(2, 0x42cbe1, 0.65).setName(`programming-tile-${column}-${row}`);
        this.add(tile);
        if (blocked) {
          this.add(scene.add.rectangle(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize * 0.86, this.cellSize * 0.86, 0x6f3541, 0.3)
            .setStrokeStyle(Math.max(3, this.cellSize * 0.045), 0xff936f, 0.95).setName(`programming-blocked-tile-${column}-${row}`));
        }
      }
    }

    const start = this.centerOf(options.challenge.start);
    const target = this.centerOf(options.challenge.targetCell);
    const startRing = scene.add.circle(start.x, start.y + this.cellSize * 0.12, this.cellSize * 0.34, 0x4be6ff, 0.12)
      .setStrokeStyle(Math.max(3, this.cellSize * 0.045), 0x8af5ff, 0.98).setName('programming-start-pad');
    const startCore = scene.add.ellipse(start.x, start.y + this.cellSize * 0.3, this.cellSize * 0.64, this.cellSize * 0.2, 0x5cecff, 0.34)
      .setStrokeStyle(2, 0xb9faff, 0.9);
    this.targetGlow = scene.add.rectangle(target.x, target.y, this.cellSize * 0.88, this.cellSize * 0.88, 0x65ffac, 0.24)
      .setStrokeStyle(Math.max(4, this.cellSize * 0.055), 0xc5ff9c, 1).setName('programming-target-pad');
    const targetCore = scene.add.circle(target.x, target.y, this.cellSize * 0.28, 0xbaff65, 0.36)
      .setStrokeStyle(3, 0xf2ff9c, 0.92);
    const targetIcon = scene.add.text(target.x, target.y + this.cellSize * 0.03, '⚡', {
      color: '#f5ff83', fontFamily: UI_FONT, fontSize: `${Math.max(25, this.cellSize * 0.45)}px`, fontStyle: 'bold', stroke: '#376c42', strokeThickness: 3,
    }).setOrigin(0.5).setName('programming-target-icon');
    this.add([startRing, startCore, this.targetGlow, targetCore, targetIcon]);

    this.previewLayer = scene.add.container(0, 0).setName('programming-route-preview');
    this.add(this.previewLayer);

    for (const [index, obstacle] of options.challenge.obstacles.entries()) {
      const point = this.centerOf(obstacle);
      const crate = scene.add.container(point.x, point.y).setName(`programming-obstacle-${index}`);
      crate.add([
        scene.add.rectangle(0, 0, this.cellSize * 0.68, this.cellSize * 0.68, 0xa74c39, 1).setStrokeStyle(4, 0xffb16d, 1),
        scene.add.rectangle(0, 0, this.cellSize * 0.52, Math.max(6, this.cellSize * 0.075), 0x51242a, 0.95).setAngle(42),
        scene.add.rectangle(0, 0, this.cellSize * 0.52, Math.max(6, this.cellSize * 0.075), 0x51242a, 0.95).setAngle(-42),
      ]);
      this.add(crate);
    }

    const robotPoint = this.centerOf(options.robotPosition);
    const measurementScale = 0.1;
    this.robot = new RobotAssemblyPreview(scene, robotPoint.x, robotPoint.y, 5, { scale: measurementScale, blueprintAlpha: 0 })
      .setName('programming-robot');
    this.robot.setPowered(true);
    this.robot.setSystemsConnected(true);
    const measuredBounds = this.robot.getBounds();
    const robotScale = Phaser.Math.Clamp(measurementScale * (this.cellSize * 0.78) / Math.max(1, measuredBounds.height), 0.055, 0.15);
    this.robot.setScale(robotScale);
    const robotBounds = this.robot.getBounds();
    this.robotCellOffsetY = this.cellSize * 0.28 - (robotBounds.bottom - this.robot.y);
    this.robot.setY(robotPoint.y + this.robotCellOffsetY);
    this.robot.setData({
      gridColumn: options.robotPosition.column, gridRow: options.robotPosition.row, groundedScale: robotScale,
      cellCenterX: robotPoint.x, cellCenterY: robotPoint.y, targetColumn: options.challenge.targetCell.column,
      targetRow: options.challenge.targetCell.row, visualScale: robotScale,
      characterRole: 'BOARD_ACTOR', targetCellHeightRatio: 0.78,
      cellSize: this.cellSize,
    });
    this.add(this.robot);
    const labelFont = Math.max(9, Math.min(14, this.cellSize * 0.15));
    const addBadge = (x: number, y: number, text: string, name: string, fill: number, color: string): Phaser.GameObjects.Container => {
      const label = scene.add.text(0, 0, text, { color, fontFamily: UI_FONT, fontSize: `${labelFont}px`, fontStyle: 'bold', stroke: '#102f4b', strokeThickness: 2 }).setOrigin(0.5);
      const badge = scene.add.container(x, y, [
        scene.add.rectangle(0, 0, Math.max(label.width + 12, this.cellSize * 0.58), labelFont + 10, fill, 0.96).setStrokeStyle(2, 0xffffff, 0.72),
        label,
      ]).setName(name);
      this.add(badge);
      return badge;
    };
    addBadge(start.x, start.y - this.cellSize * 0.36, 'СТАРТ', 'programming-start-label', 0x167a94, '#d8fbff');
    addBadge(target.x, target.y - this.cellSize * 0.36, 'ЗАРЯДКА', 'programming-target-label', 0x427a38, '#f1ffb9');
    this.setData({
      columns: options.challenge.columns, rows: options.challenge.rows, cellSize: this.cellSize,
      challengeId: options.challenge.id, maxCommands: options.challenge.maxCommands,
      targetColumn: options.challenge.targetCell.column, targetRow: options.challenge.targetCell.row,
    });
  }

  renderPreview(execution: { readonly steps: readonly ProgrammingStep[]; readonly reachedTarget?: boolean }, dimmed = false): void {
    this.clearPreview();
    const line = this.scene.add.graphics().setName('programming-preview-connectors');
    line.lineStyle(Math.max(7, this.cellSize * 0.1), 0x7df4ff, dimmed ? 0.35 : 0.72);
    this.previewLayer.add(line);
    this.previewObjects.push(line);
    let validCount = 0;
    for (const [index, step] of execution.steps.entries()) {
      const from = this.centerOf(step.from);
      const to = this.centerOf(step.to);
      if (step.collision) {
        const delta = commandDelta(step.command);
        const warningX = from.x + delta.column * this.cellSize * 0.34;
        const warningY = from.y + delta.row * this.cellSize * 0.34;
        const blocked = this.scene.add.container(warningX, warningY).setName(`programming-preview-invalid-${index}`);
        blocked.add([
          this.scene.add.circle(0, 0, this.cellSize * 0.2, 0xd74355, 0.96).setStrokeStyle(4, 0xffd09b, 1),
          this.scene.add.text(0, -1, '×', { color: '#ffffff', fontFamily: UI_FONT, fontSize: `${this.cellSize * 0.3}px`, fontStyle: 'bold' }).setOrigin(0.5),
        ]);
        this.previewLayer.add(blocked); this.previewObjects.push(blocked);
        if (!dimmed) this.scene.tweens.add({ targets: blocked, scale: { from: 0.92, to: 1.08 }, duration: 280, yoyo: true, repeat: 1 });
        break;
      }
      line.beginPath().moveTo(from.x, from.y).lineTo(to.x, to.y).strokePath();
      const cellGlow = this.scene.add.rectangle(to.x, to.y, this.cellSize * 0.78, this.cellSize * 0.78, 0x4eeaff, dimmed ? 0.1 : 0.2)
        .setStrokeStyle(Math.max(3, this.cellSize * 0.04), 0x9cfcff, dimmed ? 0.4 : 0.88).setName(`programming-preview-cell-${index}`);
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const arrow = this.scene.add.text(midX, midY, this.commandGlyph(step.command), {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.max(22, this.cellSize * 0.3)}px`, fontStyle: 'bold', stroke: '#08778f', strokeThickness: 5,
      }).setOrigin(0.5).setName(`programming-preview-arrow-${index}`);
      this.previewLayer.add([cellGlow, arrow]); this.previewObjects.push(cellGlow, arrow);
      validCount += 1;
    }
    const lastStep = execution.steps[Math.max(0, validCount - 1)];
    if (validCount > 0 && lastStep) {
      const endpoint = this.centerOf(lastStep.to);
      const ring = this.scene.add.circle(endpoint.x, endpoint.y, this.cellSize * 0.37, 0x000000, 0)
        .setStrokeStyle(Math.max(4, this.cellSize * 0.055), execution.reachedTarget ? 0x8dff9d : 0xffef75, dimmed ? 0.45 : 1).setName('programming-preview-endpoint');
      this.previewLayer.add(ring); this.previewObjects.push(ring);
    }
    this.previewLayer.setData({ stepCount: execution.steps.length, validCount, invalid: execution.steps.some((step) => Boolean(step.collision)), reachedTarget: Boolean(execution.reachedTarget) });
  }

  setExecutionStep(stepIndex: number): void {
    this.executionMarker?.destroy();
    const cell = this.previewLayer.getByName(`programming-preview-cell-${stepIndex}`) as Phaser.GameObjects.Rectangle | null;
    if (!cell) return;
    this.executionMarker = this.scene.add.rectangle(cell.x, cell.y, this.cellSize * 0.86, this.cellSize * 0.86, 0xfff27c, 0.12)
      .setStrokeStyle(Math.max(4, this.cellSize * 0.06), 0xfff7a1, 1).setName('programming-execution-step');
    this.previewLayer.add(this.executionMarker);
  }

  showTutorialTarget(cell: GridCell, reducedMotion: boolean): void {
    this.clearTutorialTarget();
    const point = this.centerOf(cell);
    this.tutorialTile = this.scene.add.rectangle(point.x, point.y, this.cellSize * 0.82, this.cellSize * 0.82, 0xffef72, 0.08)
      .setStrokeStyle(4, 0xfff39a, 1).setName('programming-tutorial-tile');
    this.addAt(this.tutorialTile, Math.min(2, this.length));
    this.scene.tweens.add({ targets: this.tutorialTile, alpha: { from: 0.24, to: 0.75 }, duration: reducedMotion ? 160 : 420, yoyo: true, repeat: reducedMotion ? 0 : -1 });
  }

  clearTutorialTarget(): void {
    if (!this.tutorialTile) return;
    this.scene.tweens.killTweensOf(this.tutorialTile);
    this.tutorialTile.destroy();
    this.tutorialTile = undefined;
  }

  private clearPreview(): void {
    this.executionMarker?.destroy();
    this.executionMarker = undefined;
    for (const object of this.previewObjects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.previewObjects = [];
    this.previewLayer.removeAll(false).setData({ stepCount: 0, validCount: 0, invalid: false });
  }

  private commandGlyph(command: ProgrammingStep['command']): string {
    return command === 'UP' ? '↑' : command === 'RIGHT' ? '→' : command === 'DOWN' ? '↓' : '←';
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
      y: point.y + this.robotCellOffsetY,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.robot.setData('moving', true),
    }).then(() => {
      if (this.robot.active) this.robot.setData({
        gridColumn: step.to.column, gridRow: step.to.row, cellCenterX: point.x, cellCenterY: point.y, moving: false,
      });
    });
  }

  resetRobot(cell: GridCell, duration: number): Promise<void> {
    const point = this.centerOf(cell);
    return this.runTween({ targets: this.robot, x: point.x, y: point.y + this.robotCellOffsetY, duration, ease: 'Sine.easeInOut' })
      .then(() => { if (this.robot.active) this.robot.setData({
        gridColumn: cell.column, gridRow: cell.row, cellCenterX: point.x, cellCenterY: point.y, moving: false,
      }); });
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
