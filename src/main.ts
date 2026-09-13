import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { robotTestCourse } from './game/mechanics/robotTestCourse';
import { sessionState } from './game/state/sessionState';
import { mission10Controller } from './game/mechanics/mission10/mission10Controller.ts';
import { installViewportDebugOverlay, installVisualViewportSizing } from './game/ui/viewport';
import './style.css';

const game = new Phaser.Game(gameConfig);
const removeViewportSizing = installVisualViewportSizing(game);
game.events.once(Phaser.Core.Events.DESTROY, removeViewportSizing);
installViewportDebugOverlay(game);

declare global {
  interface Window {
    __ROBOTLAB_GAME__?: Phaser.Game;
    __ROBOTLAB_QA__?: {
      sessionState: typeof sessionState;
      robotTestCourse: typeof robotTestCourse;
      mission10Controller: typeof mission10Controller;
    };
  }
}

window.__ROBOTLAB_GAME__ = game;
window.__ROBOTLAB_QA__ = { sessionState, robotTestCourse, mission10Controller };
