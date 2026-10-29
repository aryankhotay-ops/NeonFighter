# Production deployment

## Build

From the workspace root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Replace every example.com/path placeholder in .env.
pnpm build:production
```

The static frontend is emitted to `apps/web/dist/`. The bundled Node.js multiplayer server is emitted to `apps/server/dist/`.

`VITE_SERVER_URL` is embedded at frontend build time. If it is omitted, the browser uses its own origin, which supports a same-origin reverse-proxy deployment. Rebuild the frontend after changing any `VITE_*` value.

## Vercel frontend

The repository includes `vercel.json`; import the GitHub repository with the repository root as Vercel's project root. Vercel then uses the pinned pnpm install, frontend-only build, `apps/web/dist` output directory, immutable asset caching, and baseline security headers automatically.

Set `VITE_SERVER_URL` in the Vercel project environment to the public HTTPS endpoint of the multiplayer server, then redeploy. Vercel can host the static Phaser frontend, but it cannot host this Colyseus server because persistent WebSocket rooms require a long-running Node.js process. Deploy `apps/server/dist/index.js` to a WebSocket-capable host, VM, or container platform.

## Start the multiplayer server

```sh
pnpm start:server
```

This command loads the root `.env` when present and runs the compiled server. A process supervisor or container platform should restart the process after a crash and send `SIGTERM` during rollout.

## Required production environment

- `NODE_ENV=production`
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins; wildcards are rejected
- `VITE_SERVER_URL`: public HTTP(S) multiplayer endpoint, unless frontend and server share one origin
- `HOST` and `PORT`: listener address
- `PUBLIC_SERVER_URL`: public endpoint used in structured startup logs

See `.env.example` for transport limits and optional settings. It contains placeholders only and must not be used unchanged.

## HTTPS and secure WebSockets

Preferred deployment: terminate TLS at a trusted load balancer or reverse proxy and forward HTTP plus WebSocket upgrades to the Node.js listener. The public `VITE_SERVER_URL` must use `https://`; the Colyseus SDK then connects over `wss://`.

The server can also terminate TLS directly by setting both:

- `TLS_CERT_PATH`
- `TLS_KEY_PATH`

Direct TLS requires a trusted certificate and private key readable by the server process. TLS 1.2 or newer is enforced. Never commit certificate or key files.

A reverse proxy must preserve `Origin`, `X-Forwarded-Proto`, and WebSocket upgrade headers. Health requests should target `/healthz` or `/readyz` without WebSocket upgrade.

## Health checks

- `/healthz`: liveness and runtime metadata
- `/readyz`: readiness; returns HTTP 503 before startup is complete
- `/health`: compatibility alias

Responses contain protocol version, environment, secure-transport mode, uptime, readiness, and timestamp. They do not expose room or player data.

## Limits and origin policy

The production server enforces:

- Exact HTTP and WebSocket origin checks
- Two clients per fight room
- Global TCP connection cap
- WebSocket message-size cap
- HTTP request-size cap
- Per-client message-rate cap
- Heartbeat timeout and retry limits
- Header, request, keep-alive, and graceful-shutdown timeouts
- Compression disabled for small real-time messages

Tune limits through environment variables only after load testing. Keep `DEV_ALLOW_ANY_ORIGIN=false` in production.

## Logs

Server and room lifecycle logs are newline-delimited JSON on stdout/stderr. Events cover startup, shutdown, room creation/disposal, player join/drop/recovery/leave, match start/finish, rematch, and uncaught errors. Logs intentionally omit input payloads, reconnection tokens, and personal data.
