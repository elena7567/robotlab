import Phaser from 'phaser';
import { oddOneOutMechanic, ODD_ONE_OUT_OBJECTS, type OddOneOutObjectKey } from '../mechanics/oddOneOut';
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
import { TaskCard, type TaskObjectKey } from '../ui/TaskCard';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';
import { createResponsiveLayout } from '../ui/responsiveLayout';
import { configureResponsiveCamera } from '../ui/responsiveCamera';
import { audioManager } from '../audio/AudioManager';
import { shadowMatchingMechanic, type ShadowChoiceKey } from '../mechanics/shadowMatching';
import { memoryMechanic } from '../mechanics/memory';
import { MemoryTaskCard } from '../ui/MemoryTaskCard';
import { HELPER_ASSEMBLY_DIALOGUE } from '../state/robotAssemblyState';
import { RobotAssemblyPreview } from '../ui/RobotAssemblyPreview';

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
const MEMORY_MATCH_DIALOGUE = ['ПАРА!', 'ТОЧНО!', 'НАШЁЛ!'] as const;
const MEMORY_WRONG_DIALOGUE = ['ЗАПОМНИ ИХ', 'ПОПРОБУЙ ЕЩЁ', 'ГДЕ ЖЕ ПАРА?'] as const;

export class GameScene extends Phaser.Scene {
  private reflowCompletedTasks?: number;

  constructor() { super('GameScene'); }

  init(data?: { viewportReflow?: boolean; presentationState?: { completedTasks?: unknown } }): void {
    const value = data?.viewportReflow ? data.presentationState?.completedTasks : undefined;
    this.reflowCompletedTasks = typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4
      ? value
      : undefined;
  }

  create(): void {
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    const portrait = layout.mode !== 'landscape';
    const phoneLandscape = layout.semanticMode.startsWith('PHONE_LANDSCAPE');
    const tightPhoneLandscape = layout.semanticMode === 'PHONE_LANDSCAPE_SHORT' && layout.safeRect.width < 620;
    const state = sessionState.snapshot;
    const displayedCompletedTasks = this.reflowCompletedTasks ?? state.completedTasks;
    this.data.set('viewportPresentationState', { completedTasks: displayedCompletedTasks });
    this.game.registry.set('sessionSnapshot', state);
    const isMemoryTask = displayedCompletedTasks === 4;
    const isShadowMatchingTask = displayedCompletedTasks === 3;
    const isSizeComparisonTask = displayedCompletedTasks === 2;
    const isSequenceTask = displayedCompletedTasks === 1;
    const oddMechanic = displayedCompletedTasks === 0 ? oddOneOutMechanic : undefined;
    this.cameras.main.setBackgroundColor('#173b52');
    const worldLayer = this.add.container(0, 0).setName('logical-world').setDepth(-2);
    const actorLayer = this.add.container(0, 0).setName('logical-actors');
    addLogicalLaboratoryImage(this, worldLayer, 'bg-main-laboratory');
    const robot = createGroundedRobot(this, actorLayer, state.completedTasks);
    robot?.setData('characterRole', 'HERO');
    const frame = configureResponsiveCamera(this, worldLayer, layout);
    actorLayer.setPosition(frame.offsetX, frame.offsetY).setScale(frame.scale);
    this.game.registry.set('responsiveLayout', { ...layout, worldFrame: frame });
    this.add.rectangle(0, 0, width, height, 0x163852, portrait ? 0.12 : 0.05).setOrigin(0).setDepth(-1);

    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    const homeX = layout.safe.left + layout.iconWidth / 2;
    const topY = layout.headerY;
    addIconControl(this, homeX, topY, '⌂ Домой', () => this.scene.start('StartScene'), UI_COLORS.purple, iconSizing).setName('game-home');
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, topY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing).setName('game-sound');

    if (!portrait && !tightPhoneLandscape) {
      const headerWidth = layout.headerWidth;
      const headerX = width / 2 - headerWidth / 2;
      const header = this.add.graphics();
      const headerTop = topY - layout.headerHeight / 2;
      header.fillStyle(0x164d7b, 0.94).fillRoundedRect(headerX, headerTop, headerWidth, layout.headerHeight, 18);
      header.lineStyle(2, 0x72d9ec, 0.8).strokeRoundedRect(headerX, headerTop, headerWidth, layout.headerHeight, 18);
      this.add.text(width / 2, topY, 'Почини робота', {
        color: '#ffffff', fontFamily: UI_FONT, fontSize: `${layout.headerFontSize}px`, fontStyle: 'bold',
      }).setOrigin(0.5).setName('game-header');
    }

    const { x: cardX, y: cardY, width: cardWidth, height: cardHeight } = layout.taskCard;
    let progressPanel: ProgressPanel;
    progressPanel = new ProgressPanel(this, {
      x: layout.progress.x, y: layout.progress.y, width: layout.progress.width, height: layout.progress.height,
      value: state.assemblyProgress, horizontal: layout.progress.horizontal, sizing: layout.progress.sizing,
    });
    progressPanel.setVisible(!phoneLandscape);

