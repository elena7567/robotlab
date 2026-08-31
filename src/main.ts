import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { installViewportDebugOverlay, installVisualViewportSizing } from './game/ui/viewport';
import './style.css';

const game = new Phaser.Game(gameConfig);
const removeViewportSizing = installVisualViewportSizing(game);
game.events.once(Phaser.Core.Events.DESTROY, removeViewportSizing);
installViewportDebugOverlay(game);

declare global {
  interface Window {
    __ROBOTLAB_GAME__?: Phaser.Game;
  }
}

window.__ROBOTLAB_GAME__ = game;
