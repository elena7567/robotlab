import Phaser from 'phaser';
import { CHILD_UI } from './childUi';
import { UI_FONT } from './visualTheme';

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

export interface ScaleManagerMetrics {
  readonly parentSize: { readonly width: number; readonly height: number };
  readonly displaySize: { readonly width: number; readonly height: number };
  readonly gameSize: { readonly width: number; readonly height: number };
}

export const LOGICAL_SCENE_WIDTH = 1280;
export const LOGICAL_SCENE_HEIGHT = 720;
export const PLATFORM_CENTER_X = 640;
export const PLATFORM_CONTACT_Y = 560;

const LAB_PLATFORM_SOURCE_Y = 730;
export interface OrientationGateOptions {
  readonly name: string;
  readonly reducedMotion?: boolean;
  readonly targetOrientation?: 'landscape' | 'portrait';
}

export function addRobotLabOrientationGate(
  scene: Phaser.Scene,
  options: OrientationGateOptions,
): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const targetOrientation = options.targetOrientation ?? 'landscape';
  const reducedMotion = options.reducedMotion
    ?? (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const panelWidth = Math.min(350, width - 28);
  const panelHeight = Math.min(292, height - 112);
  const root = scene.add.container(width / 2, height / 2).setName(options.name).setDepth(30);
  const inputBlocker = scene.add.rectangle(-width / 2, -height / 2, width, height, 0x071f35, 0.34)
    .setOrigin(0)
    .setInteractive()
    .setName(`${options.name}-input-blocker`);
  const panel = scene.add.graphics();
  panel.fillStyle(0x071f35, 0.94).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24)
    .lineStyle(4, 0x7af3c0, 0.95).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
  const iconSize = Math.min(98, panelHeight * 0.34);
  const phone = scene.add.graphics().setName(`${options.name}-phone-icon`);
  phone.fillStyle(0xffffff, 0.08).fillRoundedRect(-iconSize * 0.26, -iconSize * 0.48, iconSize * 0.52, iconSize * 0.96, 11)
    .lineStyle(7, 0x8df4ff, 0.96).strokeRoundedRect(-iconSize * 0.26, -iconSize * 0.48, iconSize * 0.52, iconSize * 0.96, 11)
    .lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(-iconSize * 0.18, -iconSize * 0.36, iconSize * 0.36, iconSize * 0.68, 7);
  phone.setY(-panelHeight * 0.23);
  phone.setAngle(targetOrientation === 'portrait' ? 88 : 0);
  root.add([
    inputBlocker,
    panel,
    phone,
    scene.add.text(0, panelHeight * 0.1, 'ПОВЕРНИ ТЕЛЕФОН', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${Math.min(28, Math.max(23, width * 0.07))}px`,
      stroke: '#06243b', strokeThickness: 5, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5),
    scene.add.text(0, panelHeight * 0.29, targetOrientation === 'portrait' ? 'ИГРАЕМ ВЕРТИКАЛЬНО' : 'ИГРАЕМ ГОРИЗОНТАЛЬНО', {
      color: '#c6f8ff', fontFamily: UI_FONT, fontSize: `${Math.min(17, Math.max(CHILD_UI.typography.statusMin, width * 0.04))}px`,
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5),
  ]);
  if (!reducedMotion) {
    scene.tweens.add({ targets: phone, angle: targetOrientation === 'portrait' ? 0 : 88, duration: 760, hold: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  } else {
    phone.setAngle(targetOrientation === 'portrait' ? 0 : 90);
  }
  return root;
}

export function addLogicalLaboratoryImage(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  key: string,
): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const image = scene.add.image(0, 0, key).setOrigin(0);
  const logicalScale = Math.max(LOGICAL_SCENE_WIDTH / image.width, LOGICAL_SCENE_HEIGHT / image.height);
  const alignedY = PLATFORM_CONTACT_Y - LAB_PLATFORM_SOURCE_Y * logicalScale;
  image.setScale(logicalScale).setPosition(
    (LOGICAL_SCENE_WIDTH - image.width * logicalScale) / 2,
    Math.min(0, alignedY),
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

export function readScaleManagerMetrics(scene: Phaser.Scene): ScaleManagerMetrics {
  const { parentSize, displaySize, gameSize } = scene.scale;
  return {
    parentSize: { width: parentSize.width, height: parentSize.height },
    displaySize: { width: displaySize.width, height: displaySize.height },
    gameSize: { width: gameSize.width, height: gameSize.height },
  };
}

function scaleMetricsSignature(metrics: ScaleManagerMetrics): string {
  const size = (value: { readonly width: number; readonly height: number }): string =>
    `${Math.round(value.width * 100) / 100}x${Math.round(value.height * 100) / 100}`;
  return `${size(metrics.parentSize)}|${size(metrics.displaySize)}|${size(metrics.gameSize)}`;
}

export function restartOnViewportResize(scene: Phaser.Scene): void {
  let scheduledFrame = 0;
  let appliedSignature = scaleMetricsSignature(readScaleManagerMetrics(scene));

  const applyLatestLayout = (): void => {
    scheduledFrame = 0;
    if (!scene.sys.isActive()) return;
    const metrics = readScaleManagerMetrics(scene);
    const nextSignature = scaleMetricsSignature(metrics);
    if (nextSignature === appliedSignature) return;
    appliedSignature = nextSignature;
    scene.game.registry.set('scaleManagerMetrics', metrics);

    // create() is the authoritative Level layout pass. Restarting reconstructs
    // every responsive object from serializable session/mechanic state, so no
    // coordinate or scale from the previous orientation can survive.
    const presentationState = scene.data.get('viewportPresentationState') as unknown;
    scene.scene.restart({ viewportReflow: true, presentationState });
  };
  const onViewportCommit = (): void => {
    if (scheduledFrame) return;
    scheduledFrame = requestAnimationFrame(applyLatestLayout);
  };
  const cleanup = (): void => {
    if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = 0;
    window.removeEventListener('robotlab:viewport', onViewportCommit);
  };

  // The Scale Manager can emit several transient RESIZE events while mobile
  // browser chrome and orientation settle. Rebuild only after the centralized
  // viewport lifecycle has committed stable parent/canvas geometry.
  window.addEventListener('robotlab:viewport', onViewportCommit);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
}
