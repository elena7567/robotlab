import Phaser from 'phaser';
import { getRobotEnergyProfile, type RobotEnergyProfile } from '../state/repairProgression';

export const ROBOT_ANIMATION_STATES = [
  'IDLE', 'THINKING', 'WRONG', 'CORRECT', 'HINT', 'CELEBRATE',
] as const;

export type RobotAnimationState = (typeof ROBOT_ANIMATION_STATES)[number];

interface BaseTransform {
  readonly x: number;
  readonly y: number;
  readonly originX: number;
  readonly originY: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly alpha: number;
}

export interface RestingArmPose {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly originX: number;
  readonly originY: number;
  readonly scale: number;
}

interface TexturePoint {
  readonly x: number;
  readonly y: number;
}

interface RobotPoint {
  readonly x: number;
  readonly y: number;
}

type RobotPartName = 'body' | 'head' | 'armLeft' | 'armRight' | 'legLeft' | 'legRight' | 'antenna';

const BODY_TRANSFORM = {
  x: 0,
  y: -770,
  originX: 0.5,
  originY: 0.082,
  scale: 0.44,
  textureWidth: 1254,
  textureHeight: 1254,
} as const;

const BODY_SHOULDER_SOCKET_PIXELS: Readonly<Record<'screenLeft' | 'screenRight', TexturePoint>> = {
  screenLeft: { x: 21, y: 526 },
  screenRight: { x: 1233, y: 526 },
};

const ARM_SHOULDER_ROOT_PIXELS: Readonly<Record<'screenLeft' | 'screenRight', TexturePoint>> = {
  screenLeft: { x: 1006, y: 183 },
  screenRight: { x: 277, y: 183 },
};

function bodyTexturePointToRobotPoint(point: TexturePoint): RobotPoint {
  return {
    x: BODY_TRANSFORM.x + (point.x - BODY_TRANSFORM.textureWidth * BODY_TRANSFORM.originX) * BODY_TRANSFORM.scale,
    y: BODY_TRANSFORM.y + (point.y - BODY_TRANSFORM.textureHeight * BODY_TRANSFORM.originY) * BODY_TRANSFORM.scale,
  };
}

export const BODY_SHOULDER_ANCHORS: Readonly<Record<'screenLeft' | 'screenRight', RobotPoint>> = {
  screenLeft: bodyTexturePointToRobotPoint(BODY_SHOULDER_SOCKET_PIXELS.screenLeft),
  screenRight: bodyTexturePointToRobotPoint(BODY_SHOULDER_SOCKET_PIXELS.screenRight),
};

export const RESTING_ARM_POSES: Readonly<Record<'screenLeft' | 'screenRight', RestingArmPose>> = {
  screenLeft: {
    x: BODY_SHOULDER_ANCHORS.screenLeft.x,
    y: BODY_SHOULDER_ANCHORS.screenLeft.y,
    rotation: 4,
    originX: ARM_SHOULDER_ROOT_PIXELS.screenLeft.x / 1254,
    originY: ARM_SHOULDER_ROOT_PIXELS.screenLeft.y / 1254,
    scale: 0.4,
  },
  screenRight: {
    x: BODY_SHOULDER_ANCHORS.screenRight.x,
    y: BODY_SHOULDER_ANCHORS.screenRight.y,
    rotation: -4,
    originX: ARM_SHOULDER_ROOT_PIXELS.screenRight.x / 1254,
    originY: ARM_SHOULDER_ROOT_PIXELS.screenRight.y / 1254,
    scale: 0.4,
  },
};

const PART_TEXTURES: Readonly<Record<RobotPartName, string>> = {
  body: 'robot-part-body',
  head: 'robot-part-head',
  armLeft: 'robot-part-arm-left',
  armRight: 'robot-part-arm-right',
  legLeft: 'robot-part-leg-left',
  legRight: 'robot-part-leg-right',
  antenna: 'robot-part-antenna',
};

export class RobotActor extends Phaser.GameObjects.Container {
  // Kept as an explicit bottom-grounded contract for runtime QA and integrations.
  readonly originX = 0.5;
  readonly originY = 1;

