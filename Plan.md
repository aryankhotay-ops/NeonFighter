# Neon Rivals Development Plan

## Goal

Build a small, finishable first release of an original browser-based 2D fighting game using **TypeScript**, **Phaser 3**, and a **Node.js multiplayer server**. The game should feel responsive locally and online while keeping combat logic deterministic and independent from rendering.

The existing JavaScript prototype is a visual/gameplay reference, not the final architecture. Development will proceed through small vertical milestones. A milestone is complete only when its acceptance criteria pass.

## Implementation status

- **Milestone 1: complete (2026-10-28).** The TypeScript/pnpm workspace, Phaser 3 + Vite client, Node.js development server, deterministic 60 Hz movement simulation, input bit fields, replay fixture, and automated checks are implemented. The expanded four-fighter state fixture has 10,000-frame reference checksum `84f69b8f`.
- **Milestone 2: in progress (2026-10-30).** The playable combat slice now includes per-fighter heavy attacks, specials and Super Arts, a dedicated held Guard button with standing/crouching defense, timing-based parry, hitstop, hitstun, confirmed chains, chip damage, knockdowns, quick rise, meter, 99-second rounds, best-of-three results, and deterministic combat tests. Frame-data tuning and an optional collision-box overlay remain before this milestone is closed.
- **Milestone 3: in progress (2026-10-29).** Original state-driven temporary vector sprites give Vesper, Nova, Rook, and Sable distinct silhouettes. The Neon Transit Deck caches static geometry and redraws only motion layers; combat effects and camera shake consume authoritative event serials. Production original/licensed sprite assets and alignment review remain.
- **Milestone 5: in progress (2026-10-30).** A polished retro-arcade main menu now routes to Local Versus, Online Play, Training, Controls, Settings, Credits, and Exit. Local Versus and Training each branch to two-player keyboard or CPU play at Easy, Medium, or Hard difficulty. The original lightweight Circuit Marshal fills the left panel, smoothly aims a laser at hover/keyboard selection, and points toward the viewer on Exit. Match completion routes to a dedicated results scene. A visible HUD pause button and Esc open a fight menu with resume, persistent audio/effect settings, controls, and mode-aware exit; offline simulation freezes while online play continues with neutral local input. Gamepad menu navigation remains.
- **Milestone 6: in progress (2026-10-30).** Character selection supports Vesper, Nova, Rook, and Sable for both human and CPU matchups. Deterministic CPU controllers use level-specific reaction time, spacing, aggression, defense, parries, move selection, and meter use without hidden stat bonuses. Reusable configurations provide distinct health, movement, body dimensions, normals, specials, and Super Arts; automated validation covers all four and every matchup. Production artwork remains.
- **Milestone 7: in progress (2026-10-29).** An original Web Audio presentation layer now synthesizes attacks, impacts, blocks, parries, special/super cues, KO, and an adaptive background rhythm. Licensed/original production audio, settings, and rollback duplication tests remain.
- **Milestone 8: in progress (2026-10-30).** Colyseus private rooms now create/join by room code and run the shared simulation authoritatively at 60 Hz. Frame-numbered inputs, validation, held-input jitter prediction, adaptive 2–6 frame delay that recovers after latency spikes, bounded slow-client catch-up, client rollback/replay, remote-only presentation smoothing, periodic checksums/snapshots, reconnect grace, session-token room recovery, mutual rematch voting, and live diagnostics are implemented. Remaining work is the broader 30–180 ms network-condition matrix, real network-switch QA, and permanent production WSS hosting.
- **Milestone 4: in progress (2026-10-30).** Quick keyboard taps are latched until the next simulation sample, and attack commands have an eight-frame deterministic buffer that survives short hitstop. Character selection requires explicit Player 1 and opponent choices for both human and CPU setups. Broader gamepad, frame-step, and long-session testing remain.
- **Milestone 9: in progress (2026-10-29).** Production frontend/server builds, environment-driven public URLs and development ports, strict origin policy, health/readiness endpoints, structured JSON logs, optional direct TLS plus reverse-proxy WSS support, request/message/connection limits, and production start commands are implemented. Hosted rollout, CI deployment, and observability integration remain.
- **Milestone 10: not started.** Final cross-browser, external-network, accessibility, security, and release-candidate QA remain intentionally deferred.

