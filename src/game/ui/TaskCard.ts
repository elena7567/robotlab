import Phaser from 'phaser';
import type { OddOneOutObjectKey, OddOneOutResult } from '../mechanics/oddOneOut';
import type { SequenceAssetKey } from '../mechanics/sequence';
import type { SizeChoiceKey } from '../mechanics/sizeComparison';
import type { ShadowChoiceKey } from '../mechanics/shadowMatching';
import { addControl, setControlEnabled } from './controls';
import { UI_COLORS, UI_FONT } from './visualTheme';
import type { TaskCardSizing } from './responsiveLayout';

export type TaskObjectKey = OddOneOutObjectKey | SequenceAssetKey | SizeChoiceKey | ShadowChoiceKey;

export interface TaskCardConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  sizing: TaskCardSizing;
  taskNumber: number;
  totalTasks: number;
  title: string;
  instruction: string;
  objectKeys: readonly TaskObjectKey[];
  initialSelection?: TaskObjectKey | null;
  completed?: boolean;
  hintShown?: boolean;
  hintText: string;
  hintFeedbackText?: string;
  correctFeedbackText?: string;
  hintKeys?: readonly TaskObjectKey[];
  sequenceKeys?: readonly SequenceAssetKey[];
  correctKey?: TaskObjectKey;
  internalProgress?: { current: number; total: number };
  internalProgressLabel?: string;
  choiceTextureKey?: (key: TaskObjectKey) => string;
  choiceVisualScale?: (key: TaskObjectKey) => number;
  choiceLayout?: 'grid' | 'size-comparison' | 'shadow-matching';
  targetTextureKey?: TaskObjectKey;
  showContinueOnComplete?: boolean;
  continueDelayMs?: number;
  onSelect: (key: TaskObjectKey) => void;
  onCheck: () => OddOneOutResult;
  onHint: () => void;
  onContinue: () => void;
}

type FrameState = 'idle' | 'selected' | 'hint' | 'correct' | 'wrong';

interface ChoiceView {
  readonly container: Phaser.GameObjects.Container;
  readonly frame: Phaser.GameObjects.Graphics;
  readonly width: number;
  readonly height: number;
}

