export interface ImageAsset {
  readonly key: string;
  readonly path: string;
}

export const ASSET_GROUPS = {
  backgrounds: [
    { key: 'bg-start-laboratory', path: '/assets/backgrounds/laboratory-background.png' },
    { key: 'bg-main-laboratory', path: '/assets/backgrounds/laboratory-background.png' },
  ],
  robot: [{ key: 'robot-complete', path: 'assets/characters/robot/robot-complete_v01.png' }],
  robotParts: [
    { key: 'robot-part-antenna', path: 'assets/characters/robot/parts/robot-antenna.png' },
    { key: 'robot-part-arm-left', path: 'assets/characters/robot/parts/robot-arm-left.png' },
    { key: 'robot-part-arm-right', path: 'assets/characters/robot/parts/robot-arm-right.png' },
    { key: 'robot-part-body', path: 'assets/characters/robot/parts/robot-body.png' },
    { key: 'robot-part-head', path: 'assets/characters/robot/parts/robot-head.png' },
    { key: 'robot-part-leg-left', path: 'assets/characters/robot/parts/robot-leg-left.png' },
    { key: 'robot-part-leg-right', path: 'assets/characters/robot/parts/robot-leg-right.png' },
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
export const MISSING_ASSET_IDS = [] as const;
