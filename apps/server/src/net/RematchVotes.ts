import type { RematchStatusMessage } from "@neon-rivals/protocol";
import type { PlayerIndex } from "./InputQueue";

/** Server-owned rematch agreement. A new match starts only after both occupied seats vote. */
export class RematchVotes {
  private readonly votes: [boolean, boolean] = [false, false];

  public request(player: PlayerIndex, matchNumber: number): RematchStatusMessage {
    this.votes[player] = true;
    return this.status(matchNumber);
  }

  public cancel(player: PlayerIndex, matchNumber: number): RematchStatusMessage {
    this.votes[player] = false;
    return this.status(matchNumber);
  }

  public reset(matchNumber: number): RematchStatusMessage {
    this.votes[0] = false;
    this.votes[1] = false;
    return this.status(matchNumber);
  }

  public status(matchNumber: number): RematchStatusMessage {
    return {
      matchNumber,
      requested: [this.votes[0], this.votes[1]],
      ready: this.votes[0] && this.votes[1],
    };
  }
}
