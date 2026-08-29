import Phaser from 'phaser';
import { clampValue } from './fluidSizing';
import { LOGICAL_SCENE_HEIGHT, LOGICAL_SCENE_WIDTH, PLATFORM_CONTACT_Y } from './sceneLayout';
import type { ResponsiveLayout } from './responsiveLayout';

export interface ResponsiveWorldFrame {
  scale: number;
  offsetX: number;
  offsetY: number;
  platformScreenX: number;
  platformScreenY: number;
}

export function configureResponsiveCamera(
  scene: Phaser.Scene,
  worldLayer: Phaser.GameObjects.Container,
  layout: ResponsiveLayout,
): ResponsiveWorldFrame {
  const camera = scene.cameras.main;
  camera.setViewport(0, 0, layout.viewportWidth, layout.viewportHeight).setZoom(1).setScroll(0, 0).setRoundPixels(false);

  const portrait = layout.mode !== 'landscape';
  const scale = portrait
    ? clampValue(0.5, layout.viewportWidth / 610, 0.9)
    : Math.min(layout.viewportWidth / LOGICAL_SCENE_WIDTH, layout.viewportHeight / LOGICAL_SCENE_HEIGHT);
  const platformScreenX = portrait ? layout.viewportWidth / 2 : layout.viewportWidth / 2;
  const robotDisplayHeight = 365 * scale;
  const desiredGap = layout.mode === 'ultra-narrow-portrait' ? 0 : layout.margin;
  const platformScreenY = portrait
    ? Math.min(layout.viewportHeight - layout.safe.bottom * 0.35, layout.taskCard.y + layout.taskCard.height + desiredGap + robotDisplayHeight)
    : (layout.viewportHeight - LOGICAL_SCENE_HEIGHT * scale) / 2 + PLATFORM_CONTACT_Y * scale;
  const offsetX = platformScreenX - 640 * scale;
  const offsetY = platformScreenY - PLATFORM_CONTACT_Y * scale;
  worldLayer.setPosition(offsetX, offsetY).setScale(scale);
  worldLayer.setData({ logicalWidth: LOGICAL_SCENE_WIDTH, logicalHeight: LOGICAL_SCENE_HEIGHT, mode: layout.mode, scale });
  return { scale, offsetX, offsetY, platformScreenX, platformScreenY };
}
