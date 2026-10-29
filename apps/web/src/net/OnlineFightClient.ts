import { Client as ColyseusClient, type Room } from "@colyseus/sdk";
import {
  BASE_INPUT_DELAY_FRAMES,
  FIGHT_MESSAGE,
  FIGHT_ROOM_NAME,
  MAX_INPUT_DELAY_FRAMES,
  PROTOCOL_VERSION,
  type AuthoritativeFrameMessage,
  type FightJoinOptions,
  type FightRoomStatusMessage,
  type FightWelcomeMessage,
  type LatencyPongMessage,
  type MatchReadyMessage,
  type PeerLeftMessage,
  type PlayerInputMessage,
  type ProtocolErrorMessage,
  type RematchStatusMessage,
  type StateSnapshotMessage,
} from "@neon-rivals/protocol";
import type { FighterId } from "@neon-rivals/simulation";

export interface LatencyStats {
  readonly rttMs: number;
  readonly jitterMs: number;
  readonly inputDelayFrames: number;
}

export interface ConnectionStatus {
  readonly state: "connected" | "reconnecting" | "recovered" | "closed";
  readonly message: string;
}

interface RecoveryRecord {
  readonly endpoint: string;
  readonly roomId: string;
  readonly reconnectionToken: string;
}

type Listener<T> = (message: T) => void;

const TICK_MS = 1000 / 60;
const MAX_FRAME_BACKLOG = 240;
const RECOVERY_STORAGE_KEY = "neon-rivals.online-recovery.v1";

export function estimateInputDelayFrames(rttMs: number, jitterMs: number): number {
  const oneWayBudget = Math.max(0, rttMs) * 0.5 + Math.max(0, jitterMs) * 2;
  return Math.max(
    BASE_INPUT_DELAY_FRAMES,
    Math.min(MAX_INPUT_DELAY_FRAMES, Math.ceil(oneWayBudget / TICK_MS) + 1),
  );
}

/** Colyseus room connection plus transport-level latency and jitter estimation. */
export class OnlineFightClient {
  private readonly sdk: ColyseusClient;
  private room: Room | null = null;
  private welcome: FightWelcomeMessage | null = null;
  private matchReady: MatchReadyMessage | null = null;
  private roomStatus: FightRoomStatusMessage | null = null;
  private readonly frames: AuthoritativeFrameMessage[] = [];
  private latestSnapshot: StateSnapshotMessage | null = null;
  private readonly welcomeListeners = new Set<Listener<FightWelcomeMessage>>();
  private readonly readyListeners = new Set<Listener<MatchReadyMessage>>();
  private readonly statusListeners = new Set<Listener<FightRoomStatusMessage>>();
  private readonly frameListeners = new Set<Listener<AuthoritativeFrameMessage>>();
  private readonly snapshotListeners = new Set<Listener<StateSnapshotMessage>>();
  private readonly peerLeftListeners = new Set<Listener<PeerLeftMessage>>();
  private readonly rematchListeners = new Set<Listener<RematchStatusMessage>>();
  private readonly connectionListeners = new Set<Listener<ConnectionStatus>>();
  private readonly errorListeners = new Set<Listener<ProtocolErrorMessage>>();
  private rematchStatus: RematchStatusMessage | null = null;
  private sequence = 0;
  private pingNonce = 0;
  private pingTimer: number | null = null;
  private rttMs = 0;
  private jitterMs = 0;
  private inputDelayFrames = BASE_INPUT_DELAY_FRAMES;

  public constructor(private readonly endpoint: string) {
    this.sdk = new ColyseusClient(endpoint);
  }

  public get roomId(): string | null {
    return this.room?.roomId ?? null;
  }

  public get playerIndex(): 0 | 1 | null {
    return this.matchReady?.playerIndex ?? this.welcome?.playerIndex ?? null;
  }

  public get readyMessage(): MatchReadyMessage | null {
    return this.matchReady;
  }

  public get status(): FightRoomStatusMessage | null {
    return this.roomStatus;
  }

  public get currentMatchNumber(): number {
    return this.matchReady?.matchNumber ?? 0;
  }

  public get canRecover(): boolean {
    return this.readRecoveryRecord()?.endpoint === this.endpoint;
  }

  public get latency(): LatencyStats {
    return {
      rttMs: this.rttMs,
      jitterMs: this.jitterMs,
      inputDelayFrames: this.inputDelayFrames,
    };
  }

  public async create(fighterId: FighterId): Promise<void> {
    await this.connect("create", fighterId);
  }

