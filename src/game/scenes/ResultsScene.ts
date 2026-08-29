import Phaser from 'phaser';
import { sessionState } from '../state/sessionState';
import { addSceneTitle, addTextButton, markSceneReady } from '../ui/sceneUi';

export class ResultsScene extends Phaser.Scene {
  constructor() { super('ResultsScene'); }
  create(): void {
    const { width, height } = this.scale;
    const state = sessionState.snapshot;
    this.cameras.main.setBackgroundColor('#17364c');
    addSceneTitle(this, 'RESULTS', `Temporary score: ${state.score}`);
    addTextButton(this, width / 2, height - 100, 'RESTART', () => { sessionState.reset(); this.scene.start('StartScene'); });
    markSceneReady(this);
  }
}
