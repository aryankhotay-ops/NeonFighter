import { Room, ServerError, type Client } from "@colyseus/core";
import {
  BASE_INPUT_DELAY_FRAMES,
  FIGHT_MESSAGE,
  FIGHT_ROOM_NAME,
  NETWORK_TICK_RATE,
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_FRAMES,
  type AuthoritativeFrameMessage,
  type FightJoinOptions,
  type FightRoomStatusMessage,
  type FightWelcomeMessage,
  type LatencyPingMessage,
  type LatencyPongMessage,
  type MatchReadyMessage,
  type PeerLeftMessage,
  type PlayerInputMessage,
  type ProtocolErrorMessage,
  type RematchStatusMessage,
  type StateSnapshotMessage,
} from "@neon-rivals/protocol";
import {
  FIGHTER_IDS,
  Simulation,
  checksumState,
  cloneGameState,
  type FighterId,
} from "@neon-rivals/simulation";
import { InputQueue, type PlayerIndex } from "../net/InputQueue";
import { logError, logInfo, logWarn } from "../logger";
import { RematchVotes } from "../net/RematchVotes";

interface PlayerSlot {
  readonly index: PlayerIndex;
  fighterId: FighterId;
}

interface FightRoomOptions {
  readonly maxMessagesPerSecond?: number;
}

const RECONNECT_GRACE_SECONDS = 10;

export class FightRoom extends Room {
  public override maxClients = 2;
  private readonly simulation = new Simulation();
  private readonly inputQueue = new InputQueue();
  private readonly rematchVotes = new RematchVotes();
  private readonly players = new Map<string, PlayerSlot>();
  private readonly recoveringPlayers = new Set<PlayerIndex>();
  private phase: FightRoomStatusMessage["phase"] = "waiting";
  private running = false;
  private matchNumber = 1;
  private hasStartedMatch = false;

  public override onCreate(options: FightRoomOptions): void {
    this.maxMessagesPerSecond = options.maxMessagesPerSecond ?? 180;
    logInfo("room.created", { roomId: this.roomId, roomType: FIGHT_ROOM_NAME });
    this.onMessage<PlayerInputMessage>(FIGHT_MESSAGE.input, (client, message) => {
      this.receiveInput(client, message);
    });
    this.onMessage<LatencyPingMessage>(FIGHT_MESSAGE.latencyPing, (client, message) => {
      const response: LatencyPongMessage = {
        nonce: message.nonce,
        clientTime: message.clientTime,
        serverTime: Date.now(),
      };
      client.send(FIGHT_MESSAGE.latencyPong, response);
    });
    this.onMessage(FIGHT_MESSAGE.syncRequest, (client) => this.sendCurrentSession(client));
    this.onMessage(FIGHT_MESSAGE.rematchRequest, (client) => this.receiveRematchVote(client, true));
    this.onMessage(FIGHT_MESSAGE.rematchCancel, (client) => this.receiveRematchVote(client, false));
    this.setFixedTimestep(() => this.fixedStep(), NETWORK_TICK_RATE);
  }

  public override onAuth(_client: Client, options: FightJoinOptions): boolean {
    if (options?.protocolVersion !== PROTOCOL_VERSION) {
      throw new ServerError(4001, `Protocol ${PROTOCOL_VERSION} required.`);
    }
    if (!FIGHTER_IDS.includes(options.fighterId)) {
      throw new ServerError(4002, "Unknown fighter selection.");
    }
    return true;
  }

  public override onJoin(client: Client, options: FightJoinOptions): void {
    const index = this.nextAvailableIndex();
    if (index === null) throw new ServerError(4003, "Fight room is full.");

    this.players.set(client.sessionId, { index, fighterId: options.fighterId });
    logInfo("room.player_joined", {
      roomId: this.roomId,
      playerIndex: index,
      fighterId: options.fighterId,
      connectedPlayers: this.players.size,
    });
    const welcome: FightWelcomeMessage = {
      protocolVersion: PROTOCOL_VERSION,
      roomId: this.roomId,
      playerIndex: index,
      tickRate: NETWORK_TICK_RATE,
      baseInputDelayFrames: BASE_INPUT_DELAY_FRAMES,
    };
    client.send(FIGHT_MESSAGE.welcome, welcome);
    this.broadcastRoomStatus();

    if (this.players.size === 2) {
      if (this.hasStartedMatch) this.matchNumber += 1;
      this.startMatch();
    }
  }

