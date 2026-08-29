import Phaser from 'phaser';
import { UI_COLORS, UI_FONT } from './visualTheme';
import { clampValue } from './fluidSizing';
import type { ResponsiveLayout } from './responsiveLayout';

const DIALOGUE_DURATION_MS = 2000;

export class RobotDialogue extends Phaser.GameObjects.Container {
  private readonly label: Phaser.GameObjects.Text;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    robot: Phaser.GameObjects.Image | Phaser.GameObjects.Container,
    layout: ResponsiveLayout,
  ) {
    const { width: bubbleWidth, height: bubbleHeight, gap } = layout.dialogue;
    const robotBounds = robot.getBounds();
    const rightBoundary = layout.mode === 'landscape' ? layout.progress.x : layout.viewportWidth - layout.safe.right;
    const sideSpace = rightBoundary - robotBounds.right;
    const canUseRightSide = sideSpace >= bubbleWidth + gap;
    const x = canUseRightSide
      ? robotBounds.right + gap
      : clampValue(layout.safe.left, robotBounds.right - bubbleWidth * 0.42, rightBoundary - gap - bubbleWidth);
    const y = canUseRightSide
      ? clampValue(layout.safe.top + layout.headerHeight, robotBounds.top + robotBounds.height * 0.12, layout.viewportHeight - layout.safe.bottom - bubbleHeight)
      : clampValue(
        layout.taskCard.y + layout.taskCard.height + gap,
        robotBounds.top + robotBounds.height * 0.56,
        layout.viewportHeight - layout.safe.bottom - bubbleHeight,
      );
    super(scene, x, y);
    scene.add.existing(this);
    this.setName('robot-dialogue').setSize(bubbleWidth, bubbleHeight).setDepth(20).setVisible(false);

    const bubble = scene.add.graphics();
    bubble.fillStyle(0x203553, 0.2).fillRoundedRect(3, 5, bubbleWidth, bubbleHeight, 16);
    bubble.fillStyle(UI_COLORS.cream, 0.98).fillRoundedRect(0, 0, bubbleWidth, bubbleHeight, 16);
    bubble.lineStyle(3, UI_COLORS.purple, 1).strokeRoundedRect(0, 0, bubbleWidth, bubbleHeight, 16);
    bubble.fillStyle(UI_COLORS.cream, 1).fillTriangle(0, bubbleHeight * 0.55, -10, bubbleHeight * 0.68, 0, bubbleHeight * 0.76);
    bubble.lineStyle(3, UI_COLORS.purple, 1).beginPath()
      .moveTo(0, bubbleHeight * 0.55)
      .lineTo(-10, bubbleHeight * 0.68)
      .lineTo(0, bubbleHeight * 0.76)
      .strokePath();

    this.label = scene.add.text(bubbleWidth / 2, bubbleHeight / 2, '', {
      color: '#243548',
      fontFamily: UI_FONT,
      fontSize: `${layout.dialogue.fontSize}px`,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: bubbleWidth - 20 },
      lineSpacing: 2,
    }).setOrigin(0.5).setName('robot-dialogue-text');
    this.add([bubble, this.label]);
  }

  show(message: string): void {
    this.hideTimer?.remove(false);
    this.label.setText(message);
    this.setVisible(true).setAlpha(0).setScale(0.94);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 120, ease: 'Sine.easeOut' });
    this.hideTimer = this.scene.time.delayedCall(DIALOGUE_DURATION_MS, () => this.hide());
  }

  hide(): void {
    this.hideTimer?.remove(false);
    this.hideTimer = undefined;
    this.scene.tweens.killTweensOf(this);
    this.setVisible(false).setAlpha(1).setScale(1);
  }
}
