export interface VisibleAlphaBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface FitRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VisibleBoundsFit {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly visibleRect: FitRect;
}

export type CharacterBoundsId = 'ROBOT_V2_HELPER' | 'ROBOT_V2_ASSEMBLED';

// Immutable production metadata measured from pixels whose alpha is greater
// than 8. Values are expressed in each actor container's unscaled local space.
// The assembled bounds combine the approved RobotAssemblyPreview part layout;
// they deliberately exclude blueprint, power, and system feedback effects.
export const CHARACTER_VISIBLE_BOUNDS: Readonly<Record<CharacterBoundsId, VisibleAlphaBounds>> = {
  ROBOT_V2_HELPER: {
    left: -364.892143808256,
    top: -1448,
    width: 729.784287616511,
    height: 1448,
  },
  ROBOT_V2_ASSEMBLED: {
    left: -501.67,
    top: -1392,
    width: 999.7,
    height: 1382,
  },
};

/** Uniformly contains visible alpha bounds in a zone and returns actor-origin coordinates. */
export function fitVisibleBoundsInRect(
  bounds: VisibleAlphaBounds,
  zone: FitRect,
  alignX = 0.5,
  alignY = 1,
): VisibleBoundsFit {
  const safeBoundsWidth = Math.max(1, bounds.width);
  const safeBoundsHeight = Math.max(1, bounds.height);
  const safeZoneWidth = Math.max(0, zone.width);
  const safeZoneHeight = Math.max(0, zone.height);
  const scale = Math.max(0, Math.min(safeZoneWidth / safeBoundsWidth, safeZoneHeight / safeBoundsHeight));
  const visibleWidth = bounds.width * scale;
  const visibleHeight = bounds.height * scale;
  const visibleX = zone.x + (safeZoneWidth - visibleWidth) * alignX;
  const visibleY = zone.y + (safeZoneHeight - visibleHeight) * alignY;

  return {
    x: visibleX - bounds.left * scale,
    y: visibleY - bounds.top * scale,
    scale,
    visibleRect: { x: visibleX, y: visibleY, width: visibleWidth, height: visibleHeight },
  };
}
