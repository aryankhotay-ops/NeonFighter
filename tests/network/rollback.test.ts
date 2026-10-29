import { describe, expect, it } from "vitest";
import {
  Simulation,
  checksumState,
  cloneGameState,
  createInitialGameState,
  type GameState,
} from "@neon-rivals/simulation";
import type { AuthoritativeFrameMessage, StateSnapshotMessage } from "@neon-rivals/protocol";
import { InputButton } from "@neon-rivals/simulation";
import type { OnlineFightClient } from "../../apps/web/src/net/OnlineFightClient";
import { OnlineRollbackController } from "../../apps/web/src/net/OnlineRollbackController";

class FakeNetwork {
  public readonly latency = { rttMs: 45, jitterMs: 3, inputDelayFrames: 3 };
  public readonly sent: Array<{ frame: number; buttons: number }> = [];
  private frameListener: ((message: AuthoritativeFrameMessage) => void) | null = null;
  private snapshotListener: ((message: StateSnapshotMessage) => void) | null = null;

  public sendInput(frame: number, buttons: number): void {
    this.sent.push({ frame, buttons });
  }

  public onFrame(listener: (message: AuthoritativeFrameMessage) => void): () => void {
    this.frameListener = listener;
    return () => {
      this.frameListener = null;
    };
  }

  public onSnapshot(listener: (message: StateSnapshotMessage) => void): () => void {
    this.snapshotListener = listener;
    return () => {
      this.snapshotListener = null;
    };
  }

  public drainFrames(): AuthoritativeFrameMessage[] {
    return [];
  }

  public consumeLatestSnapshot(): StateSnapshotMessage | null {
    return null;
  }

  public emitFrame(message: AuthoritativeFrameMessage): void {
    this.frameListener?.(message);
  }

  public emitSnapshot(message: StateSnapshotMessage): void {
    this.snapshotListener?.(message);
  }
}

function fightingState(): GameState {
  const state = createInitialGameState();
  state.round.phase = "fight";
  state.round.phaseFrames = 0;
  return state;
}

describe("online rollback reconciliation", () => {
  it("delays local input, then rolls back when the authoritative input differs", () => {
    const initial = fightingState();
    const initialX = initial.fighters[0].x;
    const simulation = new Simulation(initial);
    const network = new FakeNetwork();
    const rollback = new OnlineRollbackController(
      simulation,
      network as unknown as OnlineFightClient,
      0,
      initial,
    );

    for (let frame = 0; frame < 4; frame += 1) rollback.advance(InputButton.Right);
    expect(network.sent[0]).toEqual({ frame: 3, buttons: InputButton.Right });
    expect(simulation.state.fighters[0].x).toBeGreaterThan(initialX);

    network.emitFrame({
      frame: 3,
      inputs: [0, 0],
      predictedMask: 0,
      checksum: 0,
      serverTime: 0,
    });

    expect(simulation.state.frame).toBe(4);
    expect(simulation.state.fighters[0].x).toBe(initialX);
    expect(rollback.stats.rollbacks).toBe(1);
    rollback.dispose();
  });

  it("hard-corrects a divergent state from a trusted server snapshot", () => {
    const initial = fightingState();
    const simulation = new Simulation(initial);
    const network = new FakeNetwork();
    const rollback = new OnlineRollbackController(
      simulation,
      network as unknown as OnlineFightClient,
      0,
      initial,
    );
    rollback.advance(0);

    const corrected = cloneGameState(simulation.state);
    corrected.fighters[0].health -= 77;
    network.emitSnapshot({
      frame: corrected.frame,
      state: corrected,
      checksum: checksumState(corrected),
      serverTime: 0,
    });

    expect(simulation.state.fighters[0].health).toBe(corrected.fighters[0].health);
    expect(rollback.stats.snapshotCorrections).toBe(1);
    rollback.dispose();
  });
});