## First-release scope

### Included

- Four original playable fighters
- One stage
- Keyboard and gamepad support
- Local two-player versus
- Private/casual online two-player matches
- Best-of-three rounds
- Walk, crouch, jump, dash, block, normal attacks, one special move, and one super per fighter
- Health, meter, timer, hitstop, hitstun, knockback, KO, and round transitions
- Character selection, pause, results, and basic settings
- Original visual and audio assets
- Static web deployment plus one regional Node.js game server

### Explicitly deferred

- Accounts and profiles
- Ranked matchmaking, ratings, and seasons
- Databases
- Purchases or monetization
- Spectators
- Tournament mode
- Replays exposed in the UI
- More than four fighters or one stage
- Mobile touch controls as a competitive input method
- Large-scale regional server infrastructure

A database should be introduced only if a later requirement needs durable server-side records. The first release stores no persistent player data.

## Target architecture

```text
apps/
  web/                  Phaser 3 browser client
  server/               Node.js + Colyseus match server
packages/
  simulation/           Deterministic 60 Hz combat simulation
  protocol/             Network message and input types
  content/              Fighter, move, animation, and stage data
  test-tools/           Replay, bot, and network-condition utilities
```

Key rules:

1. `packages/simulation` is authoritative for movement, collision, frame timing, damage, meter, and match rules.
2. Phaser renders simulation state but does not decide combat outcomes.
3. Client and server run the same fixed-step simulation at 60 Hz.
4. Online traffic primarily transmits frame-numbered player inputs, not positions or damage.
5. Placeholder art and sound are acceptable until the related content milestones.

---

# Milestones

## Milestone 1 — Project setup and deterministic movement slice

**Objective:** Establish the final repository structure and prove that the same inputs produce the same result in the browser and Node.js. Keep this milestone deliberately small.

### Features

- `pnpm` TypeScript workspace
- Phaser 3 web application
- Node.js server application that starts without persistence
- Shared strict TypeScript configuration
- Shared 60 Hz fixed-step simulation package
- Integer/subpixel positions and velocities
- Two placeholder fighters represented by colored rectangles
- Walk, crouch, jump, facing direction, stage bounds, and fighter pushboxes
- Input bit-field format with simulation frame numbers
- Record and replay a local input sequence
- Formatting, linting, type checking, and unit-test commands

### Files expected to change

- `pnpm-workspace.yaml`
- `package.json`
- `tsconfig.base.json`
- `.gitignore`
- `apps/web/package.json`
- `apps/web/index.html`
- `apps/web/src/main.ts`
- `apps/web/src/scenes/BootScene.ts`
- `apps/web/src/scenes/FightScene.ts`
- `apps/web/src/input/InputSource.ts`
- `apps/server/package.json`
- `apps/server/src/index.ts`
- `packages/simulation/package.json`
- `packages/simulation/src/index.ts`
- `packages/simulation/src/GameState.ts`
- `packages/simulation/src/Simulation.ts`
- `packages/simulation/src/InputFrame.ts`
- `packages/simulation/src/fixedMath.ts`
- `packages/protocol/src/index.ts`
- `packages/test-tools/src/replay.ts`
- `tests/determinism.test.ts`
- `README.md`

Existing prototype files may remain available as reference until the Phaser client replaces them.

### Dependencies

- Node.js LTS
- pnpm
- TypeScript
- Phaser 3
- Vite
- Vitest
- ESLint and Prettier

### Testable acceptance criteria

