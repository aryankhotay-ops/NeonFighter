// Presentation throttles never affect the deterministic 60 Hz simulation or network input.
// They only prevent duplicate rendering on high-refresh displays and expensive text churn.
export const DIAGNOSTICS_REFRESH_FRAMES = 15;

export function shouldPresentSimulationFrame(frame: number, lastFrame: number): boolean {
  return frame !== lastFrame;
}

export function shouldRefreshDiagnostics(frame: number, lastFrame: number): boolean {
  return lastFrame < 0 || frame < lastFrame || frame - lastFrame >= DIAGNOSTICS_REFRESH_FRAMES;
}
