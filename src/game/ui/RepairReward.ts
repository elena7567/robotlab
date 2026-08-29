import Phaser from 'phaser';
import type { RobotActor } from './RobotActor';

export interface RepairRewardConfig {
  readonly textureKey: string;
  readonly source: Phaser.Math.Vector2;
  readonly reducedMotion?: boolean;
}

export function playRepairItemReward(
  scene: Phaser.Scene,
  robot: RobotActor,
  config: RepairRewardConfig,
): Promise<void> {
  if (!scene.textures.exists(config.textureKey)) return Promise.resolve();
  const targetBounds = robot.getBounds();
  const target = new Phaser.Math.Vector2(targetBounds.centerX, targetBounds.centerY + targetBounds.height * 0.12);
  const item = scene.add.image(config.source.x, config.source.y, config.textureKey)
    .setName('repair-item-reward')
    .setDepth(40)
    .setScale(config.reducedMotion ? 0.045 : 0.06)
    .setAlpha(0);
  const duration = config.reducedMotion ? 260 : 620;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
      resolve();
    };
    const cancel = (): void => {
      scene.tweens.killTweensOf(item);
      if (item.active) item.destroy();
      finish();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
    scene.tweens.add({
      targets: item,
      alpha: 1,
      scaleX: item.scaleX * 1.18,
      scaleY: item.scaleY * 1.18,
      duration: Math.min(150, duration * 0.3),
      ease: 'Back.easeOut',
    });
    scene.tweens.add({
      targets: item,
      x: target.x,
      y: target.y,
      angle: config.reducedMotion ? 0 : 210,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        scene.tweens.add({
          targets: item,
          alpha: 0,
          scaleX: item.scaleX * 0.25,
          scaleY: item.scaleY * 0.25,
          duration: 140,
          ease: 'Sine.easeIn',
          onComplete: () => {
            item.destroy();
            finish();
          },
        });
      },
    });
  });
}
