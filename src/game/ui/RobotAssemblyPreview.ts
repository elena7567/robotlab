import Phaser from 'phaser';
import {
  ROBOT_ASSEMBLY_NEW_PARTS,
  ROBOT_ASSEMBLY_PARTS_BY_PROGRESS,
  type RobotAssemblyPart,
  type RobotAssemblyProgress,
} from '../state/robotAssemblyState';

export type RobotAssemblyState = RobotAssemblyProgress;
type AssemblyPartName = RobotAssemblyPart;

interface AssemblyPartLayout {
  readonly texture: string;
  readonly x: number;
  readonly y: number;
  readonly originX: number;
  readonly originY: number;
  readonly scale: number;
  readonly angle?: number;
}

// Dedicated static assembly layout, measured against the opaque pixels in the
// approved modular sources. It intentionally does not inherit RobotActor poses.
const ASSEMBLY_LAYOUT: Readonly<Record<AssemblyPartName, AssemblyPartLayout>> = {
  legLeft: { texture: 'robot-part-leg-left', x: -142, y: -365, originX: 0.481, originY: 0.024, scale: 0.27 },
  legRight: { texture: 'robot-part-leg-right', x: 142, y: -365, originX: 0.49, originY: 0.04, scale: 0.29 },
  armRight: { texture: 'robot-part-arm-right', x: -266.64, y: -583.88, originX: 1006 / 1254, originY: 183 / 1254, scale: 0.4, angle: 4 },
  armLeft: { texture: 'robot-part-arm-left', x: 266.64, y: -583.88, originX: 277 / 1254, originY: 183 / 1254, scale: 0.4, angle: -4 },
  body: { texture: 'robot-part-body', x: 0, y: -770, originX: 0.5, originY: 0.082, scale: 0.44 },
  head: { texture: 'robot-part-head', x: 0, y: -765, originX: 0.5, originY: 0.869, scale: 0.52 },
  antenna: { texture: 'robot-part-antenna', x: 0, y: -1220, originX: 0.5, originY: 0.951, scale: 0.14 },
};

const DRAW_ORDER: readonly AssemblyPartName[] = [
  'legLeft', 'legRight', 'armRight', 'armLeft', 'body', 'head', 'antenna',
];

export const ASSEMBLY_PREVIEW_SCALE = 0.16;
export const ASSEMBLY_COMPLETE_PREVIEW_SCALE = ASSEMBLY_PREVIEW_SCALE * 1.12;
export const HELPER_ROBOT_CANONICAL_SCALE = 0.2520718;
export const ASSEMBLY_TO_HELPER_SCALE = ASSEMBLY_PREVIEW_SCALE / HELPER_ROBOT_CANONICAL_SCALE;

export interface RobotAssemblyPreviewOptions {
  readonly scale?: number;
  readonly blueprintAlpha?: number;
}

