import Phaser from 'phaser';
import { gameConfig } from './game/config';
import './style.css';

const game = new Phaser.Game(gameConfig);

declare global {
  interface Window {
    __ROBOTLAB_GAME__?: Phaser.Game;
  }
}

window.__ROBOTLAB_GAME__ = game;
