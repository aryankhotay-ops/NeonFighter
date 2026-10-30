export const STAGE_ART_IDS = ["transit", "rooftop", "reactor", "harbor"] as const;
export type StageArt = (typeof STAGE_ART_IDS)[number];

export interface GameSettings {
  musicVolume: number;
  effectsVolume: number;
  screenShake: boolean;
  reducedFlash: boolean;
  stageArt: StageArt;
}

const STORAGE_KEY = "neon-rivals.settings.v1";

export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
  musicVolume: 0.45,
  effectsVolume: 0.8,
  screenShake: true,
  reducedFlash: false,
  stageArt: "transit",
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
      stageArt: isStageArt(parsed.stageArt) ? parsed.stageArt : DEFAULT_SETTINGS.stageArt,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function isStageArt(value: unknown): value is StageArt {
  return typeof value === "string" && STAGE_ART_IDS.includes(value as StageArt);
}

export function nextStageArt(current: StageArt): StageArt {
  const index = STAGE_ART_IDS.indexOf(current);
  return STAGE_ART_IDS[(index + 1) % STAGE_ART_IDS.length] ?? DEFAULT_SETTINGS.stageArt;
}

export function stageArtLabel(stageArt: StageArt): string {
  switch (stageArt) {
    case "transit":
      return "NEON TRANSIT";
    case "rooftop":
      return "STORM ROOFTOP";
    case "reactor":
      return "REACTOR RING";
    case "harbor":
      return "MIDNIGHT HARBOR";
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("neon-rivals-settings", { detail: settings }));
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}