- `pnpm install`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass.
- `pnpm dev` starts the Phaser client and Node.js server.
- Two placeholder fighters can walk, crouch, jump, face one another, and cannot leave the stage.
- Fighters cannot pass through one another on the ground.
- A recorded 10,000-frame input sequence produces the same final checksum in Node.js and the browser.
- Simulation results do not change when rendering frame rate changes.
- No combat, accounts, database, or production networking is added in this milestone.

---

## Milestone 2 — Core combat vertical slice

**Objective:** Complete one offline playable round using placeholder visuals before building production animation or networking.

### Features

- Fighter state machine
- Standing light and heavy attacks
- Startup, active, recovery, and cancel-window frame data
- Pushboxes, hurtboxes, and hitboxes
- Hit detection with stable collision ordering
- Blocking and chip-damage rules
- Damage, hitstop, hitstun, blockstun, knockback, and simple combo counter
- Health, meter, round timer, KO, and best-of-three score
- One special move and one meter-consuming super for the first fighter
- Data-driven move definitions
- Training/debug overlays for boxes and frame state

### Files expected to change

- `packages/simulation/src/FighterState.ts`
- `packages/simulation/src/CombatSystem.ts`
- `packages/simulation/src/CollisionSystem.ts`
- `packages/simulation/src/MatchRules.ts`
- `packages/simulation/src/CommandBuffer.ts`
- `packages/content/src/fighters/fighter-a.ts`
- `packages/content/src/moves/types.ts`
- `apps/web/src/scenes/FightScene.ts`
- `apps/web/src/debug/CombatDebugOverlay.ts`
- `tests/combat/*.test.ts`

### Dependencies

- Milestone 1 deterministic simulation
- Final decisions for first-release input layout
- Placeholder frame data for Fighter A

### Testable acceptance criteria

- Two local players can complete a best-of-three match using placeholder fighters.
- Attacks hit only during declared active frames and only when hitboxes overlap hurtboxes.
- Blocking prevents normal damage according to the documented rules.
- Hitstop freezes combat progression for the intended number of simulation frames.
- The same combat replay produces the same checksum in Node.js and the browser.
- Unit tests cover hit, whiff, block, KO, timeout, meter spend, and stage-corner cases.
- Debug overlays display the same boxes used by the simulation.

---

## Milestone 3 — Animation and visual presentation

**Objective:** Replace rectangles with a readable, original visual presentation while keeping animation subordinate to simulation state.

### Features

- Original sprite sheets or temporary production-quality silhouettes for four fighters
- Idle, walk, crouch, jump, hit, block, light, heavy, special, super, KO, and victory animations
- Simulation-frame-to-animation-frame mapping
- Original stage background with parallax layers
- Camera framing, limited shake, hit flashes, particles, and super freeze
- Rollback-safe visual event identifiers in preparation for networking
- Asset manifests and loading screen
- Reduced-flash option

### Files expected to change

- `apps/web/public/assets/fighters/**`
- `apps/web/public/assets/stages/**`
- `apps/web/src/scenes/PreloadScene.ts`
- `apps/web/src/scenes/FightScene.ts`
- `apps/web/src/presentation/FighterView.ts`
- `apps/web/src/presentation/CombatEffects.ts`
- `apps/web/src/presentation/CameraDirector.ts`
- `packages/content/src/animations/**`
- `packages/simulation/src/CombatEvent.ts`

### Dependencies

- Milestone 2 combat states and move timing
- Original art direction and animation frame list
- Asset license/ownership review

### Testable acceptance criteria

- Every combat state used in Milestone 2 has a readable animation.
- Changing render FPS does not change attack timing or match results.
- Phaser animation callbacks do not determine simulation transitions.
- Replaying the same simulation event does not duplicate a confirmed visual effect.
- Hitboxes remain aligned with sprite poses at all active frames.
- The stage and fighters remain legible at the minimum supported browser viewport.

---

## Milestone 4 — Local testing and game feel

**Objective:** Stabilize the offline game before introducing network complexity.

### Features

