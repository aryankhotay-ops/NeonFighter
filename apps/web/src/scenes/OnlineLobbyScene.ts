import { FIGHTER_IDS, getFighterDefinition, type FighterId } from "@neon-rivals/simulation";
import { PROTOCOL_VERSION } from "@neon-rivals/protocol";
import Phaser from "phaser";
import { loadWebRuntimeConfig } from "../config";
import { OnlineFightClient } from "../net/OnlineFightClient";
import { getFighterPresentation } from "../presentation/FighterPresentationConfig";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { ArcadeMenu, drawArcadeBackdrop } from "../ui/ArcadeUi";

export class OnlineLobbyScene extends Phaser.Scene {
  private menu!: ArcadeMenu;
  private statusText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private fighterText!: Phaser.GameObjects.Text;
  private roomCodeText!: Phaser.GameObjects.Text;
  private network: OnlineFightClient | null = null;
  private fighterIndex = 0;
  private busy = false;
  private handedOff = false;
  private serverCandidates: readonly string[] = [];
  private serverUrl = "";
  private serverVerified = false;

  public constructor() {
    super("online-lobby");
  }

  public create(): void {
    configureSmoothCamera(this);
    const runtimeConfig = loadWebRuntimeConfig();
    this.serverCandidates = runtimeConfig.multiplayerServerCandidates;
    this.serverUrl = runtimeConfig.multiplayerServerUrl;
    this.serverVerified = false;
    this.busy = false;
    this.handedOff = false;
    drawArcadeBackdrop(this, "Private online lobby");
    this.add
      .text(640, 118, "ONLINE PLAY", {
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "46px",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.statusText = this.add
      .text(640, 177, "CHECKING SERVER…", {
        align: "center",
        color: "#ffe45c",
        fontFamily: "monospace",
        fontSize: "20px",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.detailText = this.add
      .text(640, 219, "", {
        align: "center",
        color: "#9cabc0",
        fontFamily: "monospace",
        fontSize: "13px",
        lineSpacing: 7,
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.fighterText = this.add
      .text(640, 275, "", {
        align: "center",
        color: "#51e9ff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "20px",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.roomCodeText = this.add
      .text(640, 319, "", {
        align: "center",
        color: "#ffe45c",
        fontFamily: "monospace",
        fontSize: "16px",
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.menu = new ArcadeMenu(
      this,
      [
        {
          label: "Create Private Room",
          detail: "HOST",
          onSelect: () => void this.createRoom(),
        },
        {
          label: "Join Room Code",
          detail: "CHALLENGER",
          onSelect: () => void this.joinRoom(),
        },
        {
          label: "Recover Previous Room",
          detail: "RECONNECT",
          onSelect: () => void this.recoverRoom(),
        },
        {
          label: "Change Fighter",
          detail: "ROSTER",
          onSelect: () => void this.changeFighter(),
        },
        {
          label: "Refresh Server",
          detail: "HEALTH CHECK",
          onSelect: () => void this.checkServer(),
        },
        {
          label: "Back",
          detail: "MAIN MENU",
          onSelect: () => void this.returnToMenu(),
        },
      ],
      390,
      348,
      500,
    );
    this.renderFighter();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.handedOff) void this.network?.leave();
    });
    void this.checkServer();
  }

  public override update(): void {
    if (!this.busy) this.menu.update();
  }

  private get selectedFighter(): FighterId {
    return FIGHTER_IDS[this.fighterIndex] ?? "vesper";
  }

  private async createRoom(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.statusText.setText("CREATING PRIVATE ROOM…").setColor("#ffe45c");
    try {
      await this.ensureReachableServer();
      await this.network?.leave();
      const network = new OnlineFightClient(this.serverUrl);
      this.network = network;
      await network.create(this.selectedFighter);
      this.bindNetwork(network);
      this.statusText.setText("WAITING FOR CHALLENGER").setColor("#67f28a");
      this.roomCodeText.setText(`ROOM CODE  ${network.roomId ?? "…"}`);
      this.detailText.setText("Share this room code. The match starts when a second player joins.");
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
    }
  }

  private async joinRoom(): Promise<void> {
    if (this.busy) return;
    const roomId = window.prompt("Enter the private room code:")?.trim();
    if (!roomId) return;

    this.busy = true;
    this.statusText.setText("JOINING ROOM…").setColor("#ffe45c");
    try {
      await this.ensureReachableServer();
      await this.network?.leave();
      const network = new OnlineFightClient(this.serverUrl);
      this.network = network;
      await network.join(roomId, this.selectedFighter);
      this.bindNetwork(network);
      this.statusText.setText("CONNECTED · SYNCHRONIZING").setColor("#67f28a");
      this.roomCodeText.setText(`ROOM CODE  ${network.roomId ?? roomId}`);
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
    }
  }

  private async recoverRoom(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.statusText.setText("RECOVERING PREVIOUS ROOM…").setColor("#ffe45c");
    try {
      if (this.network) throw new Error("Already connected to a room.");
      await this.ensureReachableServer();
      const network = new OnlineFightClient(this.serverUrl);
      if (!network.canRecover) throw new Error("No recoverable room token is stored.");
      this.network = network;
      await network.recover();
      this.bindNetwork(network);
      this.roomCodeText.setText(`ROOM CODE  ${network.roomId ?? "RECOVERING"}`);
      this.statusText.setText("ROOM RECOVERED · SYNCHRONIZING").setColor("#67f28a");
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
    }
  }

  private bindNetwork(network: OnlineFightClient): void {
    network.onRoomStatus((status) => {
      this.detailText.setText(
        `${status.connectedPlayers}/${status.maxPlayers} players · ${status.phase.toUpperCase()}\nLatency is handled with adaptive input delay, server input prediction, and client rollback.`,
      );
    });
    network.onMatchReady((ready) => {
      if (this.handedOff) return;
      this.handedOff = true;
      if (ready.initialState.round.phase === "matchOver") {
        const round = ready.initialState.round;
        this.scene.start("match-results", {
          mode: "online",
          fighters: ready.fighters,
          winner: round.winner ?? -1,
          scores: [round.scores[0], round.scores[1]],
          roundsPlayed: round.number,
          onlineClient: network,
        });
      } else {
        this.statusText.setText("MATCH FOUND").setColor("#ffffff");
        this.scene.start("fight", {
          mode: "online",
          fighters: ready.fighters,
          onlineClient: network,
        });
      }
    });
    network.onConnectionStatus((status) => {
      if (status.state === "reconnecting" || status.state === "recovered") {
        this.statusText.setText(status.message.toUpperCase());
      }
    });
    network.onProtocolError((error) => {
      this.statusText.setText(error.code.toUpperCase()).setColor("#ff627d");
      this.detailText.setText(error.message);
    });
  }

  private async changeFighter(): Promise<void> {
    if (this.busy) return;
    await this.network?.leave();
    this.network = null;
    this.roomCodeText.setText("");
    this.fighterIndex = (this.fighterIndex + 1) % FIGHTER_IDS.length;
    this.renderFighter();
  }

  private renderFighter(): void {
    const fighter = getFighterDefinition(this.selectedFighter);
    const presentation = getFighterPresentation(this.selectedFighter);
    this.fighterText
      .setText(
        `${fighter.name.toUpperCase()} · ${fighter.fightingStyle}\nSUPER ART  ${fighter.moves.super.label}`,
      )
      .setColor(`#${presentation.primary.toString(16).padStart(6, "0")}`);
  }

  private async checkServer(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.statusText.setText("CHECKING SERVER…").setColor("#ffe45c");
    try {
      const info = await this.selectReachableServer();
      this.statusText.setText(info.status === "ok" ? "SERVER ONLINE" : "SERVER RESPONDED");
      this.statusText.setColor("#67f28a");
      this.detailText.setText(
        `Protocol ${info.protocolVersion} · room ${info.roomType}\nCreate a private room or join with a shared code.`,
      );
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
    }
  }

  private async ensureReachableServer(): Promise<void> {
    if (this.serverVerified) return;
    await this.selectReachableServer();
  }

  private async selectReachableServer(): Promise<{
    status: string;
    protocolVersion: number;
    roomType: string;
  }> {
    const errors: string[] = [];
    for (const candidate of this.serverCandidates) {
      try {
        const info = await this.probeServer(candidate);
        this.serverUrl = candidate;
        this.serverVerified = true;
        return info;
      } catch (error) {
        errors.push(`${candidate}: ${error instanceof Error ? error.message : "unreachable"}`);
      }
    }
    this.serverVerified = false;
    throw new Error(`No multiplayer server responded.\n${errors.join("\n")}`);
  }

  private async probeServer(serverUrl: string): Promise<{
    status: string;
    protocolVersion: number;
    roomType: string;
  }> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2_500);
    try {
      const response = await fetch(`${serverUrl}/health`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("health endpoint returned a non-JSON page");
      }
      const info = (await response.json()) as {
        status?: string;
        protocolVersion?: number;
        roomType?: string;
      };
      if (info.protocolVersion !== PROTOCOL_VERSION) {
        throw new Error(`protocol ${info.protocolVersion ?? "unknown"} is incompatible`);
      }
      if (info.status !== "ok" || !info.roomType) {
        throw new Error("health response is incomplete");
      }
      return {
        status: info.status,
        protocolVersion: info.protocolVersion,
        roomType: info.roomType,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async returnToMenu(): Promise<void> {
    await this.network?.leave();
    this.network = null;
    this.scene.start("main-menu");
  }

  private showError(error: unknown): void {
    this.statusText.setText("CONNECTION ERROR").setColor("#ff627d");
    this.detailText.setText(
      `The Online Play screen is available, but its multiplayer server is not reachable.\nStart it with pnpm dev:server or set VITE_SERVER_URL and rebuild.\n${error instanceof Error ? error.message : "Connection failed"}`,
    );
  }
}
