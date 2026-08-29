import Phaser from 'phaser';
import { OddOneOutMechanic, ODD_ONE_OUT_OBJECTS, type OddOneOutObjectKey } from '../mechanics/oddOneOut';
import { sequenceMechanic, type SequenceAssetKey } from '../mechanics/sequence';
import {
  sizeComparisonMechanic,
  SIZE_SCALE_MULTIPLIERS,
  type SizeChoiceKey,
  type SizeId,
} from '../mechanics/sizeComparison';
import { sessionState } from '../state/sessionState';
import { preferencesState } from '../state/preferencesState';
import { addIconControl } from '../ui/controls';
import { ProgressPanel } from '../ui/ProgressPanel';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { createGroundedRobot } from '../ui/robotGrounding';
import { RobotDialogue } from '../ui/RobotDialogue';
import { playRepairItemReward } from '../ui/RepairReward';
import { TaskCard, type TaskObjectKey } from '../ui/TaskCard';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';
import { createResponsiveLayout } from '../ui/responsiveLayout';
import { configureResponsiveCamera } from '../ui/responsiveCamera';
import { audioManager } from '../audio/AudioManager';
import { shadowMatchingMechanic, type ShadowChoiceKey } from '../mechanics/shadowMatching';

const WRONG_DIALOGUE = [
  'Почти! Попробуй ещё раз',
  'Подумай ещё немного',
  'Посмотри внимательнее',
  'У тебя получится!',
] as const;

const SEQUENCE_WRONG_DIALOGUE = [
  'Почти! Посмотри на ряд ещё раз',
  'Какой рисунок повторяется?',
  'Попробуй найти закономерность',
  'У тебя получится!',
] as const;

const SEQUENCE_CORRECT_DIALOGUE = 'Верно! Ты нашёл закономерность!';

const SIZE_WRONG_DIALOGUE = [
  'Посмотри на размеры ещё раз',
  'Почти! Сравни внимательнее',
  'Какая батарейка подходит по размеру?',
  'Попробуй ещё раз',
] as const;

const SIZE_CORRECT_DIALOGUE = [
  'Верно! Отлично сравнил!',
  'Да! Размер выбран правильно!',
  'Супер! Ты заметил разницу!',
] as const;

