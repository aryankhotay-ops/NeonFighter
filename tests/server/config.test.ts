import { describe, expect, it } from "vitest";
import { isOriginAllowed, loadServerConfig } from "../../apps/server/src/config";

describe("production server configuration", () => {
  it("requires explicit allowed origins in production", () => {
    expect(() => loadServerConfig({ NODE_ENV: "production" })).toThrow("ALLOWED_ORIGINS");
  });

  it("parses production origins and resource limits", () => {
    const config = loadServerConfig({
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://game.example.com,https://admin.example.com/path",
      PORT: "8443",
      MAX_CONNECTIONS: "500",
      MAX_MESSAGE_BYTES: "8192",
      MAX_MESSAGES_PER_SECOND: "120",
      PUBLIC_SERVER_URL: "https://multiplayer.example.com/",
    });

    expect(config.port).toBe(8443);
    expect(config.maxConnections).toBe(500);
    expect(config.maxMessageBytes).toBe(8192);
    expect(config.maxMessagesPerSecond).toBe(120);
    expect(config.publicServerUrl).toBe("https://multiplayer.example.com");
    expect(isOriginAllowed(config, "https://game.example.com")).toBe(true);
    expect(isOriginAllowed(config, "https://admin.example.com")).toBe(true);
    expect(isOriginAllowed(config, "https://evil.example.com")).toBe(false);
  });

  it("requires both TLS paths and rejects wildcard production CORS", () => {
    expect(() =>
      loadServerConfig({
        NODE_ENV: "production",
        ALLOWED_ORIGINS: "https://game.example.com",
        TLS_CERT_PATH: "/cert.pem",
      }),
    ).toThrow("configured together");

    expect(() => loadServerConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "*" })).toThrow(
      "cannot contain '*'",
    );

    expect(() =>
      loadServerConfig({
        NODE_ENV: "production",
        ALLOWED_ORIGINS: "http://game.example.com",
      }),
    ).toThrow("must use https://");

    expect(() =>
      loadServerConfig({
        NODE_ENV: "production",
        ALLOWED_ORIGINS: "https://game.example.com",
        PUBLIC_SERVER_URL: "http://multiplayer.example.com",
      }),
    ).toThrow("PUBLIC_SERVER_URL must use https://");
  });

  it("can explicitly allow arbitrary origins only in development", () => {
    const config = loadServerConfig({
      NODE_ENV: "development",
      DEV_ALLOW_ANY_ORIGIN: "true",
    });
    expect(isOriginAllowed(config, "http://any-development-host.invalid")).toBe(true);
  });
});
