import Phaser from 'phaser';
import { DesktopCharacterRole, type CharacterSizingResult } from './CharacterSizingPolicy';
import { CHARACTER_VISUAL_PROFILES, type CharacterVisualProfileId } from './characterVisualProfiles';

export interface CharacterTelemetryInput {
  readonly characterId: string;
  readonly object: Phaser.GameObjects.GameObject;
  readonly profileId: CharacterVisualProfileId;
  readonly role: DesktopCharacterRole;
  readonly sizing?: CharacterSizingResult;
  readonly groundY?: number;
  readonly cellHeight?: number;
}

export interface CharacterTelemetryEntry {
  readonly scene: string;
  readonly characterId: string;
  readonly profile: CharacterVisualProfileId;
  readonly role: DesktopCharacterRole;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly visualTop: number;
  readonly visualBottom: number;
  readonly visibleHeight: number;
  readonly visibleHeightRatio: number;
  readonly targetVisibleHeight: number;
  readonly targetRatio: number;
  readonly minRatio: number;
  readonly maxRatio: number;
  readonly resolvedScale: number;
  readonly groundY: number;
  readonly footY: number;
  readonly footDelta: number;
  readonly parentScale: number;
  readonly result: 'PASS' | 'FAIL';
}

const getScaleY = (matrix: Phaser.GameObjects.Components.TransformMatrix): number => Math.hypot(matrix.b, matrix.d);

export function publishCharacterTelemetry(scene: Phaser.Scene, inputs: readonly CharacterTelemetryInput[]): void {
  const viewport = scene.scale.getViewPort?.() ?? new Phaser.Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height);
  const entries = inputs.filter((input) => (input.object as { active?: boolean }).active !== false).map((input): CharacterTelemetryEntry => {
    const profile = CHARACTER_VISUAL_PROFILES[input.profileId];
    const transform = input.object as unknown as Phaser.GameObjects.Components.Transform;
    const matrix = transform.getWorldTransformMatrix();
    const scaleY = getScaleY(matrix);
    const foot = matrix.transformPoint(profile.footAnchorLocalX, profile.footAnchorLocalY);
    const top = matrix.transformPoint(profile.footAnchorLocalX, profile.visibleTopLocal);
    const bottom = matrix.transformPoint(profile.footAnchorLocalX, profile.visibleBottomLocal);
    const visualTop = Math.min(top.y, bottom.y);
    const visualBottom = Math.max(top.y, bottom.y);
    const visibleHeight = visualBottom - visualTop;
    const visibleHeightRatio = visibleHeight / viewport.height;
    const targetVisibleHeight = input.sizing?.targetVisibleHeight
      ?? (input.role === DesktopCharacterRole.BOARD_ACTOR && input.cellHeight ? input.cellHeight * 0.72 : visibleHeight);
    const targetRatio = input.sizing?.targetRatio
      ?? (input.role === DesktopCharacterRole.BOARD_ACTOR && input.cellHeight ? 0.72 : visibleHeightRatio);
    const minRatio = input.sizing?.minRatio
      ?? (input.role === DesktopCharacterRole.BOARD_ACTOR ? 0.65 : targetRatio);
    const maxRatio = input.sizing?.maxRatio
      ?? (input.role === DesktopCharacterRole.BOARD_ACTOR ? 0.78 : targetRatio);
    const measuredRatio = input.role === DesktopCharacterRole.BOARD_ACTOR && input.cellHeight
      ? visibleHeight / input.cellHeight
      : visibleHeightRatio;
    const groundY = input.groundY ?? foot.y;
    const result = measuredRatio >= minRatio - 0.005 && measuredRatio <= maxRatio + 0.005 ? 'PASS' : 'FAIL';
    return {
      scene: scene.scene.key,
      characterId: input.characterId,
      profile: input.profileId,
      role: input.role,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      visualTop,
      visualBottom,
      visibleHeight,
      visibleHeightRatio,
      targetVisibleHeight,
      targetRatio,
      minRatio,
      maxRatio,
      resolvedScale: scaleY,
      groundY,
      footY: foot.y,
      footDelta: foot.y - groundY,
      parentScale: scaleY / Math.max(0.0001, transform.scaleY),
      result,
    };
  });
  const qa = window.__ROBOTLAB_QA__;
  if (!qa) return;
  const currentCharacters = qa.characters as CharacterTelemetryEntry[] | undefined;
  const existing = Array.isArray(currentCharacters) ? currentCharacters.filter((entry) => entry.scene !== scene.scene.key) : [];
  qa.characters = [...existing, ...entries];
}