const SHADOW_WRONG_DIALOGUE = ['Попробуй ещё', 'Посмотри на форму', 'Почти!'] as const;
const SHADOW_CORRECT_DIALOGUE = ['Точно!', 'Это она!', 'Молодец!'] as const;

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create(): void {
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    const portrait = layout.mode !== 'landscape';
    const state = sessionState.snapshot;
    this.game.registry.set('sessionSnapshot', state);
    const isShadowMatchingTask = state.completedTasks === 3;
    const isSizeComparisonTask = state.completedTasks === 2;
    const isSequenceTask = state.completedTasks === 1;
    const oddMechanic = state.completedTasks === 0 ? new OddOneOutMechanic(false) : undefined;
    this.cameras.main.setBackgroundColor('#173b52');
    const worldLayer = this.add.container(0, 0).setName('logical-world').setDepth(-2);
    const actorLayer = this.add.container(0, 0).setName('logical-actors');
    addLogicalLaboratoryImage(this, worldLayer, 'bg-main-laboratory');
    const robot = createGroundedRobot(this, actorLayer, state.completedTasks);
    const frame = configureResponsiveCamera(this, worldLayer, layout);
    actorLayer.setPosition(frame.offsetX, frame.offsetY).setScale(frame.scale);
    this.game.registry.set('responsiveLayout', { ...layout, worldFrame: frame });
    this.add.rectangle(0, 0, width, height, 0x163852, portrait ? 0.12 : 0.05).setOrigin(0).setDepth(-1);

    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    const homeX = layout.safe.left + layout.iconWidth / 2;
    const topY = layout.headerY;
    addIconControl(this, homeX, topY, '⌂ Домой', () => this.scene.start('StartScene'), UI_COLORS.purple, iconSizing);
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, topY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing);

    if (!portrait) {
      const headerWidth = layout.headerWidth;
      const headerX = width / 2 - headerWidth / 2;
      const header = this.add.graphics();
      const headerTop = topY - layout.headerHeight / 2;
      header.fillStyle(0x164d7b, 0.94).fillRoundedRect(headerX, headerTop, headerWidth, layout.headerHeight, 18);
      header.lineStyle(2, 0x72d9ec, 0.8).strokeRoundedRect(headerX, headerTop, headerWidth, layout.headerHeight, 18);
      this.add.text(width / 2, topY, 'Почини робота', {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${layout.headerFontSize}px`, fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    const { x: cardX, y: cardY, width: cardWidth, height: cardHeight } = layout.taskCard;
    let progressPanel: ProgressPanel;
    progressPanel = new ProgressPanel(this, {
      x: layout.progress.x, y: layout.progress.y, width: layout.progress.width, height: layout.progress.height,
      value: state.completedTasks, horizontal: layout.progress.horizontal, sizing: layout.progress.sizing,
    });

    const robotDialogue = robot ? new RobotDialogue(this, robot, layout) : undefined;
    let wrongAttempt = 0;
    let completionFlowActive = false;
    let taskTransitionActive = false;
    const renderCurrentTask = (): void => {
      if (taskTransitionActive) return;
      taskTransitionActive = true;
      robotDialogue?.hide();
      // Restart is the normal task renderer. It synchronously destroys the old
      // TaskCard before create() chooses the card for the updated session state.
      this.scene.restart();
    };
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const playCompletionFlow = (): void => {
      if (completionFlowActive) return;
      completionFlowActive = true;
      sessionState.completeCurrentTask();
      const completedTasks = sessionState.snapshot.completedTasks;
      this.game.registry.set('sessionSnapshot', sessionState.snapshot);
      progressPanel.setValue(completedTasks);
      audioManager.playRepairReward();
      if (!robot) {
        return;
      }
      robot.setRepairProgress(completedTasks);
      void (async () => {
        await robot.playCorrect();
        if (!this.sys.isActive() || !robot.active) return;
        await playRepairItemReward(this, robot, {
          textureKey: 'repair-gear',
          source: new Phaser.Math.Vector2(cardX + cardWidth - 54, cardY + cardHeight * 0.52),
          reducedMotion,
        });
        if (!this.sys.isActive() || !robot.active) return;
        await robot.playCelebrate();
      })();
    };

    if (isShadowMatchingTask) {
      const shadowState = shadowMatchingMechanic.snapshot;
      new TaskCard(this, {
        x: cardX, y: cardY, width: cardWidth, height: cardHeight,
        sizing: layout.taskCardSizing,
        taskNumber: 4, totalTasks: state.totalTasks,
        title: 'Найди тень', instruction: 'Какая тень подходит?',
        objectKeys: shadowState.orderedKeys,
        targetTextureKey: shadowState.targetKey,
        initialSelection: shadowState.selectedKey,
        completed: shadowState.result === 'correct',
        hintShown: shadowState.hintShown,
        hintText: shadowState.challenge.hint,
        hintFeedbackText: 'Подсказка у робота',
        correctFeedbackText: 'Правильно!',
        hintKeys: [shadowState.correctKey],
        internalProgress: { current: shadowState.challengeIndex + 1, total: shadowState.challengeCount },
        internalProgressLabel: 'ТЕНЬ',
        choiceLayout: 'shadow-matching',
        showContinueOnComplete: !shadowState.isFinalChallenge,
        continueDelayMs: 180,
        onSelect: (key: TaskObjectKey) => {
          robotDialogue?.hide();
          shadowMatchingMechanic.select(key as ShadowChoiceKey);
        },
        onHint: () => {
          audioManager.playHint();
          shadowMatchingMechanic.showHint();
          robotDialogue?.show(shadowMatchingMechanic.snapshot.challenge.hint);
          void robot?.playHint();
        },
        onCheck: () => {
          const result = shadowMatchingMechanic.check().result;
          if (result === 'correct') {
            audioManager.playCorrect();
            if (shadowMatchingMechanic.snapshot.completed) playCompletionFlow();
            else void robot?.playCorrect();
            const challengeIndex = shadowMatchingMechanic.snapshot.challengeIndex;
            robotDialogue?.show(SHADOW_CORRECT_DIALOGUE[challengeIndex % SHADOW_CORRECT_DIALOGUE.length]);
          } else if (result === 'wrong') {
            audioManager.playWrong();
            robotDialogue?.show(SHADOW_WRONG_DIALOGUE[wrongAttempt % SHADOW_WRONG_DIALOGUE.length]);
            wrongAttempt += 1;
            void robot?.playWrong();
          }
          return result;
        },
        onContinue: () => {
          shadowMatchingMechanic.continue();
          renderCurrentTask();
        },
      });
    } else if (isSequenceTask) {
      const sequenceState = sequenceMechanic.snapshot;
      new TaskCard(this, {
        x: cardX, y: cardY, width: cardWidth, height: cardHeight,
        sizing: layout.taskCardSizing,
        taskNumber: 2, totalTasks: state.totalTasks,
        title: 'Продолжи ряд', instruction: 'Какая картинка должна быть следующей?',
        objectKeys: sequenceState.optionKeys,
        sequenceKeys: sequenceState.sequenceKeys,
        correctKey: sequenceState.correctKey,
        internalProgress: { current: sequenceState.challengeIndex + 1, total: sequenceState.challengeCount },
        initialSelection: sequenceState.selectedKey,
        completed: sequenceState.result === 'correct',
        hintShown: sequenceState.hintShown,
        hintText: sequenceState.challenge.hint,
        hintFeedbackText: 'Подсказка у робота',
        showContinueOnComplete: true,
        continueDelayMs: 180,
        onSelect: (key: TaskObjectKey) => {
          robotDialogue?.hide();
          sequenceMechanic.select(key as SequenceAssetKey);
        },
        onHint: () => {
          audioManager.playHint();
          sequenceMechanic.showHint();
          robotDialogue?.show(sequenceMechanic.snapshot.challenge.hint);
          void robot?.playHint();
        },
        onCheck: () => {
          const result = sequenceMechanic.check().result;
          if (result === 'correct') {
            audioManager.playCorrect();
            if (sequenceMechanic.snapshot.completed) {
              playCompletionFlow();
            } else {
              void robot?.playCorrect();
            }
            robotDialogue?.show(SEQUENCE_CORRECT_DIALOGUE);
          } else if (result === 'wrong') {
            audioManager.playWrong();
            robotDialogue?.show(SEQUENCE_WRONG_DIALOGUE[wrongAttempt % SEQUENCE_WRONG_DIALOGUE.length]);
            wrongAttempt += 1;
            void robot?.playWrong();
          }
          return result;
        },
        onContinue: () => {
          if (!sequenceMechanic.snapshot.completed) sequenceMechanic.continue();
          renderCurrentTask();
        },
      });
    } else if (isSizeComparisonTask) {
      const sizeState = sizeComparisonMechanic.snapshot;
      new TaskCard(this, {
        x: cardX, y: cardY, width: cardWidth, height: cardHeight,
        sizing: layout.taskCardSizing,
        taskNumber: 3, totalTasks: state.totalTasks,
        title: 'Сравни по размеру', instruction: sizeState.challenge.instruction,
        objectKeys: sizeState.orderedKeys,
        initialSelection: sizeState.selectedKey,
        completed: sizeState.result === 'correct',
        hintShown: sizeState.hintShown,
        hintText: sizeState.challenge.hint,
        hintFeedbackText: 'Подсказка у робота',
        correctFeedbackText: 'Правильно!',
        internalProgress: { current: sizeState.challengeIndex + 1, total: sizeState.challengeCount },
        internalProgressLabel: 'СРАВНЕНИЕ',
        choiceLayout: 'size-comparison',
        choiceTextureKey: () => 'size-battery',
        choiceVisualScale: (key) => SIZE_SCALE_MULTIPLIERS[key.replace('size-', '') as SizeId],
        showContinueOnComplete: true,
        continueDelayMs: 180,
        onSelect: (key: TaskObjectKey) => {
          robotDialogue?.hide();
          sizeComparisonMechanic.select(key as SizeChoiceKey);
        },
        onHint: () => {
          audioManager.playHint();
          sizeComparisonMechanic.showHint();
          robotDialogue?.show(sizeComparisonMechanic.snapshot.challenge.hint);
          void robot?.playHint();
        },
        onCheck: () => {
          const result = sizeComparisonMechanic.check().result;
          if (result === 'correct') {
            audioManager.playCorrect();
            if (sizeComparisonMechanic.snapshot.completed) {
              playCompletionFlow();
            } else {
              void robot?.playCorrect();
            }
            const challengeIndex = sizeComparisonMechanic.snapshot.challengeIndex;
            robotDialogue?.show(SIZE_CORRECT_DIALOGUE[challengeIndex % SIZE_CORRECT_DIALOGUE.length]);
          } else if (result === 'wrong') {
            audioManager.playWrong();
            robotDialogue?.show(SIZE_WRONG_DIALOGUE[wrongAttempt % SIZE_WRONG_DIALOGUE.length]);
            wrongAttempt += 1;
            void robot?.playWrong();
          }
          return result;
        },
        onContinue: () => {
          sizeComparisonMechanic.continue();
          renderCurrentTask();
        },
      });
    } else if (oddMechanic) {
      new TaskCard(this, {
        x: cardX, y: cardY, width: cardWidth, height: cardHeight,
        sizing: layout.taskCardSizing,
        taskNumber: state.currentTask, totalTasks: state.totalTasks,
        title: 'Найди лишний предмет', instruction: 'Какой предмет не подходит?',
        objectKeys: ODD_ONE_OUT_OBJECTS.map((item) => item.key),
        initialSelection: oddMechanic.snapshot.selectedKey,
        completed: oddMechanic.snapshot.completed,
        hintText: 'Три предмета можно съесть',
        hintKeys: ODD_ONE_OUT_OBJECTS.filter((item) => item.edible).map((item) => item.key),
        onSelect: (key: TaskObjectKey) => {
          robotDialogue?.hide();
          oddMechanic.select(key as OddOneOutObjectKey);
        },
        onHint: () => {
          audioManager.playHint();
          oddMechanic.showHint();
          robotDialogue?.show('Три предмета можно съесть');
          void robot?.playHint();
        },
        onCheck: () => {
          const result = oddMechanic.check().result;
          if (result === 'correct') {
            audioManager.playCorrect();
            playCompletionFlow();
          } else if (result === 'wrong') {
            audioManager.playWrong();
            robotDialogue?.show(WRONG_DIALOGUE[wrongAttempt % WRONG_DIALOGUE.length]);
            wrongAttempt += 1;
            void robot?.playWrong();
          }
          return result;
        },
        continueDelayMs: 180,
        onContinue: renderCurrentTask,
      });
    }
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}
