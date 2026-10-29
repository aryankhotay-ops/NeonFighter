import Phaser from "phaser";
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  enableSmoothTextRendering,
} from "./rendering/SmoothRendering";
import { BootScene } from "./scenes/BootScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { ControlsScene } from "./scenes/ControlsScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { ExitScene } from "./scenes/ExitScene";
import { FightScene } from "./scenes/FightScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { MatchResultsScene } from "./scenes/MatchResultsScene";
import { OnlineLobbyScene } from "./scenes/OnlineLobbyScene";
import { PauseScene } from "./scenes/PauseScene";
import { SettingsScene } from "./scenes/SettingsScene";
import "./style.css";

enableSmoothTextRendering();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: "#050815",
  pixelArt: false,
  antialias: true,
  antialiasGL: true,
  scene: [
    BootScene,
    MainMenuScene,
    CharacterSelectScene,
    OnlineLobbyScene,
    ControlsScene,
    SettingsScene,
    CreditsScene,
    ExitScene,
    FightScene,
    PauseScene,
    MatchResultsScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
  },
};

new Phaser.Game(config);
