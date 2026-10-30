import { describe, expect, it } from "vitest";
import { estimateInputDelayFrames } from "../../apps/web/src/net/OnlineFightClient";

describe("adaptive latency handling", () => {
  it("keeps the minimum delay on a stable low-latency connection", () => {
    expect(estimateInputDelayFrames(20, 1)).toBe(2);
  });

  it("adds delay frames for higher RTT and jitter", () => {
    expect(estimateInputDelayFrames(90, 12)).toBeGreaterThan(2);
    expect(estimateInputDelayFrames(150, 25)).toBeGreaterThan(estimateInputDelayFrames(90, 12));
  });

  it("caps delay so latency spikes cannot grow the input buffer without bound", () => {
    expect(estimateInputDelayFrames(2_000, 500)).toBe(6);
  });
});