- Keyboard and standard gamepad input
- Configurable local input bindings
- Input-history and frame-step debug tools
- Training dummy with stand, crouch, block, and playback modes
- Artificial render slowdown test
- Replay-based regression suite
- Basic CPU dummy only if it helps automated testing; a full arcade AI is deferred
- Game-feel tuning for movement, hitstop, knockback, meter, and round length

### Files expected to change

- `apps/web/src/input/KeyboardInput.ts`
- `apps/web/src/input/GamepadInput.ts`
- `apps/web/src/input/InputBindings.ts`
- `apps/web/src/scenes/TrainingScene.ts`
- `apps/web/src/debug/InputHistoryView.ts`
- `packages/test-tools/src/ReplayRunner.ts`
- `packages/test-tools/src/TrainingDummy.ts`
- `tests/replays/**`
- `packages/content/src/balance/**`

### Dependencies

- Milestone 2 combat
- Milestone 3 readable animations
- At least two common gamepads for manual browser testing

### Testable acceptance criteria

- Two players can finish 20 consecutive local matches without a crash or stuck state.
- Keyboard and supported gamepads can be rebound without changing simulation code.
- Reference replay checksums pass after every build.
- Combat remains deterministic while rendering is throttled or frame rate varies.
- Every move can be verified with input history, current frame, and collision overlays.
- A short internal playtest produces no unresolved blocker-level control or readability defects.

---

## Milestone 5 — Menus and match flow

**Objective:** Wrap the local game in a complete but minimal user flow.

### Features

- Title screen
- Main menu with Local Versus, Online, Training, Settings, and Credits
- Pause menu for offline play
- Round intro, round result, match result, rematch, and return-to-menu flow
- Settings for volume, screen shake, reduced flash, controls, and fullscreen
- Local settings stored in browser local storage
- Loading and recoverable error states

### Files expected to change

- `apps/web/src/scenes/TitleScene.ts`
- `apps/web/src/scenes/MainMenuScene.ts`
- `apps/web/src/scenes/SettingsScene.ts`
- `apps/web/src/scenes/ResultsScene.ts`
- `apps/web/src/ui/**`
- `apps/web/src/settings/LocalSettings.ts`
- `apps/web/src/styles/**`

### Dependencies

- Milestone 4 stable local match flow
- Final first-release control actions
- Basic UI visual language

### Testable acceptance criteria

- A new player can launch the game, configure controls, start a local match, finish it, rematch, and return to the title without reloading the page.
- Settings persist after a page refresh.
- Pausing stops offline simulation without corrupting replay state.
- Menu navigation works with keyboard and gamepad.
- Online menu clearly reports that networking is unavailable until Milestone 8 is complete.

---

## Milestone 6 — Character selection and four-fighter roster

**Objective:** Complete the first-release roster and pre-match selection flow.

### Features

- Character-select scene for local and online use
- Four original fighters with distinct silhouettes, movement, health, normals, special moves, and Super Arts
- One special and one super per fighter
- Fighter name, portrait, control summary, and short play-style description
- Stage selection fixed to the single release stage
- Selection confirmation and cancel behavior
- Content validation for missing moves, sprites, or animation mappings

### Files expected to change

- `apps/web/src/scenes/CharacterSelectScene.ts`
- `apps/web/src/ui/CharacterCard.ts`
- `packages/simulation/src/fighters/vesper.ts`
- `packages/simulation/src/fighters/nova.ts`
- `packages/simulation/src/fighters/rook.ts`
- `packages/simulation/src/fighters/sable.ts`
- `packages/simulation/src/FighterConfig.ts`
- `packages/simulation/src/FighterDefinitions.ts`
- `packages/content/src/roster.ts`
- `packages/content/src/validateContent.ts`
- `apps/web/public/assets/portraits/**`
- `tests/content/*.test.ts`

### Dependencies

- Milestone 2 data-driven combat
- Milestone 3 animation pipeline
- Milestone 5 menu flow
- Completed original designs and temporary presentation configurations for all four fighters

