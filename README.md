# Neon Rivals

Neon Rivals is an original browser-based 2D fighting game under incremental development. Its deterministic TypeScript simulation is shared by a Phaser 3 browser client and a Node.js server shell. It does **not** use Street Fighter characters, names, stages, source code, audio, exact frame data, or artwork.

**Play it:** https://neonfighter.vercel.app — the permanent Vercel production deployment (project `aryankhotay-5437/neonfighter`). The project is connected to this GitHub repository, so every push to `main` automatically rebuilds and redeploys production using the included `vercel.json`. Local Versus, Training, and all menus always work; Online Play needs the multiplayer server referenced by the Vercel `VITE_SERVER_URL` environment variable to be running (see [Build for production](#build-for-production)).

See the complete milestone sequence in [Plan.md](Plan.md) and the sourced mechanics research in [docs/combat-design-references.md](docs/combat-design-references.md).

## Current playable slice

The first combat slice includes:

- Four selectable animated arenas rendered in Phaser: Neon Transit, Storm Rooftop, Reactor Ring, and Midnight Harbor
- Four local original fighters with distinct silhouettes, movement, health, normals, specials, and Super Arts
- Reusable per-fighter combat configurations under `packages/simulation/src/fighters/`
- Original vector fighters with articulated two-segment limbs, hands, boots, costume panels, hair, facial features, and distinct body proportions configured separately from combat data
- State-driven body animation plus five setup-time cached face textures per selected fighter, including blinking, focused attack expressions, hit reactions, and knockout faces without rebuilding facial vectors every frame
- Event-driven impact, block, parry, special, super, KO, and camera-shake effects
- Original synthesized attack, hit, block, parry, special, super, KO, and background music audio
- Cached static stage/HUD geometry, change-only HUD redraws, 4 Hz diagnostic text, 30 Hz background motion, and at most one fighter presentation pass per 60 Hz simulation frame
- A deterministic 60 Hz, integer-subpixel simulation
- Walk, crouch, jump, super jump, double-tap dash, facing, stage bounds, and pushboxes
- Light, crouching-low, overhead-heavy, special, and super attacks
- Startup, active, recovery, hitstop, hitstun, blockstun, chip damage, and knockback
- Dedicated held Guard control with standing/crouching defense and timing-based high/low parry
- Confirmed heavy → special → super cancel paths
- Knockdown, quick rise, and super knockdown without quick rise
- Health, meter, 99-second rounds, KO/time-over, best-of-three score, match result, and rematch
- Retro arcade main menu with Local Versus, Online Play, Training, Controls, Settings, and Credits
- Local Versus and Training each support either two players on one keyboard or a computer-controlled Player 2 at Easy, Medium, or Hard difficulty
- Deterministic CPU behavior with level-specific reaction time, spacing, aggression, blocking, parrying, move selection, and meter use—without hidden health or damage bonuses
- A lightweight original Circuit Marshal animation that aims a laser at the hovered/selected menu option and switches to a two-handed, muzzle-on aim straight at the viewer (sights under the visor, laser flaring into the camera) on Exit Game
- A visible fight pause/menu button plus Esc shortcut, with resume, live audio/effect settings, controls, and exit actions
- Smooth rendering for every menu and gameplay scene, with high-DPI text, antialiased WebGL output, aligned pointer input, and no scanline overlay
- Character selection showing every fighter as an original big-head vinyl-collectible portrait with unique proportions, hair, face gear, costume, stance, fighting style, and Super Art; the user explicitly chooses both their fighter and the human/CPU opponent's fighter
- Per-player lock indicators plus a final matchup review showing both selections before the match starts
- Explicit cancellation: undo the final Player 2 choice, undo Player 1's lock, or return to the main menu
- A dedicated post-match results screen
- Functional settings for music/SFX volume, screen shake, reduced flash, and four live Fight Themes selectable from Main Menu Settings, the fight pause menu, or Online Play setup
- Private online rooms created or joined through a readable four-character uppercase alphanumeric room code
- A clipped, scrollable Online Play panel with mouse-wheel scrolling, a visible scrollbar, and keyboard selection that automatically keeps the active option in view
- Server-authoritative synchronized fights with adaptive input delay, held-input jitter handling, client rollback, checksums, and correction snapshots
- A 10-second reconnection grace period and live RTT/jitter/rollback diagnostics
- A deterministic 10,000-frame replay fixture plus combat regression tests
- Latched keyboard presses and an eight-frame deterministic command buffer prevent quick action taps from being lost between render ticks or during short hitstop windows

Production sprite sheets, gamepad testing, hosted internet deployment, and wider network-condition QA remain later milestones. All current graphics and audio are original/procedural; no Street Fighter III media is included. CC0 character-art candidates researched for any future sprite-sheet replacement are recorded in [docs/character-art-references.md](docs/character-art-references.md).

