import Phaser from 'phaser';
import { preferencesState } from '../state/preferencesState';
import { addControl, addIconControl } from '../ui/controls';
import { createGroundedRobot } from '../ui/robotGrounding';
import { RobotAssemblyPreview } from '../ui/RobotAssemblyPreview';
import { createResponsiveLayout } from '../ui/responsiveLayout';
import { composeScene } from '../ui/sceneCompositionDirector';
import { configureResponsiveCamera } from '../ui/responsiveCamera';
import { addLogicalLaboratoryImage, restartOnViewportResize } from '../ui/sceneLayout';
import { markSceneReady } from '../ui/sceneUi';
import { UI_COLORS, UI_FONT } from '../ui/visualTheme';
import { fluidValue } from '../ui/fluidSizing';
import { audioManager } from '../audio/AudioManager';
import { CHARACTER_VISIBLE_BOUNDS, fitVisibleBoundsInRect } from '../assets/characterBounds';
import { DesktopCharacterRole, resolveWorldCharacterScale } from '../characters/CharacterSizingPolicy';
import { CHARACTER_VISUAL_PROFILES } from '../characters/characterVisualProfiles';
import { publishCharacterTelemetry } from '../characters/CharacterTelemetry';

export class TransitionScene extends Phaser.Scene {
  constructor() { super('TransitionScene'); }
  create(): void {
    const { width, height } = this.scale;
    const layout = createResponsiveLayout(width, height);
    this.game.registry.set('responsiveLayout', layout);
    const portrait = layout.mode !== 'landscape';
    const sceneComposition = composeScene(layout, 'MISSION5_TRANSITION');
    const transitionLayout = sceneComposition.transition!;
    this.game.registry.set('sceneComposition', sceneComposition);
    const { phonePortrait } = transitionLayout;
    this.cameras.main.setBackgroundColor('#173b52');
    const worldLayer = this.add.container(0, 0).setName('transition-world').setDepth(-2);
    const actorLayer = this.add.container(0, 0).setName('transition-actors');
    addLogicalLaboratoryImage(this, worldLayer, 'bg-main-laboratory');
    const frame = configureResponsiveCamera(this, worldLayer, layout);
    const { buttonHeight, titleSize, titleY, pairScale, pairSpan } = transitionLayout;
    const screenActors = phonePortrait || layout.semanticMode === 'PHONE_LANDSCAPE_SHORT';
    const fitActors = screenActors;
    const characterRegion = sceneComposition.regions.CHARACTER;
    const actorGap = layout.gapS;
    const actorAvailableWidth = characterRegion.width - actorGap;
    const helperAspect = CHARACTER_VISIBLE_BOUNDS.ROBOT_V2_HELPER.width / CHARACTER_VISIBLE_BOUNDS.ROBOT_V2_HELPER.height;
    const repairedAspect = CHARACTER_VISIBLE_BOUNDS.ROBOT_V2_ASSEMBLED.width / CHARACTER_VISIBLE_BOUNDS.ROBOT_V2_ASSEMBLED.height;
    const actorWidth = actorAvailableWidth * helperAspect / (helperAspect + repairedAspect);
    const repairedWidth = actorAvailableWidth - actorWidth;
    const helperFit = fitVisibleBoundsInRect(CHARACTER_VISIBLE_BOUNDS.ROBOT_V2_HELPER, {
      x: characterRegion.x,
      y: characterRegion.y,
      width: actorWidth,
      height: characterRegion.height,
    }, 0.5, 1);
    const repairedFit = fitVisibleBoundsInRect(CHARACTER_VISIBLE_BOUNDS.ROBOT_V2_ASSEMBLED, {
      x: characterRegion.x + actorWidth + actorGap,
      y: characterRegion.y,
      width: repairedWidth,
      height: characterRegion.height,
    }, 0.5, 1);
    const helper = createGroundedRobot(this, actorLayer, 5);
    const helperX = fitActors ? helperFit.x : phonePortrait ? width / 2 - pairSpan / 2 : 640 - pairSpan / 2;
    const repairedX = fitActors ? repairedFit.x : phonePortrait ? width / 2 + pairSpan / 2 : 640 + pairSpan / 2;
    const helperY = fitActors ? helperFit.y : phonePortrait ? transitionLayout.actorFeetY : 560;
    const repairedY = fitActors ? repairedFit.y : phonePortrait ? transitionLayout.actorFeetY : 560;
    const helperScale = fitActors ? helperFit.scale : pairScale;
    const repairedScale = fitActors ? repairedFit.scale : pairScale;
    helper?.setPosition(helperX, helperY).setScale(helperScale).setData({
      baseX: helperX, baseY: helperY, characterRole: 'PRIMARY_CHARACTER', compositionRegion: 'CHARACTER', visibleBoundsId: 'ROBOT_V2_HELPER',
    });
    const repaired = new RobotAssemblyPreview(this, repairedX, repairedY, 5, { scale: repairedScale, blueprintAlpha: 0 })
      .setName('transition-assembled-robot');
    repaired.setData({ characterRole: 'PRIMARY_CHARACTER', compositionRegion: 'SECONDARY_CHARACTER', visibleBoundsId: 'ROBOT_V2_ASSEMBLED' });
    repaired.setPowered(false);
    actorLayer.add(repaired);
    if (!screenActors) actorLayer.setPosition(frame.offsetX, frame.offsetY).setScale(frame.scale);
    if (layout.semanticMode === 'DESKTOP' && helper) {
      publishCharacterTelemetry(this, [
        {
          characterId: 'transition-helper',
          object: helper,
          profileId: 'helper',
          role: DesktopCharacterRole.WORLD_PRIMARY,
          sizing: resolveWorldCharacterScale({ profile: CHARACTER_VISUAL_PROFILES.helper, role: DesktopCharacterRole.WORLD_PRIMARY, viewportHeight: height, parentScale: frame.scale }),
          groundY: transitionLayout.actorFeetY,
        },
        {
          characterId: 'transition-assembled',
          object: repaired,
          profileId: 'assembled',
          role: DesktopCharacterRole.WORLD_SECONDARY,
          sizing: resolveWorldCharacterScale({ profile: CHARACTER_VISUAL_PROFILES.assembled, role: DesktopCharacterRole.WORLD_SECONDARY, viewportHeight: height, parentScale: frame.scale }),
          groundY: transitionLayout.actorFeetY,
        },
      ]);
    }
    this.add.rectangle(0, 0, width, height, 0x102b47, portrait ? 0.3 : 0.22).setOrigin(0).setDepth(-1);

    const iconSizing = { width: layout.iconWidth, height: layout.iconHeight, fontSize: layout.iconFontSize };
    addIconControl(this, layout.safe.left + layout.iconWidth / 2, layout.headerY, '⌂ Домой', () => this.scene.start('StartScene'), UI_COLORS.purple, iconSizing).setName('transition-home');
    const soundLabel = (): string => preferencesState.soundEnabled ? '♪ Звук' : '× Звук';
    let soundControl: Phaser.GameObjects.Container;
    soundControl = addIconControl(this, width - layout.safe.right - layout.iconWidth / 2, layout.headerY, soundLabel(), () => {
      audioManager.toggleMuted();
      (soundControl.getAt(1) as Phaser.GameObjects.Text).setText(soundLabel());
    }, UI_COLORS.green, iconSizing).setName('transition-sound');
    const title = this.add.text(width / 2, titleY, 'РОБОТ СОБРАН!', {
      color: '#ffffff', fontFamily: UI_FONT, fontSize: `${titleSize}px`, fontStyle: 'bold', align: 'center',
      stroke: '#31567a', strokeThickness: 7,
    }).setOrigin(0.5).setName('transition-title');
    if (title.width > width - 30) title.setScale((width - 30) / title.width);
    this.add.text(width / 2, transitionLayout.subtitleY, 'ТЕПЕРЬ ПОРА ЕГО ОЖИВИТЬ!', {
      color: '#fff8e7', fontFamily: UI_FONT, fontSize: `${portrait ? fluidValue(15, width, 0.045, 22) : fluidValue(16, height, 0.032, 24)}px`,
      fontStyle: 'bold', align: 'center', wordWrap: { width: width - 36 }, stroke: '#31567a', strokeThickness: 4,
    }).setOrigin(0.5).setName('transition-subtitle');
    addControl(this, width / 2, transitionLayout.buttonY, 'ПРОДОЛЖИТЬ', () => this.scene.start('Mission6Scene'), {
      width: Math.min(280, width - layout.safe.left - layout.safe.right - 30), height: buttonHeight,
      fontSize: fluidValue(19, width, 0.055, 26),
    }).setName('transition-continue');
    restartOnViewportResize(this);
    markSceneReady(this);
  }
}

