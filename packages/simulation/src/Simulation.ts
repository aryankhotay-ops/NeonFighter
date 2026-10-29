import {
  FLOOR_Y,
  MAX_METER,
  ROUND_INTRO_FRAMES,
  ROUND_OVER_FRAMES,
  ROUND_TIME_FRAMES,
  ROUNDS_TO_WIN,
  STAGE_WIDTH,
  cloneGameState,
  createFighter,
  createInitialGameState,
  type CombatEventType,
  type FighterAction,
  type FighterState,
  type GameState,
  type PlayerId,
  type RoundEndReason,
} from "./GameState";
import { getFighterDefinition } from "./FighterDefinitions";
import type { FighterId } from "./FighterConfig";
import { hasInput, InputButton, type InputFrame } from "./InputFrame";
import {
  attackTotalFrames,
  isAttackActive,
  type AttackDefinition,
  type AttackId,
} from "./MoveDefinitions";
import { clampInteger, pixels } from "./fixedMath";

export const SIMULATION_HZ = 60;
export const SIMULATION_STEP_MS = 1000 / SIMULATION_HZ;

const DASH_INPUT_WINDOW = 11;
const PARRY_WINDOW = 7;
const QUICK_RISE_FRAMES = 14;
const ACTION_INPUT_BUFFER_FRAMES = 8;
const BUFFERED_ACTION_MASK = InputButton.Light | InputButton.Heavy | InputButton.Special;

function isPressed(fighter: FighterState, buttons: number, button: InputButton): boolean {
  return hasInput(buttons, button) && !hasInput(fighter.previousButtons, button);
}

function isNeutralAction(action: FighterAction): boolean {
  return action === "idle" || action === "walk" || action === "crouch" || action === "jump";
}

export class Simulation {
  public readonly state: GameState;

  public constructor(initialState: GameState = createInitialGameState()) {
    this.state = cloneGameState(initialState);
  }

  public resetMatch(
    fighterIds: readonly [FighterId, FighterId] = [
      this.state.fighters[0].fighterId,
      this.state.fighters[1].fighterId,
    ],
  ): void {
    this.restore(createInitialGameState(fighterIds));
  }

  /** Restore a trusted deterministic snapshot, then continue stepping normally. */
  public restore(snapshot: GameState): void {
    const restored = cloneGameState(snapshot);
    this.state.frame = restored.frame;
    this.state.fighters = restored.fighters;
    this.state.round = restored.round;
    this.state.hitstopFrames = restored.hitstopFrames;
    this.state.eventSerial = restored.eventSerial;
    this.state.lastEvent = restored.lastEvent;
  }

  public step(input: InputFrame): GameState {
    if (input.frame !== this.state.frame) {
      throw new Error(`Expected input frame ${this.state.frame}, received ${input.frame}.`);
    }

    this.captureBufferedActions(input);

    if (this.state.round.phase === "intro") {
      this.state.round.phaseFrames -= 1;
      if (this.state.round.phaseFrames <= 0) this.state.round.phase = "fight";
      this.finishFrame(input);
      return this.state;
    }

    if (this.state.round.phase === "roundOver") {
      this.state.round.phaseFrames -= 1;
      if (this.state.round.phaseFrames <= 0) this.advanceAfterRound();
      this.finishFrame(input);
      return this.state;
    }

    if (this.state.round.phase === "matchOver") {
      this.finishFrame(input);
      return this.state;
    }

    if (this.state.hitstopFrames > 0) {
      this.state.hitstopFrames -= 1;
      this.finishFrame(input);
      return this.state;
    }

    this.state.round.timerFrames = Math.max(0, this.state.round.timerFrames - 1);
    const previousOrder = this.state.fighters[0].x <= this.state.fighters[1].x;

    this.updateFighter(this.state.fighters[0], input.players[0]);
    this.updateFighter(this.state.fighters[1], input.players[1]);
    this.resolveGroundPushboxes(previousOrder);
    this.updateFacing();
    this.resolveAttack(this.state.fighters[0], this.state.fighters[1], input.players[1]);
    this.resolveAttack(this.state.fighters[1], this.state.fighters[0], input.players[0]);
    this.advanceActions();
    this.checkRoundEnd();
    this.finishFrame(input);
    return this.state;
  }

  private finishFrame(input: InputFrame): void {
    this.state.fighters[0].previousButtons = input.players[0];
    this.state.fighters[1].previousButtons = input.players[1];
    this.state.frame += 1;
  }

