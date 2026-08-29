import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { IntroScene } from './scenes/IntroScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultsScene } from './scenes/ResultsScene';
import { RobotAssemblyPreviewScene } from './scenes/RobotAssemblyPreviewScene';
import { StartScene } from './scenes/StartScene';
import { TransitionScene } from './scenes/TransitionScene';
import { VictoryScene } from './scenes/VictoryScene';
import { Mission6Scene } from './scenes/Mission6Scene';
import { Mission7Scene } from './scenes/Mission7Scene';

export const REFERENCE_WIDTH = 1280;
export const REFERENCE_HEIGHT = 720;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: REFERENCE_WIDTH,
  height: REFERENCE_HEIGHT,
  backgroundColor: '#0b1d36',
  // RobotAssemblyPreviewScene is dev/QA-only and is never entered by production flow.
  scene: [BootScene, PreloadScene, StartScene, IntroScene, GameScene, TransitionScene, Mission6Scene, Mission7Scene, VictoryScene, ResultsScene, RobotAssemblyPreviewScene],
  input: { activePointers: 2, touch: { capture: true } },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 320, height: 320 },
  },
  render: { antialias: true, pixelArt: false },
};
