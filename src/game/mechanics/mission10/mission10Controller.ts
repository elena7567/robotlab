import { getMission10EnergyConfig, MISSION10_ENERGY_CONFIGS, normalizeOrientation, solveMission10Energy, findMission10EnergySolution, type Mission10EnergySolution } from './energyRelayPuzzle.ts';
import { cloneMission10Snapshot, normalizeMission10Seed, selectMission10ConfigIndex, type Mission10Snapshot, type Mission10Stage, type Mission10StageShortcut } from './mission10State.ts';
import { getMission10PathConfig, getMission10PathLane, getMission10SafeLane, MISSION10_PATH_CONFIGS, type Mission10LaneId, type Mission10PathKind } from './safePathPuzzle.ts';
import { findMission10SignalSolution, getMission10SignalConfig, MISSION10_SIGNAL_CONFIGS, normalizeSignalOrientation, solveMission10Signal, type Mission10SignalSolution } from './signalPuzzle.ts';

export const MISSION10_FINALE_STEP_COUNT = 5;
export type Mission10IgnoredReason = 'WRONG_STAGE' | 'UNKNOWN_CONTROL' | 'ALREADY_APPLIED';
export type Mission10ActionResult =
  | { readonly status: 'ignored'; readonly reason: Mission10IgnoredReason; readonly stage: Mission10Stage }
  | { readonly status: 'started'; readonly stage: 'PATH' }
  | { readonly status: 'path'; readonly correct: boolean; readonly hazardKind: Mission10PathKind; readonly decisionIndex: number; readonly stageAdvanced: boolean; readonly hintLaneId: Mission10LaneId | null }
  | { readonly status: 'energy'; readonly relayId: string; readonly orientation: number; readonly evaluation: Mission10EnergySolution; readonly stageAdvanced: boolean; readonly hintRelayId: string | null }
  | { readonly status: 'signal'; readonly reflectorId: string; readonly orientation: number; readonly evaluation: Mission10SignalSolution; readonly stageAdvanced: boolean; readonly hintReflectorId: string | null }
  | { readonly status: 'launched'; readonly stage: 'FINALE' }
  | { readonly status: 'finale'; readonly finaleStep: number; readonly completed: boolean }
  | { readonly status: 'reset'; readonly stage: 'INTRO' }
  | { readonly status: 'shortcut'; readonly stage: Mission10Stage };

function initialSnapshot(seed: number): Mission10Snapshot {
  const runSeed = normalizeMission10Seed(seed);
  const pathConfig = MISSION10_PATH_CONFIGS[selectMission10ConfigIndex(runSeed, 0x10a1, MISSION10_PATH_CONFIGS.length)];
  const energyConfig = MISSION10_ENERGY_CONFIGS[selectMission10ConfigIndex(runSeed, 0x10e2, MISSION10_ENERGY_CONFIGS.length)];
  const signalConfig = MISSION10_SIGNAL_CONFIGS[selectMission10ConfigIndex(runSeed, 0x1053, MISSION10_SIGNAL_CONFIGS.length)];
  return {
    stage: 'INTRO', runSeed, pathConfigId: pathConfig.id, energyConfigId: energyConfig.id, signalConfigId: signalConfig.id,
    pathDecisionIndex: 0, pathWrongAttempts: 0, relayOrientations: { ...energyConfig.initialOrientations }, energyWrongAttempts: 0,
    reflectorOrientations: { ...signalConfig.initialOrientations }, signalWrongAttempts: 0,
    launchPressed: false, finaleStep: 0, completed: false,
  };
}

function ignored(state: Mission10Snapshot, reason: Mission10IgnoredReason): Mission10ActionResult {
  return { status: 'ignored', reason, stage: state.stage };
}

export class Mission10Controller {
  private state: Mission10Snapshot;

  constructor(seedOrSnapshot: number | Mission10Snapshot = 0) {
    this.state = typeof seedOrSnapshot === 'number' ? initialSnapshot(seedOrSnapshot) : cloneMission10Snapshot(seedOrSnapshot);
  }

