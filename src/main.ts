import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { robotTestCourse } from './game/mechanics/robotTestCourse';
import { sessionState } from './game/state/sessionState';
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
    };
  }
}

window.__ROBOTLAB_GAME__ = game;
window.__ROBOTLAB_QA__ = { sessionState, robotTestCourse };