### Testable acceptance criteria

- Either local player can select any of the four fighters and cancel before confirming.
- Every possible two-fighter pairing starts with the correct content and controls.
- All four fighters can complete a match and satisfy the same combat tests.
- Content validation fails the build if a required move or animation is missing.
- No copyrighted character names, likenesses, stages, move lists, or ripped assets are present.

---

## Milestone 7 — Sound and music

**Objective:** Add an original, rollback-safe audio layer without changing combat results.

### Features

- Original menu and stage music
- UI navigation sounds
- Movement, swing, hit, block, special, super, round, KO, and victory sounds
- Music and SFX volume controls
- Audio unlock handling for browser autoplay rules
- Deterministic combat-event IDs to prevent duplicate rollback audio
- Optional short voice cues using original performances or licensed assets

### Files expected to change

- `apps/web/public/assets/audio/**`
- `apps/web/src/audio/AudioManager.ts`
- `apps/web/src/audio/CombatAudioPresenter.ts`
- `apps/web/src/scenes/PreloadScene.ts`
- `apps/web/src/scenes/SettingsScene.ts`
- `packages/content/src/audioEvents.ts`

### Dependencies

- Milestone 3 combat-event presentation layer
- Milestone 5 settings
- Ownership or compatible licenses for every audio asset

### Testable acceptance criteria

- The first user interaction reliably unlocks audio in supported browsers.
- Music and SFX volumes can be changed independently and persist locally.
- A rollback/resimulation test does not play the same confirmed hit sound twice.
- Muting audio has no effect on simulation checksums.
- Credits document the source and license of every non-original audio asset.

---

## Milestone 8 — Real-time online multiplayer

**Objective:** Add private/casual two-player online matches after the local simulation is stable.

### Features

- Colyseus server room for one two-player match
- Create-room code and join-room code flow; no accounts
- WebSocket connection and version handshake
- Frame-numbered binary input batches
- Small configurable input delay
- Local prediction and remote-input prediction
- Client state history, rollback, and resimulation
- Authoritative server simulation using the shared package
- Server input validation and accepted-frame window
- Periodic state checksums and correction keyframes
- RTT, jitter, input-delay, and rollback-frame diagnostics
- Short reconnection grace period using an in-memory token
- Session-storage recovery entry point for a quick browser refresh
- Mutual rematch request/cancel flow that preserves the room and fighter selections
- Disconnect result policy
- Artificial latency, jitter, packet reordering, and loss test harness
- No ranked matchmaking or database

### Files expected to change

- `apps/server/src/index.ts`
- `apps/server/src/rooms/FightRoom.ts`
- `apps/server/src/rooms/FightRoomState.ts`
- `apps/server/src/net/InputQueue.ts`
- `apps/server/src/net/ServerSimulation.ts`
- `apps/web/src/net/OnlineClient.ts`
- `apps/web/src/net/RollbackController.ts`
- `apps/web/src/net/StateHistory.ts`
- `apps/web/src/scenes/OnlineLobbyScene.ts`
- `packages/protocol/src/messages.ts`
- `packages/protocol/src/codec.ts`
- `packages/simulation/src/checksum.ts`
- `packages/test-tools/src/NetworkSimulator.ts`
- `tests/network/**`

### Dependencies

- Milestone 1 deterministic cross-runtime simulation
- Milestone 4 stable local combat and replay tests
- Milestone 5 online menu entry point
- Milestone 6 final release roster/content version
- Colyseus and a supported WebSocket deployment environment

### Testable acceptance criteria

