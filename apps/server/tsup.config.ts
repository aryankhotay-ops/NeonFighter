import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  clean: true,
  sourcemap: true,
  // Workspace packages expose TypeScript source for Vite. Bundle them into the production
  // server so Node never attempts to execute or resolve that source directly.
  noExternal: ["@neon-rivals/protocol", "@neon-rivals/simulation"],
});
