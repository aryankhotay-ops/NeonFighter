import {
  MAX_METER,
  SIMULATION_STEP_MS,
  Simulation,
  checksumState,
  formatChecksum,
  getFighterDefinition,
  toPixels,
  type FighterState,
} from "@neon-rivals/simulation";
import { createDeterminismFixture, runReplay } from "@neon-rivals/test-tools";
import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { CpuController } from "../game/CpuController";
import {
  DEFAULT_MATCH_SETUP,
  cpuDifficultyLabel,
  normalizeMatchSetup,
  type MatchSetup,
} from "../game/GameFlow";
import { shouldPauseSimulation } from "../game/PausePolicy";
import { InputSource } from "../input/InputSource";
import type { OnlineFightClient } from "../net/OnlineFightClient";
import { OnlineRollbackController } from "../net/OnlineRollbackController";
import { CombatEffects } from "../presentation/CombatEffects";
import { FighterView } from "../presentation/FighterView";
import { getFighterPresentation } from "../presentation/FighterPresentationConfig";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { StageView } from "../presentation/StageView";
import {
  loadSettings,
  stageArtLabel,
  type GameSettings,
  type StageArt,
} from "../settings/GameSettings";

interface FightSceneData extends Partial<MatchSetup> {
  readonly onlineClient?: OnlineFightClient;
  readonly fightTheme?: StageArt;
}

export class FightScene extends Phaser.Scene {
  private readonly simulation = new Simulation();
  private readonly fighterView = new FighterView();
  private readonly effects = new CombatEffects();
  private readonly audio = new AudioManager();
  private settings: GameSettings = loadSettings();
  private fightTheme: StageArt = "transit";
  private matchSetup: MatchSetup = DEFAULT_MATCH_SETUP;
  private onlineClient: OnlineFightClient | null = null;
  private rollback: OnlineRollbackController | null = null;
  private cpuController: CpuController | null = null;
  private readonly onlineUnsubscribe: Array<() => void> = [];
  private inputSource!: InputSource;
  private stageView!: StageView;
  private fighterLayer!: Phaser.GameObjects.Graphics;
  private effectLayer!: Phaser.GameObjects.Graphics;
  private hudBaseLayer!: Phaser.GameObjects.Graphics;
  private hudValueLayer!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private stageTitleText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private announcementText!: Phaser.GameObjects.Text;
  private p1StateText!: Phaser.GameObjects.Text;
  private p2StateText!: Phaser.GameObjects.Text;
  private networkText!: Phaser.GameObjects.Text;
  private peerText!: Phaser.GameObjects.Text;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private accumulatorMs = 0;
  private resultsScheduled = false;
  private pauseMenuOpen = false;
  private renderedFighterPositions: [
    { x: number; feetY: number } | null,
    { x: number; feetY: number } | null,
  ] = [null, null];

  public constructor() {
    super("fight");
  }

  public init(data: FightSceneData): void {
    this.settings = loadSettings();
    this.fightTheme = data.fightTheme ?? this.settings.stageArt;
    this.matchSetup = normalizeMatchSetup(data);
    this.onlineClient = data.onlineClient ?? null;
    this.rollback = null;
    this.cpuController =
      this.matchSetup.mode !== "online" && this.matchSetup.opponent === "cpu"
        ? new CpuController(this.matchSetup.cpuDifficulty, 1)
        : null;
    this.onlineUnsubscribe.length = 0;
    this.simulation.resetMatch(this.matchSetup.fighters);
    this.effects.reset();
    this.audio.resetEventCursor();
    this.accumulatorMs = 0;
    this.resultsScheduled = false;
    this.pauseMenuOpen = false;
    this.renderedFighterPositions = [null, null];
  }

