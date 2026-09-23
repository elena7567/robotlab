import type { CharacterVisualProfile } from './characterVisualProfiles';

export enum DesktopCharacterRole {
  WORLD_PRIMARY = 'WORLD_PRIMARY',
  WORLD_SECONDARY = 'WORLD_SECONDARY',
  WORLD_SUPPORT = 'WORLD_SUPPORT',
  BOARD_ACTOR = 'BOARD_ACTOR',
  ASSEMBLY_ENVELOPE = 'ASSEMBLY_ENVELOPE',
}

export interface CharacterSizingResult {
  readonly role: DesktopCharacterRole;
  readonly targetVisibleHeight: number;
  readonly resolvedScale: number;
  readonly minVisibleHeight: number;
  readonly maxVisibleHeight: number;
  readonly targetRatio: number;
  readonly minRatio: number;
  readonly maxRatio: number;
}

const WORLD_ROLE_RATIOS: Readonly<Record<Exclude<DesktopCharacterRole, DesktopCharacterRole.BOARD_ACTOR>, {
  readonly target: number;
  readonly min: number;
  readonly max: number;
}>> = {
  [DesktopCharacterRole.WORLD_PRIMARY]: { target: 0.41, min: 0.38, max: 0.43 },
  [DesktopCharacterRole.WORLD_SECONDARY]: { target: 0.39, min: 0.36, max: 0.42 },
  [DesktopCharacterRole.WORLD_SUPPORT]: { target: 0.36, min: 0.33, max: 0.39 },
  [DesktopCharacterRole.ASSEMBLY_ENVELOPE]: { target: 0.41, min: 0.38, max: 0.43 },
};

export const BOARD_ACTOR_RATIO = 0.72;
export const BOARD_ACTOR_MIN_RATIO = 0.65;
export const BOARD_ACTOR_MAX_RATIO = 0.78;

export function resolveWorldCharacterScale(options: {
  readonly profile: CharacterVisualProfile;
  readonly role: Exclude<DesktopCharacterRole, DesktopCharacterRole.BOARD_ACTOR>;
  readonly viewportHeight: number;
  readonly parentScale?: number;
}): CharacterSizingResult {
  const ratios = WORLD_ROLE_RATIOS[options.role];
  const parentScale = Math.max(0.0001, options.parentScale ?? 1);
  const targetVisibleHeight = options.viewportHeight * ratios.target;
  return {
    role: options.role,
    targetVisibleHeight,
    resolvedScale: targetVisibleHeight / options.profile.visibleHeightAtScale1 / parentScale,
    minVisibleHeight: options.viewportHeight * ratios.min,
    maxVisibleHeight: options.viewportHeight * ratios.max,
    targetRatio: ratios.target,
    minRatio: ratios.min,
    maxRatio: ratios.max,
  };
}

export function resolveBoardActorScale(options: {
  readonly profile: CharacterVisualProfile;
  readonly localGridCellHeight: number;
  readonly ratio?: number;
}): CharacterSizingResult {
  const ratio = options.ratio ?? BOARD_ACTOR_RATIO;
  const targetVisibleHeight = options.localGridCellHeight * ratio;
  return {
    role: DesktopCharacterRole.BOARD_ACTOR,
    targetVisibleHeight,
    resolvedScale: targetVisibleHeight / options.profile.visibleHeightAtScale1,
    minVisibleHeight: options.localGridCellHeight * BOARD_ACTOR_MIN_RATIO,
    maxVisibleHeight: options.localGridCellHeight * BOARD_ACTOR_MAX_RATIO,
    targetRatio: ratio,
    minRatio: BOARD_ACTOR_MIN_RATIO,
    maxRatio: BOARD_ACTOR_MAX_RATIO,
  };
}
