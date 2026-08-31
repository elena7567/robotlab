import type Phaser from 'phaser';

export interface ViewportMetrics {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly visualViewportWidth: number;
  readonly visualViewportHeight: number;
  readonly visualViewportOffsetLeft: number;
  readonly visualViewportOffsetTop: number;
  readonly safeTop: number;
  readonly safeRight: number;
  readonly safeBottom: number;
  readonly safeLeft: number;
  readonly orientation: 'portrait' | 'landscape';
  readonly aspectRatio: number;
  readonly devicePixelRatio: number;
}

export interface CommittedViewportDetail {
  readonly generation: number;
  readonly viewport: ViewportMetrics;
  readonly parentSize: { readonly width: number; readonly height: number };
  readonly displaySize: { readonly width: number; readonly height: number };
  readonly gameSize: { readonly width: number; readonly height: number };
}

const SETTLE_QUIET_MS = 140;
const STABLE_FRAME_COUNT = 3;
const MAX_SETTLE_FRAMES = 18;

function readSafeInsets(): Pick<ViewportMetrics, 'safeTop' | 'safeRight' | 'safeBottom' | 'safeLeft'> {
  if (typeof document === 'undefined') return { safeTop: 0, safeRight: 0, safeBottom: 0, safeLeft: 0 };
  const styles = getComputedStyle(document.documentElement);
  const read = (property: string): number => Number.parseFloat(styles.getPropertyValue(property)) || 0;
  return {
    safeTop: read('--safe-area-top'), safeRight: read('--safe-area-right'),
    safeBottom: read('--safe-area-bottom'), safeLeft: read('--safe-area-left'),
  };
}

