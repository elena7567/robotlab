import Phaser from 'phaser';
import type { MemoryCardStateData, MemorySelectionResult, MemorySnapshot } from '../mechanics/memory';
import { addControl, setControlEnabled } from './controls';
import type { CompositionMode, TaskCardSizing } from './responsiveLayout';
import { UI_COLORS, UI_FONT } from './visualTheme';
import { CHILD_UI } from './childUi';
import type { ChildInteractionMetrics } from './childInteractionMetrics';
import { fitImageByVisibleAlpha } from '../assets/objectBounds';

export interface MemoryTaskCardConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly sizing: TaskCardSizing;
  readonly interactionMetrics: ChildInteractionMetrics;
  readonly secondaryActionRect?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
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
  readonly visualWidth: number;
  readonly visualHeight: number;
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
    this.setName('memory-task-card').setData('auditBounds', {
      x: config.x,
      y: config.y - config.sizing.ribbonHeight / 2,
      width: config.width,
      height: config.height + config.sizing.ribbonHeight / 2,
    });
    this.reducedMotion = config.reducedMotion;
    const { sizing } = config;
    const interaction = config.interactionMetrics;
    const body = scene.add.graphics();
    body.fillStyle(0x2a3451, 0.2).fillRoundedRect(5, 8, config.width, config.height, sizing.radius);
    body.fillStyle(UI_COLORS.cream, 0.98).fillRoundedRect(0, 0, config.width, config.height, sizing.radius);
    body.lineStyle(4, UI_COLORS.purple, 1).strokeRoundedRect(0, 0, config.width, config.height, sizing.radius);
    const ribbonY = -sizing.ribbonHeight / 2;
    body.fillStyle(UI_COLORS.purple, 1).fillRoundedRect((config.width - sizing.ribbonWidth) / 2, ribbonY, sizing.ribbonWidth, sizing.ribbonHeight, 14);
    body.lineStyle(2, UI_COLORS.purpleDark, 1).strokeRoundedRect((config.width - sizing.ribbonWidth) / 2, ribbonY, sizing.ribbonWidth, sizing.ribbonHeight, 14);
    this.add(body);

    this.add(scene.add.text(config.width / 2, 1, 'ЗАДАНИЕ 5 ИЗ 10', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${sizing.taskFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0.5).setName('memory-task-label'));
    this.add(scene.add.text(config.width / 2, sizing.titleY, 'НАЙДИ ПАРЫ', {
      color: '#243548', fontFamily: UI_FONT, fontSize: `${sizing.titleFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setName('memory-title'));
    this.add(scene.add.text(config.width / 2, sizing.instructionY, 'ОТКРОЙ ОДИНАКОВЫЕ КАРТОЧКИ', {
      color: '#425166', fontFamily: UI_FONT, fontSize: `${Math.max(CHILD_UI.typography.instructionMin, sizing.instructionFontSize)}px`,
      align: 'center', wordWrap: { width: config.width - 24 },
    }).setOrigin(0.5, 0).setName('memory-instruction'));

    const columns = 4;
    const rows = 8 / columns;
    const externalSecondaryAction = config.secondaryActionRect;
    const footerHeight = externalSecondaryAction ? interaction.feedbackHeight + 8 : sizing.actionHeight + 8;
    const areaTop = Math.max(sizing.areaTop, sizing.instructionY + sizing.instructionFontSize + interaction.instructionGap);
    const areaBottom = config.height - footerHeight;
    const availableWidth = config.width - sizing.horizontalPadding * 2;
    const availableHeight = Math.max(80, areaBottom - areaTop);
    const gap = Math.max(6, Math.min(interaction.mechanicGap, 12));
    const availableCellWidth = (availableWidth - gap * (columns - 1)) / columns;
    const availableCellHeight = (availableHeight - gap * (rows - 1)) / rows;
    const cellHeight = Math.min(interaction.memoryCardIdeal.height, availableCellHeight);
    const cellWidth = Math.min(
      interaction.memoryCardIdeal.width,
      availableCellWidth,
    );
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

    const actionY = externalSecondaryAction
      ? externalSecondaryAction.y + externalSecondaryAction.height / 2 - config.y
      : config.height - sizing.actionHeight / 2 - 8;
    const hintWidth = externalSecondaryAction?.width ?? Math.min(interaction.secondaryActionWidth, config.width * 0.34);
    const hintX = externalSecondaryAction
      ? externalSecondaryAction.x + externalSecondaryAction.width / 2 - config.x
      : config.width - sizing.horizontalPadding - hintWidth / 2;
    this.hintButton = addControl(scene, hintX, actionY, 'Подсказка', () => {
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
    }).setName('memory-hint-button').setData({
      childVisualRole: 'SECONDARY_ACTION',
      visualLocalBounds: { x: -hintWidth / 2, y: -sizing.actionHeight / 2, width: hintWidth, height: sizing.actionHeight },
    });
    this.add(this.hintButton);
    const progressY = externalSecondaryAction
      ? config.height - interaction.feedbackHeight / 2 - 4
      : actionY;
    this.progressText = scene.add.text(sizing.horizontalPadding, progressY, '', {
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
    const hitWidth = Math.max(CHILD_UI.touch.minimum, width);
    const hitHeight = Math.max(CHILD_UI.touch.minimum, height);
    const container = this.scene.add.container(x, y)
      .setName(`memory-card-${card.id}`)
      .setSize(hitWidth, hitHeight)
      .setInteractive()
      .setData({
        childVisualRole: 'MEMORY_CARD',
        visualLocalBounds: { x: -width / 2, y: -height / 2, width, height },
        memoryState: card.state,
      });
    const frame = this.scene.add.graphics();
    const cover = this.scene.add.image(0, 0, 'memory-cover').setName(`memory-cover-${card.id}`);
    const face = this.scene.add.image(0, 0, card.textureKey).setName(`memory-face-${card.id}`);
    cover.setData('childVisualRole', 'MEMORY_ARTWORK');
    face.setData('childVisualRole', 'MEMORY_ARTWORK');
    fitImageByVisibleAlpha(cover, width - 4, height - 2);
    const facePadding = Math.max(7, Math.min(width, height) * 0.1);
    fitImageByVisibleAlpha(face, width - facePadding, height - facePadding);
    container.add([frame, cover, face]);
    const view = { container, frame, cover, face, visualWidth: width, visualHeight: height, state: card.state };
    this.drawCard(view, card.state);
    container.on('pointerdown', onPress);
    return view;
  }

  private drawCard(view: MemoryCardView, state: MemoryCardStateData['state']): void {
    const width = view.visualWidth;
    const height = view.visualHeight;
    view.frame.clear();
    view.frame.fillStyle(state === 'MATCHED' ? 0xdff5d2 : 0xffffff, 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    view.frame.lineStyle(3, state === 'MATCHED' ? UI_COLORS.green : UI_COLORS.creamEdge, 1)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    view.cover.setVisible(state === 'FACE_DOWN');
    view.face.setVisible(state !== 'FACE_DOWN').setAlpha(state === 'MATCHED' ? 0.88 : 1);
    view.container.input!.enabled = state === 'FACE_DOWN';
    view.container.setAlpha(state === 'MATCHED' ? 0.92 : 1);
    view.container.setData('memoryState', state);
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
