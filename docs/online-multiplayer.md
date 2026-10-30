# Online multiplayer architecture

## Implemented slice

Neon Rivals uses ephemeral two-player Colyseus rooms. The host creates a `fight` room and shares its nine-character room ID; the challenger joins that exact ID. Join options contain only protocol version and selected fighter. No account, profile, ranking, matchmaking database, or persistent room state is involved.

## Authoritative flow

1. Both clients join with matching protocol version 3 (the Guard-control input layout).
2. The room assigns deterministic player indexes and starts when both seats are occupied.
3. Clients schedule input into a short future frame buffer and send only button bits, frame, and sequence.
4. The server validates frame windows, sequence monotonicity, and the input bit mask.
5. A Colyseus fixed timestep advances the shared simulation at 60 Hz.
6. If an input is missing, the server holds that player's last input and marks the canonical frame as predicted instead of stalling both players.
7. Every authoritative frame broadcasts the exact input pair and state checksum.
8. Every ten frames the server broadcasts a trusted correction snapshot.
9. Match results therefore come from the same server-owned simulation, not client position or damage claims.

## Latency handling

The browser estimates round-trip time and jitter once per second. It derives an adaptive input delay between 2 and 6 frames from half-RTT plus a 0.75-jitter safety margin. Low-latency matches stay at the minimum; unstable connections add a bounded buffer. When a temporary spike subsides, the client replaces its still-future scheduled inputs so the lead returns to the lower value; the previous scheduler could increase delay but never reduce it, leaving the rest of a match stuck at the peak.

Each client predicts remote input by holding the previous value. It records 180 frames of states and applied inputs. When canonical inputs differ, it restores the state before the earliest changed frame and deterministically replays to the present. Periodic server snapshots correct any remaining checksum divergence or fast-forward a client that fell behind. A client that is still behind uses at most two extra simulation steps per local tick until it is near the authoritative frame, avoiding repeated snapshot jumps without allowing an unbounded catch-up stall. Presentation smoothing is applied only to the remote fighter, reducing visible correction judder while the local fighter remains immediate.

The fight HUD reports RTT, jitter, current delay, rollback count, and snapshot correction count.

## Reconnection

Unexpected drops pause the authoritative room and reserve the seat for 10 seconds. The peer receives a reconnecting status. A successful reconnect receives the current session metadata and a trusted snapshot before the simulation resumes; expiry removes the seat and returns the room to waiting. Consented exits do not retain a seat.

The browser stores the room reconnection token in session storage. Colyseus first attempts automatic recovery on a short transport interruption. After a quick page refresh, the player can use **Recover Previous Room** from Online Play during the same 10-second server grace period. Recovery works during a fight or on the results screen. Because rooms are deliberately ephemeral and no database is used, a Node.js process restart does not recover active rooms.

## Rematches and completed flow

When an authoritative match ends, both clients keep the same room connection and enter the results scene. Each seat may request or withdraw a rematch. The server broadcasts both votes and starts match number N+1 only when both occupied seats agree. It resets simulation state, scores, frame history, input buffers, and rematch votes while preserving fighter selections, room ID, latency measurements, and player indexes.

If a player leaves instead, the room unlocks. The remaining player sees the peer status, and the room can accept a replacement challenger under the same code. Leaving for the online lobby or main menu is consented and clears the stored recovery token.

## Current boundary

This is the first functional private-room slice, not final competitive netcode. Before release it still needs:

- Browser-to-browser tests at 30, 80, 120, and 180 ms RTT
- Jitter and limited-loss tests over longer matches
- Reconnect tests on real Wi-Fi/network switches
- Hosted HTTPS/WSS deployment
- Security/load review for public exposure
- Optional server-side rewind if later playtests show held-input authority is insufficient

Use Colyseus' local latency simulation during development:

```sh
COLYSEUS_LATENCY=120 pnpm dev:server
```
