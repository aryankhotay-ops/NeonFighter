export interface WebRuntimeConfig {
  readonly multiplayerServerUrl: string;
  readonly multiplayerServerCandidates: readonly string[];
  readonly development: boolean;
}

export function loadWebRuntimeConfig(): WebRuntimeConfig {
  const candidates = resolveMultiplayerServerCandidates(
    import.meta.env.VITE_SERVER_URL,
    window.location.origin,
    import.meta.env.VITE_FALLBACK_MULTIPLAYER_PORT ||
      import.meta.env.VITE_DEV_MULTIPLAYER_PORT ||
      "2567",
  );
  return {
    multiplayerServerUrl: candidates[0] ?? window.location.origin,
    multiplayerServerCandidates: candidates,
    development: import.meta.env.DEV,
  };
}

export function resolveMultiplayerServerUrl(
  configuredValue: string | undefined,
  currentOrigin: string,
  fallbackPort?: string,
): string {
  return (
    resolveMultiplayerServerCandidates(configuredValue, currentOrigin, fallbackPort)[0] ??
    normalizeServerUrl(currentOrigin)
  );
}

/**
 * Prefer an explicit environment endpoint. Without one, try a same-origin deployment first and
 * a same-host dedicated multiplayer port second. This also makes the production preview command
 * work beside `pnpm start:server` without embedding a localhost URL.
 */
export function resolveMultiplayerServerCandidates(
  configuredValue: string | undefined,
  currentOrigin: string,
  fallbackPort?: string,
): readonly string[] {
  if (configuredValue?.trim()) return [normalizeServerUrl(configuredValue)];

  const candidates = [normalizeServerUrl(currentOrigin)];
  if (fallbackPort?.trim()) {
    const port = parsePort(fallbackPort);
    const fallbackUrl = new URL(currentOrigin);
    fallbackUrl.port = String(port);
    const normalizedFallback = normalizeServerUrl(fallbackUrl.toString());
    if (!candidates.includes(normalizedFallback)) candidates.push(normalizedFallback);
  }
  return candidates;
}

function normalizeServerUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VITE_SERVER_URL must be an absolute HTTP(S) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_SERVER_URL must use http:// or https://.");
  }
  return url.toString().replace(/\/$/, "");
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || String(port) !== value.trim() || port < 1 || port > 65_535) {
    throw new Error("VITE_FALLBACK_MULTIPLAYER_PORT must be an integer from 1 to 65535.");
  }
  return port;
}