  private captureBufferedActions(input: InputFrame): void {
    for (const player of [0, 1] as const) {
      const fighter = this.state.fighters[player];
      if (fighter.inputBufferFrames > 0) {
        fighter.inputBufferFrames -= 1;
        if (fighter.inputBufferFrames === 0) fighter.bufferedButtons = 0;
      }

      const freshActions = input.players[player] & ~fighter.previousButtons & BUFFERED_ACTION_MASK;
      if (freshActions !== 0) {
        fighter.bufferedButtons |= freshActions;
        fighter.inputBufferFrames = ACTION_INPUT_BUFFER_FRAMES;
      }
    }
  }

  private updateFighter(fighter: FighterState, buttons: number): void {
    const definition = getFighterDefinition(fighter.fighterId);
    const movement = definition.movement;
    fighter.parryHighFrames = Math.max(0, fighter.parryHighFrames - 1);
    fighter.parryLowFrames = Math.max(0, fighter.parryLowFrames - 1);
    fighter.comboWindowFrames = Math.max(0, fighter.comboWindowFrames - 1);
    if (fighter.comboWindowFrames === 0) fighter.comboCount = 0;

    const towardButton = fighter.facing === 1 ? InputButton.Right : InputButton.Left;
    if (isPressed(fighter, buttons, towardButton) && this.canDefend(fighter)) {
      fighter.parryHighFrames = PARRY_WINDOW;
    }
    if (isPressed(fighter, buttons, InputButton.Down) && this.canDefend(fighter)) {
      fighter.parryLowFrames = PARRY_WINDOW;
      fighter.lastDownTapFrame = this.state.frame;
    }

    if (fighter.action === "knockdown") {
      if (
        fighter.grounded &&
        fighter.canQuickRise &&
        isPressed(fighter, buttons, InputButton.Down)
      ) {
        fighter.stunFrames = Math.min(fighter.stunFrames, QUICK_RISE_FRAMES);
      }
      this.applyPhysics(fighter);
      return;
    }

    if (
      fighter.action === "hitstun" ||
      fighter.action === "blockstun" ||
      fighter.action === "parry" ||
      fighter.action === "ko"
    ) {
      this.applyPhysics(fighter);
      return;
    }

    if (fighter.action === "attack" && fighter.attack) {
      const cancelAttack = this.readAttackInput(fighter, buttons);
      const currentAttack = definition.moves[fighter.attack];
      if (
        cancelAttack &&
        fighter.attackConnected &&
        currentAttack.cancelTo.includes(cancelAttack) &&
        this.canPayForAttack(fighter, cancelAttack)
      ) {
        this.startAttack(fighter, cancelAttack);
      }

      if (
        currentAttack.travelSpeed &&
        fighter.actionFrame >= Math.trunc(currentAttack.startupFrames / 2) &&
        fighter.actionFrame <= currentAttack.startupFrames + currentAttack.activeFrames
      ) {
        fighter.velocityX = fighter.facing * currentAttack.travelSpeed;
      } else {
        fighter.velocityX = 0;
      }
      this.applyPhysics(fighter);
      return;
    }

    if (fighter.action === "dash") {
      fighter.velocityX = fighter.dashDirection * movement.dashSpeed;
      fighter.dashFrames -= 1;
      if (fighter.dashFrames <= 0) this.setAction(fighter, "idle");
      this.applyPhysics(fighter);
      return;
    }

    const attackInput = this.readAttackInput(fighter, buttons);
    if (fighter.grounded && attackInput && this.canPayForAttack(fighter, attackInput)) {
      this.startAttack(fighter, attackInput);
      this.applyPhysics(fighter);
      return;
    }

    const leftPressed = isPressed(fighter, buttons, InputButton.Left);
    const rightPressed = isPressed(fighter, buttons, InputButton.Right);
    if (fighter.grounded && leftPressed) {
      if (this.state.frame - fighter.lastLeftTapFrame <= DASH_INPUT_WINDOW) {
        this.startDash(fighter, -1);
      }
      fighter.lastLeftTapFrame = this.state.frame;
    }
    if (fighter.grounded && rightPressed) {
      if (this.state.frame - fighter.lastRightTapFrame <= DASH_INPUT_WINDOW) {
        this.startDash(fighter, 1);
      }
      fighter.lastRightTapFrame = this.state.frame;
    }

    if (fighter.dashFrames > 0) {
      this.applyPhysics(fighter);
      return;
    }

    const jumpPressed = isPressed(fighter, buttons, InputButton.Up);
    if (jumpPressed && fighter.grounded && !hasInput(buttons, InputButton.Down)) {
      const isSuperJump = this.state.frame - fighter.lastDownTapFrame <= 8;
      fighter.velocityY = isSuperJump ? movement.superJumpVelocity : movement.jumpVelocity;
      fighter.grounded = false;
      fighter.crouching = false;
      this.setAction(fighter, "jump");
    }

    const horizontalDirection =
      Number(hasInput(buttons, InputButton.Right)) - Number(hasInput(buttons, InputButton.Left));
    if (fighter.grounded) {
      fighter.crouching = hasInput(buttons, InputButton.Down);
      fighter.velocityX = fighter.crouching ? 0 : horizontalDirection * movement.walkSpeed;
      this.setAction(
        fighter,
        fighter.crouching ? "crouch" : horizontalDirection === 0 ? "idle" : "walk",
        false,
      );
    } else {
      fighter.velocityX = horizontalDirection * movement.airSpeed;
      fighter.crouching = false;
    }

    this.applyPhysics(fighter);
  }

