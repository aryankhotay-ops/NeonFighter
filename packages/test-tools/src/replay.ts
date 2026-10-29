import {
  checksumState,
  InputButton,
  Simulation,
  type GameState,
  type InputFrame,
} from "@neon-rivals/simulation";

export interface ReplayResult {
  readonly state: GameState;
  readonly checksum: number;
}

export function createDeterminismFixture(frameCount: number): InputFrame[] {
  return Array.from({ length: frameCount }, (_, frame) => {
    let playerOne = 0;
    let playerTwo = 0;

    if (frame % 360 < 120) playerOne |= InputButton.Right;
    if (frame % 360 >= 180 && frame % 360 < 300) playerOne |= InputButton.Left;
    if (frame % 173 === 0) playerOne |= InputButton.Up;
    if (frame % 211 > 170) playerOne |= InputButton.Down;

    if (frame % 420 < 155) playerTwo |= InputButton.Left;
    if (frame % 420 >= 230 && frame % 420 < 385) playerTwo |= InputButton.Right;
    if (frame % 197 === 0) playerTwo |= InputButton.Up;
    if (frame % 251 > 218) playerTwo |= InputButton.Down;

    return { frame, players: [playerOne, playerTwo] };
  });
}

export function runReplay(inputs: readonly InputFrame[]): ReplayResult {
  const simulation = new Simulation();
  for (const input of inputs) simulation.step(input);
  return {
    state: simulation.state,
    checksum: checksumState(simulation.state),
  };
}
