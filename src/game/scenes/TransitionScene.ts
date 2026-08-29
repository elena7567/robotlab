import Phaser from 'phaser';
import { sessionState } from '../state/sessionState';
import { addSceneTitle, addTextButton, markSceneReady } from '../ui/sceneUi';

export class TransitionScene extends Phaser.Scene {
  constructor() { super('TransitionScene'); }
  create(): void {
    const { width, height } = this.scale;
    const state = sessionState.snapshot;
    this.cameras.main.setBackgroundColor('#21486a');
    addSceneTitle(this, 'TRANSITION', `Temporary progress: ${state.completedTasks}/${state.totalTasks}`);
    addTextButton(this, width / 2 - 110, height - 100, 'BACK', () => this.scene.start('GameScene'));
    addTextButton(this, width / 2 + 110, height - 100, 'NEXT', () => this.scene.start('VictoryScene'));
    markSceneReady(this);
  }
}