  private readAttackInput(fighter: FighterState, buttons: number): AttackId | null {
    const freshButtons = buttons & ~fighter.previousButtons;
    const pressedButtons = freshButtons | fighter.bufferedButtons;
    const availableButtons = buttons | fighter.bufferedButtons;
    const lightPressed = hasInput(pressedButtons, InputButton.Light);
    const heavyPressed = hasInput(pressedButtons, InputButton.Heavy);
    const specialPressed = hasInput(pressedButtons, InputButton.Special);
    const wantsSuper =
      (specialPressed && hasInput(availableButtons, InputButton.Heavy)) ||
      (heavyPressed && hasInput(availableButtons, InputButton.Special));

    if (wantsSuper) return "super";
    if (lightPressed) return fighter.crouching ? "crouchLight" : "light";
    if (heavyPressed) return "heavy";
    if (specialPressed) return "special";
    return null;
  }

  private canPayForAttack(fighter: FighterState, attackId: AttackId): boolean {
    return fighter.meter >= getFighterDefinition(fighter.fighterId).moves[attackId].meterCost;
  }

  private startAttack(fighter: FighterState, attackId: AttackId): void {
    const attack = getFighterDefinition(fighter.fighterId).moves[attackId];
    fighter.meter = Math.max(0, fighter.meter - attack.meterCost);
    fighter.attack = attackId;
    fighter.attackConnected = false;
    fighter.bufferedButtons = 0;
    fighter.inputBufferFrames = 0;
    fighter.crouching = attackId === "crouchLight";
    fighter.velocityX = 0;
    this.setAction(fighter, "attack");
    const eventType = attackId === "special" || attackId === "super" ? attackId : "attack";
    this.emit(eventType, fighter.id, fighter.id === 0 ? 1 : 0);
  }

  private startDash(fighter: FighterState, direction: -1 | 1): void {
    const movement = getFighterDefinition(fighter.fighterId).movement;
    fighter.dashDirection = direction;
    fighter.dashFrames = movement.dashDurationFrames;
    fighter.velocityX = direction * movement.dashSpeed;
    fighter.crouching = false;
    this.setAction(fighter, "dash");
  }

  private applyPhysics(fighter: FighterState): void {
    const definition = getFighterDefinition(fighter.fighterId);
    if (!fighter.grounded) fighter.velocityY += definition.movement.gravity;
    fighter.x += fighter.velocityX;
    fighter.y += fighter.velocityY;

    if (fighter.y >= FLOOR_Y) {
      fighter.y = FLOOR_Y;
      fighter.velocityY = 0;
      fighter.grounded = true;
      if (fighter.action === "jump") this.setAction(fighter, "idle");
    }

    const halfWidth = Math.trunc(definition.body.pushboxWidth / 2);
    fighter.x = clampInteger(fighter.x, halfWidth, STAGE_WIDTH - halfWidth);
  }

