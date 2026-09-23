import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { energyMechanic } from './game/mechanics/energy';
import { programmingMechanic } from './game/mechanics/programming';
import { robotTestCourse } from './game/mechanics/robotTestCourse';
import { sessionState } from './game/state/sessionState';
import { mission10Controller } from './game/mechanics/mission10/mission10Controller.ts';
import { installViewportDebugOverlay, installVisualViewportSizing } from './game/ui/viewport';
import './style.css';

declare const __ROBOTLAB_BUILD_IDENTITY__: {
  readonly gitHead: string;
  readonly timestamp: string;
};

interface RobotLabBuildIdentity {
  readonly gitHead: string;
  readonly timestamp: string;
  readonly mainJsBundle: string;
}

function resolveMainJsBundle(): string {
  const entry = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')]
    .map((script) => new URL(script.src, window.location.href).pathname.split('/').pop() ?? '')
    .find((filename) => filename.endsWith('.js'));
  return entry || 'UNKNOWN';
}

function installBuildDebugStamp(build: RobotLabBuildIdentity): void {
  if (new URLSearchParams(window.location.search).get('buildDebug') !== '1') return;

  const stamp = document.createElement('pre');
  stamp.id = 'robotlab-build-debug';
  stamp.textContent = `git HEAD: ${build.gitHead}\nbuild timestamp: ${build.timestamp}\nmain JS bundle: ${build.mainJsBundle}`;
  Object.assign(stamp.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    zIndex: '2147483647',
    margin: '0',
    padding: '8px 10px',
    maxWidth: 'calc(100vw - 16px)',
    overflow: 'auto',
    border: '1px solid #8ff',
    borderRadius: '4px',
    background: 'rgba(0, 18, 24, 0.92)',
    color: '#dfffff',
    font: '12px/1.4 monospace',
    pointerEvents: 'none',
  });
  document.body.append(stamp);
}

const game = new Phaser.Game(gameConfig);
const removeViewportSizing = installVisualViewportSizing(game);
game.events.once(Phaser.Core.Events.DESTROY, removeViewportSizing);
installViewportDebugOverlay(game);

declare global {
  interface Window {
    __ROBOTLAB_GAME__?: Phaser.Game;
    __ROBOTLAB_QA__?: {
      sessionState: typeof sessionState;
      energyMechanic: typeof energyMechanic;
      programmingMechanic: typeof programmingMechanic;
      robotTestCourse: typeof robotTestCourse;
      mission10Controller: typeof mission10Controller;
      build: RobotLabBuildIdentity;
      mission7?: unknown;
      characters?: unknown[];
    };
  }
}

window.__ROBOTLAB_GAME__ = game;
const build: RobotLabBuildIdentity = {
  ...__ROBOTLAB_BUILD_IDENTITY__,
  mainJsBundle: resolveMainJsBundle(),
};
window.__ROBOTLAB_QA__ = { sessionState, energyMechanic, programmingMechanic, robotTestCourse, mission10Controller, build };
installBuildDebugStamp(build);

