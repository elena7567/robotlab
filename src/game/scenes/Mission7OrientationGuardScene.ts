import Phaser from 'phaser';
import { createResponsiveLayout } from '../ui/responsiveLayout';
import { addRobotLabOrientationGate } from '../ui/sceneLayout';
import { readViewportMetrics, type CommittedViewportDetail } from '../ui/viewport';
import { markSceneReady } from '../ui/sceneUi';

export class Mission7OrientationGuardScene extends Phaser.Scene {
  private retryFrame = 0;

  constructor() { super('Mission7OrientationGuardScene'); }

  create(): void {
    this.game.registry.set('mission7OrientationGate', false);
    this.game.registry.set('mission7InputActive', false);

    if (this.tryEnterMission7()) return;

    const { width, height } = this.scale;
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.cameras.main.setBackgroundColor('#173b52');
    this.add.rectangle(0, 0, width, height, 0x071f35, 0.92).setOrigin(0).setName('mission7-preentry-screen');
    addRobotLabOrientationGate(this, { name: 'mission7-preentry-orientation-gate', reducedMotion, targetOrientation: 'portrait' });
    this.game.registry.set('mission7OrientationGate', true);
    this.installViewportWatch();
    markSceneReady(this);
  }

  private tryEnterMission7(): boolean {
    const viewport = readViewportMetrics();
    const width = Math.max(320, viewport.visualViewportWidth);
    const height = Math.max(320, viewport.visualViewportHeight);
    const layout = createResponsiveLayout(width, height, viewport);
    if (viewport.orientation !== 'portrait' && layout.deviceLayoutClass !== 'DESKTOP') return false;
    this.game.registry.set('mission7OrientationGate', false);
    this.game.registry.set('mission7InputActive', false);
    if (Math.round(this.scale.width) !== width || Math.round(this.scale.height) !== height) {
      this.scale.resize(width, height);
    }
    this.scene.start('Mission7Scene');
    return true;
  }

  private installViewportWatch(): void {
    const scheduleCheck = (): void => {
      if (this.retryFrame) cancelAnimationFrame(this.retryFrame);
      this.retryFrame = requestAnimationFrame(() => {
        this.retryFrame = 0;
        if (!this.sys.isActive()) return;
        void this.tryEnterMission7();
      });
    };
    const onViewportCommit = (event: Event): void => {
      const detail = (event as CustomEvent<CommittedViewportDetail>).detail;
      const viewport = detail?.viewport;
      if (!viewport) return;
      const width = Math.max(320, viewport.visualViewportWidth);
      const height = Math.max(320, viewport.visualViewportHeight);
      const layout = createResponsiveLayout(width, height, viewport);
      if (viewport.orientation === 'portrait' || layout.deviceLayoutClass === 'DESKTOP') scheduleCheck();
    };
    const cleanup = (): void => {
      if (this.retryFrame) cancelAnimationFrame(this.retryFrame);
      this.retryFrame = 0;
      window.removeEventListener('robotlab:viewport', onViewportCommit);
      window.removeEventListener('resize', scheduleCheck);
      window.removeEventListener('orientationchange', scheduleCheck);
      window.visualViewport?.removeEventListener('resize', scheduleCheck);
    };

    window.addEventListener('robotlab:viewport', onViewportCommit);
    window.addEventListener('resize', scheduleCheck, { passive: true });
    window.addEventListener('orientationchange', scheduleCheck, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleCheck, { passive: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  }
}