  public async join(roomId: string, fighterId: FighterId): Promise<void> {
    const normalizedRoomId = roomId.trim();
    if (!normalizedRoomId) throw new Error("Enter a room code.");
    await this.connect("join", fighterId, normalizedRoomId);
  }

  public async recover(): Promise<void> {
    const recovery = this.readRecoveryRecord();
    if (!recovery || recovery.endpoint !== this.endpoint) {
      throw new Error("No recoverable online room was found.");
    }

    await this.leave(false);
    this.resetSession();
    try {
      this.room = await this.sdk.reconnect(recovery.reconnectionToken);
      this.bindRoom(this.room);
      this.persistRecovery(this.room);
      this.room.send(FIGHT_MESSAGE.syncRequest);
      this.startPinging();
      this.emit(this.connectionListeners, {
        state: "recovered",
        message: `Recovered room ${recovery.roomId}.`,
      });
    } catch (error) {
      this.clearRecovery();
      throw error;
    }
  }

  public sendInput(frame: number, buttons: number): void {
    if (!this.room) return;
    const input: PlayerInputMessage = {
      protocolVersion: PROTOCOL_VERSION,
      sequence: this.sequence,
      frame,
      buttons,
      clientTime: performance.now(),
    };
    this.sequence += 1;
    this.room.send(FIGHT_MESSAGE.input, input);
  }

  public drainFrames(): AuthoritativeFrameMessage[] {
    return this.frames.splice(0, this.frames.length);
  }

  public consumeLatestSnapshot(): StateSnapshotMessage | null {
    const snapshot = this.latestSnapshot;
    this.latestSnapshot = null;
    return snapshot;
  }

  public onWelcome(listener: Listener<FightWelcomeMessage>): () => void {
    this.welcomeListeners.add(listener);
    if (this.welcome) listener(this.welcome);
    return () => this.welcomeListeners.delete(listener);
  }

  public onMatchReady(listener: Listener<MatchReadyMessage>): () => void {
    this.readyListeners.add(listener);
    if (this.matchReady) listener(this.matchReady);
    return () => this.readyListeners.delete(listener);
  }

