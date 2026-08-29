import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { UI_COLORS, UI_FONT } from './visualTheme';

export interface ControlOptions {
  width?: number;
  height?: number;
  fill?: number;
  hoverFill?: number;
  stroke?: number;
  fontSize?: number;
  hitPadding?: number;
}

interface ControlRuntime {
  enabled: boolean;
  pressed: boolean;
  hovered: boolean;
  draw: () => void;
  release: () => void;
}

const CONTROL_RUNTIME_KEY = 'control-runtime';

export function setControlEnabled(control: Phaser.GameObjects.Container, enabled: boolean): void {
  const runtime = control.getData(CONTROL_RUNTIME_KEY) as ControlRuntime | undefined;
  if (!runtime) return;
  runtime.enabled = enabled;
  runtime.pressed = false;
  runtime.hovered = false;
  control.scene.tweens.killTweensOf(control);
  control.setScale(1).setAlpha(enabled ? 1 : 0.42);
  runtime.draw();
}

export function addControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onActivate: () => void,
  options: ControlOptions = {},
): Phaser.GameObjects.Container {
  const width = options.width ?? 160;
  const height = options.height ?? 58;
  const fill = options.fill ?? UI_COLORS.green;
  const hoverFill = options.hoverFill ?? 0x7dcc54;
  const stroke = options.stroke ?? UI_COLORS.greenDark;
  const fontSize = options.fontSize ?? 24;
  const hitPadding = options.hitPadding ?? 4;
  const container = scene.add.container(x, y).setSize(width + hitPadding * 2, height + hitPadding * 2);
  const graphics = scene.add.graphics();
  const text = scene.add.text(0, -1, label, {
    color: '#ffffff', fontFamily: UI_FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', align: 'center',
  }).setOrigin(0.5);
  const runtime: ControlRuntime = {
    enabled: true,
    pressed: false,
    hovered: false,
    draw: () => undefined,
    release: () => undefined,
  };
  const draw = (): void => {
    const color = runtime.pressed ? Phaser.Display.Color.ValueToColor(fill).darken(12).color : (runtime.hovered ? hoverFill : fill);
    graphics.clear();
    graphics.fillStyle(0x1f3650, runtime.pressed ? 0.12 : 0.24)
      .fillRoundedRect(-width / 2 + 2, -height / 2 + (runtime.pressed ? 2 : 5), width, height, 17);
    graphics.fillStyle(color, 1).fillRoundedRect(-width / 2, -height / 2 + (runtime.pressed ? 2 : 0), width, height - (runtime.pressed ? 2 : 0), 17);
    graphics.lineStyle(3, stroke, 1).strokeRoundedRect(-width / 2, -height / 2, width, height, 17);
    graphics.lineStyle(2, 0xffffff, 0.28).strokeRoundedRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 10, 13);
  };
  runtime.draw = draw;
  runtime.release = (): void => {
    if (!runtime.pressed) return;
    runtime.pressed = false;
    draw();
    scene.tweens.killTweensOf(container);
    scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
  };
  draw();
  container.add([graphics, text]).setInteractive();
  container.setData(CONTROL_RUNTIME_KEY, runtime);
  container.on('pointerover', () => {
    if (!runtime.enabled) return;
    runtime.hovered = true;
    draw();
  });
  container.on('pointerout', () => {
    runtime.hovered = false;
    runtime.release();
    draw();
  });
  container.on('pointerdown', () => {
    if (!runtime.enabled || runtime.pressed) return;
    audioManager.registerUserGesture();
    audioManager.playUiClick();
    runtime.pressed = true;
    scene.tweens.killTweensOf(container);
    container.setScale(0.97);
    draw();
    scene.input.once(Phaser.Input.Events.POINTER_UP, runtime.release);
    onActivate();
  });
  container.on('pointerup', runtime.release);
  container.on('pointerupoutside', () => runtime.release());
  return container;
}

export function addIconControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onActivate: () => void,
  color: number = UI_COLORS.purple,
  sizing: Pick<ControlOptions, 'width' | 'height' | 'fontSize'> = {},
): Phaser.GameObjects.Container {
  return addControl(scene, x, y, label, onActivate, {
    width: sizing.width ?? 76, height: sizing.height ?? 52, fill: color,
    hoverFill: color === UI_COLORS.purple ? 0x916ee1 : 0x7dcc54,
    stroke: color === UI_COLORS.purple ? UI_COLORS.purpleDark : UI_COLORS.greenDark,
    fontSize: sizing.fontSize ?? 17,
  });
}
