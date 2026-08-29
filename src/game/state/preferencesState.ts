const AUDIO_MUTED_KEY = 'robotlab.audioMuted';

function readAudioMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(AUDIO_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

let audioMuted = readAudioMuted();

export const preferencesState = {
  get audioMuted(): boolean { return audioMuted; },
  get soundEnabled(): boolean { return !audioMuted; },
  setAudioMuted(muted: boolean): void {
    audioMuted = muted;
    try {
      globalThis.localStorage?.setItem(AUDIO_MUTED_KEY, String(muted));
    } catch {
      // Storage can be denied; the in-memory preference remains functional.
    }
  },
};
