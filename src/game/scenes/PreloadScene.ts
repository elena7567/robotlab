import Phaser from 'phaser';
import { IMAGE_ASSETS, MISSING_ASSET_IDS } from '../assets/manifest';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload(): void {
    const { width, height } = this.scale;
    const progress = this.add.text(width / 2, height / 2, 'Loading 0%', {
      color: '#ffffff', fontFamily: 'Arial, sans-serif', fontSize: '30px',
    }).setOrigin(0.5);
    this.load.on('progress', (value: number) => progress.setText(`Loading ${Math.round(value * 100)}%`));
    for (const asset of IMAGE_ASSETS) this.load.image(asset.key, asset.path);
  }

  create(): void {
    for (const assetId of MISSING_ASSET_IDS) console.warn(`MISSING_ASSET: ${assetId}`);
    this.scene.start('StartScene');
  }
}
