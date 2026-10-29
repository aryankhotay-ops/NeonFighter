import { describe, expect, it } from "vitest";
import {
  InputButton,
  MAX_HEALTH,
  MAX_METER,
  ROUND_OVER_FRAMES,
  Simulation,
  getFighterDefinition,
  pixels,
  type InputFrame,
} from "@neon-rivals/simulation";

const VESPER_ATTACKS = getFighterDefinition("vesper").moves;

function readySimulation(): Simulation {
  const simulation = new Simulation();
  simulation.state.round.phase = "fight";
  simulation.state.round.phaseFrames = 0;
  simulation.state.fighters[0].x = pixels(580);
  simulation.state.fighters[1].x = pixels(660);
  return simulation;
}

function step(simulation: Simulation, p1 = 0, p2 = 0): void {
  const input: InputFrame = {
    frame: simulation.state.frame,
    players: [p1, p2],
  };
  simulation.step(input);
}

function advance(simulation: Simulation, frames: number, p1 = 0, p2 = 0): void {
  for (let frame = 0; frame < frames; frame += 1) step(simulation, p1, p2);
}

describe("arcade combat systems", () => {
  it("buffers an attack pressed during hitstop and executes it when control returns", () => {
    const simulation = readySimulation();
    simulation.state.hitstopFrames = 3;

    step(simulation, InputButton.Heavy);
    step(simulation, 0);
    step(simulation, 0);
    expect(simulation.state.fighters[0].action).toBe("idle");

    step(simulation, 0);
    expect(simulation.state.fighters[0].action).toBe("attack");
    expect(simulation.state.fighters[0].attack).toBe("heavy");
  });

  it("applies a normal hit only during its active frames", () => {
    const simulation = readySimulation();
    step(simulation, InputButton.Light);
    advance(simulation, VESPER_ATTACKS.light.startupFrames - 1);
    expect(simulation.state.fighters[1].health).toBe(MAX_HEALTH);

    step(simulation);
    expect(simulation.state.fighters[1].health).toBe(MAX_HEALTH - VESPER_ATTACKS.light.damage);
    expect(simulation.state.lastEvent?.type).toBe("hit");
  });

  it("blocks mids by holding away and applies no normal chip damage", () => {
    const simulation = readySimulation();
    step(simulation, InputButton.Light, InputButton.Right);
    advance(simulation, VESPER_ATTACKS.light.startupFrames, 0, InputButton.Right);

    expect(simulation.state.fighters[1].health).toBe(MAX_HEALTH);
    expect(simulation.state.fighters[1].action).toBe("blockstun");
    expect(simulation.state.lastEvent?.type).toBe("block");
  });

  it("requires a crouch block against low attacks", () => {
    const standingBlock = readySimulation();
    step(standingBlock, InputButton.Down, InputButton.Right);
    step(standingBlock, InputButton.Down | InputButton.Light, InputButton.Right);
    advance(standingBlock, VESPER_ATTACKS.crouchLight.startupFrames, 0, InputButton.Right);
    expect(standingBlock.state.fighters[1].health).toBeLessThan(MAX_HEALTH);

    const crouchBlock = readySimulation();
    advance(crouchBlock, 8, 0, InputButton.Right | InputButton.Down);
    step(crouchBlock, InputButton.Down, InputButton.Right | InputButton.Down);
    step(crouchBlock, InputButton.Down | InputButton.Light, InputButton.Right | InputButton.Down);
    advance(
      crouchBlock,
      VESPER_ATTACKS.crouchLight.startupFrames,
      0,
      InputButton.Right | InputButton.Down,
    );
    expect(crouchBlock.state.fighters[1].health).toBe(MAX_HEALTH);
    expect(crouchBlock.state.lastEvent?.type).toBe("block");
  });

  it("parries a mid by tapping toward inside the timing window", () => {
    const simulation = readySimulation();
    step(simulation, InputButton.Light);
    step(simulation, 0, InputButton.Left);
    advance(simulation, VESPER_ATTACKS.light.startupFrames - 1);

    expect(simulation.state.fighters[1].health).toBe(MAX_HEALTH);
    expect(simulation.state.fighters[1].action).toBe("parry");
    expect(simulation.state.fighters[1].meter).toBeGreaterThan(0);
    expect(simulation.state.lastEvent?.type).toBe("parry");
  });

  it("chains a confirmed light into heavy as a two-hit combo", () => {
    const simulation = readySimulation();
    step(simulation, InputButton.Light);
    advance(simulation, VESPER_ATTACKS.light.startupFrames);
    advance(simulation, VESPER_ATTACKS.light.hitstopFrames);
    step(simulation, InputButton.Heavy);
    advance(simulation, VESPER_ATTACKS.heavy.startupFrames + 1);

    expect(simulation.state.fighters[0].comboCount).toBe(2);
    expect(simulation.state.fighters[1].health).toBe(
      MAX_HEALTH - VESPER_ATTACKS.light.damage - VESPER_ATTACKS.heavy.damage,
    );
  });

  it("special attacks cause knockdown and can be quick-risen", () => {
    const simulation = readySimulation();
    step(simulation, InputButton.Special);
    advance(simulation, VESPER_ATTACKS.special.startupFrames);

    const defender = simulation.state.fighters[1];
    expect(defender.action).toBe("knockdown");
    expect(defender.canQuickRise).toBe(true);
    expect(defender.health).toBe(MAX_HEALTH - VESPER_ATTACKS.special.damage);

    advance(simulation, 40);
    if (defender.grounded) {
      const before = defender.stunFrames;
      step(simulation, 0, InputButton.Down);
      expect(defender.stunFrames).toBeLessThan(before);
    }
  });

  it("applies chip damage when a special move is blocked", () => {
    const simulation = readySimulation();
    step(simulation, InputButton.Special, InputButton.Right);
    advance(simulation, VESPER_ATTACKS.special.startupFrames, 0, InputButton.Right);

    expect(simulation.state.fighters[1].health).toBe(
      MAX_HEALTH - VESPER_ATTACKS.special.chipDamage,
    );
    expect(simulation.state.lastEvent?.type).toBe("block");
  });

  it("supports double-tap dashes and clean whiffs", () => {
    const simulation = readySimulation();
    step(simulation, InputButton.Right);
    step(simulation);
    step(simulation, InputButton.Right);
    expect(simulation.state.fighters[0].action).toBe("dash");

    simulation.state.fighters[1].x = pixels(1100);
    advance(simulation, 10);
    step(simulation, InputButton.Light);
    advance(simulation, VESPER_ATTACKS.light.startupFrames + VESPER_ATTACKS.light.activeFrames);
    expect(simulation.state.fighters[1].health).toBe(MAX_HEALTH);
  });

  it("spends meter on an original super and disables quick rise", () => {
    const simulation = readySimulation();
    simulation.state.fighters[0].meter = MAX_METER;
    step(simulation, InputButton.Heavy | InputButton.Special);
    expect(simulation.state.fighters[0].meter).toBe(MAX_METER - VESPER_ATTACKS.super.meterCost);

    advance(simulation, VESPER_ATTACKS.super.startupFrames);
    expect(simulation.state.fighters[1].health).toBe(MAX_HEALTH - VESPER_ATTACKS.super.damage);
    expect(simulation.state.fighters[1].action).toBe("knockdown");
    expect(simulation.state.fighters[1].canQuickRise).toBe(false);
  });

  it("awards rounds and reaches a best-of-three match result", () => {
    const simulation = readySimulation();
    simulation.state.round.scores[0] = 1;
    simulation.state.fighters[1].health = VESPER_ATTACKS.light.damage;
    step(simulation, InputButton.Light);
    advance(simulation, VESPER_ATTACKS.light.startupFrames);

    expect(simulation.state.round.phase).toBe("roundOver");
    expect(simulation.state.round.scores).toEqual([2, 0]);
    expect(simulation.state.round.winner).toBe(0);

    advance(simulation, ROUND_OVER_FRAMES);
    expect(simulation.state.round.phase).toBe("matchOver");
    expect(simulation.state.round.winner).toBe(0);
  });

  it("awards a time-over round to the fighter with more health", () => {
    const simulation = readySimulation();
    simulation.state.fighters[0].health = 700;
    simulation.state.fighters[1].health = 500;
    simulation.state.round.timerFrames = 1;
    step(simulation);

    expect(simulation.state.round.phase).toBe("roundOver");
    expect(simulation.state.round.reason).toBe("time");
    expect(simulation.state.round.winner).toBe(0);
  });
});
