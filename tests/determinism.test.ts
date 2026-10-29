import { describe, expect, it } from "vitest";
import {
  FIGHTER_WIDTH,
  InputButton,
  Simulation,
  STAGE_WIDTH,
  checksumState,
  pixels,
} from "@neon-rivals/simulation";
import { createDeterminismFixture, runReplay } from "@neon-rivals/test-tools";

describe("deterministic simulation", () => {
  it("produces the same checksum for a 10,000-frame replay", () => {
    const replay = createDeterminismFixture(10_000);
    const firstRun = runReplay(replay);
    const secondRun = runReplay(replay);

    expect(firstRun.state.frame).toBe(10_000);
    expect(firstRun.checksum).toBe(secondRun.checksum);
    expect(firstRun.checksum).toBe(checksumState(firstRun.state));
    expect(firstRun.checksum).toBe(0x84f69b8f);
  });

  it("keeps fighters inside the stage", () => {
    const simulation = new Simulation();
    for (let frame = 0; frame < 500; frame += 1) {
      simulation.step({
        frame,
        players: [InputButton.Left, InputButton.Right],
      });
    }

    expect(simulation.state.fighters[0].x).toBe(pixels(30));
    expect(simulation.state.fighters[1].x).toBe(STAGE_WIDTH - pixels(31.5));
  });

  it("prevents grounded fighters from crossing through one another", () => {
    const simulation = new Simulation();
    for (let frame = 0; frame < 120; frame += 1) {
      simulation.step({
        frame,
        players: [InputButton.Right, InputButton.Left],
      });
    }

    const [first, second] = simulation.state.fighters;
    expect(second.x - first.x).toBeGreaterThanOrEqual(FIGHTER_WIDTH);
    expect(first.facing).toBe(1);
    expect(second.facing).toBe(-1);
  });
});
