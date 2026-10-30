import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, type PlayerInputMessage } from "@neon-rivals/protocol";
import { InputQueue } from "../../apps/server/src/net/InputQueue";

function input(sequence: number, frame: number, buttons: number): PlayerInputMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sequence,
    frame,
    buttons,
    clientTime: sequence * 16,
  };
}

describe("authoritative network input queue", () => {
  it("consumes exact frame inputs from both players", () => {
    const queue = new InputQueue();
    expect(queue.submit(0, input(0, 3, 2), 0)).toBeNull();
    expect(queue.submit(1, input(0, 3, 1), 0)).toBeNull();

    expect(queue.consume(3)).toEqual({ inputs: [2, 1], predictedMask: 0 });
  });

  it("holds the last input during jitter and marks the predicted player", () => {
    const queue = new InputQueue();
    queue.submit(0, input(0, 0, 2), 0);
    queue.submit(1, input(0, 0, 1), 0);
    expect(queue.consume(0)).toEqual({ inputs: [2, 1], predictedMask: 0 });

    queue.submit(0, input(1, 1, 4), 1);
    expect(queue.consume(1)).toEqual({ inputs: [4, 1], predictedMask: 0b10 });
  });

  it("rejects late, excessively future, malformed, and stale inputs", () => {
    const queue = new InputQueue();
    expect(queue.submit(0, input(0, 9, 1), 10)).toBe("late-input");
    expect(queue.submit(0, input(1, 40, 1), 10)).toBe("future-input");
    expect(queue.submit(0, input(2, 12, 0x100), 10)).toBe("invalid-input");
    expect(queue.submit(0, input(3, 12, 1), 10)).toBeNull();
    expect(queue.submit(0, input(3, 13, 2), 10)).toBe("stale-sequence");
  });

  it("resets held and pending inputs between matches", () => {
    const queue = new InputQueue();
    queue.submit(0, input(0, 0, 2), 0);
    queue.consume(0);
    queue.reset();
    expect(queue.consume(1)).toEqual({ inputs: [0, 0], predictedMask: 0b11 });
  });

  it("accepts the full eight-bit input mask used by Guard-era protocol v3", () => {
    const queue = new InputQueue();
    expect(queue.submit(0, input(0, 2, 0x80), 0)).toBeNull();
    expect(queue.consume(2).inputs[0]).toBe(0x80);
  });
});