export function readViewportMetrics(): ViewportMetrics {
  const visual = window.visualViewport;
  const visualViewportWidth = Math.round(visual?.width ?? window.innerWidth);
  const visualViewportHeight = Math.round(visual?.height ?? window.innerHeight);
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualViewportWidth,
    visualViewportHeight,
    visualViewportOffsetLeft: Math.round(visual?.offsetLeft ?? 0),
    visualViewportOffsetTop: Math.round(visual?.offsetTop ?? 0),
    ...readSafeInsets(),
    orientation: visualViewportHeight >= visualViewportWidth ? 'portrait' : 'landscape',
    aspectRatio: visualViewportWidth / Math.max(1, visualViewportHeight),
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

export function installVisualViewportSizing(game: Phaser.Game): () => void {
  let frame = 0;
  let inputSyncFrame = 0;
  let quietTimer = 0;
  let settleFrames = 0;
  let stableFrames = 0;
  let candidateSignature = '';
  let committedSignature = '';
  let generation = 0;

  const syncInputTransform = (): void => {
    // Mobile browser chrome can change the canvas' rendered CSS box without
    // Phaser receiving a matching resize before the next finger-down. Refresh
    // the DOM bounds in the capture phase so that the same visible point maps
    // to the same game point even when the canvas is vertically compressed.
    game.scale.updateBounds();
    game.scale.displayScale.set(
      game.scale.baseSize.width / Math.max(1, game.scale.canvasBounds.width),
      game.scale.baseSize.height / Math.max(1, game.scale.canvasBounds.height),
    );
  };

  const scheduleInputTransformSync = (): void => {
    if (inputSyncFrame) cancelAnimationFrame(inputSyncFrame);
    inputSyncFrame = requestAnimationFrame(() => {
      inputSyncFrame = 0;
      syncInputTransform();
    });
  };

  const geometrySignature = (metrics: ViewportMetrics): string => [
    metrics.visualViewportWidth, metrics.visualViewportHeight,
    metrics.innerWidth, metrics.innerHeight,
    metrics.safeTop, metrics.safeRight, metrics.safeBottom, metrics.safeLeft,
  ].join('|');

  const commit = (metrics: ViewportMetrics): void => {
    frame = 0;
    const signature = geometrySignature(metrics);
    const alreadySynchronized = committedSignature === signature
      && game.scale.parentSize.width === metrics.visualViewportWidth
      && game.scale.parentSize.height === metrics.visualViewportHeight
      && game.scale.displaySize.width === metrics.visualViewportWidth
      && game.scale.displaySize.height === metrics.visualViewportHeight
      && game.scale.gameSize.width === metrics.visualViewportWidth
      && game.scale.gameSize.height === metrics.visualViewportHeight;
    if (alreadySynchronized) return;

    document.documentElement.style.setProperty('--app-visible-width', `${metrics.visualViewportWidth}px`);
    document.documentElement.style.setProperty('--app-visible-height', `${metrics.visualViewportHeight}px`);

    // Reading the parent after changing the CSS variables forces the browser to
    // commit its final box before Phaser refreshes. ScaleManager.resize() uses
    // parentSize in RESIZE mode, so updating those bounds first is essential.
    game.scale.getParentBounds();
    game.scale.resize(metrics.visualViewportWidth, metrics.visualViewportHeight);
    committedSignature = signature;

    const detail: CommittedViewportDetail = {
      generation: ++generation,
      viewport: metrics,
      parentSize: { width: game.scale.parentSize.width, height: game.scale.parentSize.height },
      displaySize: { width: game.scale.displaySize.width, height: game.scale.displaySize.height },
      gameSize: { width: game.scale.gameSize.width, height: game.scale.gameSize.height },
    };
    game.registry.set('committedViewport', detail);
    game.registry.set('scaleManagerMetrics', {
      parentSize: detail.parentSize, displaySize: detail.displaySize, gameSize: detail.gameSize,
    });
    window.dispatchEvent(new CustomEvent<CommittedViewportDetail>('robotlab:viewport', { detail }));
    scheduleInputTransformSync();
  };

  const settle = (): void => {
    frame = 0;
    const metrics = readViewportMetrics();
    const signature = geometrySignature(metrics);
    settleFrames += 1;
    if (signature === candidateSignature) stableFrames += 1;
    else {
      candidateSignature = signature;
      stableFrames = 1;
    }

    if (stableFrames < STABLE_FRAME_COUNT && settleFrames < MAX_SETTLE_FRAMES) {
      frame = requestAnimationFrame(settle);
      return;
    }
    commit(metrics);
  };
  const schedule = (): void => {
    if (frame) cancelAnimationFrame(frame);
    if (quietTimer) window.clearTimeout(quietTimer);
    settleFrames = 0;
    stableFrames = 0;
    candidateSignature = '';
    // Mobile browser chrome can pause at several intermediate sizes for more
    // than two frames. Begin stability sampling only after the event burst has
    // been quiet briefly, then require three identical live reads.
    quietTimer = window.setTimeout(() => {
      quietTimer = 0;
      frame = requestAnimationFrame(settle);
    }, SETTLE_QUIET_MS);
  };
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  game.canvas.addEventListener('pointerdown', syncInputTransform, { capture: true, passive: true });
  game.canvas.addEventListener('touchstart', syncInputTransform, { capture: true, passive: true });
  schedule();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    if (inputSyncFrame) cancelAnimationFrame(inputSyncFrame);
    if (quietTimer) window.clearTimeout(quietTimer);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
    game.canvas.removeEventListener('pointerdown', syncInputTransform, { capture: true });
    game.canvas.removeEventListener('touchstart', syncInputTransform, { capture: true });
  };
}

export function installViewportDebugOverlay(game: Phaser.Game): void {
  const dev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ?? false;
  if (!dev) return;
  const enabled = new URLSearchParams(location.search).has('viewportDebug');
  if (!enabled) {
    console.info('[RobotLab viewport]', readViewportMetrics());
    return;
  }
  const overlay = document.createElement('pre');
  overlay.id = 'robotlab-viewport-debug';
  document.body.append(overlay);
  const render = (): void => {
    const metrics = readViewportMetrics();
    const canvas = game.canvas?.getBoundingClientRect();
    const layout = game.registry.get('responsiveLayout') as { compositionName?: string; mode?: string } | undefined;
    overlay.textContent = [
      `inner ${metrics.innerWidth}×${metrics.innerHeight}`,
      `visual ${metrics.visualViewportWidth}×${metrics.visualViewportHeight}`,
      `safe ${metrics.safeTop}/${metrics.safeRight}/${metrics.safeBottom}/${metrics.safeLeft}`,
      `dpr ${metrics.devicePixelRatio}`,
      `canvas ${Math.round(canvas?.width ?? 0)}×${Math.round(canvas?.height ?? 0)}`,
      `game ${game.scale.width}×${game.scale.height}`,
      `scale ${game.scale.displayScale.x.toFixed(3)}×${game.scale.displayScale.y.toFixed(3)}`,
      `mode ${layout?.compositionName ?? layout?.mode ?? 'boot'}`,
    ].join('\n');
  };
  window.addEventListener('robotlab:viewport', render);
  window.setInterval(render, 500);
  render();
}
