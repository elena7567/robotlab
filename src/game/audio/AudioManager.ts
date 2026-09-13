import Phaser from 'phaser';
import { preferencesState } from '../state/preferencesState';

const MUSIC_VOLUME = 0.26;
const SFX_VOLUME = 0.58;
const MISSION_10_INTRO_FAILURE_VOLUME = 0.46;
const MISSION_10_VICTORY_VOLUME = 0.48;
const MISSION_10_INTRO_FAILURE_KEY = 'audio-answer-wrong';
const MISSION_10_BEACON_KEY = 'audio-mission10-beacon-launch';
const MISSION_10_VICTORY_KEY = 'audio-mission10-victory-theme';

type SfxKey = 'audio-ui-click' | 'audio-answer-correct' | 'audio-answer-wrong' | 'audio-hint' | 'audio-repair-reward';

interface VolumeSound extends Phaser.Sound.BaseSound {
  volume: number;
  setVolume(value: number): this;
}

class AudioManager {
  private game?: Phaser.Game;
  private music?: VolumeSound;
  private mission10IntroFailure?: VolumeSound;
  private mission10Victory?: VolumeSound;
  private fadeTimer?: ReturnType<typeof setInterval>;
  private musicRequested = false;
  private mission10VictoryRequested = false;
  private mission10VictoryUnlockListenerAttached = false;
  private mission10IntroFailurePending = false;
  private mission10IntroUnlockListenerAttached = false;
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
    if (!this.music) this.music = this.game.sound.add('audio-start-lab-theme', { loop: true, volume: MUSIC_VOLUME }) as VolumeSound;
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

  requestMission10IntroFailureCue(): void {
    this.mission10IntroFailurePending = true;
    this.tryPlayMission10IntroFailureCue();
  }

  stopMission10IntroFailureCue(stopPlaying = true): void {
    this.mission10IntroFailurePending = false;
    if (stopPlaying) this.mission10IntroFailure?.stop();
  }

  playMission10BeaconLaunch(): void {
    if (!this.game || preferencesState.audioMuted || !this.userGestureReceived) return;
    if (this.game.sound.locked) {
      this.waitForUnlock(() => this.playMission10BeaconLaunch());
      return;
    }
    this.game.sound.stopByKey(MISSION_10_BEACON_KEY);
    this.game.sound.play(MISSION_10_BEACON_KEY, { volume: SFX_VOLUME });
  }

  playMission10VictoryTheme(): void {
    this.mission10VictoryRequested = true;
    if (!this.game || preferencesState.audioMuted || !this.userGestureReceived) return;
    if (this.game.sound.locked) {
      if (!this.mission10VictoryUnlockListenerAttached) {
        this.mission10VictoryUnlockListenerAttached = true;
        this.game.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
          this.mission10VictoryUnlockListenerAttached = false;
          if (this.mission10VictoryRequested) this.playMission10VictoryTheme();
        });
      }
      return;
    }
    if (this.mission10Victory?.isPlaying) return;
    if (this.mission10Victory?.isPaused) {
      this.mission10Victory.resume();
      return;
    }
    if (!this.mission10Victory) {
      this.mission10Victory = this.game.sound.add(MISSION_10_VICTORY_KEY, {
        loop: false,
        volume: MISSION_10_VICTORY_VOLUME,
      }) as VolumeSound;
      this.mission10Victory.on(Phaser.Sound.Events.COMPLETE, () => {
        this.mission10VictoryRequested = false;
      });
    }
    // A requested theme continues through presentation rebuilds and scene handoff.
    this.mission10Victory.setVolume(MISSION_10_VICTORY_VOLUME);
    this.mission10Victory.play();
  }

  stopMission10Audio(): void {
    this.stopMission10IntroFailureCue();
    this.mission10VictoryRequested = false;
    this.game?.sound.stopByKey(MISSION_10_BEACON_KEY);
    this.mission10Victory?.stop();
  }

  releaseMission10AudioAfterSceneShutdown(): void {
    this.stopMission10IntroFailureCue();
    const game = this.game;
    // Phaser queues scene stop and start together. Decide ownership after that
    // batch, so responsive restarts and the Victory handoff keep one soundtrack.
    queueMicrotask(() => {
      if (!game || this.game !== game || !game.isBooted) return;
      if (!game.scene.isActive('Mission10Scene') && !game.scene.isActive('VictoryScene')) {
        this.stopMission10Audio();
      }
    });
  }
  registerUserGesture(): void {
    const firstGesture = !this.userGestureReceived;
    this.userGestureReceived = true;
    this.resumeAudioContextAfterGesture();
    this.tryPlayMission10IntroFailureCue();
    if (this.mission10VictoryRequested) this.playMission10VictoryTheme();
    if (!firstGesture) return;
    if (this.musicRequested) this.startMusic();
  }

  setMuted(muted: boolean): void {
    preferencesState.setAudioMuted(muted);
    if (!this.game) return;
    this.game.sound.mute = muted;
    if (!muted) {
      this.tryPlayMission10IntroFailureCue();
      if (this.musicRequested) this.startMusic();
      if (this.mission10VictoryRequested && !this.mission10Victory?.isPlaying) {
        this.playMission10VictoryTheme();
      }
    }
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

  private tryPlayMission10IntroFailureCue(): void {
    if (!this.mission10IntroFailurePending || !this.game || preferencesState.audioMuted || !this.userGestureReceived) return;
    if (this.game.sound.locked) {
      if (this.mission10IntroUnlockListenerAttached) return;
      this.mission10IntroUnlockListenerAttached = true;
      this.game.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        this.mission10IntroUnlockListenerAttached = false;
        this.tryPlayMission10IntroFailureCue();
      });
      return;
    }
    if (!this.mission10IntroFailure) {
      this.mission10IntroFailure = this.game.sound.add(MISSION_10_INTRO_FAILURE_KEY, {
        loop: false,
        volume: MISSION_10_INTRO_FAILURE_VOLUME,
      }) as VolumeSound;
    }
    this.mission10IntroFailure.stop();
    this.mission10IntroFailure.setVolume(MISSION_10_INTRO_FAILURE_VOLUME);
    // Retain the request if the browser cannot start this playback yet.
    if (this.mission10IntroFailure.play()) this.mission10IntroFailurePending = false;
  }

  private resumeAudioContextAfterGesture(): void {
    const manager = this.game?.sound;
    if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return;
    if (manager.context.state === 'running' || manager.context.state === 'closed') return;
    // A backgrounded browser may suspend the context without relocking Phaser.
    // Resume only from an actual input action and retain deferred cues on failure.
    void manager.context.resume().then(() => this.tryPlayMission10IntroFailureCue()).catch(() => {});
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
    if (this.mission10Victory?.isPlaying) this.mission10Victory.pause();
  }

  private resumeMusic(): void {
    if (this.musicRequested && !preferencesState.audioMuted && this.music?.isPaused) this.music.resume();
    if (this.mission10VictoryRequested
      && !preferencesState.audioMuted
      && this.mission10Victory?.isPaused) this.mission10Victory.resume();
  }

  private cancelFade(): void {
    if (!this.fadeTimer) return;
    clearInterval(this.fadeTimer);
    this.fadeTimer = undefined;
  }
}

export const audioManager = new AudioManager();
