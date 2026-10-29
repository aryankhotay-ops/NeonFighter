import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, workspaceRoot, "");
  return {
    envDir: workspaceRoot,
    base: environment.VITE_BASE_PATH || "/",
    plugins: [
      {
        name: "remove-colyseus-local-fallback",
        enforce: "pre",
        transform(code, id) {
          if (!id.includes("@colyseus/sdk")) {
            return null;
          }
          // Neon Rivals always supplies an endpoint. Remove the SDK's unused local fallback
          // so production artifacts never contain or accidentally select a local URL.
          return code
            .replaceAll("ws://127.0.0.1:2567", "ws://configuration-required.invalid")
            .replaceAll("localhost", "configuration-required.invalid");
        },
      },
    ],
    server: {
      host: environment.DEV_WEB_HOST || "127.0.0.1",
      port: parsePort(environment.DEV_WEB_PORT, 5173),
      strictPort: parseBoolean(environment.DEV_WEB_STRICT_PORT, true),
      headers: {
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    },
    preview: {
      host: environment.PREVIEW_WEB_HOST || environment.DEV_WEB_HOST || "127.0.0.1",
      port: parsePort(environment.PREVIEW_WEB_PORT, 4173),
      strictPort: true,
    },
    build: {
      target: "es2022",
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      minify: true,
      cssCodeSplit: true,
      manifest: true,
      chunkSizeWarningLimit: 1_600,
    },
  };
});

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid web server port: ${value}`);
  }
  return port;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected true or false, received: ${value}`);
}
