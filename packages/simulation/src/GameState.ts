import { getFighterDefinition } from "./FighterDefinitions";
import type { FighterId } from "./FighterConfig";
import type { AttackId } from "./MoveDefinitions";
import { pixels } from "./fixedMath";

export type Facing = -1 | 1;
export type PlayerId = 0 | 1;
export type FighterAction =
  | "idle"
  | "walk"
  | "crouch"
  | "jump"
  | "dash"
  | "attack"
  | "blockstun"
  | "parry"
  | "hitstun"
  | "knockdown"
  | "ko";
export type MatchPhase = "intro" | "fight" | "roundOver" | "matchOver";
export type RoundEndReason = "ko" | "time" | "draw" | null;
export type CombatEventType = "attack" | "hit" | "block" | "parry" | "special" | "super" | "ko";

export interface CombatEvent {
  readonly serial: number;
  readonly frame: number;
  readonly type: CombatEventType;
  readonly source: PlayerId;
  readonly target: PlayerId;
}

export interface FighterState {
  readonly id: PlayerId;
  readonly fighterId: FighterId;
  readonly maxHealth: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  facing: Facing;
  grounded: boolean;
  crouching: boolean;
  previousButtons: number;
  bufferedButtons: number;
  inputBufferFrames: number;
  health: number;
  meter: number;
  action: FighterAction;
  actionFrame: number;
  attack: AttackId | null;
  attackConnected: boolean;
  stunFrames: number;
  comboCount: number;
  comboWindowFrames: number;
  parryHighFrames: number;
  parryLowFrames: number;
  dashFrames: number;
  dashDirection: Facing;
  lastLeftTapFrame: number;
  lastRightTapFrame: number;
  lastDownTapFrame: number;
  canQuickRise: boolean;
}

export interface RoundState {
  phase: MatchPhase;
  number: number;
  timerFrames: number;
  phaseFrames: number;
  scores: [number, number];
  winner: PlayerId | -1 | null;
  reason: RoundEndReason;
}

export interface GameState {
  frame: number;
  fighters: [FighterState, FighterState];
  round: RoundState;
  hitstopFrames: number;
  eventSerial: number;
  lastEvent: CombatEvent | null;
}

export const DEFAULT_FIGHTERS: readonly [FighterId, FighterId] = ["vesper", "nova"];
export const STAGE_WIDTH = pixels(1280);
export const FLOOR_Y = pixels(590);
// Legacy baseline values remain exported for debug/tests; live bodies come from fighter configs.
export const FIGHTER_WIDTH = pixels(60);
export const STANDING_HEIGHT = pixels(166);
export const CROUCHING_HEIGHT = pixels(108);
export const MAX_HEALTH = 1000;
export const MAX_METER = 1000;
export const ROUND_TIME_FRAMES = 99 * 60;
export const ROUND_INTRO_FRAMES = 90;
export const ROUND_OVER_FRAMES = 150;
export const ROUNDS_TO_WIN = 2;

export function createFighter(
  id: PlayerId,
  fighterId: FighterId = DEFAULT_FIGHTERS[id],
  meter = 0,
): FighterState {
  const definition = getFighterDefinition(fighterId);
  return {
    id,
    fighterId,
    maxHealth: definition.maxHealth,
    x: pixels(id === 0 ? 360 : 920),
    y: FLOOR_Y,
    velocityX: 0,
    velocityY: 0,
    facing: id === 0 ? 1 : -1,
    grounded: true,
    crouching: false,
    previousButtons: 0,
    bufferedButtons: 0,
    inputBufferFrames: 0,
    health: definition.maxHealth,
    meter,
    action: "idle",
    actionFrame: 0,
    attack: null,
    attackConnected: false,
    stunFrames: 0,
    comboCount: 0,
    comboWindowFrames: 0,
    parryHighFrames: 0,
    parryLowFrames: 0,
    dashFrames: 0,
    dashDirection: id === 0 ? 1 : -1,
    lastLeftTapFrame: -100,
    lastRightTapFrame: -100,
    lastDownTapFrame: -100,
    canQuickRise: false,
  };
}

export function createInitialGameState(
  fighterIds: readonly [FighterId, FighterId] = DEFAULT_FIGHTERS,
): GameState {
  return {
    frame: 0,
    fighters: [createFighter(0, fighterIds[0]), createFighter(1, fighterIds[1])],
    round: {
      phase: "intro",
      number: 1,
      timerFrames: ROUND_TIME_FRAMES,
      phaseFrames: ROUND_INTRO_FRAMES,
      scores: [0, 0],
      winner: null,
      reason: null,
    },
    hitstopFrames: 0,
    eventSerial: 0,
    lastEvent: null,
  };
}

export function cloneGameState(state: GameState): GameState {
  return {
    frame: state.frame,
    fighters: [{ ...state.fighters[0] }, { ...state.fighters[1] }],
    round: { ...state.round, scores: [...state.round.scores] },
    hitstopFrames: state.hitstopFrames,
    eventSerial: state.eventSerial,
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
  };
}