    const robotDialogue = robot && !phoneLandscape ? new RobotDialogue(this, robot, layout) : undefined;
    let wrongAttempt = 0;
    let completionFlowActive = false;
    let taskTransitionActive = false;
    const renderCurrentTask = (): void => {
      if (taskTransitionActive) return;
      taskTransitionActive = true;
      robotDialogue?.hide();
      // Restart is the normal task renderer. It synchronously destroys the old
      // TaskCard before create() chooses the card for the updated session state.
      // A viewport reflow restarts this scene with presentation data that keeps
      // the currently visible completed task on screen. Phaser may retain that
      // init payload when restart() receives no replacement data, so an
      // explicit child action must clear reflow mode before rendering the next
      // canonical task.
      this.scene.restart({ viewportReflow: false });
    };
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const releaseCompletedRobot = async (): Promise<void> => {
      const panelBounds = progressPanel.getBounds();
      const startScreenX = panelBounds.centerX;
      const startScreenY = panelBounds.centerY;
      const startLogicalX = (startScreenX - frame.offsetX) / frame.scale;
      const startLogicalY = (startScreenY - frame.offsetY) / frame.scale;
      const pairScale = layout.mode === 'landscape' ? 0.19 : (layout.mode === 'large-portrait-tablet' ? 0.19 : 0.17);
      const pairSpan = layout.mode === 'landscape' ? 270 : 250;
      const helperX = 640 - pairSpan / 2;
      const repairedX = 640 + pairSpan / 2;
      const repairedRobot = new RobotAssemblyPreview(this, startLogicalX, startLogicalY, 5, {
        scale: pairScale * 0.72,
        blueprintAlpha: 0,
      }).setName('released-assembled-robot').setAlpha(0).setData({
        role: 'repaired',
        releaseActive: true,
        released: false,
        platformContactX: repairedX,
        platformContactY: 560,
        robotFeetContactX: repairedX,
        robotFeetContactY: 560,
        groundedScale: pairScale,
      });
      actorLayer.add(repairedRobot);
      const duration = reducedMotion ? 260 : 720;
      const tween = (config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> => new Promise((resolve) => {
        this.tweens.add({ ...config, duration, ease: 'Sine.easeInOut', onComplete: () => resolve() });
      });
      const movements: Promise<void>[] = [
        progressPanel.playRelease(reducedMotion),
        tween({ targets: repairedRobot, x: repairedX, y: 560, scaleX: pairScale, scaleY: pairScale, alpha: 1 }),
      ];
      if (robot) {
        movements.push(tween({ targets: robot, x: helperX, y: 560, scaleX: pairScale, scaleY: pairScale }));
      }
      await Promise.all(movements);
      if (!this.sys.isActive() || !repairedRobot.active) return;
      repairedRobot.setData({ releaseActive: false, released: true });
      robot?.setData({
        baseX: helperX,
        baseY: 560,
        groundedScale: pairScale,
        platformContactX: helperX,
        platformContactY: 560,
      });
      this.game.registry.set('finalRobotReleased', true);
    };
    let completionRewardPromise: Promise<void> | undefined;
    const playCompletionFlow = (): Promise<void> => {
      if (completionRewardPromise) return completionRewardPromise;
      const previousProgress = sessionState.snapshot.assemblyProgress;
      completionFlowActive = true;
      sessionState.completeCurrentTask();
      const nextState = sessionState.snapshot;
      const completedTasks = nextState.completedTasks;
      this.game.registry.set('sessionSnapshot', nextState);
      audioManager.playRepairReward();
      robot?.setRepairProgress(completedTasks);
      robotDialogue?.show(HELPER_ASSEMBLY_DIALOGUE[nextState.assemblyProgress as 1 | 2 | 3 | 4 | 5]);
      const helperReaction = robot ? (async (): Promise<void> => {
        await robot.playCorrect();
        if (this.sys.isActive() && robot.active) await robot.playCelebrate();
      })() : Promise.resolve();
      completionRewardPromise = Promise.all([
        progressPanel.playInstall(previousProgress, nextState.assemblyProgress, reducedMotion),
        helperReaction,
      ]).then(async () => {
        if (completedTasks === 5 && this.sys.isActive()) await releaseCompletedRobot();
      });
      return completionRewardPromise;
    };

    if (isMemoryTask) {
      let memoryCard: MemoryTaskCard;
      let memoryResolutionTimer: Phaser.Time.TimerEvent | undefined;
      let finalTransitionTimer: Phaser.Time.TimerEvent | undefined;
      const playFinalCompletion = (): void => {
        if (completionFlowActive) return;
        void playCompletionFlow().then(() => {
          finalTransitionTimer = this.time.delayedCall(reducedMotion ? 420 : 900, () => {
            if (this.sys.isActive()) this.scene.start('TransitionScene');
          });
        });
      };
      const resolvePendingPair = (): void => {
        memoryResolutionTimer?.remove(false);
        const pending = memoryMechanic.snapshot;
        if (!pending.locked || !pending.firstCardId || !pending.secondCardId) return;
        const first = pending.cards.find((card) => card.id === pending.firstCardId);
        const second = pending.cards.find((card) => card.id === pending.secondCardId);
        const matches = first?.pairId === second?.pairId;
        memoryResolutionTimer = this.time.delayedCall(matches ? 360 : (reducedMotion ? 650 : 900), () => {
          const resolution = memoryMechanic.resolvePair();
          memoryCard.sync(memoryMechanic.snapshot, true);
          if (resolution === 'mismatch') {
            audioManager.playWrong();
            robotDialogue?.show(MEMORY_WRONG_DIALOGUE[wrongAttempt % MEMORY_WRONG_DIALOGUE.length]);
            wrongAttempt += 1;
            void robot?.playWrong();
          } else if (resolution === 'match' || resolution === 'complete') {
            audioManager.playCorrect();
            const pairIndex = memoryMechanic.snapshot.matchedPairs - 1;
            robotDialogue?.show(MEMORY_MATCH_DIALOGUE[pairIndex % MEMORY_MATCH_DIALOGUE.length]);
            if (resolution === 'complete') playFinalCompletion();
            else void robot?.playCorrect();
          }
          memoryResolutionTimer = undefined;
        });
      };
      memoryCard = new MemoryTaskCard(this, {
        x: cardX, y: cardY, width: cardWidth, height: cardHeight,
        sizing: layout.taskCardSizing,
        mode: layout.mode,
        snapshot: memoryMechanic.snapshot,
        reducedMotion,
        onCard: (cardId) => {
          robotDialogue?.hide();
          const result = memoryMechanic.select(cardId);
          if (result !== 'ignored') {
            audioManager.registerUserGesture();
            audioManager.playUiClick();
          }
          if (result === 'second') resolvePendingPair();
          return result;
        },
        onHint: () => {
          const ids = memoryMechanic.hintCardIds();
          if (!ids.length) return ids;
          audioManager.playHint();
          robotDialogue?.show(memoryMechanic.snapshot.firstCardId ? 'ВОТ ГДЕ ПАРА' : 'ЗАПОМНИ ИХ');
          void robot?.playHint();
          return ids;
        },
      });
      if (memoryMechanic.snapshot.locked) resolvePendingPair();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        memoryResolutionTimer?.remove(false);
        finalTransitionTimer?.remove(false);
      });
    } else if (isShadowMatchingTask) {
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
        responseMode: 'direct',
        showContinueOnComplete: false,
        continueDelayMs: shadowState.isFinalChallenge ? (reducedMotion ? 650 : 1550) : 720,
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
            if (shadowMatchingMechanic.snapshot.completed) {
              void playCompletionFlow();
            } else {
              void robot?.playCorrect();
              const challengeIndex = shadowMatchingMechanic.snapshot.challengeIndex;
              robotDialogue?.show(SHADOW_CORRECT_DIALOGUE[challengeIndex % SHADOW_CORRECT_DIALOGUE.length]);
            }
          } else if (result === 'wrong') {
            audioManager.playWrong();
            robotDialogue?.show(SHADOW_WRONG_DIALOGUE[wrongAttempt % SHADOW_WRONG_DIALOGUE.length]);
            wrongAttempt += 1;
            void robot?.playWrong();
          }
          return result;
        },
        onContinue: () => {
          if (!shadowMatchingMechanic.snapshot.completed) shadowMatchingMechanic.continue();
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
        responseMode: 'direct',
        showContinueOnComplete: false,
        continueDelayMs: sequenceState.isFinalChallenge ? (reducedMotion ? 650 : 1550) : 720,
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
              void playCompletionFlow();
            } else {
              void robot?.playCorrect();
              robotDialogue?.show(SEQUENCE_CORRECT_DIALOGUE);
            }
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
        responseMode: 'direct',
        showContinueOnComplete: false,
        continueDelayMs: sizeState.isFinalChallenge ? (reducedMotion ? 650 : 1550) : 720,
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
              void playCompletionFlow();
            } else {
              void robot?.playCorrect();
              const challengeIndex = sizeComparisonMechanic.snapshot.challengeIndex;
              robotDialogue?.show(SIZE_CORRECT_DIALOGUE[challengeIndex % SIZE_CORRECT_DIALOGUE.length]);
            }
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
        taskNumber: displayedCompletedTasks + 1, totalTasks: state.totalTasks,
        title: 'Найди лишний предмет', instruction: 'Какой предмет не подходит?',
        objectKeys: ODD_ONE_OUT_OBJECTS.map((item) => item.key),
        initialSelection: oddMechanic.snapshot.selectedKey,
        completed: oddMechanic.snapshot.completed,
        hintText: 'Три предмета можно съесть',
        hintKeys: ODD_ONE_OUT_OBJECTS.filter((item) => item.edible).map((item) => item.key),
        responseMode: 'direct',
        showContinueOnComplete: false,
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
            void playCompletionFlow();
          } else if (result === 'wrong') {
            audioManager.playWrong();
            robotDialogue?.show(WRONG_DIALOGUE[wrongAttempt % WRONG_DIALOGUE.length]);
            wrongAttempt += 1;
            void robot?.playWrong();
          }
          return result;
        },
        continueDelayMs: reducedMotion ? 650 : 1550,
        onContinue: renderCurrentTask,
      });
    }
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}
