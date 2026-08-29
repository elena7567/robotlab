import Phaser from 'phaser';
import { addSceneTitle, addTextButton, markSceneReady } from '../ui/sceneUi';

export class IntroScene extends Phaser.Scene {
  constructor() { super('IntroScene'); }
  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#15395b');
    addSceneTitle(this, 'INTRO', 'The robot needs help. Educational gameplay comes in a later stage.');
    addTextButton(this, width / 2 - 110, height - 100, 'BACK', () => this.scene.start('StartScene'));
    addTextButton(this, width / 2 + 110, height - 100, 'NEXT', () => this.scene.start('GameScene'));
    markSceneReady(this);
  }
}
