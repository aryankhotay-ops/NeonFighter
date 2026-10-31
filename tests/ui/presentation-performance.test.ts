import { describe, expect, it } from "vitest";
import {
  FIGHTER_FACE_TEXTURE_VARIANTS,
  MAX_MATCH_FACE_TEXTURE_BYTES,
  collectiblePortraitProfile,
  fighterFaceTextureKey,
  resolveFighterFaceState,
} from "../../apps/web/src/presentation/FighterArt";
import { FIGHTER_PRESENTATIONS } from "../../apps/web/src/presentation/FighterPresentationConfig";
import {
  DIAGNOSTICS_REFRESH_FRAMES,
  shouldPresentSimulationFrame,
  shouldRefreshDiagnostics,
} from "../../apps/web/src/rendering/PresentationBudget";

describe("lightweight fighter presentation", () => {
  it("uses five cached face variants instead of rebuilding faces every frame", () => {
    expect(FIGHTER_FACE_TEXTURE_VARIANTS).toHaveLength(5);
    const keys = FIGHTER_FACE_TEXTURE_VARIANTS.map((face) => fighterFaceTextureKey("vesper", face));
    expect(new Set(keys).size).toBe(keys.length);
    expect(MAX_MATCH_FACE_TEXTURE_BYTES).toBeLessThan(512 * 1024);
  });

  it("maps combat state to a stable cached face", () => {
    expect(resolveFighterFaceState({ action: "idle", actionFrame: 144 })).toEqual({
      expression: "neutral",
      blink: false,
    });
    expect(resolveFighterFaceState({ action: "idle", actionFrame: 145 }).blink).toBe(true);
    expect(resolveFighterFaceState({ action: "attack", actionFrame: 3 }).expression).toBe(
      "focused",
    );
    expect(resolveFighterFaceState({ action: "hitstun", actionFrame: 2 }).expression).toBe("hurt");
    expect(resolveFighterFaceState({ action: "ko", actionFrame: 2 }).expression).toBe("knockout");
  });

  it("gives every selection collectible a different signature and oversized head", () => {
    const profiles = Object.values(FIGHTER_PRESENTATIONS).map(collectiblePortraitProfile);
    expect(new Set(profiles.map((profile) => profile.signature)).size).toBe(4);
    expect(
      new Set(profiles.map((profile) => `${profile.headWidth}x${profile.headHeight}`)).size,
    ).toBe(4);
    for (const profile of profiles) {
      expect(profile.headWidth).toBeGreaterThan(profile.bodyWidth);
      expect(profile.headHeight).toBeGreaterThan(profile.bodyHeight);
    }
  });

  it("renders once per simulation frame and throttles diagnostic text", () => {
    expect(shouldPresentSimulationFrame(100, 100)).toBe(false);
    expect(shouldPresentSimulationFrame(101, 100)).toBe(true);
    expect(shouldRefreshDiagnostics(14, 0)).toBe(false);
    expect(shouldRefreshDiagnostics(DIAGNOSTICS_REFRESH_FRAMES, 0)).toBe(true);
    expect(shouldRefreshDiagnostics(2, 100)).toBe(true);
  });
});
