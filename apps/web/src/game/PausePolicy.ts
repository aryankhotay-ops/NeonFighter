import type { MatchMode } from "./GameFlow";

/** Offline simulation can freeze. Online simulation must keep reconciling with the server. */
export function shouldPauseSimulation(mode: MatchMode): boolean {
  return mode !== "online";
}

export function pauseDestination(mode: MatchMode): "main-menu" | "online-lobby" {
  return mode === "online" ? "online-lobby" : "main-menu";
}
