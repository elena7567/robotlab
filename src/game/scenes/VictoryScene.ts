import Phaser from 'phaser';
import { addSceneTitle, addTextButton, markSceneReady } from '../ui/sceneUi';

export class VictoryScene extends Phaser.Scene {
  constructor() { super('VictoryScene'); }
  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#315f75');
    addSceneTitle(this, 'VICTORY', 'Temporary end-of-flow screen');
    addTextButton(this, width / 2 - 110, height - 100, 'BACK', () => this.scene.start('TransitionScene'));
    addTextButton(this, width / 2 + 110, height - 100, 'NEXT', () => this.scene.start('ResultsScene'));
    markSceneReady(this);
  }
}