  public override async onDrop(client: Client): Promise<void> {
    const slot = this.players.get(client.sessionId);
    if (!slot) return;
    this.recoveringPlayers.add(slot.index);
    logWarn("room.player_dropped", { roomId: this.roomId, playerIndex: slot.index });
    this.running = false;
    const left: PeerLeftMessage = {
      playerIndex: slot.index,
      reconnecting: true,
      graceSeconds: RECONNECT_GRACE_SECONDS,
    };
    this.broadcast(FIGHT_MESSAGE.peerLeft, left, { except: client });
    this.broadcastRoomStatus();

    try {
      await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
      this.recoveringPlayers.delete(slot.index);
      this.running =
        this.players.size === 2 && this.recoveringPlayers.size === 0 && this.phase === "running";
      this.sendCurrentSession(client);
      this.broadcastRoomStatus();
      logInfo("room.player_recovered", { roomId: this.roomId, playerIndex: slot.index });
    } catch {
      this.removePlayer(client.sessionId, false);
    }
  }

  public override onLeave(client: Client): void {
    this.removePlayer(client.sessionId, false);
  }

  public override onReconnect(client: Client): void {
    const slot = this.players.get(client.sessionId);
    if (slot) this.recoveringPlayers.delete(slot.index);
    this.running =
      this.players.size === 2 && this.recoveringPlayers.size === 0 && this.phase === "running";
    this.sendCurrentSession(client);
    if (slot) logInfo("room.player_reconnected", { roomId: this.roomId, playerIndex: slot.index });
  }

  public override onDispose(): void {
    logInfo("room.disposed", { roomId: this.roomId, matchNumber: this.matchNumber });
  }

  public override onUncaughtException(error: Error, methodName: string): void {
    logError("room.uncaught_exception", error, { roomId: this.roomId, methodName });
  }

  private fixedStep(): void {
    if (!this.running || this.phase !== "running") return;

    const frame = this.simulation.state.frame;
    const consumed = this.inputQueue.consume(frame);
    this.simulation.step({ frame, players: consumed.inputs });

    const authoritative: AuthoritativeFrameMessage = {
      frame,
      inputs: consumed.inputs,
      predictedMask: consumed.predictedMask,
      checksum: checksumState(this.simulation.state),
      serverTime: Date.now(),
    };
    this.broadcast(FIGHT_MESSAGE.authoritativeFrame, authoritative);

    if (this.simulation.state.frame % SNAPSHOT_INTERVAL_FRAMES === 0) {
      this.broadcastSnapshot();
    }
    if (this.simulation.state.round.phase === "matchOver") {
      this.phase = "finished";
      this.running = false;
      logInfo("room.match_finished", {
        roomId: this.roomId,
        matchNumber: this.matchNumber,
        scores: this.simulation.state.round.scores,
        winner: this.simulation.state.round.winner,
      });
      this.rematchVotes.reset(this.matchNumber);
      this.broadcastSnapshot();
      this.broadcastRematchStatus();
      this.broadcastRoomStatus();
    }
  }

  private startMatch(): void {
    const first = this.slotAt(0);
    const second = this.slotAt(1);
    if (!first || !second) return;

    const fighters: [FighterId, FighterId] = [first.fighterId, second.fighterId];
    this.simulation.resetMatch(fighters);
    this.inputQueue.reset();
    this.rematchVotes.reset(this.matchNumber);
    this.phase = "running";
    this.running = true;
    this.hasStartedMatch = true;
    void this.lock();
    logInfo("room.match_started", {
      roomId: this.roomId,
      matchNumber: this.matchNumber,
      fighters,
    });

    for (const client of this.clients) {
      const slot = this.players.get(client.sessionId);
      if (!slot) continue;
      const ready: MatchReadyMessage = {
        matchNumber: this.matchNumber,
        fighters,
        playerIndex: slot.index,
        initialState: cloneGameState(this.simulation.state),
        serverTime: Date.now(),
      };
      client.send(FIGHT_MESSAGE.matchReady, ready);
    }
    this.broadcastRematchStatus();
    this.broadcastRoomStatus();
  }

