import { describe, expect, it } from "vitest";
import { FIGHTER_IDS, type FighterId } from "@neon-rivals/simulation";
import { CharacterSelectController } from "../../apps/web/src/game/CharacterSelectController";

describe("character selection", () => {
  it("locks player one, then player two, before exposing a confirmed matchup", () => {
    const selection = new CharacterSelectController("local", FIGHTER_IDS);

    selection.select("vesper");
    expect(selection.snapshot).toEqual({
      mode: "local",
      phase: "choosing-p2",
      activePlayer: 1,
      choices: ["vesper", null],
    });
    expect(selection.confirmedMatchup()).toBeNull();

    selection.select("rook");
    expect(selection.snapshot.phase).toBe("ready");
    expect(selection.snapshot.activePlayer).toBeNull();
    expect(selection.snapshot.choices).toEqual(["vesper", "rook"]);
    expect(selection.confirmedMatchup()).toEqual(["vesper", "rook"]);
  });

  it("allows mirror matches and keeps the locked choices stable during final review", () => {
    const selection = new CharacterSelectController("local", FIGHTER_IDS);
    selection.select("sable");
    selection.select("sable");
    selection.select("nova");

    expect(selection.confirmedMatchup()).toEqual(["sable", "sable"]);
  });

  it("requires an explicit player two choice in training mode", () => {
    const selection = new CharacterSelectController("training", FIGHTER_IDS);
    selection.select("nova");

    expect(selection.snapshot).toEqual({
      mode: "training",
      phase: "choosing-p2",
      activePlayer: 1,
      choices: ["nova", null],
    });
    expect(selection.confirmedMatchup()).toBeNull();

    selection.select("sable");
    expect(selection.snapshot.phase).toBe("ready");
    expect(selection.snapshot.choices).toEqual(["nova", "sable"]);
    expect(selection.confirmedMatchup()).toEqual(["nova", "sable"]);
  });

  it("cancels a training matchup back to player two without changing player one", () => {
    const selection = new CharacterSelectController("training", FIGHTER_IDS);
    selection.select("rook");
    selection.select("vesper");

    expect(selection.cancel()).toBe("changed-selection");
    expect(selection.snapshot).toEqual({
      mode: "training",
      phase: "choosing-p2",
      activePlayer: 1,
      choices: ["rook", null],
    });
  });

  it("cancels player one lock while player two is choosing", () => {
    const selection = new CharacterSelectController("local", FIGHTER_IDS);
    selection.select("vesper");

    expect(selection.cancel()).toBe("changed-selection");
    expect(selection.snapshot.phase).toBe("choosing-p1");
    expect(selection.snapshot.choices).toEqual([null, null]);
  });

  it("cancels final review back to player two without losing player one", () => {
    const selection = new CharacterSelectController("local", FIGHTER_IDS);
    selection.select("rook");
    selection.select("nova");

    expect(selection.cancel()).toBe("changed-selection");
    expect(selection.snapshot).toEqual({
      mode: "local",
      phase: "choosing-p2",
      activePlayer: 1,
      choices: ["rook", null],
    });
    expect(selection.confirmedMatchup()).toBeNull();
  });

  it("returns to the menu when cancel is pressed before any lock", () => {
    const selection = new CharacterSelectController("local", FIGHTER_IDS);
    expect(selection.cancel()).toBe("exit-to-menu");
  });

  it("rejects choices outside the configured roster", () => {
    const selection = new CharacterSelectController("local", FIGHTER_IDS);
    expect(() => selection.select("unknown" as FighterId)).toThrow("Unknown fighter selection");
  });
});
