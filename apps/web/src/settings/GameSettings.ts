export interface GameSettings {
  musicVolume: number;
  effectsVolume: number;
  screenShake: boolean;
  reducedFlash: boolean;
}

const STORAGE_KEY = "neon-rivals.settings.v1";

export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
  musicVolume: 0.45,
  effectsVolume: 0.8,
  screenShake: true,
  reducedFlash: false,
};

export function loadSettings(): GameSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(stored) as Partial<GameSettings>;
    return {
      musicVolume: clampVolume(parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume),
      effectsVolume: clampVolume(parsed.effectsVolume ?? DEFAULT_SETTINGS.effectsVolume),
      screenShake: parsed.screenShake ?? DEFAULT_SETTINGS.screenShake,
      reducedFlash: parsed.reducedFlash ?? DEFAULT_SETTINGS.reducedFlash,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("neon-rivals-settings", { detail: settings }));
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}
