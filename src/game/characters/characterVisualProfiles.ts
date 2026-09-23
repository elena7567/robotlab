export type CharacterVisualProfileId = 'helper' | 'assembled';

export interface CharacterVisualProfile {
  readonly id: CharacterVisualProfileId;
  readonly visibleTopLocal: number;
  readonly visibleBottomLocal: number;
  readonly visibleLeftLocal: number;
  readonly visibleRightLocal: number;
  readonly visibleHeightAtScale1: number;
  readonly visibleWidthAtScale1: number;
  readonly footAnchorLocalX: number;
  readonly footAnchorLocalY: number;
}

export const CHARACTER_VISUAL_PROFILES: Readonly<Record<CharacterVisualProfileId, CharacterVisualProfile>> = {
  helper: {
    id: 'helper',
    visibleTopLocal: -1448,
    visibleBottomLocal: 0,
    visibleLeftLocal: -364.892143808256,
    visibleRightLocal: 364.892143808255,
    visibleHeightAtScale1: 1448,
    visibleWidthAtScale1: 729.784287616511,
    footAnchorLocalX: 0,
    footAnchorLocalY: 0,
  },
  assembled: {
    id: 'assembled',
    visibleTopLocal: -1392,
    visibleBottomLocal: -10,
    visibleLeftLocal: -501.67,
    visibleRightLocal: 498.03,
    visibleHeightAtScale1: 1382,
    visibleWidthAtScale1: 999.7,
    footAnchorLocalX: 0,
    footAnchorLocalY: 0,
  },
};
