let soundEnabled = true;

export const preferencesState = {
  get soundEnabled(): boolean { return soundEnabled; },
  toggleSound(): boolean {
    soundEnabled = !soundEnabled;
    return soundEnabled;
  },
};
