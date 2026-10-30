import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  STAGE_ART_IDS,
  isStageArt,
  loadSettings,
  nextStageArt,
  stageArtLabel,
} from "../../apps/web/src/settings/GameSettings";

afterEach(() => vi.unstubAllGlobals());

describe("game settings", () => {
  it("cycles through all four animated background-art choices", () => {
    let stage = DEFAULT_SETTINGS.stageArt;
    const visited = new Set([stage]);
    for (let index = 0; index < STAGE_ART_IDS.length - 1; index += 1) {
      stage = nextStageArt(stage);
      visited.add(stage);
    }
    expect([...visited]).toEqual(["transit", "rooftop", "reactor", "harbor"]);
    expect(nextStageArt(stage)).toBe("transit");
    expect(STAGE_ART_IDS.map(stageArtLabel)).toEqual([
      "NEON TRANSIT",
      "STORM ROOFTOP",
      "REACTOR RING",
      "MIDNIGHT HARBOR",
    ]);
  });

  it("migrates old saved settings to the default stage and rejects invalid stages", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ musicVolume: 0.25, stageArt: "invalid-stage" }),
      setItem: vi.fn(),
    });
    expect(loadSettings()).toMatchObject({ musicVolume: 0.25, stageArt: "transit" });
    expect(isStageArt("harbor")).toBe(true);
    expect(isStageArt("invalid-stage")).toBe(false);
  });
});