  private resolveAttack(
    attacker: FighterState,
    defender: FighterState,
    defenderButtons: number,
  ): void {
    if (attacker.action !== "attack" || !attacker.attack || attacker.attackConnected) return;

    const attack = getFighterDefinition(attacker.fighterId).moves[attacker.attack];
    if (!isAttackActive(attack, attacker.actionFrame)) return;

    const directionToDefender = defender.x - attacker.x;
    if (directionToDefender * attacker.facing <= 0) return;
    const attackerWidth = getFighterDefinition(attacker.fighterId).body.pushboxWidth;
    const defenderWidth = getFighterDefinition(defender.fighterId).body.pushboxWidth;
    const edgeDistance = Math.max(
      0,
      Math.abs(directionToDefender) - Math.trunc((attackerWidth + defenderWidth) / 2),
    );
    if (edgeDistance > attack.range || Math.abs(defender.y - attacker.y) > pixels(140)) return;

    if (this.didParry(defender, attack)) {
      attacker.attackConnected = true;
      defender.meter = clampInteger(defender.meter + 70, 0, MAX_METER);
      defender.stunFrames = 7;
      defender.velocityX = 0;
      this.setAction(defender, "parry");
      this.state.hitstopFrames = Math.max(this.state.hitstopFrames, 8);
      this.emit("parry", attacker.id, defender.id);
      return;
    }

    if (this.didBlock(defender, attacker, attack, defenderButtons)) {
      attacker.attackConnected = true;
      defender.health = Math.max(0, defender.health - attack.chipDamage);
      defender.stunFrames = attack.blockstunFrames;
      defender.velocityX = attacker.facing * Math.trunc(attack.knockbackX / 3);
      this.setAction(defender, "blockstun");
      attacker.meter = clampInteger(
        attacker.meter + Math.trunc(attack.meterGain / 3),
        0,
        MAX_METER,
      );
      defender.meter = clampInteger(defender.meter + 25, 0, MAX_METER);
      this.state.hitstopFrames = Math.max(
        this.state.hitstopFrames,
        Math.max(2, attack.hitstopFrames - 2),
      );
      this.emit("block", attacker.id, defender.id);
      return;
    }

    this.applyHit(attacker, defender, attack);
  }

  private didParry(defender: FighterState, attack: AttackDefinition): boolean {
    if (!this.canDefend(defender)) return false;
    return attack.height === "low" ? defender.parryLowFrames > 0 : defender.parryHighFrames > 0;
  }

  private didBlock(
    defender: FighterState,
    attacker: FighterState,
    attack: AttackDefinition,
    buttons: number,
  ): boolean {
    if (!defender.grounded || !this.canDefend(defender)) return false;
    const awayButton = attacker.x < defender.x ? InputButton.Right : InputButton.Left;
    const holdingAway = hasInput(buttons, awayButton);
    const holdingDown = hasInput(buttons, InputButton.Down);
    if (!holdingAway) return false;
    if (attack.height === "low") return holdingDown;
    if (attack.height === "overhead") return !holdingDown;
    return true;
  }

  private canDefend(fighter: FighterState): boolean {
    return (
      isNeutralAction(fighter.action) || fighter.action === "dash" || fighter.action === "parry"
    );
  }

  private applyHit(attacker: FighterState, defender: FighterState, attack: AttackDefinition): void {
    attacker.attackConnected = true;
    attacker.meter = clampInteger(attacker.meter + attack.meterGain, 0, MAX_METER);
    defender.meter = clampInteger(defender.meter + Math.trunc(attack.damage / 2), 0, MAX_METER);
    defender.health = Math.max(0, defender.health - attack.damage);
    defender.attack = null;
    defender.attackConnected = false;
    defender.stunFrames = attack.knockdown
      ? Math.max(58, attack.hitstunFrames)
      : attack.hitstunFrames;
    defender.velocityX = attacker.facing * attack.knockbackX;
    defender.velocityY = attack.launchY;
    defender.canQuickRise = attack.knockdown && attack.id !== "super";
    if (attack.knockdown) defender.grounded = false;
    this.setAction(defender, attack.knockdown ? "knockdown" : "hitstun");

    attacker.comboCount = attacker.comboWindowFrames > 0 ? attacker.comboCount + 1 : 1;
    attacker.comboWindowFrames = attack.hitstunFrames + 34;
    this.state.hitstopFrames = Math.max(this.state.hitstopFrames, attack.hitstopFrames);
    this.emit("hit", attacker.id, defender.id);
  }

  private advanceActions(): void {
    for (const fighter of this.state.fighters) {
      if (fighter.action === "attack" && fighter.attack) {
        fighter.actionFrame += 1;
        const attack = getFighterDefinition(fighter.fighterId).moves[fighter.attack];
        if (fighter.actionFrame >= attackTotalFrames(attack)) {
          fighter.attack = null;
          fighter.attackConnected = false;
          fighter.crouching = false;
          this.setAction(fighter, "idle");
        }
        continue;
      }

      if (
        fighter.action === "hitstun" ||
        fighter.action === "blockstun" ||
        fighter.action === "parry" ||
        fighter.action === "knockdown"
      ) {
        fighter.stunFrames = Math.max(0, fighter.stunFrames - 1);
        fighter.actionFrame += 1;
        if (fighter.stunFrames === 0 && (fighter.action !== "knockdown" || fighter.grounded)) {
          fighter.canQuickRise = false;
          fighter.crouching = false;
          this.setAction(fighter, "idle");
        }
        continue;
      }

      fighter.actionFrame += 1;
    }
  }