  get snapshot(): Readonly<Mission10Snapshot> { return cloneMission10Snapshot(this.state); }

  beginMission(): Mission10ActionResult {
    if (this.state.stage !== 'INTRO') return ignored(this.state, 'ALREADY_APPLIED');
    this.state = { ...this.state, stage: 'PATH' };
    return { status: 'started', stage: 'PATH' };
  }

  choosePath(laneId: Mission10LaneId): Mission10ActionResult {
    if (this.state.stage !== 'PATH') return ignored(this.state, 'WRONG_STAGE');
    const lane = getMission10PathLane(this.state.pathConfigId, this.state.pathDecisionIndex, laneId);
    if (!lane) return ignored(this.state, 'UNKNOWN_CONTROL');
    if (lane.kind !== 'SAFE') {
      const wrongAttempts = this.state.pathWrongAttempts + 1;
      this.state = { ...this.state, pathWrongAttempts: wrongAttempts };
      return { status: 'path', correct: false, hazardKind: lane.kind, decisionIndex: this.state.pathDecisionIndex, stageAdvanced: false,
        hintLaneId: wrongAttempts >= 2 ? getMission10SafeLane(this.state.pathConfigId, this.state.pathDecisionIndex) : null };
    }
    const decisionIndex = this.state.pathDecisionIndex + 1;
    const stageAdvanced = decisionIndex === getMission10PathConfig(this.state.pathConfigId).rounds.length;
    this.state = { ...this.state, pathDecisionIndex: decisionIndex, stage: stageAdvanced ? 'ENERGY' : 'PATH' };
    return { status: 'path', correct: true, hazardKind: 'SAFE', decisionIndex, stageAdvanced, hintLaneId: null };
  }

  rotateRelay(relayId: string): Mission10ActionResult {
    if (this.state.stage !== 'ENERGY') return ignored(this.state, 'WRONG_STAGE');
    const config = getMission10EnergyConfig(this.state.energyConfigId);
    if (!config.relays.some((relay) => relay.id === relayId)) return ignored(this.state, 'UNKNOWN_CONTROL');
    const before = solveMission10Energy(config, this.state.relayOrientations);
    const orientation = normalizeOrientation((this.state.relayOrientations[relayId] ?? 0) + 1);
    const relayOrientations = { ...this.state.relayOrientations, [relayId]: orientation };
    const evaluation = solveMission10Energy(config, relayOrientations);
    const wrongAttempts = !evaluation.receiverPowered && evaluation.connectedRelayCount <= before.connectedRelayCount
      ? this.state.energyWrongAttempts + 1 : this.state.energyWrongAttempts;
    this.state = { ...this.state, relayOrientations, energyWrongAttempts: wrongAttempts, stage: evaluation.receiverPowered ? 'SIGNAL' : 'ENERGY' };
    return { status: 'energy', relayId, orientation, evaluation, stageAdvanced: evaluation.receiverPowered,
      hintRelayId: wrongAttempts >= 2 && !evaluation.receiverPowered ? evaluation.breakRelayId : null };
  }

  rotateReflector(reflectorId: string): Mission10ActionResult {
    if (this.state.stage !== 'SIGNAL') return ignored(this.state, 'WRONG_STAGE');
    const config = getMission10SignalConfig(this.state.signalConfigId);
    if (!config.reflectors.some((reflector) => reflector.id === reflectorId)) return ignored(this.state, 'UNKNOWN_CONTROL');
    const before = solveMission10Signal(config, this.state.reflectorOrientations);
    const orientation = normalizeSignalOrientation((this.state.reflectorOrientations[reflectorId] ?? 0) + 1);
    const reflectorOrientations = { ...this.state.reflectorOrientations, [reflectorId]: orientation };
    const evaluation = solveMission10Signal(config, reflectorOrientations);
    const wrongAttempts = !evaluation.receiverHit && evaluation.segments.length <= before.segments.length
      ? this.state.signalWrongAttempts + 1 : this.state.signalWrongAttempts;
    this.state = { ...this.state, reflectorOrientations, signalWrongAttempts: wrongAttempts, stage: evaluation.receiverHit ? 'LAUNCH' : 'SIGNAL' };
    return { status: 'signal', reflectorId, orientation, evaluation, stageAdvanced: evaluation.receiverHit,
      hintReflectorId: wrongAttempts >= 2 && !evaluation.receiverHit ? evaluation.firstIncompleteReflectorId : null };
  }

