export interface ImageAsset {
  readonly key: string;
  readonly path: string;
}

export interface AudioAsset {
  readonly key: string;
  readonly path: string;
}

export const ASSET_GROUPS = {
  backgrounds: [
    { key: 'bg-start-laboratory', path: '/assets/backgrounds/laboratory-background.png' },
    { key: 'bg-main-laboratory', path: '/assets/backgrounds/laboratory-background.png' },
  ],
  robot: [
    { key: 'robot-v2-helper', path: 'assets/characters/robot-v2/robot-helper.png' },
    { key: 'robot-v2-repaired', path: 'assets/characters/robot-v2/robot-repaired.png' },
    { key: 'robot-v2-duo', path: 'assets/characters/robot-v2/robot-duo.png' },
  ],
  robotParts: [
    { key: 'robot-v2-antenna', path: 'assets/characters/robot-v2/parts/robot-antenna.png' },
    { key: 'robot-v2-arm-left', path: 'assets/characters/robot-v2/parts/robot-arm-left.png' },
    { key: 'robot-v2-arm-right', path: 'assets/characters/robot-v2/parts/robot-arm-right.png' },
    { key: 'robot-v2-body', path: 'assets/characters/robot-v2/parts/robot-body.png' },
    { key: 'robot-v2-head', path: 'assets/characters/robot-v2/parts/robot-head.png' },
    { key: 'robot-v2-leg-left', path: 'assets/characters/robot-v2/parts/robot-leg-left.png' },
    { key: 'robot-v2-leg-right', path: 'assets/characters/robot-v2/parts/robot-leg-right.png' },
  ],
  oddOneOut: [
    { key: 'odd-apple', path: 'assets/objects/odd-one-out/apple.png' },
    { key: 'odd-ball', path: 'assets/objects/odd-one-out/ball.png' },
    { key: 'odd-banana', path: 'assets/objects/odd-one-out/banana.png' },
    { key: 'odd-carrot', path: 'assets/objects/odd-one-out/carrot.png' },
  ],
  sequence: [
    { key: 'sequence-gear', path: 'assets/objects/sequence/sequence-gear.png' },
    { key: 'sequence-lightning', path: 'assets/objects/sequence/sequence-lightning.png' },
    { key: 'sequence-planet', path: 'assets/objects/sequence/sequence-planet.png' },
    { key: 'sequence-star', path: 'assets/objects/sequence/sequence-star.png' },
  ],
  sizeComparison: [{ key: 'size-battery', path: 'assets/objects/size-comparison/size-battery.png' }],
  shadows: [
    { key: 'shadow-apple', path: 'assets/objects/shadows/shadow-apple.png' },
    { key: 'shadow-ball', path: 'assets/objects/shadows/shadow-ball.png' },
    { key: 'shadow-banana', path: 'assets/objects/shadows/shadow-banana.png' },
    { key: 'shadow-carrot', path: 'assets/objects/shadows/shadow-carrot.png' },
  ],
  memory: [{ key: 'memory-cover', path: 'assets/objects/memory/memory-cover.png' }],
  repairItems: [
    { key: 'repair-bolt', path: 'assets/objects/repair-items/bolt.png' },
    { key: 'repair-circuit-board', path: 'assets/objects/repair-items/circuit-board.png' },
    { key: 'repair-gear', path: 'assets/objects/repair-items/gear.png' },
  ],
} satisfies Record<string, readonly ImageAsset[]>;

export const IMAGE_ASSETS = Object.values(ASSET_GROUPS).flat();
export const AUDIO_ASSETS = [
  { key: 'audio-start-theme', path: 'assets/audio/music/start-theme.wav' },
  { key: 'audio-ui-click', path: 'assets/audio/sfx/ui-click.wav' },
  { key: 'audio-answer-correct', path: 'assets/audio/sfx/answer-correct.wav' },
  { key: 'audio-answer-wrong', path: 'assets/audio/sfx/answer-wrong.wav' },
  { key: 'audio-hint', path: 'assets/audio/sfx/hint.wav' },
  { key: 'audio-repair-reward', path: 'assets/audio/sfx/repair-reward.wav' },
] satisfies readonly AudioAsset[];
export const MISSING_ASSET_IDS = [] as const;