  private setAction(fighter: FighterState, action: FighterAction, resetFrame = true): void {
    if (fighter.action === action && !resetFrame) return;
    fighter.action = action;
    if (resetFrame) fighter.actionFrame = 0;
  }

  private resolveGroundPushboxes(firstWasLeft: boolean): void {
    const first = this.state.fighters[0];
    const second = this.state.fighters[1];
    if (!first.grounded || !second.grounded || first.action === "ko" || second.action === "ko")
      return;

    const left = firstWasLeft ? first : second;
    const right = firstWasLeft ? second : first;
    const leftWidth = getFighterDefinition(left.fighterId).body.pushboxWidth;
    const rightWidth = getFighterDefinition(right.fighterId).body.pushboxWidth;
    const minimumDistance = Math.trunc((leftWidth + rightWidth) / 2);
    const leftHalfWidth = Math.trunc(leftWidth / 2);
    const rightHalfWidth = Math.trunc(rightWidth / 2);
    const overlap = minimumDistance - (right.x - left.x);
    if (overlap <= 0) return;

    const leftShare = Math.trunc(overlap / 2);
    const rightShare = overlap - leftShare;
    left.x = clampInteger(left.x - leftShare, leftHalfWidth, STAGE_WIDTH - leftHalfWidth);
    right.x = clampInteger(right.x + rightShare, rightHalfWidth, STAGE_WIDTH - rightHalfWidth);

    const remainingOverlap = minimumDistance - (right.x - left.x);
    if (remainingOverlap > 0) {
      if (left.x === leftHalfWidth) {
        right.x = clampInteger(
          left.x + minimumDistance,
          rightHalfWidth,
          STAGE_WIDTH - rightHalfWidth,
        );
      } else {
        left.x = clampInteger(
          right.x - minimumDistance,
          leftHalfWidth,
          STAGE_WIDTH - leftHalfWidth,
        );
      }
    }
  }

  private updateFacing(): void {
    const [first, second] = this.state.fighters;
    if (first.x === second.x || first.action === "attack" || second.action === "attack") return;
    first.facing = first.x < second.x ? 1 : -1;
    second.facing = first.x < second.x ? -1 : 1;
  }

  private checkRoundEnd(): void {
    const [first, second] = this.state.fighters;
    if (first.health <= 0 || second.health <= 0) {
      if (first.health <= 0) first.action = "ko";
      if (second.health <= 0) second.action = "ko";
      const winner = first.health === second.health ? -1 : first.health > second.health ? 0 : 1;
      this.finishRound(winner, winner === -1 ? "draw" : "ko");
      return;
    }

    if (this.state.round.timerFrames <= 0) {
      const winner = first.health === second.health ? -1 : first.health > second.health ? 0 : 1;
      this.finishRound(winner, winner === -1 ? "draw" : "time");
    }
  }

  private finishRound(winner: PlayerId | -1, reason: Exclude<RoundEndReason, null>): void {
    if (this.state.round.phase !== "fight") return;
    this.state.round.phase = "roundOver";
    this.state.round.phaseFrames = ROUND_OVER_FRAMES;
    this.state.round.winner = winner;
    this.state.round.reason = reason;
    if (winner !== -1) {
      this.state.round.scores[winner] += 1;
      this.emit("ko", winner, winner === 0 ? 1 : 0);
    }
  }

  private advanceAfterRound(): void {
    const matchWinner =
      this.state.round.scores[0] >= ROUNDS_TO_WIN
        ? 0
        : this.state.round.scores[1] >= ROUNDS_TO_WIN
          ? 1
          : null;
    if (matchWinner !== null) {
      this.state.round.phase = "matchOver";
      this.state.round.winner = matchWinner;
      this.state.round.phaseFrames = 0;
      return;
    }

    const meters: [number, number] = [this.state.fighters[0].meter, this.state.fighters[1].meter];
    this.state.fighters = [
      createFighter(0, this.state.fighters[0].fighterId, meters[0]),
      createFighter(1, this.state.fighters[1].fighterId, meters[1]),
    ];
    this.state.round.number += 1;
    this.state.round.timerFrames = ROUND_TIME_FRAMES;
    this.state.round.phaseFrames = ROUND_INTRO_FRAMES;
    this.state.round.phase = "intro";
    this.state.round.winner = null;
    this.state.round.reason = null;
    this.state.hitstopFrames = 0;
    this.state.lastEvent = null;
  }

  private emit(type: CombatEventType, source: PlayerId, target: PlayerId): void {
    this.state.eventSerial += 1;
    this.state.lastEvent = {
      serial: this.state.eventSerial,
      frame: this.state.frame,
      type,
      source,
      target,
    };
  }
}