## Original roster

| Fighter | Silhouette                               | Style and movement                                           | Normals                                      | Special            | Super Art        |
| ------- | ---------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- | ------------------ | ---------------- |
| Vesper  | Lean boxer with a trailing courier scarf | Courier boxing; fastest walk and dash, lower health          | Relay Jab, Signal Sweep, Crosswind Hook      | Slipstream Barrage | Midnight Express |
| Nova    | Tall aerial striker with a bright crest  | Aerial kickboxing; highest jump and strongest air control    | Prism Palm, Comet Low, Solar Axe             | Orbit Breaker      | Zenith Spiral    |
| Rook    | Broad armored heavyweight                | Foundry brawling; slow, grounded, highest health and damage  | Iron Knuckle, Foundation Kick, Gantry Hammer | Seismic Clamp      | Citadel Collapse |
| Sable   | Long-coated precision duelist            | Vector savate; balanced counter movement and longest normals | Ghost Tap, Shadow Scythe, Null Heel          | Phase Reversal     | Event Horizon    |

Combat properties and move frame data are independent of presentation. Final original or properly licensed sprite sheets can replace the vector silhouettes without changing simulation behavior.

The four gameplay silhouettes now separate at a glance: Vesper is a narrow scarf-and-satchel courier, Nova is a tall orbital comet striker, Rook is a very broad plated warden, and Sable is a long split-coat duelist. Character-select art deliberately uses a roughly half-head/half-body collectible proportion while keeping all costumes and identities original to Neon Rivals.

## Presentation performance budget

- Deterministic simulation, input capture, rollback, and network transport remain at 60 Hz and do not depend on face animation.
- Only the two fighters selected for a match are cached. Each identity uses five transparent 112 × 112 face textures; the maximum nominal RGBA pixel storage is 501,760 bytes per match, and gameplay transforms two image quads instead of re-tessellating facial paths.
- Rendering is skipped when the simulation frame has not advanced, preventing 120/144 Hz displays from duplicating 60 Hz graphics work.
- Health/meter graphics redraw only when their values change. Timer, fighter labels, announcements, and online diagnostics update at their natural lower rates.
- The Online Play lobby and create/join room flow remain event-driven text UI. They do not create fighter textures or run presentation animation.
- The browser no longer computes the 10,000-frame determinism fixture when a match starts. Its test-verified checksum is displayed as build data, while the full replay remains in automated tests.

## Requirements

- Node.js 24 LTS or newer
- pnpm 12

Install pnpm if it is not already available:

```sh
npm install --global pnpm@12.15.0
```

React is intentionally not installed. Phaser is sufficient for the current canvas UI. If later DOM menus justify React, it will remain a presentation layer in `apps/web` and will not own or mutate combat simulation state.

## Install and run

From the `neon-rivals` directory:

```sh
pnpm install
pnpm dev
```

Local endpoints:

- Game: `http://127.0.0.1:5173`
- Server health: `http://127.0.0.1:2567/health`

Run either process separately:

```sh
pnpm dev:web
pnpm dev:server
```

## Online play

1. Start the client and server with `pnpm dev`.
2. In **Online Play**, cycle to the desired fighter and Fight Theme.
3. The host selects **Create Private Room** and shares the displayed room code. The host's theme becomes the shared room theme for both players.
4. The challenger selects **Join Room Code** and enters that code.
5. Both clients transition into the same authoritative fight room automatically.
6. After results, both players can vote for a rematch without creating a new room. Either player may withdraw before both accept.

The first networking slice uses Colyseus WebSockets and the shared 60 Hz simulation. Clients send only frame-numbered inputs. The server validates and simulates them, holds the last input through short jitter gaps, broadcasts canonical inputs, and sends correction snapshots every twenty frames. Clients apply adaptive 2–6 frame input delay and roll back/replay when prediction differs. The future-input scheduler can reduce its lead again after a latency spike instead of remaining stuck at the previous maximum. Bounded catch-up stepping absorbs small server leads instead of hard-snapping to each ahead snapshot, and remote-fighter presentation smooths short rollback corrections without delaying the local fighter. Animated stage art updates at 30 Hz to leave more render budget for networking and combat. There are no accounts, ranked matchmaking, or databases.

Unexpected disconnects pause the room and reserve the player's seat for 10 seconds. Automatic reconnect restores the latest server snapshot. The reconnection token is also stored in session storage, so **Recover Previous Room** can restore a room after a quick page refresh. Recovery is intentionally in-memory: restarting the Node.js process disposes active rooms.

