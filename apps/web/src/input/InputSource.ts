import { InputButton, type InputFrame } from "@neon-rivals/simulation";
import Phaser from "phaser";
import { BufferedButtonState, type LocalPlayerIndex } from "./BufferedButtonState";

interface PlayerKeys {
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly guard: Phaser.Input.Keyboard.Key;
  readonly heavy: Phaser.Input.Keyboard.Key;
  readonly special: Phaser.Input.Keyboard.Key;
}

export class InputSource {
  private readonly players: readonly [PlayerKeys, PlayerKeys];
  private readonly buffered = new BufferedButtonState();

  public constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is unavailable.");

    this.players = [
      this.createKeys(keyboard, {
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        guard: Phaser.Input.Keyboard.KeyCodes.F,
        heavy: Phaser.Input.Keyboard.KeyCodes.G,
        special: Phaser.Input.Keyboard.KeyCodes.H,
      }),
      this.createKeys(keyboard, {
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        guard: Phaser.Input.Keyboard.KeyCodes.J,
        heavy: Phaser.Input.Keyboard.KeyCodes.K,
        special: Phaser.Input.Keyboard.KeyCodes.L,
      }),
    ];

    this.registerBufferedActions(0, this.players[0]);
    this.registerBufferedActions(1, this.players[1]);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.buffered.clear());
  }

  public capture(frame: number): InputFrame {
    return {
      frame,
      players: [this.captureButtons(0), this.captureButtons(1)],
    };
  }

  /** Online matches always use the Player 1 keyboard layout for the local user. */
  public captureButtons(player: 0 | 1): number {
    return this.buffered.consume(player, this.capturePlayer(this.players[player]));
  }

  public clearBufferedActions(): void {
    this.buffered.clear();
  }

  private registerBufferedActions(player: LocalPlayerIndex, keys: PlayerKeys): void {
    const actions: ReadonlyArray<readonly [Phaser.Input.Keyboard.Key, InputButton]> = [
      [keys.up, InputButton.Up],
      [keys.heavy, InputButton.Heavy],
      [keys.special, InputButton.Special],
    ];
    for (const [key, button] of actions) {
      key.on("down", () => this.buffered.queue(player, button));
    }
  }

  private createKeys(
    keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
    codes: Readonly<Record<keyof PlayerKeys, number>>,
  ): PlayerKeys {
    return {
      left: keyboard.addKey(codes.left),
      right: keyboard.addKey(codes.right),
      up: keyboard.addKey(codes.up),
      down: keyboard.addKey(codes.down),
      guard: keyboard.addKey(codes.guard),
      heavy: keyboard.addKey(codes.heavy),
      special: keyboard.addKey(codes.special),
    };
  }

  private capturePlayer(keys: PlayerKeys): number {
    let buttons = 0;
    if (keys.left.isDown) buttons |= InputButton.Left;
    if (keys.right.isDown) buttons |= InputButton.Right;
    if (keys.up.isDown) buttons |= InputButton.Up;
    if (keys.down.isDown) buttons |= InputButton.Down;
    if (keys.guard.isDown) buttons |= InputButton.Guard;
    if (keys.heavy.isDown) buttons |= InputButton.Heavy;
    if (keys.special.isDown) buttons |= InputButton.Special;
    return buttons;
  }
}
