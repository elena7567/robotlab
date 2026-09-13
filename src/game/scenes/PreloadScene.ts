import Phaser from 'phaser';
import { AUDIO_ASSETS, IMAGE_ASSETS, MISSING_ASSET_IDS } from '../assets/manifest';
import { audioManager } from '../audio/AudioManager';
import { robotTestCourse } from '../mechanics/robotTestCourse';
import { sessionState } from '../state/sessionState';
import { mission10Controller } from '../mechanics/mission10/mission10Controller.ts';
import type { Mission10StageShortcut } from '../mechanics/mission10/mission10State.ts';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload(): void {
    const { width, height } = this.scale;
    const progress = this.add.text(width / 2, height / 2, 'Loading 0%', {
      color: '#ffffff', fontFamily: 'Arial, sans-serif', fontSize: '30px',
    }).setOrigin(0.5);
    this.load.on('progress', (value: number) => progress.setText(`Loading ${Math.round(value * 100)}%`));
    for (const asset of IMAGE_ASSETS) this.load.image(asset.key, asset.path);
    for (const asset of AUDIO_ASSETS) this.load.audio(asset.key, asset.path);
  }

  create(): void {
    audioManager.initialize(this.game);
    for (const assetId of MISSING_ASSET_IDS) console.warn(`MISSING_ASSET: ${assetId}`);
    const query = new URLSearchParams(globalThis.location?.search ?? '');
    if (query.get('qaMission') === '9') {
      sessionState.enterMission9Qa();
      robotTestCourse.reset();
      this.scene.start('Mission9Scene');
      return;
    }
    if (query.get('qaMission') === '10') {
      sessionState.enterMission10Qa();
      const requested = (query.get('stage') ?? 'intro').toLowerCase();
      const shortcuts: readonly Mission10StageShortcut[] = ['intro', 'path', 'energy', 'signal', 'launch', 'final', 'complete'];
      const stage = shortcuts.includes(requested as Mission10StageShortcut) ? requested as Mission10StageShortcut : 'intro';
      mission10Controller.initializeStageShortcut(stage, 1010);
      this.scene.start('Mission10Scene');
      return;
    }
    this.scene.start('StartScene');
  }
}