To point the browser at another server, copy the root `.env.example` to `.env` and set `VITE_SERVER_URL`. If it is omitted, Online Play probes the page origin first and then the configured same-host multiplayer port. This keeps reverse-proxy deployment and the separate `start:web` / `start:server` preview flow working without a hard-coded local URL. To exercise transport delay locally, Colyseus supports `COLYSEUS_LATENCY`, for example:

```sh
COLYSEUS_LATENCY=120 pnpm dev:server
```

## Controls

| Action             | Player 1          | Player 2          |
| ------------------ | ----------------- | ----------------- |
| Move / parry       | W A S D           | Arrow keys        |
| Guard / defend     | F                 | J                 |
| Heavy attack       | G                 | K                 |
| Special move       | H                 | L                 |
| Super              | G + H             | K + L             |
| Menu navigation    | Arrows + Enter    | Arrows + Enter    |
| Pause / fight menu | Esc or HUD button | Esc or HUD button |

Combat rules:

- Hold Guard to block mids and standing attacks.
- Hold Guard + down to block low attacks.
- Tap toward shortly before a mid/overhead impact to parry it.
- Tap down shortly before a low impact to parry it.
- Double-tap left or right to dash.
- Tap down then up to super jump.
- Press down after landing from an eligible special knockdown to quick rise. Super Art knockdowns disable quick rise.
- Specials and supers inflict chip damage when blocked.
- Super costs 500 of the 1,000-point meter.

Local Versus and Training freeze completely while paused. An online match cannot pause the authoritative server for one player, so opening its fight menu sends neutral local input while the match continues; the menu clearly warns about this behavior.

Fight Themes can be cycled under **Settings → Fight Theme**, directly from **Pause → Fight Theme**, or from the **Fight Theme** option in Online Play before creating or joining a room. The selection persists across sessions and applies immediately to a paused fight. In online rooms, the host's selection is authoritative so both players see the same theme.

## Build for production

```sh
pnpm install --frozen-lockfile
pnpm build:production
```

Outputs:

- Browser client: `apps/web/dist/`
- Node.js server: `apps/server/dist/`

Preview the static frontend or start the compiled multiplayer server:

```sh
pnpm start:web
pnpm start:server
```

The server start command reads the root `.env` when it exists. Production requires an explicit `ALLOWED_ORIGINS` list. HTTPS/WSS may terminate at a trusted reverse proxy, or directly in Node when both TLS certificate-path variables are configured. Full environment, health-check, limit, and reverse-proxy guidance is in `docs/deployment.md`.

The game is hosted on Vercel at https://neonfighter.vercel.app. The included `vercel.json` deploys the frontend from the repository root, and the Vercel project `neonfighter` is connected to this GitHub repository, so every push to `main` redeploys production automatically (other branches get preview deployments). Set Vercel's `VITE_SERVER_URL` to an externally hosted HTTPS Colyseus endpoint and add `https://neonfighter.vercel.app` to that server's `ALLOWED_ORIGINS`. Persistent multiplayer WebSocket rooms require a long-running server and cannot run inside Vercel's static/serverless frontend deployment.

Example temporary port override:

```sh
PORT=3000 pnpm --filter @neon-rivals/server start
```

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
```

The expanded deterministic fixture finishes frame 10,000 with checksum `84f69b8f`. The Phaser scene computes and displays the same fixture checksum in the browser. Fifty-nine automated tests cover all four configurations and matchups, menu laser targeting, explicit training selection, pause policy, quick-tap latching, deterministic command buffering, production endpoint discovery/configuration, combat, authoritative network input buffering, adaptive delay, rollback/snapshot reconciliation, and rematch voting. Production smoke tests verify origin rejection, health/readiness, HTTP and direct TLS/WSS startup, room creation, joining, automatic room recovery, synchronized fighter state, full match completion, and a same-room rematch reset.

## Architecture

```text
apps/
  web/                  Phaser 3 presentation and input
  server/               Colyseus rooms and authoritative simulation
packages/
  simulation/           Authoritative deterministic movement, combat, and fighter configs
  protocol/             Shared network-facing message types
  test-tools/           Replay fixtures and deterministic test utilities
tests/                   Determinism, combat, UI, and networking tests
```

`packages/simulation` contains no Phaser, DOM, Web Audio, or Node.js APIs. Phaser renders predicted/reconciled state, while the Colyseus server computes the canonical movement, defense, hits, meter, and match results using that same package. Networking remains an ephemeral private-room system: no persistent player data is stored.

## Legacy prototype

The root-level `index.html`, `styles.css`, and `game.js` are the earlier standalone JavaScript prototype. They remain only as a visual and interaction reference while the TypeScript client is developed under `apps/web`.
