import Phaser from 'phaser';
import { addCoverImage, restartOnViewportResize } from '../ui/sceneLayout';
import { RobotAssemblyPreview, type RobotAssemblyState } from '../ui/RobotAssemblyPreview';
import { markSceneReady } from '../ui/sceneUi';
import { UI_FONT } from '../ui/visualTheme';
import { deriveAssemblyProgress } from '../state/robotAssemblyState';

interface PreviewSceneData {
  state?: RobotAssemblyState;
}

const normalizeState = (state: number | undefined): RobotAssemblyState => deriveAssemblyProgress(state ?? 0);

export class RobotAssemblyPreviewScene extends Phaser.Scene {
  private previewState: RobotAssemblyState = 0;

  constructor() { super('RobotAssemblyPreviewScene'); }

  init(data: PreviewSceneData): void {
    this.previewState = normalizeState(data.state);
  }

  create(): void {
    const { width, height } = this.scale;
    const portrait = width < height;
    this.cameras.main.setBackgroundColor('#102d45');
    addCoverImage(this, 'bg-main-laboratory');
    const background = this.children.list.find((child) => child instanceof Phaser.GameObjects.Image) as Phaser.GameObjects.Image | undefined;
    background?.setAlpha(0.42).setName('assembly-preview-background');
    this.add.rectangle(0, 0, width, height, 0x0a2841, 0.48).setOrigin(0);

    const titleSize = Math.max(24, Math.min(42, width * 0.055, height * 0.065));
    const titleY = Math.max(42, height * 0.09);
    this.add.text(width / 2, titleY, 'СБОРКА РОБОТА', {
      fontFamily: UI_FONT, fontSize: `${titleSize}px`, fontStyle: 'bold', color: '#ffffff',
      stroke: '#315b7b', strokeThickness: 6,
    }).setOrigin(0.5).setName('assembly-preview-title');
    this.add.text(width / 2, titleY + titleSize * 0.92, 'ВИЗУАЛЬНЫЙ МАКЕТ • БЕЗ ИГРОВОЙ ЛОГИКИ', {
      fontFamily: UI_FONT, fontSize: `${Math.max(11, Math.min(17, width * 0.026))}px`,
      fontStyle: 'bold', color: '#b9eaf3', align: 'center', wordWrap: { width: width - 32 },
    }).setOrigin(0.5).setName('assembly-preview-subtitle');

    const stationWidth = Math.min(portrait ? width - 34 : 440, width - 34);
    const stationTop = Math.max(titleY + titleSize * 1.75, height * (portrait ? 0.23 : 0.2));
    const preferredStationHeight = stationWidth / 1.28;
    const stationBottom = Math.min(height - 74, stationTop + preferredStationHeight);
    const feetY = stationBottom - Math.max(18, (stationBottom - stationTop) * 0.07);
    this.drawRepairStation(width / 2, stationTop, stationWidth, stationBottom - stationTop, feetY);

    const robot = new RobotAssemblyPreview(this, width / 2, feetY, this.previewState);
    const stateLabels: Readonly<Record<RobotAssemblyState, string>> = {
      0: '0/5 • ЧЕРТЁЖ',
      1: '1/5 • КОРПУС',
      2: '2/5 • КОРПУС + ГОЛОВА',
      3: '3/5 • НОГИ',
      4: '4/5 • РУКИ',
      5: '5/5 • ГОТОВ К АКТИВАЦИИ',
    };
    const stateLabel = stateLabels[this.previewState];
    const label = this.add.text(width / 2, Math.min(height - 35, stationBottom + 30), stateLabel, {
      fontFamily: UI_FONT, fontSize: `${Math.max(16, Math.min(24, width * 0.045))}px`,
      fontStyle: 'bold', color: this.previewState === 5 ? '#fff1a8' : '#d5f8ff',
      backgroundColor: '#153b59', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setName('assembly-state-label');
    if (label.width > width - 24) label.setScale((width - 24) / label.width);

    robot.setData({ stationTop, stationBottom, stationWidth, stateLabel });
    restartOnViewportResize(this);
    markSceneReady(this);
  }

  private drawRepairStation(x: number, top: number, width: number, height: number, feetY: number): void {
    const graphics = this.add.graphics().setName('assembly-repair-stand');
    const left = x - width / 2;
    graphics.fillStyle(0x0b2238, 1);
    graphics.fillRoundedRect(left, top, width, height, 24);
    graphics.lineStyle(2, 0x69ddec, 0.48);
    graphics.strokeRoundedRect(left, top, width, height, 24);
    graphics.lineStyle(1, 0x8df2ff, 0.2);
    graphics.strokeRoundedRect(left + 9, top + 9, width - 18, height - 18, 18);

    const bracket = Math.max(18, width * 0.07);
    graphics.lineStyle(3, 0x58ccdd, 0.38);
    graphics.lineBetween(left + 18, top + 28, left + 18 + bracket, top + 28);
    graphics.lineBetween(left + 18, top + 28, left + 18, top + 28 + bracket);
    graphics.lineBetween(left + width - 18 - bracket, top + 28, left + width - 18, top + 28);
    graphics.lineBetween(left + width - 18, top + 28, left + width - 18, top + 28 + bracket);

    graphics.fillStyle(0x48d9e9, 0.08);
    graphics.fillEllipse(x, feetY + 7, width * 0.76, 42);
    graphics.fillStyle(0x102f49, 1);
    graphics.fillRoundedRect(left + 18, feetY - 4, width - 36, 35, 16);
    graphics.lineStyle(3, 0x62dce9, 0.72);
    graphics.strokeRoundedRect(left + 18, feetY - 4, width - 36, 35, 16);
    graphics.lineStyle(2, 0xc4f8ff, 0.28);
    graphics.lineBetween(left + 44, feetY + 4, left + width - 44, feetY + 4);

    graphics.fillStyle(0x7ceafa, 0.8);
    graphics.fillCircle(left + 34, top + 28, 4);
    graphics.fillCircle(left + width - 34, top + 28, 4);
    graphics.setData({ feetContactX: x, feetContactY: feetY, top, width, height });
  }
}
