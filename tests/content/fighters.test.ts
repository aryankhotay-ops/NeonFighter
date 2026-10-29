import { describe, expect, it } from "vitest";
import {
  FIGHTER_IDS,
  FIGHTER_ROSTER,
  InputButton,
  Simulation,
  getFighterDefinition,
  type AttackId,
  type FighterId,
} from "@neon-rivals/simulation";

const REQUIRED_MOVES: readonly AttackId[] = ["light", "crouchLight", "heavy", "special", "super"];

describe("original fighter configurations", () => {
  it("defines four distinct complete fighters", () => {
    expect(FIGHTER_ROSTER).toHaveLength(4);
    expect(new Set(FIGHTER_ROSTER.map((fighter) => fighter.name)).size).toBe(4);
    expect(new Set(FIGHTER_ROSTER.map((fighter) => fighter.fightingStyle)).size).toBe(4);
    expect(new Set(FIGHTER_ROSTER.map((fighter) => fighter.movement.walkSpeed)).size).toBe(4);

    for (const fighter of FIGHTER_ROSTER) {
      expect(fighter.description.length).toBeGreaterThan(30);
      expect(fighter.maxHealth).toBeGreaterThanOrEqual(900);
      expect(Object.keys(fighter.moves).sort()).toEqual([...REQUIRED_MOVES].sort());
      expect(fighter.moves.special.label).not.toBe(fighter.moves.super.label);
      expect(fighter.moves.super.meterCost).toBeGreaterThan(0);
      expect(fighter.body.pushboxWidth).toBeGreaterThan(0);
    }
  });

  it("uses unique normal, special, and super names across the roster", () => {
    const names = FIGHTER_ROSTER.flatMap((fighter) =>
      REQUIRED_MOVES.map((moveId) => fighter.moves[moveId].label),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("starts every matchup with the selected configurations", () => {
    for (const first of FIGHTER_IDS) {
      for (const second of FIGHTER_IDS) {
        const simulation = new Simulation();
        simulation.resetMatch([first, second]);
        expect(simulation.state.fighters[0].fighterId).toBe(first);
        expect(simulation.state.fighters[1].fighterId).toBe(second);
        expect(simulation.state.fighters[0].health).toBe(getFighterDefinition(first).maxHealth);
        expect(simulation.state.fighters[1].health).toBe(getFighterDefinition(second).maxHealth);
      }
    }
  });

  it.each(FIGHTER_IDS)("executes %s's configured light attack", (fighterId: FighterId) => {
    const simulation = new Simulation();
    simulation.resetMatch([fighterId, "nova"]);
    simulation.state.round.phase = "fight";
    simulation.state.round.phaseFrames = 0;
    simulation.state.fighters[0].x = 580 * 256;
    simulation.state.fighters[1].x = 670 * 256;
    const attack = getFighterDefinition(fighterId).moves.light;
    const startingHealth = simulation.state.fighters[1].health;

    simulation.step({
      frame: simulation.state.frame,
      players: [InputButton.Light, 0],
    });
    for (let frame = 0; frame < attack.startupFrames; frame += 1) {
      simulation.step({ frame: simulation.state.frame, players: [0, 0] });
    }

    expect(simulation.state.fighters[1].health).toBe(startingHealth - attack.damage);
  });
});