  public onNextMatchReady(listener: Listener<MatchReadyMessage>): () => void {
    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  public onRoomStatus(listener: Listener<FightRoomStatusMessage>): () => void {
    this.statusListeners.add(listener);
    if (this.roomStatus) listener(this.roomStatus);
    return () => this.statusListeners.delete(listener);
  }

  public onFrame(listener: Listener<AuthoritativeFrameMessage>): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  public onSnapshot(listener: Listener<StateSnapshotMessage>): () => void {
    this.snapshotListeners.add(listener);
    if (this.latestSnapshot) listener(this.latestSnapshot);
    return () => this.snapshotListeners.delete(listener);
  }

  public onPeerLeft(listener: Listener<PeerLeftMessage>): () => void {
    this.peerLeftListeners.add(listener);
    return () => this.peerLeftListeners.delete(listener);
  }

  public onRematchStatus(listener: Listener<RematchStatusMessage>): () => void {
    this.rematchListeners.add(listener);
    if (this.rematchStatus) listener(this.rematchStatus);
    return () => this.rematchListeners.delete(listener);
  }

  public onConnectionStatus(listener: Listener<ConnectionStatus>): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  public onProtocolError(listener: Listener<ProtocolErrorMessage>): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public requestRematch(): void {
    this.room?.send(FIGHT_MESSAGE.rematchRequest);
  }

  public cancelRematch(): void {
    this.room?.send(FIGHT_MESSAGE.rematchCancel);
  }

  public async leave(clearRecovery = true): Promise<void> {
    this.stopPinging();
    const room = this.room;
    this.room = null;
    if (clearRecovery) this.clearRecovery();
    if (room) await room.leave(true);
  }

  private async connect(
    method: "create" | "join",
    fighterId: FighterId,
    roomId?: string,
  ): Promise<void> {
    await this.leave();
    this.resetSession();
    const options: FightJoinOptions = { protocolVersion: PROTOCOL_VERSION, fighterId };
    this.room =
      method === "create"
        ? await this.sdk.create(FIGHT_ROOM_NAME, options)
        : await this.sdk.joinById(roomId ?? "", options);
    this.bindRoom(this.room);
    this.persistRecovery(this.room);
    this.room.send(FIGHT_MESSAGE.syncRequest);
    this.startPinging();
  }

  private bindRoom(room: Room): void {
    room.onMessage<FightWelcomeMessage>(FIGHT_MESSAGE.welcome, (message) => {
      this.welcome = message;
      this.inputDelayFrames = message.baseInputDelayFrames;
      this.emit(this.welcomeListeners, message);
    });
    room.onMessage<FightRoomStatusMessage>(FIGHT_MESSAGE.roomStatus, (message) => {
      this.roomStatus = message;
      this.emit(this.statusListeners, message);
    });
    room.onMessage<MatchReadyMessage>(FIGHT_MESSAGE.matchReady, (message) => {
      if (this.matchReady?.matchNumber !== message.matchNumber) {
        this.frames.length = 0;
        this.latestSnapshot = null;
        this.sequence = 0;
      }
      this.matchReady = message;
      this.emit(this.readyListeners, message);
    });
    room.onMessage<AuthoritativeFrameMessage>(FIGHT_MESSAGE.authoritativeFrame, (message) => {
      this.frames.push(message);
      if (this.frames.length > MAX_FRAME_BACKLOG) this.frames.shift();
      this.emit(this.frameListeners, message);
    });
    room.onMessage<StateSnapshotMessage>(FIGHT_MESSAGE.snapshot, (message) => {
      this.latestSnapshot = message;
      this.emit(this.snapshotListeners, message);
    });
    room.onMessage<LatencyPongMessage>(FIGHT_MESSAGE.latencyPong, (message) => {
      this.recordLatency(Math.max(0, performance.now() - message.clientTime));
    });
    room.onMessage<PeerLeftMessage>(FIGHT_MESSAGE.peerLeft, (message) => {
      this.emit(this.peerLeftListeners, message);
    });
    room.onMessage<RematchStatusMessage>(FIGHT_MESSAGE.rematchStatus, (message) => {
      this.rematchStatus = message;
      this.emit(this.rematchListeners, message);
    });
    room.onMessage<ProtocolErrorMessage>(FIGHT_MESSAGE.protocolError, (message) => {
      this.emit(this.errorListeners, message);
    });
    room.onDrop((_code, reason) => {
      this.emit(this.connectionListeners, {
        state: "reconnecting",
        message: reason || "Connection interrupted. Recovering room…",
      });
    });
    room.onReconnect(() => {
      this.persistRecovery(room);
      room.send(FIGHT_MESSAGE.syncRequest);
      this.emit(this.connectionListeners, {
        state: "recovered",
        message: "Room connection recovered.",
      });
    });
    room.onLeave((_code, reason) => {
      this.stopPinging();
      this.emit(this.connectionListeners, {
        state: "closed",
        message: reason || "Online room closed.",
      });
    });
    this.emit(this.connectionListeners, {
      state: "connected",
      message: `Connected to room ${room.roomId}.`,
    });
  }

  private startPinging(): void {
    this.stopPinging();
    const ping = (): void => {
      if (!this.room) return;
      this.room.send(FIGHT_MESSAGE.latencyPing, {
        nonce: this.pingNonce,
        clientTime: performance.now(),
      });
      this.pingNonce += 1;
    };
    ping();
    this.pingTimer = window.setInterval(ping, 1_000);
  }

  private stopPinging(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private recordLatency(sampleRtt: number): void {
    if (this.rttMs === 0) {
      this.rttMs = sampleRtt;
      this.jitterMs = 0;
    } else {
      const delta = Math.abs(sampleRtt - this.rttMs);
      this.rttMs = this.rttMs * 0.85 + sampleRtt * 0.15;
      this.jitterMs = this.jitterMs * 0.8 + delta * 0.2;
    }
    this.inputDelayFrames = estimateInputDelayFrames(this.rttMs, this.jitterMs);
  }

  private resetSession(): void {
    this.welcome = null;
    this.matchReady = null;
    this.roomStatus = null;
    this.frames.length = 0;
    this.latestSnapshot = null;
    this.rematchStatus = null;
    this.sequence = 0;
    this.rttMs = 0;
    this.jitterMs = 0;
    this.inputDelayFrames = BASE_INPUT_DELAY_FRAMES;
  }

  private emit<T>(listeners: ReadonlySet<Listener<T>>, message: T): void {
    for (const listener of listeners) listener(message);
  }

  private persistRecovery(room: Room): void {
    if (typeof sessionStorage === "undefined") return;
    const record: RecoveryRecord = {
      endpoint: this.endpoint,
      roomId: room.roomId,
      reconnectionToken: room.reconnectionToken,
    };
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(record));
  }

  private readRecoveryRecord(): RecoveryRecord | null {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<RecoveryRecord>;
      if (!parsed.endpoint || !parsed.roomId || !parsed.reconnectionToken) return null;
      return {
        endpoint: parsed.endpoint,
        roomId: parsed.roomId,
        reconnectionToken: parsed.reconnectionToken,
      };
    } catch {
      return null;
    }
  }

  private clearRecovery(): void {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    }
  }
}
