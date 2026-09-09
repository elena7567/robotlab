import Phaser from 'phaser';
import type { ResponsiveLayout } from './responsiveLayout';
import type { SceneComposition } from './sceneCompositionDirector';
import { getImageVisibleAlphaBounds } from '../assets/objectBounds';

export interface BoundsAuditItem {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneBoundsAudit {
  readonly scene: string;
  readonly semanticMode: string;
  readonly compositionPolicyId?: string;
  readonly overlapCount: number;
  readonly overlaps: readonly string[];
  readonly outsideSafeRect: readonly string[];
  readonly undersizedTouchTargets: readonly string[];
  readonly childVisualReadability: 'PASS' | 'FAIL';
  readonly undersizedVisibleObjects: readonly string[];
  readonly visibleObjectBounds: readonly (BoundsAuditItem & { role: string })[];
  readonly interactiveHitBounds: readonly (BoundsAuditItem & { role: string })[];
  readonly characters: readonly { name: string; role: string; height: number; readable: boolean }[];
  readonly items: readonly BoundsAuditItem[];
}

const MAJOR_UI_NAME = /(?:home|sound|systems-progress|header|task-card|connection-task-card|programming-board|program-strip|instruction|route-label|hint-button|delete-button|run-button|play-button|continue|completion|start-title|start-subtitle|transition-title|transition-subtitle)$/;
const IGNORE_SAFE_NAME = /(?:completion|modal-blocker)$/;

interface AuditRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function objectBounds(item: Phaser.GameObjects.GameObject & { getBounds: () => Phaser.Geom.Rectangle }): Phaser.Geom.Rectangle {
  const declared = item.getData?.('auditBounds') as AuditRect | undefined;
  return declared
    ? new Phaser.Geom.Rectangle(declared.x, declared.y, declared.width, declared.height)
    : item.getBounds();
}

function rectIntersection(a: Phaser.Geom.Rectangle, b: Phaser.Geom.Rectangle): boolean {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

function isIntentionalOverlap(leftName: string, rightName: string): boolean {
  const pair = new Set([leftName, rightName]);
  return pair.has('programming-board') && pair.has('program-strip');
}

function insideRect(inner: Phaser.Geom.Rectangle, outer: Phaser.Geom.Rectangle, tolerance = 1): boolean {
  return inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance
    && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
}

function descendants(root: Phaser.GameObjects.GameObject): Phaser.GameObjects.GameObject[] {
  const result = [root];
  if (root instanceof Phaser.GameObjects.Container) {
    for (const child of root.list) result.push(...descendants(child));
  }
  return result;
}

function transformedLocalRect(object: Phaser.GameObjects.GameObject, local: AuditRect): Phaser.Geom.Rectangle {
  const transformable = object as Phaser.GameObjects.GameObject & { getWorldTransformMatrix: () => Phaser.GameObjects.Components.TransformMatrix };
  const matrix = transformable.getWorldTransformMatrix();
  const corners = [
    matrix.transformPoint(local.x, local.y),
    matrix.transformPoint(local.x + local.width, local.y),
    matrix.transformPoint(local.x + local.width, local.y + local.height),
    matrix.transformPoint(local.x, local.y + local.height),
  ];
  const xs = corners.map(({ x }) => x);
  const ys = corners.map(({ y }) => y);
  return new Phaser.Geom.Rectangle(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function minimumReadableCharacterHeight(object: Phaser.GameObjects.GameObject, role: string): number {
  if (role === 'BOARD_ACTOR') return Number(object.getData('cellSize') ?? 44) * 0.65;
  if (role === 'PRIMARY_CHARACTER') return 120;
  if (role === 'SUPPORTING_CHARACTER') return 72;
  if (role === 'HERO') return 120;
  return 72;
}

export function auditSceneBounds(scene: Phaser.Scene): SceneBoundsAudit {
  const layout = scene.game.registry.get('responsiveLayout') as ResponsiveLayout | undefined;
  const composition = scene.game.registry.get('sceneComposition') as SceneComposition | undefined;
  const safe = layout?.safeRect ?? { x: 0, y: 0, width: scene.scale.width, height: scene.scale.height };
  const safeRect = new Phaser.Geom.Rectangle(safe.x, safe.y, safe.width, safe.height);
  const modalActive = Boolean(scene.children.getByName('mission7-completion') || scene.children.getByName('mission8-completion'));
  const topLevel = scene.children.list.filter((item): item is Phaser.GameObjects.GameObject & { getBounds: () => Phaser.Geom.Rectangle } => {
    const candidate = item as Phaser.GameObjects.GameObject & { getBounds?: () => Phaser.Geom.Rectangle; visible?: boolean };
    if (!candidate.visible || typeof candidate.getBounds !== 'function' || !candidate.name) return false;
    if (modalActive) return /(?:completion|continue)$/.test(candidate.name);
    return MAJOR_UI_NAME.test(candidate.name);
  });
  const items = topLevel.map((item) => {
    const bounds = objectBounds(item);
    return { object: item, bounds, item: { name: item.name, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
  }).filter(({ bounds }) => bounds.width > 0 && bounds.height > 0);
  const overlaps: string[] = [];
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      if (/completion/.test(items[left].item.name) && /continue/.test(items[right].item.name)
        || /continue/.test(items[left].item.name) && /completion/.test(items[right].item.name)) continue;
      if (isIntentionalOverlap(items[left].item.name, items[right].item.name)) continue;
      if (rectIntersection(items[left].bounds, items[right].bounds)) overlaps.push(`${items[left].item.name} × ${items[right].item.name}`);
    }
  }
  const outsideSafeRect = items
    .filter(({ item, bounds }) => !IGNORE_SAFE_NAME.test(item.name) && !insideRect(bounds, safeRect))
    .map(({ item }) => item.name);
  const undersizedTouchTargets = items
    .filter(({ object, bounds }) => {
      const input = (object as Phaser.GameObjects.GameObject & { input?: Phaser.Types.Input.InteractiveObject | null }).input;
      const hitArea = input?.hitArea as { width?: number; height?: number } | undefined;
      const hitWidth = Number(hitArea?.width ?? bounds.width);
      const hitHeight = Number(hitArea?.height ?? bounds.height);
      return Boolean(input?.enabled) && (hitWidth < 44 || hitHeight < 44);
    })
    .map(({ item }) => item.name);
  const characters = scene.children.list.flatMap(descendants).flatMap((object) => {
    const role = object.getData?.('characterRole') as string | undefined;
    const bounded = object as Phaser.GameObjects.GameObject & { getBounds?: () => Phaser.Geom.Rectangle };
    if (!role || typeof bounded.getBounds !== 'function' || !(object as Phaser.GameObjects.GameObject & { visible?: boolean }).visible) return [];
    const height = bounded.getBounds().height;
    const minimum = minimumReadableCharacterHeight(object, role);
    return [{ name: object.name || role, role, height: Math.round(height), readable: height >= minimum }];
  });
  const allObjects = scene.children.list.flatMap(descendants);
  const visibleObjectBounds = allObjects.flatMap((object) => {
    const visible = (object as Phaser.GameObjects.GameObject & { visible?: boolean }).visible;
    const role = object.getData?.('childVisualRole') as string | undefined;
    if (!visible || !role) return [];
    let bounds: Phaser.Geom.Rectangle | undefined;
    if (object instanceof Phaser.GameObjects.Image) bounds = getImageVisibleAlphaBounds(object);
    else {
      const local = object.getData?.('visualLocalBounds') as AuditRect | undefined;
      if (local && 'getWorldTransformMatrix' in object) bounds = transformedLocalRect(object, local);
    }
    return bounds ? [{ name: object.name || role, role, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }] : [];
  });
  const interactiveHitBounds = allObjects.flatMap((object) => {
    const input = (object as Phaser.GameObjects.GameObject & { input?: Phaser.Types.Input.InteractiveObject | null }).input;
    const role = object.getData?.('childVisualRole') as string | undefined;
    if (!input?.enabled || !role || !('getWorldTransformMatrix' in object)) return [];
    const area = input.hitArea as { x?: number; y?: number; width?: number; height?: number };
    const width = Number(area.width ?? 0);
    const height = Number(area.height ?? 0);
    const displayOriginX = Number((object as Phaser.GameObjects.GameObject & { displayOriginX?: number }).displayOriginX ?? width / 2);
    const displayOriginY = Number((object as Phaser.GameObjects.GameObject & { displayOriginY?: number }).displayOriginY ?? height / 2);
    const bounds = transformedLocalRect(object, {
      x: Number(area.x ?? 0) - displayOriginX,
      y: Number(area.y ?? 0) - displayOriginY,
      width,
      height,
    });
    return [{ name: object.name || role, role, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }];
  });
  const shortLandscape = layout?.semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const undersizedVisibleObjects = visibleObjectBounds.filter((item) => {
    if (item.role === 'SEQUENCE_SYMBOL') return Math.max(item.width, item.height) < 47.5;
    if (item.role === 'ANSWER_CARD') return shortLandscape && (item.width < 80 || item.height < 56);
    if (item.role === 'ANSWER_SYMBOL') return Math.max(item.width, item.height) < 39.5;
    if (item.role === 'MEMORY_CARD') return shortLandscape && (item.width < 90 || item.height < 58);
    if (item.role === 'MEMORY_ARTWORK') return Math.max(item.width, item.height) < 52;
    return false;
  }).map((item) => item.name);
  return {
    scene: scene.scene.key,
    semanticMode: layout?.semanticMode ?? 'UNKNOWN',
    compositionPolicyId: composition?.policyId,
    overlapCount: overlaps.length,
    overlaps,
    outsideSafeRect,
    undersizedTouchTargets,
    childVisualReadability: undersizedVisibleObjects.length === 0 ? 'PASS' : 'FAIL',
    undersizedVisibleObjects,
    visibleObjectBounds,
    interactiveHitBounds,
    characters,
    items: items.map(({ item }) => item),
  };
}

export function scheduleSceneBoundsAudit(scene: Phaser.Scene): void {
  scene.time.delayedCall(0, () => {
    if (!scene.sys.isActive()) return;
    const report = auditSceneBounds(scene);
    scene.game.registry.set('boundsAudit', report);
    if (report.overlapCount > 0) console.error('[RobotLab layout] unintended overlaps', report);
  });
}
