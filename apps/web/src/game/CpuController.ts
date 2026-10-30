import {
  InputButton,
  MAX_METER,
  getFighterDefinition,
  pixels,
  type FighterState,
  type GameState,
} from "@neon-rivals/simulation";
import type { CpuDifficulty } from "./GameFlow";

interface CpuTuning {
  /** Frames between decisions: the visible reaction-time difference between levels. */
  readonly reactionFrames: number;
  readonly preferredDistancePx: number;
  readonly retreatDistancePx: number;
  readonly defenseChance: number;
  readonly idleChance: number;
  readonly jumpChance: number;
  readonly specialChance: number;
  readonly heavyChance: number;
}

const CPU_TUNING: Readonly<Record<CpuDifficulty, CpuTuning>> = {
  easy: {
    reactionFrames: 30,
    preferredDistancePx: 92,
    retreatDistancePx: 40,
    defenseChance: 0.22,
    idleChance: 0.34,
    jumpChance: 0.04,
    specialChance: 0.08,
    heavyChance: 0.2,
  },
  medium: {
    reactionFrames: 12,
    preferredDistancePx: 116,
    retreatDistancePx: 54,
    defenseChance: 0.58,
    idleChance: 0.14,
    jumpChance: 0.09,
    specialChance: 0.22,
    heavyChance: 0.32,
  },
  hard: {
    reactionFrames: 2,
    preferredDistancePx: 80,
    retreatDistancePx: 28,
    defenseChance: 0.9,
    idleChance: 0,
    jumpChance: 0.05,
    specialChance: 0.1,
    heavyChance: 0.86,
  },
};

/**
 * Deterministic local CPU opponent. Decisions depend only on the simulation frame/state, so
 * identical fights replay identically. Difficulty changes reaction time, spacing, defense and
 * move selection rather than adding hidden health or damage bonuses.
 */
export class CpuController {
  private movementButtons = 0;
  private nextDecisionFrame = 0;

  public constructor(
    private readonly difficulty: CpuDifficulty,
    private readonly player: 0 | 1 = 1,
  ) {}

  public capture(state: GameState): number {
    if (state.round.phase !== "fight") {
      this.movementButtons = 0;
      this.nextDecisionFrame = state.frame;
      return 0;
    }

    if (state.frame < this.nextDecisionFrame) return this.movementButtons;

    const tuning = CPU_TUNING[this.difficulty];
    const self = state.fighters[this.player];
    const opponent = state.fighters[this.player === 0 ? 1 : 0];
    this.nextDecisionFrame = state.frame + tuning.reactionFrames;

    const decision = this.decide(state.frame, self, opponent, tuning);
    this.movementButtons = decision.movement;
    // Attacks are one-frame pulses. Releasing them on following frames makes each later choice
    // a fresh press that the simulation input buffer can consume.
    return decision.movement | decision.action;
  }

  private decide(
    frame: number,
    self: FighterState,
    opponent: FighterState,
    tuning: CpuTuning,
  ): { movement: number; action: number } {
    const toward = self.facing === 1 ? InputButton.Right : InputButton.Left;
    const away = self.facing === 1 ? InputButton.Left : InputButton.Right;
    const centerDistance = Math.abs(opponent.x - self.x);
    const bodyWidths =
      getFighterDefinition(self.fighterId).body.pushboxWidth +
      getFighterDefinition(opponent.fighterId).body.pushboxWidth;
    const edgeDistance = Math.max(0, centerDistance - Math.trunc(bodyWidths / 2));
    const choice = deterministicUnit(frame, self.health, opponent.health, this.player);

    if (this.isThreatened(self, opponent, edgeDistance)) {
      const defenseRoll = deterministicUnit(frame, opponent.actionFrame, opponent.meter, 7);
      if (defenseRoll < tuning.defenseChance) {
        const incoming = opponent.attack
          ? getFighterDefinition(opponent.fighterId).moves[opponent.attack]
          : null;
        const crouch = incoming?.height === "low";
        // Hard reacts with a timed parry input more often; all levels use the same Guard control
        // available to the player rather than gaining a hidden defensive advantage.
        if (this.difficulty === "hard" && defenseRoll < tuning.defenseChance * 0.42) {
          return { movement: crouch ? InputButton.Down : toward, action: 0 };
        }
        return {
          movement: InputButton.Guard | (crouch ? InputButton.Down : 0),
          action: 0,
        };
      }
    }

    if (!this.canAct(self)) {
      return {
        movement: self.action === "knockdown" && this.difficulty !== "easy" ? InputButton.Down : 0,
        action: 0,
      };
    }

    if (choice < tuning.idleChance) return { movement: 0, action: 0 };
    if (edgeDistance > pixels(tuning.preferredDistancePx)) return { movement: toward, action: 0 };
    if (edgeDistance < pixels(tuning.retreatDistancePx) && choice < 0.5) {
      return { movement: away, action: 0 };
    }

    const actionRoll = deterministicUnit(frame, self.meter, opponent.x, 13);
    if (self.meter >= MAX_METER / 2 && this.difficulty === "hard" && actionRoll < 0.22) {
      return { movement: 0, action: InputButton.Heavy | InputButton.Special };
    }
    if (actionRoll < tuning.specialChance) {
      return { movement: 0, action: InputButton.Special };
    }
    if (actionRoll < tuning.specialChance + tuning.heavyChance) {
      return { movement: 0, action: InputButton.Heavy };
    }
    if (actionRoll > 1 - tuning.jumpChance && edgeDistance > pixels(70)) {
      return { movement: toward | InputButton.Up, action: 0 };
    }
    return { movement: 0, action: InputButton.Heavy };
  }

  private isThreatened(self: FighterState, opponent: FighterState, edgeDistance: number): boolean {
    if (opponent.action !== "attack" || !opponent.attack) return false;
    const attack = getFighterDefinition(opponent.fighterId).moves[opponent.attack];
    const verticalReach = Math.abs(opponent.y - self.y) < pixels(145);
    return verticalReach && edgeDistance <= attack.range + pixels(36);
  }

  private canAct(fighter: FighterState): boolean {
    return (
      fighter.action === "idle" ||
      fighter.action === "walk" ||
      fighter.action === "crouch" ||
      fighter.action === "jump" ||
      fighter.action === "dash"
    );
  }
}

function deterministicUnit(frame: number, a: number, b: number, salt: number): number {
  // Integer hash avoids Math.random(), keeping CPU behavior replayable and testable.
  let value = Math.imul(frame + salt * 101, 0x45d9f3b);
  value ^= Math.imul(a + 17, 0x119de1f3);
  value ^= Math.imul(b + 31, 0x3449d);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}