  readonly bodyPart: Phaser.GameObjects.Image;
  readonly head: Phaser.GameObjects.Image;
  readonly armLeft: Phaser.GameObjects.Image;
  readonly armRight: Phaser.GameObjects.Image;
  readonly legLeft: Phaser.GameObjects.Image;
  readonly legRight: Phaser.GameObjects.Image;
  readonly antenna: Phaser.GameObjects.Image;

  private readonly parts: Readonly<Record<RobotPartName, Phaser.GameObjects.Image>>;
  private readonly baseTransforms = new Map<Phaser.GameObjects.Image, BaseTransform>();
  private idleTweens: Phaser.Tweens.Tween[] = [];
  private reactionTimer?: Phaser.Time.TimerEvent;
  private microTimer?: Phaser.Time.TimerEvent;
  private activeReactionResolve?: () => void;
  private energy: RobotEnergyProfile;
  private reducedMotion: boolean;
  private currentAnimationState: RobotAnimationState = 'IDLE';
  private disposed = false;

  constructor(scene: Phaser.Scene, completedTasks: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setName('grounded-robot');

    this.legLeft = this.createPart('legLeft', -142, -365, 0.481, 0.024, 0.27);
    this.legRight = this.createPart('legRight', 142, -365, 0.49, 0.04, 0.29);
    const screenLeftArmPose = RESTING_ARM_POSES.screenLeft;
    const screenRightArmPose = RESTING_ARM_POSES.screenRight;
    this.armRight = this.createPart(
      'armRight',
      screenLeftArmPose.x,
      screenLeftArmPose.y,
      screenLeftArmPose.originX,
      screenLeftArmPose.originY,
      screenLeftArmPose.scale,
      screenLeftArmPose.rotation,
    );
    this.armLeft = this.createPart(
      'armLeft',
      screenRightArmPose.x,
      screenRightArmPose.y,
      screenRightArmPose.originX,
      screenRightArmPose.originY,
      screenRightArmPose.scale,
      screenRightArmPose.rotation,
    );
    this.bodyPart = this.createPart(
      'body',
      BODY_TRANSFORM.x,
      BODY_TRANSFORM.y,
      BODY_TRANSFORM.originX,
      BODY_TRANSFORM.originY,
      BODY_TRANSFORM.scale,
    );
    this.head = this.createPart('head', 0, -765, 0.5, 0.869, 0.52);
    this.antenna = this.createPart('antenna', 0, -1220, 0.5, 0.951, 0.14);
    this.parts = {
      body: this.bodyPart,
      head: this.head,
      armLeft: this.armLeft,
      armRight: this.armRight,
      legLeft: this.legLeft,
      legRight: this.legRight,
      antenna: this.antenna,
    };

    Object.values(this.parts).forEach((part) => this.captureBase(part));
    this.energy = getRobotEnergyProfile(completedTasks);
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.setData('animationState', this.currentAnimationState);
    this.setData('completedTasks', this.energy.completedTasks);
    this.setData('bodyShoulderLeftAnchor', BODY_SHOULDER_ANCHORS.screenLeft);
    this.setData('bodyShoulderRightAnchor', BODY_SHOULDER_ANCHORS.screenRight);
    this.startIdle();
  }

  static canCreate(scene: Phaser.Scene): boolean {
    return Object.values(PART_TEXTURES).every((key) => scene.textures.exists(key));
  }

  setRepairProgress(completedTasks: number): void {
    this.energy = getRobotEnergyProfile(completedTasks);
    this.setData('completedTasks', this.energy.completedTasks);
    if (this.currentAnimationState === 'IDLE') this.startIdle();
  }

  get animationState(): RobotAnimationState {
    return this.currentAnimationState;
  }

  playIdle(): void {
    this.cancelReaction();
    this.restoreBaseTransforms();
    this.applyAnimationState('IDLE');
    this.startIdle();
  }

  playThinking(): Promise<void> {
    return this.runReaction('THINKING', this.reducedMotion ? 220 : 520, () => {
      const amount = this.reducedMotion ? 1.5 : 5;
      this.addReactionTween({ targets: this.head, angle: this.base(this.head).rotation * Phaser.Math.RAD_TO_DEG - amount, duration: 240, yoyo: true });
      this.addReactionTween({ targets: this.antenna, angle: amount * 0.7, duration: 180, yoyo: true, repeat: 1 });
    });
  }

