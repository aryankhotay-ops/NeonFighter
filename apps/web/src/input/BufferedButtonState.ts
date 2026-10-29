export type LocalPlayerIndex = 0 | 1;

/**
 * Latches one-shot button presses until the next simulation sample. This closes the gap where
 * a quick key tap can begin and end between two 60 Hz simulation ticks.
 */
export class BufferedButtonState {
  private readonly queued: [number, number] = [0, 0];

  public queue(player: LocalPlayerIndex, button: number): void {
    this.queued[player] |= button;
  }

  public consume(player: LocalPlayerIndex, heldButtons: number): number {
    const buttons = heldButtons | this.queued[player];
    this.queued[player] = 0;
    return buttons;
  }

  public clear(): void {
    this.queued[0] = 0;
    this.queued[1] = 0;
  }
}
