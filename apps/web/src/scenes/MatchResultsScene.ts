import { getFighterDefinition } from "@neon-rivals/simulation";
import Phaser from "phaser";
import type { MatchResultData } from "../game/GameFlow";
import type { OnlineFightClient } from "../net/OnlineFightClient";
import { getFighterPresentation } from "../presentation/FighterPresentationConfig";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { loadSettings, type StageArt } from "../settings/GameSettings";
import { ArcadeMenu, drawArcadeBackdrop, type MenuItem } from "../ui/ArcadeUi";

interface MatchResultsSceneData extends MatchResultData {
  readonly onlineClient?: OnlineFightClient;
  readonly fightTheme?: StageArt;
}

export class MatchResultsScene extends Phaser.Scene {
  private menu!: ArcadeMenu;
  private statusText!: Phaser.GameObjects.Text;
  private onlineClient: OnlineFightClient | null = null;
  private finishedMatchNumber = 0;
  private fightTheme: StageArt = "transit";
  private handedOff = false;
  private readonly unsubscribe: Array<() => void> = [];
  private result: MatchResultData = {
    mode: "local",
    fighters: ["vesper", "nova"],
    opponent: "human",
    cpuDifficulty: "medium",
    winner: -1,
    scores: [0, 0],
    roundsPlayed: 0,
  };

  public constructor() {
    super("match-results");
  }

  public init(data: MatchResultsSceneData): void {
    this.result = data;
    this.fightTheme = data.fightTheme ?? loadSettings().stageArt;
    this.onlineClient = data.onlineClient ?? null;
    this.finishedMatchNumber = this.onlineClient?.currentMatchNumber ?? 0;
    this.handedOff = false;
    this.unsubscribe.length = 0;
  }

  public create(): void {
    configureSmoothCamera(this);
    drawArcadeBackdrop(this, "Match results");
    const winnerChoice =
      this.result.winner === -1 ? null : this.result.fighters[this.result.winner];
    const winner = winnerChoice === null ? null : getFighterDefinition(winnerChoice);
    const winnerPresentation = winnerChoice === null ? null : getFighterPresentation(winnerChoice);

    this.add
      .text(640, 142, winner ? `${winner.name.toUpperCase()} WINS` : "DRAW MATCH", {
        color: winnerPresentation
          ? `#${winnerPresentation.primary.toString(16).padStart(6, "0")}`
          : "#ffe45c",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "60px",
        fontStyle: "italic",
        stroke: "#050711",
        strokeThickness: 11,
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.add
      .text(640, 232, `${this.result.scores[0]}  —  ${this.result.scores[1]}`, {
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "68px",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.add
      .text(
        640,
        296,
        `${this.result.roundsPlayed} ROUNDS · ${this.result.mode.toUpperCase()} MATCH`,
        {
          color: "#94a4ba",
          fontFamily: "monospace",
          fontSize: "15px",
          letterSpacing: 2,
        },
      )
      .setOrigin(0.5)
      .setDepth(3);

    const onlineStatus =
      this.result.mode === "online"
        ? `ROOM ${this.onlineClient?.roomId ?? "UNAVAILABLE"} REMAINS OPEN`
        : "";
    this.statusText = this.add
      .text(640, 342, onlineStatus, {
        align: "center",
        color: "#ffe45c",
        fontFamily: "monospace",
        fontSize: "14px",
        lineSpacing: 5,
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.menu = new ArcadeMenu(this, this.createMenuItems(), 390, 390, 500);
    if (this.result.mode === "online") this.bindOnlineRoom();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribe) unsubscribe();
      this.unsubscribe.length = 0;
    });
  }

  public override update(): void {
    this.menu.update();
  }

  private createMenuItems(): MenuItem[] {
    if (this.result.mode === "online") {
      return [
        {
          label: "Request Rematch",
          detail: "SAME ROOM",
          onSelect: () => this.requestRematch(),
        },
        {
          label: "Cancel Rematch",
          detail: "WITHDRAW VOTE",
          onSelect: () => this.cancelRematch(),
        },
        {
          label: "Online Lobby",
          detail: "LEAVE ROOM",
          onSelect: () => void this.leaveFor("online-lobby"),
        },
        {
          label: "Main Menu",
          detail: "LEAVE ROOM",
          onSelect: () => void this.leaveFor("main-menu"),
        },
      ];
    }

    return [
      {
        label: "Rematch",
        detail: "SAME FIGHTERS",
        onSelect: () =>
          this.scene.start("fight", {
            mode: this.result.mode,
            fighters: this.result.fighters,
            opponent: this.result.opponent,
            cpuDifficulty: this.result.cpuDifficulty,
            fightTheme: this.fightTheme,
          }),
      },
      {
        label: "Character Select",
        detail: "NEW MATCHUP",
        onSelect: () =>
          this.scene.start("character-select", {
            mode: this.result.mode,
            opponent: this.result.opponent,
            cpuDifficulty: this.result.cpuDifficulty,
          }),
      },
      {
        label: "Main Menu",
        detail: "EXIT MATCH",
        onSelect: () => this.scene.start("main-menu"),
      },
    ];
  }

  private bindOnlineRoom(): void {
    const network = this.onlineClient;
    if (!network) {
      this.statusText.setText("ONLINE ROOM CONNECTION LOST · RETURN TO ONLINE LOBBY");
      return;
    }

    this.unsubscribe.push(
      network.onRematchStatus((status) => {
        const localIndex = network.playerIndex;
        if (localIndex === null) return;
        const remoteIndex = localIndex === 0 ? 1 : 0;
        const localVote = status.requested[localIndex];
        const remoteVote = status.requested[remoteIndex];
        this.statusText.setText(
          status.ready
            ? "REMATCH ACCEPTED · SYNCHRONIZING NEXT MATCH"
            : localVote && remoteVote
              ? "BOTH PLAYERS READY"
              : localVote
                ? "REMATCH REQUESTED · WAITING FOR OPPONENT"
                : remoteVote
                  ? "OPPONENT REQUESTS A REMATCH"
                  : "ROOM REMAINS OPEN · REQUEST A REMATCH",
        );
      }),
      network.onNextMatchReady((ready) => {
        if (this.handedOff || ready.matchNumber <= this.finishedMatchNumber) return;
        this.handedOff = true;
        this.scene.start("fight", {
          mode: "online",
          fighters: ready.fighters,
          fightTheme: ready.fightTheme,
          onlineClient: network,
        });
      }),
      network.onPeerLeft((message) => {
        this.statusText.setText(
          message.reconnecting
            ? `OPPONENT RECONNECTING · ${message.graceSeconds}s GRACE`
            : "OPPONENT LEFT · ROOM OPEN FOR A NEW CHALLENGER",
        );
      }),
      network.onConnectionStatus((status) => {
        if (status.state === "reconnecting" || status.state === "recovered") {
          this.statusText.setText(status.message.toUpperCase());
        }
      }),
    );
  }

  private requestRematch(): void {
    if (!this.onlineClient) {
      this.statusText.setText("ONLINE ROOM IS NOT AVAILABLE");
      return;
    }
    this.onlineClient.requestRematch();
    this.statusText.setText("REMATCH REQUESTED · WAITING FOR OPPONENT");
  }

  private cancelRematch(): void {
    this.onlineClient?.cancelRematch();
    this.statusText.setText("REMATCH REQUEST WITHDRAWN");
  }

  private async leaveFor(scene: "online-lobby" | "main-menu"): Promise<void> {
    await this.onlineClient?.leave();
    this.onlineClient = null;
    this.scene.start(scene);
  }
}