- Two browsers can create/join a private room and finish a complete match.
- The client sends input, never authoritative position, health, damage, or meter values.
- Server and clients maintain matching confirmed-state checksums during a normal match.
- Under simulated 80 ms RTT and moderate jitter, controls remain playable and matches complete without permanent divergence.
- Late corrected input causes bounded rollback and correct resimulation.
- Duplicate simulation events do not duplicate confirmed sounds or major effects.
- An invalid or excessively late input is rejected by the server.
- A brief disconnect can reconnect within the grace period; expiry produces a clear match result.
- A quick page refresh can recover the reserved seat and authoritative snapshot.
- Two players can complete a match, mutually accept a rematch, and start a clean match in the same room.
- No account, ranked matchmaking, or database dependency exists.

---

## Milestone 9 — Deployment

**Objective:** Publish the smallest reliable production configuration.

### Features

- Production web build
- One Node.js/Colyseus game-server deployment
- HTTPS/WSS configuration
- Environment-based client server URL
- Health endpoint
- Structured server logs without personal data
- Basic uptime, error-rate, room-count, RTT, and desync metrics
- Content and protocol version checks
- Simple rollback deployment procedure
- Static legal/credits page and privacy statement appropriate for a no-account game

### Files expected to change

- `apps/web/vite.config.ts`
- `apps/web/src/config.ts`
- `apps/server/src/config.ts`
- `apps/server/src/health.ts`
- `Dockerfile`
- `docker-compose.yml` or selected host configuration
- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `docs/deployment.md`
- `apps/web/public/credits.html`
- `apps/web/public/privacy.html`

### Dependencies

- Milestone 8 stable online build
- A static web host
- A Node.js host with WebSocket support
- Domain and TLS configuration

### Testable acceptance criteria

- CI installs, lints, type-checks, tests, and builds from a clean checkout.
- The production client loads over HTTPS and connects to the server over WSS.
- Two users on separate external networks can complete a private match.
- The health endpoint reports readiness without exposing match data.
- Client/server protocol version mismatch fails with a clear upgrade message.
- A previous known-good release can be restored using the documented rollback procedure.
- Server restart loses only active ephemeral rooms; no database recovery is expected.

---

## Milestone 10 — Final QA and release candidate

**Objective:** Verify that the scoped first release is complete, original, stable, and understandable.

### Features

- Full regression pass
- Browser compatibility testing
- Keyboard and gamepad compatibility matrix
- Accessibility and reduced-effects review
- Performance profiling
- Network-condition matrix
- Security and dependency review
- Originality and asset-license audit
- Player-facing controls and troubleshooting documentation
- Release notes and known issues

### Files expected to change

- `tests/e2e/**`
- `tests/replays/**`
- `docs/test-matrix.md`
- `docs/network-test-results.md`
- `docs/controls.md`
- `docs/known-issues.md`
- `CHANGELOG.md`
- `README.md`
- Asset attribution files as required

### Dependencies

- All previous milestones
- At least two physical test machines and two network connections
- Current supported versions of Chromium and Firefox; Safari tested where available
- Representative keyboard and gamepad hardware

### Testable acceptance criteria

- All automated checks pass from a clean checkout.
- A 30-minute local session and a 30-minute online session complete without crash, soft lock, or permanent desync.
- Supported browsers can complete the title-to-results flow.
- The game maintains its target simulation rate on the documented minimum hardware.
- Network tests document behavior at 30, 80, 120, and 180 ms RTT with jitter and limited packet loss.
- No blocker or critical defects remain open.
- Every shipped asset is original or has a recorded compatible license.
- No Street Fighter characters, names, stages, music, sound, move data, or artwork ship with the game.
- Release documentation accurately describes the four-fighter, one-stage, casual/private-online scope.

---

# Build order and release boundary

Complete milestones sequentially. Do not begin online multiplayer until deterministic local combat and replay tests are stable. Do not expand the roster, add accounts, or add ranked systems during the first-release cycle.

The **first playable internal build** ends at Milestone 2. The **first polished local build** ends at Milestone 7. The **first public release candidate** ends at Milestone 10.

If schedule pressure occurs, reduce presentation content before weakening determinism, combat testing, or online correctness. The smallest acceptable release remains four configured fighters with replaceable temporary art, one stage, local versus, and private-code online matches.
