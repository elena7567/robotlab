import Phaser from 'phaser';

export interface CoverImageMetrics {
  scale: number;
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface LogicalSceneTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const LOGICAL_SCENE_WIDTH = 1280;
export const LOGICAL_SCENE_HEIGHT = 720;
export const PLATFORM_CENTER_X = 640;
export const PLATFORM_CONTACT_Y = 560;

const LAB_PLATFORM_SOURCE_Y = 730;

export function addLogicalLaboratoryImage(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  key: string,
): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const image = scene.add.image(0, 0, key).setOrigin(0);
  const logicalScale = Math.max(LOGICAL_SCENE_WIDTH / image.width, LOGICAL_SCENE_HEIGHT / image.height);
  image.setScale(logicalScale).setPosition(
    (LOGICAL_SCENE_WIDTH - image.width * logicalScale) / 2,
    PLATFORM_CONTACT_Y - LAB_PLATFORM_SOURCE_Y * logicalScale,
  );
  parent.add(image);
  return image;
}

export function getLogicalSceneCoverTransform(scene: Phaser.Scene): LogicalSceneTransform {
  const { width, height } = scene.scale;
  const scale = Math.max(width / LOGICAL_SCENE_WIDTH, height / LOGICAL_SCENE_HEIGHT);
  return {
    scale,
    offsetX: (width - LOGICAL_SCENE_WIDTH * scale) / 2,
    offsetY: (height - LOGICAL_SCENE_HEIGHT * scale) / 2,
  };
}

export function addCoverImage(scene: Phaser.Scene, key: string): CoverImageMetrics | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const { width, height } = scene.scale;
  const image = scene.add.image(width / 2, height / 2, key);
  const scale = Math.max(width / image.width, height / image.height);
  image.setScale(scale);
  return {
    scale,
    displayWidth: image.displayWidth,
    displayHeight: image.displayHeight,
    offsetX: (width - image.displayWidth) / 2,
    offsetY: (height - image.displayHeight) / 2,
  };
}

export function addPlatformAlignedCoverImage(
  scene: Phaser.Scene,
  key: string,
  platformTargetY?: number,
): CoverImageMetrics | undefined {
  if (!scene.textures.exists(key)) return undefined;
  if (platformTargetY !== undefined) {
    const { width } = scene.scale;
    const image = scene.add.image(width / 2, 0, key).setOrigin(0.5, 0);
    const scale = Math.max(
      width / image.width,
      scene.scale.height / image.height,
      platformTargetY / LAB_PLATFORM_SOURCE_Y,
    );
    const offsetY = platformTargetY - LAB_PLATFORM_SOURCE_Y * scale;
    image.setScale(scale).setY(offsetY);
    return {
      scale,
      displayWidth: image.displayWidth,
      displayHeight: image.displayHeight,
      offsetX: (width - image.displayWidth) / 2,
      offsetY,
    };
  }
  const transform = getLogicalSceneCoverTransform(scene);
  const image = scene.add.image(0, 0, key).setOrigin(0);
  const logicalImageScale = Math.max(LOGICAL_SCENE_WIDTH / image.width, LOGICAL_SCENE_HEIGHT / image.height);
  const logicalOffsetY = PLATFORM_CONTACT_Y - LAB_PLATFORM_SOURCE_Y * logicalImageScale;
  const scale = logicalImageScale * transform.scale;
  const offsetX = transform.offsetX + (LOGICAL_SCENE_WIDTH - image.width * logicalImageScale) * transform.scale / 2;
  const offsetY = transform.offsetY + logicalOffsetY * transform.scale;
  image.setScale(scale).setPosition(offsetX, offsetY);
  return {
    scale,
    displayWidth: image.displayWidth,
    displayHeight: image.displayHeight,
    offsetX,
    offsetY,
  };
}

export function restartOnViewportResize(scene: Phaser.Scene): void {
  const onResize = (): void => { scene.scene.restart(); };
  scene.scale.once('resize', onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', onResize));
}