  private sendCurrentSession(client: Client): void {
    const slot = this.players.get(client.sessionId);
    if (!slot) return;
    const welcome: FightWelcomeMessage = {
      protocolVersion: PROTOCOL_VERSION,
      roomId: this.roomId,
      playerIndex: slot.index,
      tickRate: NETWORK_TICK_RATE,
      baseInputDelayFrames: BASE_INPUT_DELAY_FRAMES,
    };
    client.send(FIGHT_MESSAGE.welcome, welcome);
    const first = this.slotAt(0);
    const second = this.slotAt(1);
    if (first && second && this.phase !== "waiting") {
      const ready: MatchReadyMessage = {
        matchNumber: this.matchNumber,
        fighters: [first.fighterId, second.fighterId],
        playerIndex: slot.index,
        initialState: cloneGameState(this.simulation.state),
        serverTime: Date.now(),
      };
      client.send(FIGHT_MESSAGE.matchReady, ready);
      this.sendSnapshot(client);
    }
    client.send(FIGHT_MESSAGE.rematchStatus, this.rematchVotes.status(this.matchNumber));
    this.broadcastRoomStatus();
  }

  private receiveRematchVote(client: Client, requested: boolean): void {
    const slot = this.players.get(client.sessionId);
    if (!slot || this.phase !== "finished" || this.recoveringPlayers.size > 0) return;

    const status = requested
      ? this.rematchVotes.request(slot.index, this.matchNumber)
      : this.rematchVotes.cancel(slot.index, this.matchNumber);
    this.broadcast(FIGHT_MESSAGE.rematchStatus, status);

    if (status.ready && this.players.size === 2) {
      logInfo("room.rematch_accepted", { roomId: this.roomId, matchNumber: this.matchNumber });
      this.matchNumber += 1;
      this.startMatch();
    }
  }

  private receiveInput(client: Client, message: PlayerInputMessage): void {
    const slot = this.players.get(client.sessionId);
    if (!slot || message.protocolVersion !== PROTOCOL_VERSION || this.phase !== "running") return;

    const rejection = this.inputQueue.submit(slot.index, message, this.simulation.state.frame);
    if (!rejection || rejection === "stale-sequence") return;

    const code: ProtocolErrorMessage["code"] =
      rejection === "late-input"
        ? "late-input"
        : rejection === "future-input"
          ? "future-input"
          : "invalid-input";
    const error: ProtocolErrorMessage = {
      code,
      message: `Input frame ${message.frame} rejected at server frame ${this.simulation.state.frame}.`,
    };
    client.send(FIGHT_MESSAGE.protocolError, error);
  }

  private broadcastSnapshot(): void {
    const snapshot: StateSnapshotMessage = {
      frame: this.simulation.state.frame,
      state: cloneGameState(this.simulation.state),
      checksum: checksumState(this.simulation.state),
      serverTime: Date.now(),
    };
    this.broadcast(FIGHT_MESSAGE.snapshot, snapshot);
  }

  private sendSnapshot(client: Client): void {
    const snapshot: StateSnapshotMessage = {
      frame: this.simulation.state.frame,
      state: cloneGameState(this.simulation.state),
      checksum: checksumState(this.simulation.state),
      serverTime: Date.now(),
    };
    client.send(FIGHT_MESSAGE.snapshot, snapshot);
  }

  private broadcastRoomStatus(): void {
    const status: FightRoomStatusMessage = {
      roomId: this.roomId,
      connectedPlayers: this.clients.length,
      maxPlayers: 2,
      phase: this.recoveringPlayers.size > 0 ? "recovering" : this.phase,
    };
    this.broadcast(FIGHT_MESSAGE.roomStatus, status);
  }

  private broadcastRematchStatus(): void {
    const status: RematchStatusMessage = this.rematchVotes.status(this.matchNumber);
    this.broadcast(FIGHT_MESSAGE.rematchStatus, status);
  }

  private removePlayer(sessionId: string, reconnecting: boolean): void {
    const slot = this.players.get(sessionId);
    if (!slot) return;
    this.players.delete(sessionId);
    this.recoveringPlayers.delete(slot.index);
    this.running = false;
    this.phase = "waiting";
    this.inputQueue.reset();
    this.rematchVotes.reset(this.matchNumber);
    void this.unlock();
    logInfo("room.player_left", {
      roomId: this.roomId,
      playerIndex: slot.index,
      connectedPlayers: this.players.size,
    });
    const left: PeerLeftMessage = {
      playerIndex: slot.index,
      reconnecting,
      graceSeconds: 0,
    };
    this.broadcast(FIGHT_MESSAGE.peerLeft, left);
    this.broadcastRoomStatus();
  }

  private nextAvailableIndex(): PlayerIndex | null {
    const used = new Set([...this.players.values()].map((slot) => slot.index));
    if (!used.has(0)) return 0;
    if (!used.has(1)) return 1;
    return null;
  }

  private slotAt(index: PlayerIndex): PlayerSlot | undefined {
    return [...this.players.values()].find((slot) => slot.index === index);
  }
}

export { FIGHT_ROOM_NAME };
