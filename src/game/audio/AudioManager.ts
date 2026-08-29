import Phaser from 'phaser';
import { preferencesState } from '../state/preferencesState';

const MUSIC_VOLUME = 0.26;
const SFX_VOLUME = 0.58;

type SfxKey = 'audio-ui-click' | 'audio-answer-correct' | 'audio-answer-wrong' | 'audio-hint' | 'audio-repair-reward';

interface VolumeSound extends Phaser.Sound.BaseSound {
  volume: number;
  setVolume(value: number): this;
}

class AudioManager {
  private game?: Phaser.Game;
  private music?: VolumeSound;
  private fadeTimer?: ReturnType<typeof setInterval>;
  private musicRequested = false;
  private unlockListenerAttached = false;
  private userGestureReceived = false;

  initialize(game: Phaser.Game): void {
    this.game = game;
    game.sound.mute = preferencesState.audioMuted;
    game.events.off(Phaser.Core.Events.BLUR, this.pauseMusic, this);
    game.events.off(Phaser.Core.Events.FOCUS, this.resumeMusic, this);
    game.events.on(Phaser.Core.Events.BLUR, this.pauseMusic, this);
    game.events.on(Phaser.Core.Events.FOCUS, this.resumeMusic, this);
  }

  startMusic(): void {
    this.musicRequested = true;
    this.cancelFade();
    if (!this.game || preferencesState.audioMuted || !this.userGestureReceived) return;
    if (this.game.sound.locked) {
      this.waitForUnlock();
      return;
    }
    if (!this.music) this.music = this.game.sound.add('audio-start-theme', { loop: true, volume: MUSIC_VOLUME }) as VolumeSound;
    this.music.setVolume(MUSIC_VOLUME);
    if (!this.music.isPlaying) this.music.play();
  }

  stopMusic(fadeMs = 0): void {
    this.musicRequested = false;
    if (!this.music) return;
    this.cancelFade();
    if (fadeMs > 0 && this.game && this.music.isPlaying) {
      const sound = this.music;
      const startedAt = performance.now();
      const startingVolume = sound.volume;
      this.fadeTimer = setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / fadeMs);
        sound.setVolume(startingVolume * (1 - progress));
        if (progress < 1) return;
        this.cancelFade();
        sound.stop();
        sound.setVolume(MUSIC_VOLUME);
      }, 16);
      return;
    }
    this.music.stop();
    this.music.setVolume(MUSIC_VOLUME);
  }

  playUiClick(): void { this.playSfx('audio-ui-click'); }
  playCorrect(): void { this.playSfx('audio-answer-correct'); }
  playWrong(): void { this.playSfx('audio-answer-wrong'); }
  playHint(): void { this.playSfx('audio-hint'); }
  playRepairReward(): void { this.playSfx('audio-repair-reward'); }

  registerUserGesture(): void {
    if (this.userGestureReceived) return;
    this.userGestureReceived = true;
    if (this.musicRequested) this.startMusic();
  }

  setMuted(muted: boolean): void {
    preferencesState.setAudioMuted(muted);
    if (!this.game) return;
    this.game.sound.mute = muted;
    if (!muted && this.musicRequested) this.startMusic();
  }

  toggleMuted(): boolean {
    const muted = !preferencesState.audioMuted;
    this.setMuted(muted);
    return muted;
  }

  private playSfx(key: SfxKey): void {
    if (!this.game || preferencesState.audioMuted || !this.userGestureReceived) return;
    if (this.game.sound.locked) {
      this.waitForUnlock(() => this.playSfx(key));
      return;
    }
    this.game.sound.stopByKey(key);
    this.game.sound.play(key, { volume: SFX_VOLUME });
  }

  private waitForUnlock(afterUnlock?: () => void): void {
    if (!this.game) return;
    if (afterUnlock) this.game.sound.once(Phaser.Sound.Events.UNLOCKED, afterUnlock);
    if (!this.unlockListenerAttached) {
      this.unlockListenerAttached = true;
      this.game.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        this.unlockListenerAttached = false;
        if (this.musicRequested) this.startMusic();
      });
    }
  }

  private pauseMusic(): void {
    if (this.music?.isPlaying) this.music.pause();
  }

  private resumeMusic(): void {
    if (this.musicRequested && !preferencesState.audioMuted && this.music?.isPaused) this.music.resume();
  }

  private cancelFade(): void {
    if (!this.fadeTimer) return;
    clearInterval(this.fadeTimer);
    this.fadeTimer = undefined;
  }
}

export const audioManager = new AudioManager();
