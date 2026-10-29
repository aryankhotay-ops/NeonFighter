export const enum InputButton {
  Left = 1 << 0,
  Right = 1 << 1,
  Up = 1 << 2,
  Down = 1 << 3,
  Light = 1 << 4,
  Heavy = 1 << 5,
  Special = 1 << 6,
}

export interface InputFrame {
  readonly frame: number;
  readonly players: readonly [number, number];
}

export function hasInput(buttons: number, button: InputButton): boolean {
  return (buttons & button) !== 0;
}