export class TaskCard extends Phaser.GameObjects.Container {
  private readonly feedbackText: Phaser.GameObjects.Text;
  private readonly choices = new Map<TaskObjectKey, ChoiceView>();
  private selectedKey: TaskObjectKey | null;
  private wrongKey: TaskObjectKey | null = null;
  private result: OddOneOutResult;
  private readonly checkButton: Phaser.GameObjects.Container;
  private readonly continueButton: Phaser.GameObjects.Container;
  private readonly configuredHintKeys: ReadonlySet<TaskObjectKey>;
  private readonly feedbackPrefix: string;
  private missingSlotImage?: Phaser.GameObjects.Image;
  private targetImage?: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, config: TaskCardConfig) {
    super(scene, config.x, config.y);
    scene.add.existing(this);
    this.setName('task-card');
    this.configuredHintKeys = new Set(config.hintKeys ?? []);
    this.feedbackPrefix = config.internalProgress
      ? `${config.internalProgressLabel ?? 'РЯД'} ${config.internalProgress.current} ИЗ ${config.internalProgress.total}`
      : '';
    this.selectedKey = config.initialSelection ?? null;
    this.result = config.completed ? 'correct' : 'idle';
    const showContinueOnComplete = config.showContinueOnComplete ?? true;
    const sizing = config.sizing;
    const body = scene.add.graphics();
    body.fillStyle(0x2a3451, 0.2).fillRoundedRect(5, 8, config.width, config.height, sizing.radius);
    body.fillStyle(UI_COLORS.cream, 0.98).fillRoundedRect(0, 0, config.width, config.height, sizing.radius);
    body.lineStyle(4, UI_COLORS.purple, 1).strokeRoundedRect(0, 0, config.width, config.height, sizing.radius);
    const ribbonWidth = sizing.ribbonWidth;
    const ribbonY = -sizing.ribbonHeight / 2;
    body.fillStyle(UI_COLORS.purple, 1).fillRoundedRect((config.width - ribbonWidth) / 2, ribbonY, ribbonWidth, sizing.ribbonHeight, 14);
    body.lineStyle(2, UI_COLORS.purpleDark, 1).strokeRoundedRect((config.width - ribbonWidth) / 2, ribbonY, ribbonWidth, sizing.ribbonHeight, 14);
    this.add(body);

    this.add(scene.add.text(config.width / 2, 1, `ЗАДАНИЕ ${config.taskNumber} ИЗ ${config.totalTasks}`, {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${sizing.taskFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0.5));
    const title = scene.add.text(config.width / 2, sizing.titleY, config.title.toUpperCase(), {
      color: '#243548', fontFamily: UI_FONT, fontSize: `${sizing.titleFontSize}px`, fontStyle: 'bold', align: 'center',
      wordWrap: { width: config.width - 30 },
    }).setOrigin(0.5, 0);
    this.add(title);
    const instructionY = Math.max(sizing.instructionY, sizing.titleY + title.height + 4);
    const instruction = scene.add.text(config.width / 2, instructionY, config.instruction, {
      color: '#425166', fontFamily: UI_FONT, fontSize: `${sizing.instructionFontSize}px`, align: 'center',
      wordWrap: { width: config.width - 30 },
    }).setOrigin(0.5, 0);
    this.add(instruction);

    const areaTop = Math.max(sizing.areaTop, instructionY + instruction.height + 7);
    const footerSpace = sizing.footerSpace;
    const areaHeight = config.height - areaTop - footerSpace;
    const cellGap = sizing.cellGap;
    const sequenceMode = Boolean(config.sequenceKeys);
    let cellWidth: number;
    let cellHeight: number;
    let choicePositions: readonly { x: number; y: number }[];

    if (sequenceMode && config.sequenceKeys) {
      const contentWidth = config.width - sizing.horizontalPadding * 2;
      const sequenceHeight = Math.max(30, Math.min(areaHeight * 0.44, sizing.sequenceIconMaxSize + 14));
      const optionGap = sizing.sequenceGap;
      cellHeight = Math.max(36, Math.min(areaHeight - sequenceHeight - optionGap, sizing.sequenceOptionMaxHeight));
      cellWidth = Math.max(36, Math.min(
        (contentWidth - optionGap * (config.objectKeys.length - 1)) / config.objectKeys.length,
        sizing.cellMaxWidth,
      ));
      const optionsWidth = cellWidth * config.objectKeys.length + optionGap * (config.objectKeys.length - 1);
      const optionsX = (config.width - optionsWidth) / 2;
      const optionsY = areaTop + sequenceHeight + optionGap + cellHeight / 2;
      choicePositions = config.objectKeys.map((_, index) => ({
        x: optionsX + index * (cellWidth + optionGap) + cellWidth / 2,
        y: optionsY,
      }));

      const sequenceBackground = scene.add.graphics();
      sequenceBackground.fillStyle(0xe8f4f4, 0.94)
        .fillRoundedRect(sizing.horizontalPadding, areaTop, contentWidth, sequenceHeight, 12);
      sequenceBackground.lineStyle(2, UI_COLORS.cyan, 0.65)
        .strokeRoundedRect(sizing.horizontalPadding, areaTop, contentWidth, sequenceHeight, 12);
      this.add(sequenceBackground);

      const sequenceCount = config.sequenceKeys.length + 1;
      const sequenceGap = sizing.sequenceGap;
      const sequenceContentWidth = contentWidth - 12;
      const slotSize = Math.max(22, Math.min(
        sizing.sequenceIconMaxSize,
        (sequenceContentWidth - sequenceGap * (sequenceCount - 1)) / sequenceCount,
        sequenceHeight - 12,
      ));
      const rowWidth = slotSize * sequenceCount + sequenceGap * (sequenceCount - 1);
      const rowX = config.width / 2 - rowWidth / 2;
      const rowY = areaTop + sequenceHeight / 2 + 3;
      config.sequenceKeys.forEach((key, index) => {
        const image = scene.add.image(rowX + slotSize / 2 + index * (slotSize + sequenceGap), rowY, key);
        image.setScale(Math.min(slotSize / image.width, slotSize / image.height));
        this.add(image);
      });
      const missingX = rowX + slotSize / 2 + (sequenceCount - 1) * (slotSize + sequenceGap);
      const missingSlot = scene.add.graphics();
      missingSlot.fillStyle(0xfffbf1, 0.96).fillRoundedRect(missingX - slotSize / 2, rowY - slotSize / 2, slotSize, slotSize, 8);
      missingSlot.lineStyle(2, UI_COLORS.purple, 0.9)
        .strokeRoundedRect(missingX - slotSize / 2, rowY - slotSize / 2, slotSize, slotSize, 8);
      this.add(missingSlot);
      this.add(scene.add.text(missingX, rowY - 1, '?', {
        color: '#7659bb', fontFamily: UI_FONT, fontSize: `${Math.max(16, slotSize * 0.62)}px`, fontStyle: 'bold',
      }).setOrigin(0.5).setName('missing-slot-question'));
      if (config.correctKey && scene.textures.exists(config.correctKey)) {
        this.missingSlotImage = scene.add.image(missingX, rowY, config.correctKey).setVisible(Boolean(config.completed));
        this.missingSlotImage.setScale(Math.min((slotSize - 4) / this.missingSlotImage.width, (slotSize - 4) / this.missingSlotImage.height));
        this.missingSlotImage.setName('missing-slot-answer');
        this.add(this.missingSlotImage);
      }
    } else if (config.choiceLayout === 'shadow-matching' && config.targetTextureKey) {
      const contentWidth = config.width - sizing.horizontalPadding * 2;
      const shadowAreaHeight = Math.max(84, Math.min(
        areaHeight,
        config.height - sizing.actionHeight - 24 - sizing.feedbackFontSize - areaTop,
      ));
      const targetHeight = Math.max(30, Math.min(shadowAreaHeight * 0.34, sizing.cellMaxHeight));
      const optionGap = sizing.cellGap;
      cellWidth = Math.max(56, Math.min(
        (contentWidth - optionGap * (config.objectKeys.length - 1)) / config.objectKeys.length,
        sizing.cellMaxWidth,
      ));
      cellHeight = Math.max(48, Math.min(shadowAreaHeight - targetHeight - optionGap, sizing.cellMaxHeight));
      const rowWidth = cellWidth * config.objectKeys.length + optionGap * (config.objectKeys.length - 1);
      const rowX = (config.width - rowWidth) / 2;
      const optionsY = areaTop + targetHeight + optionGap + cellHeight / 2;
      choicePositions = config.objectKeys.map((_, index) => ({
        x: rowX + index * (cellWidth + optionGap) + cellWidth / 2,
        y: optionsY,
      }));

      const targetBackground = scene.add.graphics();
      const targetWidth = Math.min(contentWidth, Math.max(92, targetHeight * 1.5));
      targetBackground.fillStyle(0xe8f4f4, 0.96)
        .fillRoundedRect(config.width / 2 - targetWidth / 2, areaTop, targetWidth, targetHeight, 12);
      targetBackground.lineStyle(2, UI_COLORS.cyan, 0.7)
        .strokeRoundedRect(config.width / 2 - targetWidth / 2, areaTop, targetWidth, targetHeight, 12);
      this.add(targetBackground);
      if (scene.textures.exists(config.targetTextureKey)) {
        this.targetImage = scene.add.image(config.width / 2, areaTop + targetHeight / 2, config.targetTextureKey)
          .setName('shadow-target-object');
        this.targetImage.setScale(Math.min(
          (targetWidth - 18) / this.targetImage.width,
          (targetHeight - 10) / this.targetImage.height,
        ));
        this.add(this.targetImage);
      }
    } else if (config.choiceLayout === 'size-comparison') {
      const contentWidth = config.width - sizing.horizontalPadding * 2;
      cellWidth = Math.max(64, Math.min(
        (contentWidth - cellGap * (config.objectKeys.length - 1)) / config.objectKeys.length,
        sizing.cellMaxWidth,
      ));
      cellHeight = Math.max(56, Math.min(areaHeight, sizing.cellMaxHeight));
      const rowWidth = cellWidth * config.objectKeys.length + cellGap * (config.objectKeys.length - 1);
      const rowX = (config.width - rowWidth) / 2;
      const rowY = areaTop + Math.max(0, (areaHeight - cellHeight) / 2) + cellHeight / 2;
      choicePositions = config.objectKeys.map((_, index) => ({
        x: rowX + index * (cellWidth + cellGap) + cellWidth / 2,
        y: rowY,
      }));
    } else {
      cellWidth = Math.min((config.width - sizing.horizontalPadding * 2 - cellGap) / 2, sizing.cellMaxWidth);
      cellHeight = Math.max(36, Math.min((areaHeight - cellGap) / 2, sizing.cellMaxHeight));
      const gridWidth = cellWidth * 2 + cellGap;
      const gridHeight = cellHeight * 2 + cellGap;
      const gridX = (config.width - gridWidth) / 2;
      const gridY = areaTop + Math.max(0, (areaHeight - gridHeight) / 2);
      choicePositions = config.objectKeys.map((_, index) => ({
        x: gridX + (index % 2) * (cellWidth + cellGap) + cellWidth / 2,
        y: gridY + Math.floor(index / 2) * (cellHeight + cellGap) + cellHeight / 2,
      }));
    }

    config.objectKeys.slice(0, 4).forEach((key, index) => {
      const { x: cx, y: cy } = choicePositions[index];
      const choice = scene.add.container(cx, cy).setSize(cellWidth + 8, cellHeight + 8).setName(`choice-${key}`);
      const frame = scene.add.graphics();
      choice.add(frame);
      const textureKey = config.choiceTextureKey?.(key) ?? key;
      if (scene.textures.exists(textureKey)) {
        const image = scene.add.image(0, 0, textureKey).setName(`choice-image-${key}`);
        const visualScale = config.choiceVisualScale?.(key) ?? 1;
        const maxVisualScale = config.choiceLayout === 'size-comparison' ? 1.3 : visualScale;
        const baseScale = Math.min(
          (cellWidth - 16) / (image.width * maxVisualScale),
          (cellHeight - 12) / (image.height * maxVisualScale),
        );
        image.setScale(baseScale * visualScale);
        if (config.choiceLayout === 'size-comparison') image.setOrigin(0.5, 1).setY(cellHeight / 2 - 6);
        choice.add(image);
      }
      choice.setInteractive();
      choice.on('pointerdown', () => {
        if (this.result === 'correct') return;
        scene.tweens.killTweensOf(choice);
        choice.setScale(0.97);
        this.selectedKey = key;
        this.wrongKey = null;
        this.result = 'idle';
        config.onSelect(key);
        this.setFeedback('Выбрано');
        this.drawChoices();
        this.setCheckEnabled(true);
      });
      const release = (): void => {
        scene.tweens.killTweensOf(choice);
        scene.tweens.add({
          targets: choice,
          scale: key === this.selectedKey ? 1.045 : 1,
          duration: 120,
          ease: 'Sine.easeOut',
        });
      };
      choice.on('pointerup', release);
      choice.on('pointerupoutside', release);
      choice.on('pointerout', release);
      this.choices.set(key, { container: choice, frame, width: cellWidth, height: cellHeight });
      this.add(choice);
    });

    this.feedbackText = scene.add.text(sizing.horizontalPadding, config.height - sizing.actionHeight - 24, '', {
      color: '#536274', fontFamily: UI_FONT, fontSize: `${sizing.feedbackFontSize}px`, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setName('task-feedback');
    this.add(this.feedbackText);

    const actionY = config.height - sizing.actionHeight / 2 - 8;
    const actionWidth = (config.width - sizing.horizontalPadding * 2 - sizing.actionGap) / 2;
    const hint = addControl(scene, sizing.horizontalPadding + actionWidth / 2, actionY, 'Подсказка', () => {
      if (this.result === 'correct') return;
      config.onHint();
      this.setFeedback(config.hintFeedbackText ?? config.hintText);
      if (config.choiceLayout === 'shadow-matching') this.playShadowHint();
      else this.drawChoices(true);
    }, {
      width: actionWidth, height: sizing.actionHeight, fill: UI_COLORS.purple, hoverFill: 0x916ee1,
      stroke: UI_COLORS.purpleDark, fontSize: sizing.actionFontSize,
    });
    this.add(hint);

    this.checkButton = addControl(scene, config.width - sizing.horizontalPadding - actionWidth / 2, actionY, 'Проверить', () => {
      if (!this.selectedKey || this.result === 'correct') return;
      const checkedKey = this.selectedKey;
      this.result = config.onCheck();
      if (this.result === 'correct') {
        this.setFeedback(config.correctFeedbackText ?? 'Правильно! Отличная работа!');
        this.setCheckEnabled(false);
        if (this.missingSlotImage) {
          this.missingSlotImage.setVisible(true).setAlpha(0).setScale(this.missingSlotImage.scaleX * 0.55);
          scene.tweens.add({
            targets: this.missingSlotImage,
            alpha: 1,
            scaleX: this.missingSlotImage.scaleX / 0.55,
            scaleY: this.missingSlotImage.scaleY / 0.55,
            duration: 220,
            ease: 'Back.easeOut',
          });
        }
        scene.time.delayedCall(config.continueDelayMs ?? 180, () => {
          if (!this.active || !showContinueOnComplete) return;
          this.continueButton.setVisible(true).setActive(true);
          setControlEnabled(this.continueButton, true);
        });
      } else {
        this.selectedKey = null;
        this.wrongKey = checkedKey;
        this.setFeedback('Попробуй ещё раз');
        this.setCheckEnabled(false);
        const wrongChoice = this.choices.get(checkedKey);
        if (wrongChoice) {
          const originalX = wrongChoice.container.x;
          scene.tweens.killTweensOf(wrongChoice.container);
          scene.tweens.add({
            targets: wrongChoice.container,
            x: originalX + 4,
            duration: 60,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
            onComplete: () => wrongChoice.container.setX(originalX),
          });
        }
        scene.time.delayedCall(320, () => {
          if (this.result !== 'wrong' || this.wrongKey !== checkedKey) return;
          this.wrongKey = null;
          this.result = 'idle';
          this.drawChoices();
          this.setCheckEnabled(false);
        });
      }
      this.drawChoices();
    }, {
      width: actionWidth, height: sizing.actionHeight, fill: UI_COLORS.green, hoverFill: 0x7dcc54,
      stroke: UI_COLORS.greenDark, fontSize: sizing.actionFontSize,
    });
    this.checkButton.setName('check-button');
    this.add(this.checkButton);

    this.continueButton = addControl(scene, config.width - sizing.horizontalPadding - actionWidth / 2, actionY, 'Дальше', config.onContinue, {
      width: actionWidth, height: sizing.actionHeight, fill: UI_COLORS.green, hoverFill: 0x7dcc54,
      stroke: UI_COLORS.greenDark, fontSize: sizing.actionFontSize,
    });
    this.continueButton.setName('continue-button');
    const continueVisible = this.result === 'correct' && showContinueOnComplete;
    this.continueButton.setVisible(continueVisible).setActive(continueVisible);
    setControlEnabled(this.continueButton, continueVisible);
    this.add(this.continueButton);

    this.drawChoices(Boolean(config.hintShown) && config.choiceLayout !== 'shadow-matching');
    this.setCheckEnabled(Boolean(this.selectedKey) && this.result !== 'correct');
    if (this.result === 'correct') this.setFeedback('Задание выполнено!');
    else if (config.hintShown) this.setFeedback(config.hintFeedbackText ?? config.hintText);
    else this.setFeedback('');
  }

  private drawChoices(showHint = false): void {
    this.choices.forEach((choice, key) => {
      let state: FrameState = key === this.selectedKey ? 'selected' : 'idle';
      if (showHint && this.configuredHintKeys.has(key)) state = 'hint';
      if (this.result === 'correct' && key === this.selectedKey) state = 'correct';
      if (this.result === 'wrong' && key === this.wrongKey) state = 'wrong';
      this.drawFrame(choice, state);
      if (choice.container.scaleX !== 0.97) choice.container.setScale(key === this.selectedKey ? 1.045 : 1);
    });
  }

  private drawFrame(choice: ChoiceView, state: FrameState): void {
    const style = {
      idle: [0xfffbf1, UI_COLORS.creamEdge, 2],
      selected: [0xe9f8d9, UI_COLORS.green, 4],
      hint: [0xfff2b8, UI_COLORS.gold, 4],
      correct: [0xd9f8d0, UI_COLORS.green, 5],
      wrong: [0xffeee0, 0xe69a62, 4],
    }[state];
    const { frame, width, height } = choice;
    frame.clear();
    if (state === 'selected' || state === 'correct') {
      frame.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10, 17);
    }
    frame.fillStyle(style[0], 1).fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    frame.lineStyle(style[2], style[1], 1).strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
    if (state === 'selected' || state === 'correct') {
      frame.fillStyle(UI_COLORS.green, 1).fillCircle(width / 2 - 11, -height / 2 + 11, 10);
      frame.lineStyle(2, 0xffffff, 1).beginPath()
        .moveTo(width / 2 - 16, -height / 2 + 11)
        .lineTo(width / 2 - 12, -height / 2 + 15)
        .lineTo(width / 2 - 6, -height / 2 + 7)
        .strokePath();
    }
  }

  private playShadowHint(): void {
    if (!this.targetImage) return;
    this.setData('shadowHintStage', 'target');
    const hintedKey = [...this.configuredHintKeys][0];
    const hintedChoice = hintedKey ? this.choices.get(hintedKey) : undefined;
    const targetBaseScale = this.targetImage.scaleX;
    this.scene.tweens.killTweensOf(this.targetImage);
    if (hintedChoice) this.scene.tweens.killTweensOf(hintedChoice.container);
    this.scene.tweens.add({
      targets: this.targetImage,
      scaleX: targetBaseScale * 1.1,
      scaleY: targetBaseScale * 1.1,
      duration: 180,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!this.active || !hintedChoice || this.result === 'correct') return;
        this.setData('shadowHintStage', 'choice');
        this.drawFrame(hintedChoice, 'hint');
        this.scene.tweens.add({
          targets: hintedChoice.container,
          scaleX: 1.055,
          scaleY: 1.055,
          duration: 180,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (!this.active) return;
            hintedChoice.container.setScale(hintedKey === this.selectedKey ? 1.045 : 1);
            this.drawChoices();
            this.setData('shadowHintStage', 'idle');
          },
        });
      },
    });
  }

  private setCheckEnabled(enabled: boolean): void {
    setControlEnabled(this.checkButton, enabled);
  }

  private setFeedback(message: string): void {
    this.feedbackText.setText([this.feedbackPrefix, message].filter(Boolean).join(' · '));
  }
}
