import { InputButton, Simulation } from "@neon-rivals/simulation";
import { describe, expect, it } from "vitest";
import { CpuController } from "../../apps/web/src/game/CpuController";
import { normalizeMatchSetup } from "../../apps/web/src/game/GameFlow";

describe("local CPU opponent", () => {
  it("normalizes human and CPU match setup without affecting online matches", () => {
    expect(
      normalizeMatchSetup({
        mode: "local",
        opponent: "cpu",
        cpuDifficulty: "hard",
      }),
    ).toMatchObject({ mode: "local", opponent: "cpu", cpuDifficulty: "hard" });
    expect(
      normalizeMatchSetup({
        mode: "online",
        opponent: "cpu",
        cpuDifficulty: "easy",
      }),
    ).toMatchObject({ mode: "online", opponent: "human", cpuDifficulty: "easy" });
  });

  it("does not move during round intros and produces deterministic decisions", () => {
    const simulation = new Simulation();
    const first = new CpuController("medium");
    const second = new CpuController("medium");

    expect(first.capture(simulation.state)).toBe(0);
    expect(second.capture(simulation.state)).toBe(0);

    simulation.state.round.phase = "fight";
    const firstSequence: number[] = [];
    const secondSequence: number[] = [];
    for (let frame = 0; frame < 90; frame += 1) {
      simulation.state.frame = frame;
      firstSequence.push(first.capture(simulation.state));
      secondSequence.push(second.capture(simulation.state));
    }
    expect(firstSequence).toEqual(secondSequence);
    expect(firstSequence.some((buttons) => (buttons & InputButton.Left) !== 0)).toBe(true);
  });

  it.each(["easy", "medium", "hard"] as const)(
    "%s advances, attacks and can damage an unattended opponent",
    (difficulty) => {
      const simulation = new Simulation();
      const cpu = new CpuController(difficulty);
      const startingX = simulation.state.fighters[1].x;
      let attacked = false;

      for (let index = 0; index < 3_600; index += 1) {
        const buttons = cpu.capture(simulation.state);
        attacked ||= (buttons & (InputButton.Heavy | InputButton.Special)) !== 0;
        simulation.step({ frame: simulation.state.frame, players: [0, buttons] });
        if (simulation.state.round.phase === "roundOver") break;
      }

      expect(simulation.state.fighters[1].x).toBeLessThan(startingX);
      expect(attacked).toBe(true);
      expect(simulation.state.fighters[0].health).toBeLessThan(
        simulation.state.fighters[0].maxHealth,
      );
    },
  );

  it("scales pressure across the three difficulty levels", () => {
    const defeatFrame = (difficulty: "easy" | "medium" | "hard"): number => {
      const simulation = new Simulation();
      const cpu = new CpuController(difficulty);
      for (let index = 0; index < 3_600; index += 1) {
        const buttons = cpu.capture(simulation.state);
        simulation.step({ frame: simulation.state.frame, players: [0, buttons] });
        if (simulation.state.fighters[0].health === 0) return simulation.state.frame;
      }
      return Number.POSITIVE_INFINITY;
    };

    const easyFrame = defeatFrame("easy");
    const mediumFrame = defeatFrame("medium");
    const hardFrame = defeatFrame("hard");
    expect(mediumFrame).toBeLessThan(easyFrame);
    expect(hardFrame).toBeLessThan(easyFrame);
    // Hard spends decisions on parries and spacing as well as offense. Against an idle target it
    // should remain comparable to Medium rather than regressing to Easy pressure.
    expect(hardFrame).toBeLessThanOrEqual(mediumFrame + 30);
  });
});
