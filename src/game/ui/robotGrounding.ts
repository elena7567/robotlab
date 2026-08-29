import Phaser from 'phaser';
import {
  PLATFORM_CENTER_X,
  PLATFORM_CONTACT_Y,
} from './sceneLayout';
import { RobotActor } from './RobotActor';

export const ROBOT_PLATFORM_SCALE = 0.2520718;

export function placeRobotOnPlatform(
  robot: RobotActor,
): RobotActor {
  const scale = ROBOT_PLATFORM_SCALE;
  const baseY = PLATFORM_CONTACT_Y;

  robot
    .setScale(scale)
    .setPosition(PLATFORM_CENTER_X, baseY)
    .setName('grounded-robot')
    .setData({
      baseX: PLATFORM_CENTER_X,
      baseY,
      platformContactX: PLATFORM_CENTER_X,
      platformContactY: PLATFORM_CONTACT_Y,
      logicalPlatformX: PLATFORM_CENTER_X,
      logicalPlatformY: PLATFORM_CONTACT_Y,
      logicalScale: ROBOT_PLATFORM_SCALE,
      groundedScale: scale,
    });

  return robot;
}

export function createGroundedRobot(
  scene: Phaser.Scene,
  parent?: Phaser.GameObjects.Container,
  completedTasks = 0,
): RobotActor | undefined {
  if (!RobotActor.canCreate(scene)) return undefined;
  const robot = placeRobotOnPlatform(new RobotActor(scene, completedTasks));
  parent?.add(robot);
  return robot;
}
