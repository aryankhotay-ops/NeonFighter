import { INPUT_FUTURE_WINDOW_FRAMES, type PlayerInputMessage } from "@neon-rivals/protocol";

export type PlayerIndex = 0 | 1;

export interface ConsumedInputs {
  readonly inputs: [number, number];
  readonly predictedMask: number;
}

export type InputRejection = "invalid-input" | "late-input" | "future-input" | "stale-sequence";

const INPUT_MASK = 0x7f;

/**
 * Bounded authoritative input buffer. Missing frames hold the last input so jitter does not
 * stall the server; the predicted mask tells clients exactly which frames may later reconcile.
 */
export class InputQueue {
  private readonly pending: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  private readonly latestSequence: [number, number] = [-1, -1];
  private readonly heldInput: [number, number] = [0, 0];

  public submit(
    player: PlayerIndex,
    message: PlayerInputMessage,
    authoritativeFrame: number,
  ): InputRejection | null {
    if (
      !Number.isInteger(message.frame) ||
      !Number.isInteger(message.sequence) ||
      !Number.isInteger(message.buttons) ||
      message.buttons < 0 ||
      (message.buttons & ~INPUT_MASK) !== 0
    ) {
      return "invalid-input";
    }
    if (message.sequence <= this.latestSequence[player]) return "stale-sequence";
    // This first server slice is authoritative and does not rewind itself. Late client input
    // is rejected; client-side rollback reconciles to the held input the server actually used.
    if (message.frame < authoritativeFrame) return "late-input";
    if (message.frame > authoritativeFrame + INPUT_FUTURE_WINDOW_FRAMES) return "future-input";

    this.latestSequence[player] = message.sequence;
    this.pending[player].set(message.frame, message.buttons);
    this.prune(authoritativeFrame);
    return null;
  }

  public consume(frame: number): ConsumedInputs {
    let predictedMask = 0;
    const inputs: [number, number] = [0, 0];
    for (const player of [0, 1] as const) {
      const queued = this.pending[player].get(frame);
      if (queued === undefined) {
        inputs[player] = this.heldInput[player];
        predictedMask |= 1 << player;
      } else {
        this.pending[player].delete(frame);
        this.heldInput[player] = queued;
        inputs[player] = queued;
      }
    }
    this.prune(frame);
    return { inputs, predictedMask };
  }

  public reset(): void {
    this.pending[0].clear();
    this.pending[1].clear();
    this.latestSequence[0] = -1;
    this.latestSequence[1] = -1;
    this.heldInput[0] = 0;
    this.heldInput[1] = 0;
  }

  private prune(frame: number): void {
    for (const playerQueue of this.pending) {
      for (const queuedFrame of playerQueue.keys()) {
        if (queuedFrame < frame) playerQueue.delete(queuedFrame);
      }
    }
  }
}
