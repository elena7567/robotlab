import Phaser from 'phaser';

export interface VisibleTextureBounds {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Alpha >= 16 bounds measured from the immutable production PNG sources. */
export const OBJECT_VISIBLE_BOUNDS: Readonly<Record<string, VisibleTextureBounds>> = {
  'sequence-gear': { sourceWidth: 1254, sourceHeight: 1254, x: 22, y: 21, width: 1210, height: 1207 },
  'sequence-lightning': { sourceWidth: 1254, sourceHeight: 1254, x: 287, y: 35, width: 728, height: 1164 },
  'sequence-planet': { sourceWidth: 1254, sourceHeight: 1254, x: 25, y: 142, width: 1214, height: 912 },
  'sequence-star': { sourceWidth: 1254, sourceHeight: 1254, x: 41, y: 47, width: 1172, height: 1136 },
  'memory-cover': { sourceWidth: 1254, sourceHeight: 1254, x: 205, y: 61, width: 844, height: 1110 },
  'odd-apple': { sourceWidth: 1254, sourceHeight: 1254, x: 157, y: 51, width: 954, height: 1123 },
  'odd-ball': { sourceWidth: 1254, sourceHeight: 1254, x: 65, y: 49, width: 1124, height: 1149 },
  'odd-banana': { sourceWidth: 1254, sourceHeight: 1254, x: 60, y: 53, width: 1144, height: 1118 },
  'odd-carrot': { sourceWidth: 1254, sourceHeight: 1254, x: 255, y: 66, width: 963, height: 1130 },
  'size-battery': { sourceWidth: 1254, sourceHeight: 1254, x: 339, y: 29, width: 576, height: 1185 },
  'shadow-apple': { sourceWidth: 1254, sourceHeight: 1254, x: 149, y: 80, width: 956, height: 1082 },
  'shadow-ball': { sourceWidth: 1254, sourceHeight: 1254, x: 109, y: 115, width: 1034, height: 1030 },
  'shadow-banana': { sourceWidth: 1254, sourceHeight: 1254, x: 125, y: 122, width: 1056, height: 964 },
  'shadow-carrot': { sourceWidth: 1254, sourceHeight: 1254, x: 313, y: 18, width: 644, height: 1152 },
};

export function fitImageByVisibleAlpha(
  image: Phaser.GameObjects.Image,
  maxVisibleWidth: number,
  maxVisibleHeight: number,
): void {
  const bounds = OBJECT_VISIBLE_BOUNDS[image.texture.key];
  if (!bounds) {
    image.setScale(Math.min(maxVisibleWidth / image.width, maxVisibleHeight / image.height));
    return;
  }
  const scale = Math.min(maxVisibleWidth / bounds.width, maxVisibleHeight / bounds.height);
  image.setScale(scale).setData('visibleAlphaSourceBounds', bounds);
}

export function getImageVisibleAlphaBounds(image: Phaser.GameObjects.Image): Phaser.Geom.Rectangle {
  const bounds = (image.getData('visibleAlphaSourceBounds') as VisibleTextureBounds | undefined)
    ?? OBJECT_VISIBLE_BOUNDS[image.texture.key]
    ?? { sourceWidth: image.width, sourceHeight: image.height, x: 0, y: 0, width: image.width, height: image.height };
  const matrix = image.getWorldTransformMatrix();
  const left = bounds.x - image.displayOriginX;
  const top = bounds.y - image.displayOriginY;
  const corners = [
    matrix.transformPoint(left, top),
    matrix.transformPoint(left + bounds.width, top),
    matrix.transformPoint(left + bounds.width, top + bounds.height),
    matrix.transformPoint(left, top + bounds.height),
  ];
  const xs = corners.map(({ x }) => x);
  const ys = corners.map(({ y }) => y);
  return new Phaser.Geom.Rectangle(
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
}