  public create(): void {
    configureSmoothCamera(this);
    this.inputSource = new InputSource(this);
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is unavailable.");
    this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.stageView = new StageView(this, this.fightTheme);
    this.fighterLayer = this.add.graphics().setDepth(2);
    this.effectLayer = this.add.graphics().setDepth(3);
    this.hudBaseLayer = this.add.graphics().setDepth(4);
    this.hudValueLayer = this.add.graphics().setDepth(5);
    this.drawHudBase();
    this.audio.bindUnlock(this.game.canvas);
    this.configureOnlineMatch();

    this.add
      .text(44, 24, "NEON RIVALS", {
        color: "#f6f8ff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "28px",
        fontStyle: "italic",
      })
      .setDepth(6);

    this.stageTitleText = this.add
      .text(46, 58, `${stageArtLabel(this.fightTheme)} · ORIGINAL COMBAT PRESENTATION`, {
        color: "#79eaff",
        fontFamily: "monospace",
        fontSize: "11px",
        letterSpacing: 2,
      })
      .setDepth(6);

    const pauseButton = this.add
      .rectangle(640, 31, 126, 34, 0x071423, 0.92)
      .setStrokeStyle(2, 0x65eaff, 0.85)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });
    const pauseLabel = this.add
      .text(640, 31, this.matchSetup.mode === "online" ? "Ⅱ  MENU" : "Ⅱ  PAUSE", {
        align: "center",
        color: "#f5f8ff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "13px",
      })
      .setOrigin(0.5)
      .setDepth(8);
    pauseButton.on("pointerover", () => {
      pauseButton.setFillStyle(0x173652, 1);
      pauseLabel.setColor("#ffe45c");
    });
    pauseButton.on("pointerout", () => {
      pauseButton.setFillStyle(0x071423, 0.92);
      pauseLabel.setColor("#f5f8ff");
    });
    pauseButton.on("pointerdown", () => this.openPauseMenu());

    this.add
      .text(34, 676, "P1  WASD · F GUARD · G HEAVY · H SPECIAL · G+H SUPER", {
        color: "#b9c5d8",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setDepth(6);

    this.add
      .text(
        1246,
        676,
        this.cpuController
          ? `CPU ${cpuDifficultyLabel(this.matchSetup.cpuDifficulty)} · COMPUTER CONTROLLED`
          : "P2  ARROWS · J GUARD · K HEAVY · L SPECIAL · K+L SUPER",
        {
          align: "right",
          color: "#b9c5d8",
          fontFamily: "monospace",
          fontSize: "13px",
        },
      )
      .setOrigin(1, 0)
      .setDepth(6);

    this.add
      .text(
        640,
        638,
        "HOLD GUARD TO BLOCK · GUARD + DOWN BLOCKS LOW · TAP TOWARD / DOWN TO PARRY",
        {
          align: "center",
          color: "#ffd85a",
          fontFamily: "monospace",
          fontSize: "13px",
        },
      )
      .setOrigin(0.5, 0)
      .setDepth(6);

    const fixture = runReplay(createDeterminismFixture(10_000));
    this.add
      .text(1236, 28, `10K REPLAY  ${formatChecksum(fixture.checksum)}`, {
        align: "right",
        color: "#8fffb2",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setOrigin(1, 0)
      .setDepth(6);

    this.statusText = this.add
      .text(1236, 49, "", {
        align: "right",
        color: "#8392aa",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setOrigin(1, 0)
      .setDepth(6);

    this.timerText = this.add
      .text(640, 78, "99", {
        align: "center",
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "34px",
      })
      .setOrigin(0.5, 0)
      .setDepth(7);

    this.announcementText = this.add
      .text(640, 280, "", {
        align: "center",
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        fontStyle: "italic",
        stroke: "#050711",
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(7);

    this.p1StateText = this.add
      .text(56, 145, "", {
        color: "#7ceeff",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(6);
    this.p2StateText = this.add
      .text(1224, 145, "", {
        align: "right",
        color: "#ff8fc8",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setOrigin(1, 0)
      .setDepth(6);

    this.networkText = this.add
      .text(1236, 185, "", {
        align: "right",
        color: "#67f28a",
        fontFamily: "monospace",
        fontSize: "11px",
        lineSpacing: 3,
      })
      .setOrigin(1, 0)
      .setDepth(6)
      .setVisible(this.matchSetup.mode === "online");
    this.peerText = this.add
      .text(640, 220, "", {
        align: "center",
        color: "#ffcf54",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "22px",
        stroke: "#050711",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(8);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.rollback?.dispose();
      this.rollback = null;
      for (const unsubscribe of this.onlineUnsubscribe) unsubscribe();
      this.onlineUnsubscribe.length = 0;
    });

    this.drawScene();
  }

  public override update(time: number, delta: number): void {
    if (!this.pauseMenuOpen && Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.openPauseMenu();
      return;
    }

    this.accumulatorMs += Math.min(delta, 250);
    while (this.accumulatorMs >= SIMULATION_STEP_MS) {
      if (this.rollback) {
        this.rollback.advance(this.pauseMenuOpen ? 0 : this.inputSource.captureButtons(0));
      } else {
        const frame = this.simulation.state.frame;
        const localInput = this.inputSource.capture(frame);
        const secondPlayerButtons = this.cpuController
          ? this.cpuController.capture(this.simulation.state)
          : localInput.players[1];
        this.simulation.step({
          frame,
          players: [localInput.players[0], secondPlayerButtons],
        });
      }
      this.accumulatorMs -= SIMULATION_STEP_MS;
    }

    const colors: [number, number] = [
      this.presentationForPlayer(0).primary,
      this.presentationForPlayer(1).primary,
    ];
    this.effects.sync(this.simulation.state, colors);
    this.audio.update(time, this.simulation.state.round.phase, this.simulation.state.lastEvent);
    const shake = this.effects.consumeShake();
    if (shake > 0 && this.settings.screenShake) {
      this.cameras.main.shake(90, shake / 2500, true);
    }
    this.drawScene();

    if (this.simulation.state.round.phase === "matchOver" && !this.resultsScheduled) {
      this.resultsScheduled = true;
      this.time.delayedCall(1100, () => {
        const round = this.simulation.state.round;
        this.scene.stop("pause-menu");
        this.scene.start("match-results", {
          ...this.matchSetup,
          fightTheme: this.fightTheme,
          winner: round.winner ?? -1,
          scores: [round.scores[0], round.scores[1]],
          roundsPlayed: round.number,
          onlineClient: this.onlineClient ?? undefined,
        });
      });
    }
  }

  private drawScene(): void {
    const state = this.simulation.state;
    this.stageView.drawMotion(state.frame);

    this.fighterLayer.clear();
    this.drawFighter(0);
    this.drawFighter(1);

    this.effectLayer.clear();
    this.effects.draw(this.effectLayer, state.frame, this.settings.reducedFlash);

    this.drawHudValues();
    this.updateText();
  }

  private drawHudBase(): void {
    const graphics = this.hudBaseLayer;
    const healthWidth = 440;
    const barY = 88;
    graphics.fillStyle(0x03050b, 0.9);
    graphics.fillRect(48, barY, healthWidth, 30);
    graphics.fillRect(792, barY, healthWidth, 30);
    graphics.fillStyle(0x50172c, 1);
    graphics.fillRect(54, barY + 6, healthWidth - 12, 18);
    graphics.fillRect(798, barY + 6, healthWidth - 12, 18);
    graphics.fillStyle(0x03050b, 0.88);
    graphics.fillRect(48, 123, 310, 13);
    graphics.fillRect(922, 123, 310, 13);
    graphics.fillStyle(0x050711, 0.95);
    graphics.fillCircle(640, 102, 45);
    graphics.lineStyle(2, 0xffd85a, 0.9);
    graphics.strokeCircle(640, 102, 42);
  }

  private drawHudValues(): void {
    const graphics = this.hudValueLayer;
    const [p1, p2] = this.simulation.state.fighters;
    const healthWidth = 428;
    const barY = 94;
    graphics.clear();

    graphics.fillStyle(p1.health < p1.maxHealth * 0.25 ? 0xff3e55 : 0x67f28a, 1);
    graphics.fillRect(54, barY, (healthWidth * p1.health) / p1.maxHealth, 18);
    const p2HealthWidth = (healthWidth * p2.health) / p2.maxHealth;
    graphics.fillStyle(p2.health < p2.maxHealth * 0.25 ? 0xff3e55 : 0x67f28a, 1);
    graphics.fillRect(1226 - p2HealthWidth, barY, p2HealthWidth, 18);

    graphics.fillStyle(this.presentationForPlayer(0).primary, 1);
    graphics.fillRect(50, 125, (306 * p1.meter) / MAX_METER, 9);
    const p2MeterWidth = (306 * p2.meter) / MAX_METER;
    graphics.fillStyle(this.presentationForPlayer(1).primary, 1);
    graphics.fillRect(1230 - p2MeterWidth, 125, p2MeterWidth, 9);

    const scores = this.simulation.state.round.scores;
    for (let index = 0; index < 2; index += 1) {
      graphics.fillStyle(index < scores[0] ? 0xffd85a : 0x344057, 1);
      graphics.fillCircle(70 + index * 22, 151, 7);
      graphics.fillStyle(index < scores[1] ? 0xffd85a : 0x344057, 1);
      graphics.fillCircle(1210 - index * 22, 151, 7);
    }
  }

  private updateText(): void {
    const state = this.simulation.state;
    const [p1, p2] = state.fighters;
    const seconds = Math.ceil(state.round.timerFrames / 60);
    const checksum = formatChecksum(checksumState(state));
    this.statusText.setText(`FRAME ${state.frame.toString().padStart(6, "0")}  ${checksum}`);
    this.timerText.setText(String(seconds).padStart(2, "0"));
    this.timerText.setColor(seconds <= 10 ? "#ff526f" : "#ffffff");

    this.p1StateText.setText(this.fighterLabel(p1));
    this.p2StateText.setText(this.fighterLabel(p2));
    this.p1StateText.setColor(
      `#${this.presentationForPlayer(0).primary.toString(16).padStart(6, "0")}`,
    );
    this.p2StateText.setColor(
      `#${this.presentationForPlayer(1).primary.toString(16).padStart(6, "0")}`,
    );
    if (this.rollback && this.onlineClient) {
      const latency = this.onlineClient.latency;
      const reconciliation = this.rollback.stats;
      this.networkText.setText(
        `ONLINE · ${Math.round(latency.rttMs)}ms RTT · ${Math.round(latency.jitterMs)}ms JITTER\nDELAY ${latency.inputDelayFrames}f · ROLLBACK ${reconciliation.rollbacks} · FIX ${reconciliation.snapshotCorrections}`,
      );
    }

    if (state.round.phase === "intro") {
      this.announcementText.setText(`ROUND ${state.round.number}\nREADY`);
      this.announcementText.setColor("#ffffff");
    } else if (state.round.phase === "roundOver") {
      const result =
        state.round.reason === "time" ? "TIME" : state.round.reason === "draw" ? "DRAW" : "K.O.";
      const winner =
        state.round.winner === -1
          ? ""
          : `\n${getFighterDefinition(this.matchSetup.fighters[state.round.winner ?? 0]).name.toUpperCase()} WINS`;
      this.announcementText.setText(`${result}${winner}`);
      this.announcementText.setColor("#ffd85a");
    } else if (state.round.phase === "matchOver") {
      const winner =
        state.round.winner === -1
          ? "DRAW MATCH"
          : `${getFighterDefinition(this.matchSetup.fighters[state.round.winner ?? 0]).name.toUpperCase()} WINS`;
      this.announcementText.setText(`${winner}\nMATCH COMPLETE`);
      this.announcementText.setColor("#ffd85a");
    } else {
      this.announcementText.setText(seconds <= 10 ? String(seconds) : "");
      this.announcementText.setColor(seconds <= 10 ? "#ff526f" : "#ffffff");
    }
  }

  private fighterLabel(fighter: FighterState): string {
    const definition = getFighterDefinition(fighter.fighterId);
    const move = fighter.attack ? ` · ${definition.moves[fighter.attack].label}` : "";
    const combo = fighter.comboCount > 1 ? `\n${fighter.comboCount} HIT CHAIN` : "";
    return `${definition.name.toUpperCase()} · ${definition.fightingStyle}\n${fighter.action.toUpperCase()}${move}${combo}`;
  }

  private presentationForPlayer(player: 0 | 1) {
    return getFighterPresentation(this.matchSetup.fighters[player]);
  }

  /** Smooth only the remote online fighter; the local fighter stays immediate and responsive. */
  private drawFighter(player: 0 | 1): void {
    const fighter = this.simulation.state.fighters[player];
    const target = { x: toPixels(fighter.x), feetY: toPixels(fighter.y) };
    const localOnlinePlayer = this.onlineClient?.playerIndex;
    const shouldSmooth =
      this.rollback !== null && localOnlinePlayer !== null && localOnlinePlayer !== player;

    if (!shouldSmooth) {
      this.renderedFighterPositions[player] = target;
      this.fighterView.draw(this.fighterLayer, fighter, this.presentationForPlayer(player), target);
      return;
    }

    const previous = this.renderedFighterPositions[player] ?? target;
    const correctionDistance = Math.hypot(target.x - previous.x, target.feetY - previous.feetY);
    const renderPosition =
      correctionDistance > 180
        ? target
        : {
            x: Phaser.Math.Linear(previous.x, target.x, 0.42),
            feetY: Phaser.Math.Linear(previous.feetY, target.feetY, 0.42),
          };
    this.renderedFighterPositions[player] = renderPosition;
    this.fighterView.draw(
      this.fighterLayer,
      fighter,
      this.presentationForPlayer(player),
      renderPosition,
    );
  }

  public resumeFromPauseMenu(): void {
    this.pauseMenuOpen = false;
    this.accumulatorMs = 0;
    this.refreshFightSettings();
    if (shouldPauseSimulation(this.matchSetup.mode)) this.scene.resume("fight");
  }

  public refreshFightSettings(): void {
    this.settings = loadSettings();
    this.fightTheme = this.settings.stageArt;
    this.stageView.setStageArt(this.fightTheme);
    this.stageTitleText.setText(`${stageArtLabel(this.fightTheme)} · ORIGINAL COMBAT PRESENTATION`);
    this.audio.unlock();
  }

  private openPauseMenu(): void {
    if (this.pauseMenuOpen || this.resultsScheduled) return;
    this.pauseMenuOpen = true;
    this.inputSource.clearBufferedActions();
    this.scene.launch("pause-menu", {
      ...this.matchSetup,
      fightTheme: this.fightTheme,
      ...(this.onlineClient ? { onlineClient: this.onlineClient } : {}),
    });
    if (shouldPauseSimulation(this.matchSetup.mode)) this.scene.pause("fight");
  }

  private configureOnlineMatch(): void {
    if (this.matchSetup.mode !== "online") return;
    const ready = this.onlineClient?.readyMessage;
    const playerIndex = this.onlineClient?.playerIndex;
    if (!this.onlineClient || !ready || playerIndex === null || playerIndex === undefined) {
      this.time.delayedCall(0, () => this.scene.start("online-lobby"));
      return;
    }

    this.rollback = new OnlineRollbackController(
      this.simulation,
      this.onlineClient,
      playerIndex,
      ready.initialState,
    );
    this.onlineUnsubscribe.push(
      this.onlineClient.onPeerLeft((message) => {
        this.peerText?.setText(
          message.reconnecting
            ? `OPPONENT RECONNECTING · ${message.graceSeconds}s GRACE`
            : "OPPONENT LEFT THE ROOM",
        );
      }),
      this.onlineClient.onRoomStatus((status) => {
        if (status.connectedPlayers === 2) this.peerText?.setText("");
      }),
      this.onlineClient.onProtocolError((error) => {
        this.peerText?.setText(`${error.code.toUpperCase()} · ${error.message}`);
      }),
    );
  }
}
