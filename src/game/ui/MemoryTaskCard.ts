import Phaser from 'phaser';
import type { MemoryCardStateData, MemorySelectionResult, MemorySnapshot } from '../mechanics/memory';
import { addControl, setControlEnabled } from './controls';
import type { CompositionMode, TaskCardSizing } from './responsiveLayout';
import { UI_COLORS, UI_FONT } from './visualTheme';

export interface MemoryTaskCardConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly sizing: TaskCardSizing;
  readonly mode: CompositionMode;
  readonly snapshot: MemorySnapshot;
  readonly reducedMotion: boolean;
  readonly onCard: (cardId: string) => MemorySelectionResult;
  readonly onHint: () => readonly string[];
}

interface MemoryCardView {
  readonly container: Phaser.GameObjects.Container;
  readonly frame: Phaser.GameObjects.Graphics;
  readonly cover: Phaser.GameObjects.Image;
  readonly face: Phaser.GameObjects.Image;
  state: MemoryCardStateData['state'];
}

export class MemoryTaskCard extends Phaser.GameObjects.Container {
  private readonly cardViews = new Map<string, MemoryCardView>();
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly hintButton: Phaser.GameObjects.Container;
  private readonly reducedMotion: boolean;
  private hintLocked = false;
  private hintTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, config: MemoryTaskCardConfig) {
    super(scene, config.x, config.y);
    scene.add.existing(this);
    this.setName('memory-task-card');
    this.reducedMotion = config.reducedMotion;
    const { sizing } = config;
    const body = scene.add.graphics();
    body.fillStyle(0x2a3451, 0.2).fillRoundedRect(5, 8, config.width, config.height, sizing.radius);
    body.fillStyle(UI_COLORS.cream, 0.98).fillRoundedRect(0, 0, config.width, config.height, sizing.radius);
    body.lineStyle(4, UI_COLORS.purple, 1).strokeRoundedRect(0, 0, config.width, config.height, sizing.radius);
    const ribbonY = -sizing.ribbonHeight / 2;
    body.fillStyle(UI_COLORS.purple, 1).fillRoundedRect((config.width - sizing.ribbonWidth) / 2, ribbonY, sizing.ribbonWidth, sizing.ribbonHeight, 14);
    body.lineStyle(2, UI_COLORS.purpleDark, 1).strokeRoundedRect((config.width - sizing.ribbonWidth) / 2, ribbonY, sizing.ribbonWidth, sizing.ribbonHeight, 14);
    this.add(body);

    this.add(scene.add.text(config.width / 2, 1, 'ЗАДАНИЕ 5 ИЗ 5', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${sizing.taskFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0.5).setName('memory-task-label'));
    this.add(scene.add.text(config.width / 2, sizing.titleY, 'НАЙДИ ПАРЫ', {
      color: '#243548', fontFamily: UI_FONT, fontSize: `${sizing.titleFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setName('memory-title'));
    this.add(scene.add.text(config.width / 2, sizing.instructionY, 'ОТКРОЙ ОДИНАКОВЫЕ КАРТОЧКИ', {
      color: '#425166', fontFamily: UI_FONT, fontSize: `${Math.max(11, sizing.instructionFontSize - 1)}px`,
      align: 'center', wordWrap: { width: config.width - 24 },
    }).setOrigin(0.5, 0).setName('memory-instruction'));

    const columns = config.mode === 'large-portrait-tablet' ? 2 : 4;
    const rows = 8 / columns;
    const footerHeight = sizing.actionHeight + 10;
    const areaTop = Math.max(sizing.areaTop, sizing.instructionY + sizing.instructionFontSize + 12);
    const areaBottom = config.height - footerHeight;
    const availableWidth = config.width - sizing.horizontalPadding * 2;
    const availableHeight = Math.max(80, areaBottom - areaTop);
    const gap = Math.max(5, Math.min(sizing.cellGap, 10));
    const cellWidth = Math.min(112, (availableWidth - gap * (columns - 1)) / columns);
    const cellHeight = Math.min(126, (availableHeight - gap * (rows - 1)) / rows);
    const gridWidth = cellWidth * columns + gap * (columns - 1);
    const gridHeight = cellHeight * rows + gap * (rows - 1);
    const gridX = (config.width - gridWidth) / 2;
    const gridY = areaTop + Math.max(0, (availableHeight - gridHeight) / 2);

    config.snapshot.cards.forEach((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cardView = this.createCard(
        card,
        gridX + column * (cellWidth + gap) + cellWidth / 2,
        gridY + row * (cellHeight + gap) + cellHeight / 2,
        cellWidth,
        cellHeight,
        () => {
          if (this.hintLocked) return;
          const result = config.onCard(card.id);
          if (result !== 'ignored') this.revealCard(card.id, true);
          if (result === 'second') this.setData('locked', true);
        },
      );
      this.cardViews.set(card.id, cardView);
      this.add(cardView.container);
    });

    const actionY = config.height - sizing.actionHeight / 2 - 8;
    const hintWidth = Math.min(150, config.width * 0.42);
    this.hintButton = addControl(scene, config.width - sizing.horizontalPadding - hintWidth / 2, actionY, 'Подсказка', () => {
      if (this.hintLocked) return;
      const ids = config.onHint();
      if (ids.length) this.playHint(ids);
    }, {
      width: hintWidth,
      height: sizing.actionHeight,
      fill: UI_COLORS.purple,
      hoverFill: 0x916ee1,
      stroke: UI_COLORS.purpleDark,
      fontSize: sizing.actionFontSize,
    }).setName('memory-hint-button');
    this.add(this.hintButton);
    this.progressText = scene.add.text(sizing.horizontalPadding, actionY, '', {
      color: '#425166', fontFamily: UI_FONT, fontSize: `${sizing.feedbackFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setName('memory-progress');
    this.add(this.progressText);
    this.sync(config.snapshot, false);
  }

  sync(snapshot: MemorySnapshot, animate = true): void {
    this.progressText.setText(`ПАРЫ ${snapshot.matchedPairs} ИЗ ${snapshot.totalPairs}`);
    this.setData('matchedPairs', snapshot.matchedPairs);
    this.setData('locked', snapshot.locked);
    this.setData('completed', snapshot.completed);
    snapshot.cards.forEach((card) => {
      const view = this.cardViews.get(card.id);
      if (!view || view.state === card.state) return;
      if (card.state === 'FACE_DOWN') this.hideCard(card.id, animate);
      else this.revealCard(card.id, animate, card.state === 'MATCHED');
    });
    if (snapshot.completed) setControlEnabled(this.hintButton, false);
  }

  override destroy(fromScene?: boolean): void {
    this.hintTimer?.remove(false);
    this.hintTimer = undefined;
    super.destroy(fromScene);
  }

  private createCard(
    card: MemoryCardStateData,
    x: number,
    y: number,
    width: number,
    height: number,
    onPress: () => void,
  ): MemoryCardView {
    const container = this.scene.add.container(x, y)
      .setName(`memory-card-${card.id}`)
      .setSize(width, height)
      .setInteractive();
    const frame = this.scene.add.graphics();
    const cover = this.scene.add.image(0, 0, 'memory-cover').setName(`memory-cover-${card.id}`);
    const face = this.scene.add.image(0, 0, card.textureKey).setName(`memory-face-${card.id}`);
    const fit = (image: Phaser.GameObjects.Image, padding: number): void => {
      image.setScale(Math.min((width - padding) / image.width, (height - padding) / image.height));
    };
    fit(cover, 6);
    fit(face, Math.max(12, Math.min(width, height) * 0.24));
    container.add([frame, cover, face]);
    const view = { container, frame, cover, face, state: card.state };
    this.drawCard(view, card.state);
    container.on('pointerdown', onPress);
    return view;
  }

  private drawCard(view: MemoryCardView, state: MemoryCardStateData['state']): void {
    const width = view.container.width;
    const height = view.container.height;
    view.frame.clear();
    view.frame.fillStyle(state === 'MATCHED' ? 0xdff5d2 : 0xffffff, 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    view.frame.lineStyle(3, state === 'MATCHED' ? UI_COLORS.green : UI_COLORS.creamEdge, 1)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    view.cover.setVisible(state === 'FACE_DOWN');
    view.face.setVisible(state !== 'FACE_DOWN').setAlpha(state === 'MATCHED' ? 0.88 : 1);
    view.container.input!.enabled = state === 'FACE_DOWN';
    view.container.setAlpha(state === 'MATCHED' ? 0.92 : 1);
    view.state = state;
  }

  private revealCard(cardId: string, animate: boolean, matched = false): void {
    const view = this.cardViews.get(cardId);
    if (!view) return;
    this.flip(view, matched ? 'MATCHED' : 'FACE_UP', animate);
  }

  private hideCard(cardId: string, animate: boolean): void {
    const view = this.cardViews.get(cardId);
    if (!view) return;
    this.flip(view, 'FACE_DOWN', animate);
  }

  private flip(view: MemoryCardView, state: MemoryCardStateData['state'], animate: boolean): void {
    this.scene.tweens.killTweensOf(view.container);
    if (!animate || this.reducedMotion) {
      view.container.setScale(1);
      this.drawCard(view, state);
      return;
    }
    view.container.input!.enabled = false;
    this.scene.tweens.add({
      targets: view.container,
      scaleX: 0.04,
      duration: 90,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (!view.container.active) return;
        this.drawCard(view, state);
        this.scene.tweens.add({ targets: view.container, scaleX: 1, duration: 100, ease: 'Sine.easeOut' });
      },
    });
  }

  private playHint(cardIds: readonly string[]): void {
    this.hintLocked = true;
    setControlEnabled(this.hintButton, false);
    const temporary = cardIds.filter((id) => this.cardViews.get(id)?.state === 'FACE_DOWN');
    temporary.forEach((id) => this.revealCard(id, true));
    this.hintTimer?.remove(false);
    this.hintTimer = this.scene.time.delayedCall(this.reducedMotion ? 500 : 900, () => {
      temporary.forEach((id) => this.hideCard(id, true));
      this.hintLocked = false;
      setControlEnabled(this.hintButton, true);
      this.hintTimer = undefined;
    });
  }
}
