import type { GameState } from "./GameState";

function addInteger(hash: number, value: number): number {
  let next = hash;
  const integer = value | 0;
  for (let shift = 0; shift < 32; shift += 8) {
    next ^= (integer >>> shift) & 0xff;
    next = Math.imul(next, 0x01000193);
  }
  return next >>> 0;
}

function addString(hash: number, value: string | null): number {
  let next = addInteger(hash, value?.length ?? -1);
  if (!value) return next;
  for (let index = 0; index < value.length; index += 1) {
    next = addInteger(next, value.charCodeAt(index));
  }
  return next;
}

export function checksumState(state: GameState): number {
  let hash = addInteger(0x811c9dc5, state.frame);
  hash = addInteger(hash, state.hitstopFrames);
  hash = addInteger(hash, state.eventSerial);
  hash = addString(hash, state.round.phase);
  hash = addInteger(hash, state.round.number);
  hash = addInteger(hash, state.round.timerFrames);
  hash = addInteger(hash, state.round.phaseFrames);
  hash = addInteger(hash, state.round.scores[0]);
  hash = addInteger(hash, state.round.scores[1]);
  hash = addInteger(hash, state.round.winner ?? -2);
  hash = addString(hash, state.round.reason);

  for (const fighter of state.fighters) {
    hash = addInteger(hash, fighter.id);
    hash = addString(hash, fighter.fighterId);
    hash = addInteger(hash, fighter.maxHealth);
    hash = addInteger(hash, fighter.x);
    hash = addInteger(hash, fighter.y);
    hash = addInteger(hash, fighter.velocityX);
    hash = addInteger(hash, fighter.velocityY);
    hash = addInteger(hash, fighter.facing);
    hash = addInteger(hash, fighter.grounded ? 1 : 0);
    hash = addInteger(hash, fighter.crouching ? 1 : 0);
    hash = addInteger(hash, fighter.previousButtons);
    hash = addInteger(hash, fighter.bufferedButtons);
    hash = addInteger(hash, fighter.inputBufferFrames);
    hash = addInteger(hash, fighter.health);
    hash = addInteger(hash, fighter.meter);
    hash = addString(hash, fighter.action);
    hash = addInteger(hash, fighter.actionFrame);
    hash = addString(hash, fighter.attack);
    hash = addInteger(hash, fighter.attackConnected ? 1 : 0);
    hash = addInteger(hash, fighter.stunFrames);
    hash = addInteger(hash, fighter.comboCount);
    hash = addInteger(hash, fighter.comboWindowFrames);
    hash = addInteger(hash, fighter.parryHighFrames);
    hash = addInteger(hash, fighter.parryLowFrames);
    hash = addInteger(hash, fighter.dashFrames);
    hash = addInteger(hash, fighter.dashDirection);
    hash = addInteger(hash, fighter.lastLeftTapFrame);
    hash = addInteger(hash, fighter.lastRightTapFrame);
    hash = addInteger(hash, fighter.lastDownTapFrame);
    hash = addInteger(hash, fighter.canQuickRise ? 1 : 0);
  }

  if (state.lastEvent) {
    hash = addInteger(hash, state.lastEvent.serial);
    hash = addInteger(hash, state.lastEvent.frame);
    hash = addString(hash, state.lastEvent.type);
    hash = addInteger(hash, state.lastEvent.source);
    hash = addInteger(hash, state.lastEvent.target);
  } else {
    hash = addInteger(hash, -1);
  }
  return hash >>> 0;
}

export function formatChecksum(checksum: number): string {
  return checksum.toString(16).padStart(8, "0");
}
