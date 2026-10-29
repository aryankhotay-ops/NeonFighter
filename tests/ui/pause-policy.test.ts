import { describe, expect, it } from "vitest";
import { pauseDestination, shouldPauseSimulation } from "../../apps/web/src/game/PausePolicy";

describe("fight pause policy", () => {
  it("freezes local versus and training simulation", () => {
    expect(shouldPauseSimulation("local")).toBe(true);
    expect(shouldPauseSimulation("training")).toBe(true);
  });

  it("keeps an authoritative online match running behind the menu", () => {
    expect(shouldPauseSimulation("online")).toBe(false);
  });

  it("routes exits to the appropriate destination", () => {
    expect(pauseDestination("local")).toBe("main-menu");
    expect(pauseDestination("training")).toBe("main-menu");
    expect(pauseDestination("online")).toBe("online-lobby");
  });
});
