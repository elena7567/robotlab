import Phaser from 'phaser';
import { getRobotEnergyProfile, type RobotEnergyProfile } from '../state/repairProgression';

export const ROBOT_ANIMATION_STATES = [
  'IDLE', 'THINKING', 'WRONG', 'CORRECT', 'HINT', 'CELEBRATE',
] as const;

export type RobotAnimationState = (typeof ROBOT_ANIMATION_STATES)[number];

interface SpriteTransform {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly alpha: number;
}

const HELPER_TEXTURE = 'robot-v2-helper';
const HELPER_SOURCE_HEIGHT = 1534;
const HELPER_VISIBLE_HEIGHT = 1502;
const HELPER_BOTTOM_TRANSPARENT_PX = 16;
const HELPER_LOGICAL_HEIGHT = 1448;
const HELPER_INTERNAL_SCALE = HELPER_LOGICAL_HEIGHT / HELPER_VISIBLE_HEIGHT;

export class RobotActor extends Phaser.GameObjects.Container {
  readonly originX = 0.5;
  readonly originY = 1;
  readonly sprite: Phaser.GameObjects.Image;

  private readonly baseTransform: SpriteTransform;
  private idleTweens: Phaser.Tweens.Tween[] = [];
  private reactionTimer?: Phaser.Time.TimerEvent;
  private microTimer?: Phaser.Time.TimerEvent;
  private activeReactionResolve?: () => void;
  private energy: RobotEnergyProfile;
  private readonly reducedMotion: boolean;
  private currentAnimationState: RobotAnimationState = 'IDLE';
  private disposed = false;

  constructor(scene: Phaser.Scene, completedTasks: number) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setName('grounded-robot');

    const groundedImageY = HELPER_BOTTOM_TRANSPARENT_PX * HELPER_INTERNAL_SCALE;
    this.sprite = scene.add.image(0, groundedImageY, HELPER_TEXTURE)
      .setOrigin(0.5, 1)
      .setScale(HELPER_INTERNAL_SCALE)
      .setName('robot-v2-helper-sprite')
      .setData({
        characterIdentity: 'MAIN_HELPER',
        sourceHeight: HELPER_SOURCE_HEIGHT,
        visibleHeight: HELPER_VISIBLE_HEIGHT,
      });
    this.add(this.sprite);
    this.baseTransform = {
      x: this.sprite.x,
      y: this.sprite.y,
      angle: this.sprite.angle,
      scaleX: this.sprite.scaleX,
      scaleY: this.sprite.scaleY,
      alpha: this.sprite.alpha,
    };

    this.energy = getRobotEnergyProfile(completedTasks);
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.setData({
      animationState: this.currentAnimationState,
      completedTasks: this.energy.completedTasks,
      characterIdentity: 'MAIN_HELPER',
      robotV2: true,
    });
    this.startIdle();
  }

  static canCreate(scene: Phaser.Scene): boolean {
    return scene.textures.exists(HELPER_TEXTURE);
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
    const motion = this.reducedMotion ? 0.35 : 1;
    return this.runReaction('THINKING', this.reducedMotion ? 220 : 520, () => {
      this.addReactionTween({ targets: this.sprite, angle: -3.5 * motion, duration: 240, yoyo: true });
    });
  }

  playWrong(): Promise<void> {
    const motion = this.reducedMotion ? 0.45 : 1;
    return this.runReaction('WRONG', this.reducedMotion ? 260 : 440, () => {
      this.addReactionTween({
        targets: this.sprite,
        angle: -4.5 * motion,
        x: this.baseTransform.x - 7 * motion,
        duration: 105,
        yoyo: true,
        repeat: 1,
      });
    });
  }

  playCorrect(): Promise<void> {
    const strength = this.energy.reactionStrength * (this.reducedMotion ? 0.45 : 1);
    return this.runReaction('CORRECT', this.reducedMotion ? 420 : 620, () => {
      this.addActorPulse(8 * strength, 0.018 * strength, this.reducedMotion ? 150 : 190);
      this.addReactionTween({ targets: this.sprite, angle: 2.5 * strength, duration: 210, yoyo: true });
    });
  }

  playHint(): Promise<void> {
    const motion = this.reducedMotion ? 0.45 : 1;
    return this.runReaction('HINT', this.reducedMotion ? 360 : 520, () => {
      this.addReactionTween({ targets: this.sprite, angle: -5 * motion, duration: 260, yoyo: true });
    });
  }

  playCelebrate(): Promise<void> {
    const motion = this.reducedMotion ? 0.4 : 1;
    return this.runReaction('CELEBRATE', this.reducedMotion ? 540 : 760, () => {
      this.addActorPulse(12 * motion, 0.025 * motion, this.reducedMotion ? 160 : 210, 1);
      this.addReactionTween({ targets: this.sprite, angle: 4 * motion, duration: 220, yoyo: true, repeat: 1 });
    });
  }

  restoreBaseTransforms(): void {
    this.killControlledTweens();
    this.sprite
      .setPosition(this.baseTransform.x, this.baseTransform.y)
      .setAngle(this.baseTransform.angle)
      .setScale(this.baseTransform.scaleX, this.baseTransform.scaleY)
      .setAlpha(this.baseTransform.alpha);
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
      this.scene.tweens.add({
        targets: this.sprite,
        y: this.baseTransform.y - amplitude,
        angle: 0.7 * (this.reducedMotion ? 0.35 : 1),
        duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
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
    this.microTimer = this.scene.time.delayedCall(Phaser.Math.Between(5000, 9000), () => this.playMicroReaction());
  }

  private playMicroReaction(): void {
    const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    void this.runReaction('THINKING', 420, () => {
      this.addReactionTween({ targets: this.sprite, angle: 2.2 * direction, duration: 190, yoyo: true });
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
    this.scene.tweens.killTweensOf([this, this.sprite]);
  }
}
