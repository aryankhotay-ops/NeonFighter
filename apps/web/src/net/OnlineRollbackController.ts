import {
  checksumState,
  cloneGameState,
  type GameState,
  type InputFrame,
  type Simulation,
} from "@neon-rivals/simulation";
import type { AuthoritativeFrameMessage, StateSnapshotMessage } from "@neon-rivals/protocol";
import type { OnlineFightClient } from "./OnlineFightClient";

export interface ReconciliationStats {
  readonly rollbacks: number;
  readonly snapshotCorrections: number;
  readonly latestServerFrame: number;
}

const HISTORY_FRAMES = 180;
const MAX_EXTRA_CATCH_UP_FRAMES = 4;
const MAX_SNAPSHOT_CATCH_UP_GAP = 8;

/**
 * Runs input-delay prediction locally, then rolls back when canonical server inputs disagree.
 * The authoritative server remains the source of match results and periodic correction states.
 */
export class OnlineRollbackController {
  private readonly canonical = new Map<number, readonly [number, number]>();
  private readonly plannedLocal = new Map<number, number>();
  private readonly applied = new Map<number, readonly [number, number]>();
  private readonly stateHistory = new Map<number, GameState>();
  private lastApplied: [number, number] = [0, 0];
  private lastScheduledFrame = -1;
  private rollbackCount = 0;
  private snapshotCorrectionCount = 0;
  private latestServerFrame = 0;
  private readonly unsubscribe: Array<() => void> = [];

  public constructor(
    private readonly simulation: Simulation,
    private readonly network: OnlineFightClient,
    private readonly playerIndex: 0 | 1,
    initialState: GameState,
  ) {
    this.simulation.restore(initialState);
    this.latestServerFrame = initialState.frame;
    this.unsubscribe.push(
      network.onFrame((message) => this.receiveAuthoritativeFrame(message)),
      network.onSnapshot((message) => this.receiveSnapshot(message)),
    );
    for (const message of network.drainFrames()) this.receiveAuthoritativeFrame(message);
    const snapshot = network.consumeLatestSnapshot();
    if (snapshot) this.receiveSnapshot(snapshot);
  }

  public get stats(): ReconciliationStats {
    return {
      rollbacks: this.rollbackCount,
      snapshotCorrections: this.snapshotCorrectionCount,
      latestServerFrame: this.latestServerFrame,
    };
  }

  public advance(localButtons: number): void {
    const currentFrame = this.simulation.state.frame;
    const schedulingBase = Math.max(currentFrame, this.latestServerFrame);
    const desiredFrame = schedulingBase + this.network.latency.inputDelayFrames;
    this.scheduleLocalInput(desiredFrame, localButtons);

    // A browser that briefly renders below 60 Hz can fall behind the authoritative room even
    // while its socket remains healthy. Advance up to four additional canonical/predicted frames
    // per simulation tick until it is nearly caught up; the bound prevents a long stall after a
    // background-tab pause. Without this, periodic snapshots repeatedly jumped slow clients
    // forward, which looked like severe online stutter.
    const framesBehind = Math.max(0, this.latestServerFrame - currentFrame - 1);
    const framesToAdvance = 1 + Math.min(MAX_EXTRA_CATCH_UP_FRAMES, framesBehind);
    for (let index = 0; index < framesToAdvance; index += 1) {
      this.stepFrame(this.simulation.state.frame);
    }
    this.prune(this.simulation.state.frame);
  }

  /**
   * Keep the server's future queue contiguous while allowing adaptive delay to come back down.
   * Previously `max(desired, last + 1)` permanently preserved the largest delay ever observed:
   * one Wi-Fi/tunnel spike could leave the entire match at the old 8-frame maximum. When delay
   * drops, correcting the still-future range lets both the local prediction and server converge
   * to the smaller lead over the next few frames.
   */
  private scheduleLocalInput(desiredFrame: number, localButtons: number): void {
    if (this.lastScheduledFrame < 0) {
      this.plannedLocal.set(desiredFrame, localButtons);
      this.network.sendInput(desiredFrame, localButtons);
      this.lastScheduledFrame = desiredFrame;
      return;
    }

    if (desiredFrame > this.lastScheduledFrame) {
      const held = this.plannedLocal.get(this.lastScheduledFrame) ?? 0;
      for (let frame = this.lastScheduledFrame + 1; frame < desiredFrame; frame += 1) {
        this.plannedLocal.set(frame, held);
        this.network.sendInput(frame, held);
      }
      this.plannedLocal.set(desiredFrame, localButtons);
      this.network.sendInput(desiredFrame, localButtons);
      this.lastScheduledFrame = desiredFrame;
      return;
    }

    // Delay decreased. Replace inputs already queued for still-future frames so the lower lead
    // takes effect instead of remaining stuck at the previous peak for the rest of the match.
    for (let frame = desiredFrame; frame <= this.lastScheduledFrame; frame += 1) {
      this.plannedLocal.set(frame, localButtons);
      this.network.sendInput(frame, localButtons);
    }
  }

