import { describe, expect, it } from "vitest";
import { RematchVotes } from "../../apps/server/src/net/RematchVotes";

describe("server rematch agreement", () => {
  it("starts only after both players request the same rematch", () => {
    const votes = new RematchVotes();
    expect(votes.request(0, 4)).toEqual({
      matchNumber: 4,
      requested: [true, false],
      ready: false,
    });
    expect(votes.request(1, 4)).toEqual({
      matchNumber: 4,
      requested: [true, true],
      ready: true,
    });
  });

  it("allows either player to withdraw before both accept", () => {
    const votes = new RematchVotes();
    votes.request(1, 2);
    expect(votes.cancel(1, 2)).toEqual({
      matchNumber: 2,
      requested: [false, false],
      ready: false,
    });
  });

  it("clears prior votes when the next match starts", () => {
    const votes = new RematchVotes();
    votes.request(0, 1);
    votes.request(1, 1);
    expect(votes.reset(2)).toEqual({
      matchNumber: 2,
      requested: [false, false],
      ready: false,
    });
  });
});