  launchBeacon(): Mission10ActionResult {
    if (this.state.stage !== 'LAUNCH') return ignored(this.state, this.state.launchPressed ? 'ALREADY_APPLIED' : 'WRONG_STAGE');
    this.state = { ...this.state, stage: 'FINALE', launchPressed: true };
    return { status: 'launched', stage: 'FINALE' };
  }

  advanceFinale(): Mission10ActionResult {
    if (this.state.stage !== 'FINALE') return ignored(this.state, this.state.completed ? 'ALREADY_APPLIED' : 'WRONG_STAGE');
    const finaleStep = Math.min(MISSION10_FINALE_STEP_COUNT, this.state.finaleStep + 1);
    const completed = finaleStep === MISSION10_FINALE_STEP_COUNT;
    this.state = { ...this.state, finaleStep, completed, stage: completed ? 'COMPLETE' : 'FINALE' };
    return { status: 'finale', finaleStep, completed };
  }

  reset(seed = this.state.runSeed): Mission10ActionResult {
    this.state = initialSnapshot(seed);
    return { status: 'reset', stage: 'INTRO' };
  }

  initializeStageShortcut(
    shortcut: Mission10StageShortcut,
    seed = this.state.runSeed,
    signalConfigId?: string,
  ): Mission10ActionResult {
    this.state = initialSnapshot(seed);
    if (signalConfigId) {
      const signalConfig = getMission10SignalConfig(signalConfigId);
      this.state = {
        ...this.state,
        signalConfigId: signalConfig.id,
        reflectorOrientations: { ...signalConfig.initialOrientations },
      };
    }
    const stageMap: Readonly<Record<Mission10StageShortcut, Mission10Stage>> = {
      intro: 'INTRO', path: 'PATH', energy: 'ENERGY', signal: 'SIGNAL', launch: 'LAUNCH', final: 'FINALE', complete: 'COMPLETE',
    };
    const stage = stageMap[shortcut] as Mission10Stage | undefined;
    if (!stage) return ignored(this.state, 'UNKNOWN_CONTROL');
    const order: readonly Mission10Stage[] = ['INTRO', 'PATH', 'ENERGY', 'SIGNAL', 'LAUNCH', 'FINALE', 'COMPLETE'];
    const targetIndex = order.indexOf(stage);
    if (targetIndex >= order.indexOf('ENERGY')) this.state = { ...this.state, pathDecisionIndex: 3 };
    if (targetIndex >= order.indexOf('SIGNAL')) {
      const solution = findMission10EnergySolution(getMission10EnergyConfig(this.state.energyConfigId));
      if (!solution) throw new Error(`Unsolvable energy shortcut ${this.state.energyConfigId}`);
      this.state = { ...this.state, relayOrientations: { ...solution.orientations } };
    }
    if (targetIndex >= order.indexOf('LAUNCH')) {
      const solution = findMission10SignalSolution(getMission10SignalConfig(this.state.signalConfigId));
      if (!solution) throw new Error(`Unsolvable signal shortcut ${this.state.signalConfigId}`);
      this.state = { ...this.state, reflectorOrientations: { ...solution } };
    }
    this.state = {
      ...this.state, stage, launchPressed: targetIndex >= order.indexOf('FINALE'),
      finaleStep: stage === 'COMPLETE' ? MISSION10_FINALE_STEP_COUNT : 0, completed: stage === 'COMPLETE',
    };
    return { status: 'shortcut', stage };
  }
}

export const mission10Controller = new Mission10Controller();
