export const enum InputButton {
  Left = 1 << 0,
  Right = 1 << 1,
  Up = 1 << 2,
  Down = 1 << 3,
  /** Dedicated held defense control (F for P1, J for P2). */
  Guard = 1 << 4,
  Heavy = 1 << 5,
  Special = 1 << 6,
  /** Retained for deterministic move/replay fixtures; it is no longer mapped to a player key. */
  Light = 1 << 7,
}

export interface InputFrame {
  readonly frame: number;
  readonly players: readonly [number, number];
}

export function hasInput(buttons: number, button: InputButton): boolean {
  return (buttons & button) !== 0;
}
