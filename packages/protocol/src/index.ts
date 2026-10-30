import type { FighterId, GameState } from "@neon-rivals/simulation";

// v3 changes input bit 4 from Light to Guard and moves the internal Light bit to bit 7.
export const PROTOCOL_VERSION = 3;
export const FIGHT_ROOM_NAME = "fight";
export const NETWORK_TICK_RATE = 60;
export const BASE_INPUT_DELAY_FRAMES = 2;
export const MAX_INPUT_DELAY_FRAMES = 6;
export const SNAPSHOT_INTERVAL_FRAMES = 10;
export const INPUT_FUTURE_WINDOW_FRAMES = 20;
export const INPUT_PAST_WINDOW_FRAMES = 3;

export const FIGHT_MESSAGE = {
  welcome: "fight:welcome",
  roomStatus: "fight:room-status",
  matchReady: "fight:match-ready",
  syncRequest: "fight:sync-request",
  input: "fight:input",
  authoritativeFrame: "fight:frame",
  snapshot: "fight:snapshot",
  latencyPing: "fight:latency-ping",
  latencyPong: "fight:latency-pong",
  peerLeft: "fight:peer-left",
  rematchRequest: "fight:rematch-request",
  rematchCancel: "fight:rematch-cancel",
  rematchStatus: "fight:rematch-status",
  protocolError: "fight:protocol-error",
} as const;

export interface FightJoinOptions {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly fighterId: FighterId;
}

export interface FightWelcomeMessage {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly roomId: string;
  readonly playerIndex: 0 | 1;
  readonly tickRate: typeof NETWORK_TICK_RATE;
  readonly baseInputDelayFrames: number;
}

export interface FightRoomStatusMessage {
  readonly roomId: string;
  readonly connectedPlayers: number;
  readonly maxPlayers: 2;
  readonly phase: "waiting" | "running" | "finished" | "recovering";
}

export interface MatchReadyMessage {
  /** Increments for every rematch in the same room. */
  readonly matchNumber: number;
  readonly fighters: readonly [FighterId, FighterId];
  readonly playerIndex: 0 | 1;
  readonly initialState: GameState;
  readonly serverTime: number;
}

export interface PlayerInputMessage {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly sequence: number;
  readonly frame: number;
  readonly buttons: number;
  readonly clientTime: number;
}

export interface AuthoritativeFrameMessage {
  readonly frame: number;
  readonly inputs: readonly [number, number];
  /** Bit 0/1 is set when the server had to hold that player's prior input. */
  readonly predictedMask: number;
  readonly checksum: number;
  readonly serverTime: number;
}

export interface StateSnapshotMessage {
  /** State frame: the next input frame to simulate. */
  readonly frame: number;
  readonly state: GameState;
  readonly checksum: number;
  readonly serverTime: number;
}

export interface LatencyPingMessage {
  readonly nonce: number;
  readonly clientTime: number;
}

export interface LatencyPongMessage extends LatencyPingMessage {
  readonly serverTime: number;
}

export interface PeerLeftMessage {
  readonly playerIndex: 0 | 1;
  readonly reconnecting: boolean;
  readonly graceSeconds: number;
}

export interface RematchStatusMessage {
  readonly matchNumber: number;
  readonly requested: readonly [boolean, boolean];
  readonly ready: boolean;
}

export interface ProtocolErrorMessage {
  readonly code:
    "version-mismatch" | "invalid-fighter" | "invalid-input" | "late-input" | "future-input";
  readonly message: string;
}

export interface ServerInfo {
  readonly name: "neon-rivals-server";
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly status: "ok";
  readonly roomType: typeof FIGHT_ROOM_NAME;
}