  playWrong(): Promise<void> {
    return this.runReaction('WRONG', this.reducedMotion ? 260 : 440, () => {
      const motion = this.reducedMotion ? 0.45 : 1;
      this.addReactionTween({ targets: this.head, angle: -5 * motion, duration: 180, yoyo: true, ease: 'Sine.easeInOut' });
      this.addReactionTween({ targets: this.bodyPart, angle: 2.2 * motion, x: this.base(this.bodyPart).x + 7 * motion, duration: 105, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      this.addReactionTween({ targets: this.antenna, angle: -8 * motion, y: this.base(this.antenna).y + 10 * motion, duration: 170, yoyo: true, ease: 'Sine.easeInOut' });
    });
  }

  playCorrect(): Promise<void> {
    const strength = this.energy.reactionStrength * (this.reducedMotion ? 0.45 : 1);
    return this.runReaction('CORRECT', this.reducedMotion ? 420 : 620, () => {
      this.addActorPulse(8 * strength, 0.018 * strength, this.reducedMotion ? 150 : 190);
      this.addReactionTween({ targets: this.head, y: this.base(this.head).y - 18 * strength, angle: 3 * strength, duration: 210, yoyo: true, ease: 'Sine.easeOut' });
      this.addReactionTween({ targets: this.antenna, y: this.base(this.antenna).y - 12 * strength, scaleX: this.base(this.antenna).scaleX * (1 + 0.12 * strength), scaleY: this.base(this.antenna).scaleY * (1 + 0.12 * strength), duration: 140, yoyo: true, repeat: 1 });
    });
  }

  playHint(): Promise<void> {
    return this.runReaction('HINT', this.reducedMotion ? 360 : 520, () => {
      const motion = this.reducedMotion ? 0.45 : 1;
      this.addReactionTween({ targets: this.head, angle: -6 * motion, duration: 260, yoyo: true, ease: 'Sine.easeInOut' });
      this.addReactionTween({ targets: this.antenna, angle: -7 * motion, scaleX: this.base(this.antenna).scaleX * (1 + 0.1 * motion), scaleY: this.base(this.antenna).scaleY * (1 + 0.1 * motion), duration: 150, yoyo: true, repeat: 1 });
    });
  }

  playCelebrate(): Promise<void> {
    const motion = this.reducedMotion ? 0.4 : 1;
    return this.runReaction('CELEBRATE', this.reducedMotion ? 540 : 760, () => {
      this.addActorPulse(12 * motion, 0.025 * motion, this.reducedMotion ? 160 : 210, 1);
      this.addReactionTween({ targets: this.head, angle: 5 * motion, y: this.base(this.head).y - 22 * motion, duration: 220, yoyo: true, repeat: 1 });
      this.addReactionTween({ targets: this.antenna, angle: 9 * motion, y: this.base(this.antenna).y - 15 * motion, scaleX: this.base(this.antenna).scaleX * (1 + 0.16 * motion), scaleY: this.base(this.antenna).scaleY * (1 + 0.16 * motion), duration: 130, yoyo: true, repeat: 2 });
    });
  }

  restoreBaseTransforms(): void {
    this.killControlledTweens();
    Object.values(this.parts).forEach((part) => {
      const base = this.base(part);
      part.setPosition(base.x, base.y)
        .setOrigin(base.originX, base.originY)
        .setRotation(base.rotation)
        .setScale(base.scaleX, base.scaleY)
        .setAlpha(base.alpha);
    });
    const baseX = this.getData('baseX') as number | undefined;
    const baseY = this.getData('baseY') as number | undefined;
    const groundedScale = this.getData('groundedScale') as number | undefined;
    if (baseX !== undefined && baseY !== undefined) this.setPosition(baseX, baseY);
    if (groundedScale !== undefined) this.setScale(groundedScale);
    this.setAngle(0);
  }

  override destroy(fromScene?: boolean): void {
    this.disposed = true;
    this.microTimer?.remove(false);
    this.reactionTimer?.remove(false);
    this.killControlledTweens();
    this.activeReactionResolve?.();
    this.activeReactionResolve = undefined;
    super.destroy(fromScene);
  }

  private createPart(
    name: RobotPartName,
    x: number,
    y: number,
    originX: number,
    originY: number,
    scale: number,
    angle = 0,
  ): Phaser.GameObjects.Image {
    const part = this.scene.add.image(x, y, PART_TEXTURES[name])
      .setName(`robot-${name}`)
      .setOrigin(originX, originY)
      .setScale(scale)
      .setAngle(angle);
    this.add(part);
    return part;
  }

  private captureBase(part: Phaser.GameObjects.Image): void {
    const transform = {
      x: part.x,
      y: part.y,
      originX: part.originX,
      originY: part.originY,
      rotation: part.rotation,
      scaleX: part.scaleX,
      scaleY: part.scaleY,
      alpha: part.alpha,
    };
    this.baseTransforms.set(part, transform);
    part.setData('baseTransform', transform);
  }

  private base(part: Phaser.GameObjects.Image): BaseTransform {
    const base = this.baseTransforms.get(part);
    if (!base) throw new Error(`Missing RobotActor base transform for ${part.name}`);
    return base;
  }

  private applyAnimationState(state: RobotAnimationState): void {
    this.currentAnimationState = state;
    this.setData('animationState', state);
  }

  private startIdle(): void {
    if (this.disposed || this.currentAnimationState !== 'IDLE') return;
    this.stopIdle();
    this.restoreBaseTransforms();
    const amplitude = this.reducedMotion ? 0.6 : this.energy.idleAmplitude;
    const duration = this.energy.idleDurationMs;
    this.idleTweens = [
      this.scene.tweens.add({ targets: this.bodyPart, y: this.base(this.bodyPart).y - amplitude, duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.scene.tweens.add({ targets: this.head, angle: 1.15 * (this.reducedMotion ? 0.35 : 1), duration: duration * 1.12, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.scene.tweens.add({ targets: this.antenna, angle: this.energy.antennaAmplitude * (this.reducedMotion ? 0.3 : 1), duration: duration * 0.68, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
    ];
    this.scheduleMicroReaction();
  }

  private stopIdle(): void {
    this.idleTweens.forEach((tween) => tween.stop());
    this.idleTweens = [];
    this.microTimer?.remove(false);
    this.microTimer = undefined;
  }

  private scheduleMicroReaction(): void {
    this.microTimer?.remove(false);
    if (this.reducedMotion || this.disposed || this.currentAnimationState !== 'IDLE') return;
    const delay = Phaser.Math.Between(5000, 9000);
    this.microTimer = this.scene.time.delayedCall(delay, () => this.playMicroReaction());
  }

  private playMicroReaction(): void {
    const choice = Phaser.Math.Between(0, 2);
    this.runReaction('THINKING', 420, () => {
      if (choice === 0) this.addReactionTween({ targets: this.head, angle: -3.5, duration: 190, yoyo: true });
      else if (choice === 1) this.addReactionTween({ targets: this.antenna, y: this.base(this.antenna).y - 14, duration: 115, yoyo: true, repeat: 1 });
      else this.addReactionTween({ targets: this.bodyPart, x: this.base(this.bodyPart).x + 7, duration: 190, yoyo: true });
    });
  }

  private addActorPulse(yOffset: number, scaleAmount: number, duration: number, repeat = 0): void {
    this.addReactionTween({
      targets: this,
      y: this.y - yOffset,
      scaleX: this.scaleX * (1 + scaleAmount),
      scaleY: this.scaleY * (1 + scaleAmount),
      duration,
      yoyo: true,
      repeat,
      ease: 'Sine.easeInOut',
    });
  }

  private runReaction(state: RobotAnimationState, duration: number, animate: () => void): Promise<void> {
    this.cancelReaction();
    this.stopIdle();
    this.restoreBaseTransforms();
    this.applyAnimationState(state);
    animate();
    return new Promise((resolve) => {
      this.activeReactionResolve = resolve;
      this.reactionTimer = this.scene.time.delayedCall(duration, () => {
        this.reactionTimer = undefined;
        this.restoreBaseTransforms();
        this.applyAnimationState('IDLE');
        this.activeReactionResolve = undefined;
        resolve();
        this.startIdle();
      });
    });
  }

  private cancelReaction(): void {
    this.reactionTimer?.remove(false);
    this.reactionTimer = undefined;
    this.activeReactionResolve?.();
    this.activeReactionResolve = undefined;
  }

  private addReactionTween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    this.scene.tweens.add({ ease: 'Sine.easeInOut', ...config });
  }

  private killControlledTweens(): void {
    this.scene.tweens.killTweensOf([this, ...Object.values(this.parts)]);
  }
}