export class RobotAssemblyPreview extends Phaser.GameObjects.Container {
  private readonly silhouetteParts = new Map<AssemblyPartName, Phaser.GameObjects.Image>();
  private readonly installedParts = new Map<AssemblyPartName, Phaser.GameObjects.Image>();
  private assemblyState: RobotAssemblyState = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    state: RobotAssemblyState,
    options: RobotAssemblyPreviewOptions = {},
  ) {
    super(scene, x, feetY);
    scene.add.existing(this);
    this.setName('assembly-robot');
    const previewScale = options.scale ?? (state === 5 ? ASSEMBLY_COMPLETE_PREVIEW_SCALE : ASSEMBLY_PREVIEW_SCALE);
    this.setScale(previewScale);

    for (const name of DRAW_ORDER) {
      const ghost = this.createPart(name, 'assembly-blueprint')
        .setTint(0x6bbbd0)
        .setAlpha(options.blueprintAlpha ?? 0.024)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.silhouetteParts.set(name, ghost);
    }
    for (const name of DRAW_ORDER) {
      const installed = this.createPart(name, 'assembly-installed');
      this.installedParts.set(name, installed);
    }

    this.setAssemblyState(state);
    this.setData({
      previewScale,
      helperScale: HELPER_ROBOT_CANONICAL_SCALE,
      scaleRatio: previewScale / HELPER_ROBOT_CANONICAL_SCALE,
      feetContactX: x,
      feetContactY: feetY,
      headCenterX: 0,
      bodyCenterX: 0,
      antennaCenterX: 0,
      shoulderLeftX: -266.64,
      shoulderRightX: 266.64,
    });
  }

  setAssemblyState(state: RobotAssemblyState): void {
    this.assemblyState = state;
    const installed = new Set(ROBOT_ASSEMBLY_PARTS_BY_PROGRESS[state]);
    for (const [name, part] of this.installedParts) part.setVisible(installed.has(name));
    this.setData('assemblyState', state);
    this.setData('installedParts', [...installed]);
  }

  get currentAssemblyState(): RobotAssemblyState {
    return this.assemblyState;
  }

  async playInstall(
    previousState: RobotAssemblyState,
    nextState: Exclude<RobotAssemblyState, 0>,
    reducedMotion = false,
  ): Promise<void> {
    this.setAssemblyState(previousState);
    const names = ROBOT_ASSEMBLY_NEW_PARTS[nextState];
    const parts = names.map((name) => this.installedParts.get(name)).filter(Boolean) as Phaser.GameObjects.Image[];
    const startOffset = reducedMotion ? -38 : -120;
    for (const part of parts) {
      const layout = ASSEMBLY_LAYOUT[part.getData('assemblyPart') as AssemblyPartName];
      part.setVisible(true).setAlpha(0).setY(layout.y + startOffset).setScale(layout.scale * 0.85);
    }
    this.setData({ installAnimationActive: true, installingParts: names, activationActive: false });

    await Promise.all(parts.map(async (part, index): Promise<void> => {
      const name = part.getData('assemblyPart') as AssemblyPartName;
      const layout = ASSEMBLY_LAYOUT[name];
      await this.runTween({
        targets: part,
        alpha: 1,
        y: layout.y,
        scaleX: layout.scale * 1.05,
        scaleY: layout.scale * 1.05,
        delay: index * (reducedMotion ? 20 : 80),
        duration: reducedMotion ? 180 : 430,
        ease: 'Back.easeOut',
      });
      if (!this.active || !this.scene.sys.isActive()) return;
      await this.runTween({
        targets: part,
        scaleX: layout.scale,
        scaleY: layout.scale,
        duration: reducedMotion ? 80 : 180,
        ease: 'Sine.easeInOut',
      });
    }));

    if (!this.active || !this.scene.sys.isActive()) return;
    this.setAssemblyState(nextState);
    await this.playGlow(nextState === 5, reducedMotion);
    if (!this.active || !this.scene.sys.isActive()) return;
    this.setData({ installAnimationActive: false, installingParts: [], activationActive: false });
  }

  private playGlow(activate: boolean, reducedMotion: boolean): Promise<void> {
    const glow = this.scene.add.ellipse(0, -650, 700, 1050, activate ? 0xffe37a : 0x69edff, 0)
      .setName(activate ? 'assembly-activation-glow' : 'assembly-install-glow')
      .setBlendMode(Phaser.BlendModes.ADD);
    this.addAt(glow, 0);
    const antennaLight = activate
      ? this.scene.add.circle(0, -1230, 54, 0xfff2a1, 0).setName('assembly-antenna-light').setBlendMode(Phaser.BlendModes.ADD)
      : undefined;
    if (antennaLight) this.add(antennaLight);
    if (activate) this.setData('activationActive', true);
    return this.runTween({
      targets: [glow, ...(antennaLight ? [antennaLight] : [])],
      alpha: activate ? 0.7 : 0.42,
      duration: reducedMotion ? 100 : 210,
      yoyo: true,
      repeat: activate && !reducedMotion ? 1 : 0,
      ease: 'Sine.easeInOut',
    }).then(() => {
      if (glow.active) glow.destroy();
      if (antennaLight?.active) antennaLight.destroy();
    });
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
      const cancel = (): void => {
        scene.tweens.killTweensOf(config.targets);
        finish();
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
      scene.tweens.add({ ...config, onComplete: () => finish() });
    });
  }

  private createPart(name: AssemblyPartName, role: string): Phaser.GameObjects.Image {
    const layout = ASSEMBLY_LAYOUT[name];
    const part = this.scene.add.image(layout.x, layout.y, layout.texture)
      .setName(`${role}-${name}`)
      .setOrigin(layout.originX, layout.originY)
      .setScale(layout.scale)
      .setAngle(layout.angle ?? 0)
      .setData('assemblyPart', name);
    this.add(part);
    return part;
  }
}
