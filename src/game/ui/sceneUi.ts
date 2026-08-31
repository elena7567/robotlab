import Phaser from 'phaser';
import { scheduleSceneBoundsAudit } from './layoutAudit';

export function addSceneTitle(scene: Phaser.Scene, title: string, subtitle: string): void {
  const { width } = scene.scale;
  scene.add.text(width / 2, 105, title, {
    color: '#ffffff', fontFamily: 'Arial, sans-serif', fontSize: '56px', fontStyle: 'bold', align: 'center',
  }).setOrigin(0.5);
  scene.add.text(width / 2, 170, subtitle, {
    color: '#bce7ff', fontFamily: 'Arial, sans-serif', fontSize: '26px', align: 'center', wordWrap: { width: 1000 },
  }).setOrigin(0.5);
}

export function addTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: 'START' | 'NEXT' | 'BACK' | 'RESTART',
  onActivate: () => void,
): Phaser.GameObjects.Text {
  const button = scene.add.text(x, y, label, {
    color: '#08213b', backgroundColor: '#65dcff', fontFamily: 'Arial, sans-serif',
    fontSize: '30px', fontStyle: 'bold', padding: { x: 28, y: 16 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  button.on('pointerover', () => button.setStyle({ backgroundColor: '#a8edff' }));
  button.on('pointerout', () => button.setStyle({ backgroundColor: '#65dcff' }));
  button.on('pointerdown', () => { button.disableInteractive(); onActivate(); });
  return button;
}

export function markSceneReady(scene: Phaser.Scene): void {
  scene.game.registry.set('activeScene', scene.scene.key);
  scheduleSceneBoundsAudit(scene);
}
