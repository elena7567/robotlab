import Phaser from 'phaser';
import type { ConnectionResult, ConnectionsSnapshot, WireColor } from '../mechanics/connections';
import { audioManager } from '../audio/AudioManager';
import { UI_COLORS, UI_FONT } from './visualTheme';
import { CHILD_UI } from './childUi';

const COLOR_VALUES: Readonly<Record<WireColor, number>> = {
  red: 0xff5f66,
  blue: 0x53b9ff,
  green: 0x66dc75,
  yellow: 0xffdc55,
};

interface PortView {
  readonly color: WireColor;
  readonly side: 'source' | 'target';
  readonly x: number;
  readonly y: number;
  readonly hitRadius: number;
  readonly container: Phaser.GameObjects.Container;
}

export interface ConnectionTaskCardOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly snapshot: ConnectionsSnapshot;
  readonly onConnect: (source: WireColor, target: WireColor) => ConnectionResult;
  readonly onCancel: () => void;
}

export class ConnectionTaskCard extends Phaser.GameObjects.Container {
  private snapshot: ConnectionsSnapshot;
  private readonly wireLayer: Phaser.GameObjects.Graphics;
  private readonly temporaryWire: Phaser.GameObjects.Graphics;
  private readonly feedback: Phaser.GameObjects.Text;
  private readonly ports = new Map<string, PortView>();
  private activeWire?: { pointerId: number; source: WireColor; x: number; y: number };
  private readonly pointerMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly pointerUp: (pointer: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene, options: ConnectionTaskCardOptions) {
    super(scene, options.x, options.y);
    scene.add.existing(this);
    this.setName('connection-task-card').setSize(options.width, options.height).setDepth(5).setData('auditBounds', {
      x: options.x, y: options.y - 17, width: options.width, height: options.height + 17,
    });
    this.snapshot = options.snapshot;
    const background = scene.add.graphics();
    background.fillStyle(0x173c58, 0.97).fillRoundedRect(0, 0, options.width, options.height, 24);
    background.lineStyle(3, 0x6fe6f5, 0.9).strokeRoundedRect(0, 0, options.width, options.height, 24);
    background.lineStyle(2, 0xffffff, 0.12).strokeRoundedRect(6, 6, options.width - 12, options.height - 12, 19);
    const ribbonWidth = Math.min(options.width - 44, 270);
    const ribbon = scene.add.graphics();
    ribbon.fillStyle(UI_COLORS.purple, 1).fillRoundedRect((options.width - ribbonWidth) / 2, -17, ribbonWidth, 40, 15);
    ribbon.lineStyle(3, UI_COLORS.purpleDark, 1).strokeRoundedRect((options.width - ribbonWidth) / 2, -17, ribbonWidth, 40, 15);
    const task = scene.add.text(options.width / 2, 3, 'ЗАДАНИЕ 7 ИЗ 10', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(18, Math.max(14, options.width * 0.035))}px`, fontStyle: 'bold',
    }).setOrigin(0.5).setName('connection-task-number');
    const title = scene.add.text(options.width / 2, 40, 'ПОДКЛЮЧИ ПРОВОДА', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(25, Math.max(17, options.width * 0.043))}px`, fontStyle: 'bold',
    }).setOrigin(0.5).setName('connection-title');
    const progress = scene.add.text(options.width / 2, 68, `ПОДКЛЮЧЕНИЕ ${this.snapshot.challengeIndex + 1} ИЗ 3`, {
      color: '#8ff4ff', fontFamily: UI_FONT, fontSize: `${Math.min(16, Math.max(CHILD_UI.typography.statusMin, options.width * 0.027))}px`, fontStyle: 'bold',
    }).setOrigin(0.5).setName('connection-progress');
    this.feedback = scene.add.text(options.width / 2, options.height - 20, '', {
      color: '#bdf8ff', fontFamily: UI_FONT, fontSize: `${Math.min(16, Math.max(CHILD_UI.typography.statusMin, options.width * 0.027))}px`, fontStyle: 'bold',
    }).setOrigin(0.5).setName('connection-feedback');
    this.wireLayer = scene.add.graphics().setName('connection-wires');
    this.temporaryWire = scene.add.graphics().setName('connection-temporary-wire');
    this.add([background, ribbon, task, title, progress, this.wireLayer, this.temporaryWire, this.feedback]);
    this.createPorts(options);
    this.redrawWires();
    this.setData({
      challengeIndex: this.snapshot.challengeIndex,
      destinationOrder: [...this.snapshot.destinationOrder],
      connected: [...this.snapshot.connected],
    });

    this.pointerMove = (pointer) => {
      if (!this.activeWire || pointer.id !== this.activeWire.pointerId) return;
      pointer.event?.preventDefault();
      const local = this.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y);
      this.drawTemporary(this.activeWire.x, this.activeWire.y, local.x, local.y, this.activeWire.source);
    };
    this.pointerUp = (pointer) => {
      if (!this.activeWire || pointer.id !== this.activeWire.pointerId) return;
      pointer.event?.preventDefault();
      const active = this.activeWire;
      this.activeWire = undefined;
      const local = this.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y);
      const target = [...this.ports.values()]
        .filter((port) => port.side === 'target' && !this.snapshot.connected.includes(port.color))
        .map((port) => ({ port, distance: Phaser.Math.Distance.Between(local.x, local.y, port.x, port.y) }))
        .filter(({ port, distance }) => distance <= port.hitRadius)
        .sort((a, b) => a.distance - b.distance)[0]?.port;
      if (!target) {
        options.onCancel();
        this.retractTemporary(false);
        return;
      }
      const result = options.onConnect(active.source, target.color);
      if (result === 'wrong') {
        this.drawTemporary(active.x, active.y, target.x, target.y, active.source, 0xff7b7b);
        this.retractTemporary(true);
      } else {
        this.temporaryWire.clear();
      }
    };
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.pointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.pointerUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.pointerUp);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.activeWire = undefined;
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.pointerMove);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.pointerUp);
      scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.pointerUp);
    });
  }

  refresh(snapshot: ConnectionsSnapshot, message = ''): void {
    this.snapshot = snapshot;
    this.feedback.setText(message);
    this.setData({
      challengeIndex: snapshot.challengeIndex,
      destinationOrder: [...snapshot.destinationOrder],
      connected: [...snapshot.connected],
      challengeComplete: snapshot.connected.length === snapshot.challenge.colors.length,
    });
    for (const port of this.ports.values()) {
      const locked = snapshot.connected.includes(port.color);
      port.container.setData('locked', locked).setAlpha(locked ? 0.9 : 1);
      if (locked) port.container.disableInteractive();
    }
    this.redrawWires();
  }

  setInteractionEnabled(enabled: boolean): void {
    if (!enabled) this.activeWire = undefined;
    this.temporaryWire.clear();
    for (const port of this.ports.values()) {
      const locked = this.snapshot.connected.includes(port.color);
      if (enabled && !locked) port.container.setInteractive();
      else port.container.disableInteractive();
    }
  }

  pulseHint(color: WireColor): void {
    const source = this.ports.get(`source-${color}`)?.container;
    const target = this.ports.get(`target-${color}`)?.container;
    if (!source || !target) return;
    this.scene.tweens.killTweensOf([source, target]);
    this.scene.tweens.add({ targets: source, scale: 1.22, duration: 180, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    this.scene.time.delayedCall(420, () => {
      if (target.active) this.scene.tweens.add({ targets: target, scale: 1.22, duration: 180, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    });
  }

  async playCompletionPulse(reducedMotion: boolean): Promise<void> {
    const pulses = this.snapshot.connected.map((color) => {
      const source = this.ports.get(`source-${color}`)!;
      const target = this.ports.get(`target-${color}`)!;
      return { color, source, target, dot: this.scene.add.circle(source.x, source.y, 9, 0xffffff, 0).setBlendMode(Phaser.BlendModes.ADD) };
    });
    pulses.forEach(({ dot }) => this.add(dot));
    await Promise.all(pulses.map(({ color, source, target, dot }, index) => new Promise<void>((resolve) => {
      const curve = this.makeCurve(source.x, source.y, target.x, target.y);
      const progress = { value: 0 };
      this.scene.tweens.add({
        targets: progress,
        value: 1,
        delay: index * (reducedMotion ? 20 : 80),
        duration: reducedMotion ? 220 : 720,
        ease: 'Sine.easeInOut',
        onStart: () => dot.setAlpha(1).setFillStyle(COLOR_VALUES[color]),
        onUpdate: () => { const point = curve.getPoint(progress.value); dot.setPosition(point.x, point.y); },
        onComplete: () => { dot.destroy(); resolve(); },
      });
    })));
  }

  private createPorts(options: ConnectionTaskCardOptions): void {
    const compactness = Phaser.Math.Clamp((options.height - 210) / 120, 0, 1);
    const top = Phaser.Math.Linear(88, 105, compactness);
    const bottom = options.height - Phaser.Math.Linear(34, 48, compactness);
    const rows = this.snapshot.challenge.colors.length;
    const rowGap = rows === 1 ? 0 : (bottom - top) / (rows - 1);
    const hitRadius = Math.max(32, Math.min(38, rowGap * 0.46, options.width * 0.11));
    const sourceX = Math.max(42, options.width * 0.105);
    const targetX = options.width - sourceX;
    const makePort = (color: WireColor, side: 'source' | 'target', x: number, y: number): void => {
      const port = this.scene.add.container(x, y).setName(`connection-${side}-${color}`).setSize(hitRadius * 2, hitRadius * 2);
      const glow = this.scene.add.circle(0, 0, Math.max(16, hitRadius * 0.7), COLOR_VALUES[color], 0.16).setBlendMode(Phaser.BlendModes.ADD);
      const rim = this.scene.add.circle(0, 0, Math.max(13, hitRadius * 0.48), 0x10283d, 1).setStrokeStyle(5, COLOR_VALUES[color], 1);
      const core = this.scene.add.circle(0, 0, Math.max(6, hitRadius * 0.2), COLOR_VALUES[color], 1);
      port.add([glow, rim, core]).setInteractive();
      port.setData({ color, side, hitWidth: hitRadius * 2, hitHeight: hitRadius * 2, locked: false });
      if (side === 'source') {
        port.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
          if (this.activeWire || this.snapshot.connected.includes(color)) return;
          pointer.event?.preventDefault();
          audioManager.registerUserGesture();
          this.activeWire = { pointerId: pointer.id, source: color, x, y };
          this.drawTemporary(x, y, x, y, color);
        });
      }
      this.add(port);
      this.ports.set(`${side}-${color}`, { color, side, x, y, hitRadius, container: port });
    };
    this.snapshot.challenge.colors.forEach((color, index) => {
      const baseY = top + index * rowGap;
      const stagger = this.snapshot.challenge.staggered && index % 2 === 1 ? Math.min(18, rowGap * 0.2) : 0;
      makePort(color, 'source', sourceX, baseY + stagger);
    });
    this.snapshot.destinationOrder.forEach((color, index) => {
      const baseY = top + index * rowGap;
      const stagger = this.snapshot.challenge.staggered && index % 2 === 0 ? Math.min(18, rowGap * 0.2) : 0;
      makePort(color, 'target', targetX, baseY + stagger);
    });
  }

  private makeCurve(x1: number, y1: number, x2: number, y2: number): Phaser.Curves.CubicBezier {
    const bend = Math.min(80, Math.abs(x2 - x1) * 0.24);
    return new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(x1, y1),
      new Phaser.Math.Vector2(x1 + bend, y1),
      new Phaser.Math.Vector2(x2 - bend, y2),
      new Phaser.Math.Vector2(x2, y2),
    );
  }

  private strokeCurve(graphics: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, alpha = 1): void {
    const points = this.makeCurve(x1, y1, x2, y2).getPoints(28);
    graphics.lineStyle(13, color, 0.16 * alpha).strokePoints(points, false, false);
    graphics.lineStyle(6, color, 0.96 * alpha).strokePoints(points, false, false);
    graphics.lineStyle(2, 0xffffff, 0.35 * alpha).strokePoints(points, false, false);
  }

  private redrawWires(): void {
    this.wireLayer.clear();
    for (const color of this.snapshot.connected) {
      const source = this.ports.get(`source-${color}`);
      const target = this.ports.get(`target-${color}`);
      if (source && target) this.strokeCurve(this.wireLayer, source.x, source.y, target.x, target.y, COLOR_VALUES[color]);
    }
  }

  private drawTemporary(x1: number, y1: number, x2: number, y2: number, color: WireColor, override?: number): void {
    this.temporaryWire.clear().setAlpha(1);
    this.strokeCurve(this.temporaryWire, x1, y1, x2, y2, override ?? COLOR_VALUES[color], 0.72);
  }

  private retractTemporary(wrong: boolean): void {
    this.scene.tweens.killTweensOf(this.temporaryWire);
    this.scene.tweens.add({
      targets: this.temporaryWire,
      alpha: 0,
      duration: wrong ? 220 : 140,
      ease: 'Sine.easeOut',
      onComplete: () => this.temporaryWire.clear().setAlpha(1),
    });
  }
}