  public dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.unsubscribe.length = 0;
  }

  private stepFrame(frame: number): void {
    const canonical = this.canonical.get(frame);
    const inputs: [number, number] = canonical
      ? [canonical[0], canonical[1]]
      : [this.lastApplied[0], this.lastApplied[1]];
    if (!canonical) {
      const local = this.plannedLocal.get(frame);
      if (local !== undefined) inputs[this.playerIndex] = local;
    }

    this.stateHistory.set(frame, cloneGameState(this.simulation.state));
    this.applied.set(frame, inputs);
    this.simulation.step({ frame, players: inputs });
    this.lastApplied = [inputs[0], inputs[1]];
  }

  private receiveAuthoritativeFrame(message: AuthoritativeFrameMessage): void {
    this.canonical.set(message.frame, message.inputs);
    this.latestServerFrame = Math.max(this.latestServerFrame, message.frame + 1);

    const applied = this.applied.get(message.frame);
    if (applied && (applied[0] !== message.inputs[0] || applied[1] !== message.inputs[1])) {
      this.replayFrom(message.frame);
    }
  }

  private receiveSnapshot(message: StateSnapshotMessage): void {
    this.latestServerFrame = Math.max(this.latestServerFrame, message.frame);
    const currentFrame = this.simulation.state.frame;

    if (message.frame > currentFrame) {
      // Small leads are normal network timing, not corruption. Let bounded catch-up consume the
      // canonical frame stream instead of snapping the whole scene forward on every snapshot.
      if (message.frame - currentFrame <= MAX_SNAPSHOT_CATCH_UP_GAP) return;
      this.simulation.restore(message.state);
      this.resetHistoryAt(message.frame);
      this.snapshotCorrectionCount += 1;
      return;
    }

    const localState =
      message.frame === currentFrame ? this.simulation.state : this.stateHistory.get(message.frame);
    if (!localState || checksumState(localState) === message.checksum) return;

    const targetFrame = currentFrame;
    this.simulation.restore(message.state);
    this.stateHistory.set(message.frame, cloneGameState(message.state));
    this.replayRange(message.frame, targetFrame);
    this.snapshotCorrectionCount += 1;
  }

  private replayFrom(frame: number): void {
    const restorePoint = this.stateHistory.get(frame);
    if (!restorePoint) return;
    const targetFrame = this.simulation.state.frame;
    this.simulation.restore(restorePoint);
    this.replayRange(frame, targetFrame);
    this.rollbackCount += 1;
  }

  private replayRange(startFrame: number, targetFrame: number): void {
    const before = this.applied.get(startFrame - 1);
    this.lastApplied = before ? [before[0], before[1]] : [0, 0];

    for (let frame = startFrame; frame < targetFrame; frame += 1) {
      const authoritative = this.canonical.get(frame);
      const previousPrediction = this.applied.get(frame);
      const input: InputFrame = {
        frame,
        players: authoritative
          ? [authoritative[0], authoritative[1]]
          : previousPrediction
            ? [previousPrediction[0], previousPrediction[1]]
            : [this.lastApplied[0], this.lastApplied[1]],
      };
      this.stateHistory.set(frame, cloneGameState(this.simulation.state));
      this.applied.set(frame, input.players);
      this.simulation.step(input);
      this.lastApplied = [input.players[0], input.players[1]];
    }
  }

  private resetHistoryAt(frame: number): void {
    this.stateHistory.clear();
    this.applied.clear();
    this.canonical.forEach((_value, key) => {
      if (key < frame) this.canonical.delete(key);
    });
    this.lastApplied = [0, 0];
  }

  private prune(frame: number): void {
    const oldest = frame - HISTORY_FRAMES;
    for (const history of [this.canonical, this.plannedLocal, this.applied, this.stateHistory]) {
      for (const key of history.keys()) {
        if (key < oldest) history.delete(key);
      }
    }
  }
}
