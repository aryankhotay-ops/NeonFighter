import { describe, expect, it } from "vitest";
import {
  resolveMultiplayerServerCandidates,
  resolveMultiplayerServerUrl,
} from "../../apps/web/src/config";

describe("frontend production server URL", () => {
  it("uses an environment-supplied HTTPS endpoint", () => {
    expect(
      resolveMultiplayerServerUrl("https://multiplayer.example.com/", "https://game.example.com"),
    ).toBe("https://multiplayer.example.com");
  });

  it("falls back to same-origin deployment without embedding a local URL", () => {
    expect(resolveMultiplayerServerUrl(undefined, "https://game.example.com")).toBe(
      "https://game.example.com",
    );
  });

  it("derives a development endpoint from the current host and configured port", () => {
    expect(
      resolveMultiplayerServerCandidates(undefined, "http://dev-machine.example:5173", "2567"),
    ).toEqual(["http://dev-machine.example:5173", "http://dev-machine.example:2567"]);
  });

  it("uses only an explicit server URL instead of probing fallbacks", () => {
    expect(
      resolveMultiplayerServerCandidates(
        "https://multiplayer.example.com",
        "https://game.example.com",
        "2567",
      ),
    ).toEqual(["https://multiplayer.example.com"]);
  });

  it("rejects insecure non-HTTP transports in frontend configuration", () => {
    expect(() =>
      resolveMultiplayerServerUrl("file:///tmp/server", "https://game.example.com"),
    ).toThrow("http:// or https://");
  });
});
