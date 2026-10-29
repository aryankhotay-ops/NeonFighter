import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { FIGHT_ROOM_NAME, PROTOCOL_VERSION, type ServerInfo } from "@neon-rivals/protocol";
import { readFileSync } from "node:fs";
import type { Server as HttpServer, IncomingMessage, ServerResponse } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { loadServerConfig, isOriginAllowed } from "./config";
import { configureLogger, createFrameworkLogger, logError, logInfo, logWarn } from "./logger";
import { FightRoom } from "./rooms/FightRoom";

const config = loadServerConfig();
configureLogger(config.logLevel);
let ready = false;
const startedAt = Date.now();

const info: ServerInfo = {
  name: "neon-rivals-server",
  protocolVersion: PROTOCOL_VERSION,
  status: "ok",
  roomType: FIGHT_ROOM_NAME,
};

const tlsServer = config.tls
  ? createHttpsServer({
      cert: readFileSync(config.tls.certPath),
      key: readFileSync(config.tls.keyPath),
      minVersion: "TLSv1.2",
    })
  : undefined;

const transport = new WebSocketTransport({
  ...(tlsServer ? { server: tlsServer } : {}),
  maxPayload: config.maxMessageBytes,
  perMessageDeflate: false,
  pingInterval: config.pingIntervalMs,
  pingMaxRetries: config.pingMaxRetries,
  beforeUpgrade: (request) => {
    const origin = request.headers.get("origin");
    if (isOriginAllowed(config, origin)) return;
    logWarn("websocket.origin_rejected", { origin });
    return new Response("Origin not allowed", { status: 403 });
  },
});

const gameServer = new Server({
  transport,
  gracefullyShutdown: false,
  greet: false,
  logger: createFrameworkLogger(),
  express: (app) => {
    app.disable("x-powered-by");
    app.use((request: IncomingMessage, response: ServerResponse, next: () => void) => {
      const origin = request.headers.origin;
      response.setHeader("x-content-type-options", "nosniff");
      response.setHeader("referrer-policy", "no-referrer");
      response.setHeader("cross-origin-resource-policy", "same-site");
      response.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
      response.setHeader("vary", "Origin");
      if (config.tls || request.headers["x-forwarded-proto"] === "https") {
        response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
      }

      if (!isOriginAllowed(config, origin)) {
        logWarn("http.origin_rejected", { method: request.method, origin, path: request.url });
        response.statusCode = 403;
        response.end("Origin not allowed");
        return;
      }

      if (origin) {
        response.setHeader("access-control-allow-origin", origin);
        response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
        response.setHeader("access-control-allow-headers", "content-type, authorization");
        response.setHeader("access-control-max-age", "86400");
      }
      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }

      const contentLength = Number(request.headers["content-length"] ?? 0);
      if (Number.isFinite(contentLength) && contentLength > config.maxHttpBodyBytes) {
        logWarn("http.payload_rejected", { contentLength, path: request.url });
        response.statusCode = 413;
        response.end("Request payload too large");
        return;
      }
      if (
        request.method === "POST" &&
        request.headers["transfer-encoding"] &&
        !request.headers["content-length"]
      ) {
        logWarn("http.chunked_request_rejected", { path: request.url });
        response.statusCode = 411;
        response.end("Content-Length required");
        return;
      }
      next();
    });

    const sendHealth = (_request: IncomingMessage, response: ServerResponse): void => {
      response.setHeader("cache-control", "no-store");
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.statusCode = ready ? 200 : 503;
      response.end(
        JSON.stringify({
          ...info,
          ready,
          environment: config.environment,
          secureTransport: Boolean(config.tls),
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1_000),
          timestamp: new Date().toISOString(),
        }),
      );
    };
    app.get(["/", "/health", "/healthz", "/readyz"], sendHealth);
  },
});

gameServer.define(FIGHT_ROOM_NAME, FightRoom, {
  maxMessagesPerSecond: config.maxMessagesPerSecond,
});

const nodeServer = transport.server as HttpServer | undefined;
if (!nodeServer) throw new Error("WebSocket transport did not initialize an HTTP(S) server.");
nodeServer.maxConnections = config.maxConnections;
nodeServer.maxHeadersCount = 64;
nodeServer.requestTimeout = 15_000;
nodeServer.headersTimeout = 10_000;
nodeServer.keepAliveTimeout = 5_000;
nodeServer.maxRequestsPerSocket = 100;

await gameServer.listen(config.port, config.host);
ready = true;
const protocol = config.tls ? "https" : "http";
logInfo("server.started", {
  environment: config.environment,
  listen: `${protocol}://${config.host}:${config.port}`,
  publicServerUrl: config.publicServerUrl,
  secureTransport: Boolean(config.tls),
  roomType: FIGHT_ROOM_NAME,
  protocolVersion: PROTOCOL_VERSION,
  limits: {
    maxConnections: config.maxConnections,
    maxMessageBytes: config.maxMessageBytes,
    maxHttpBodyBytes: config.maxHttpBodyBytes,
    maxMessagesPerSecond: config.maxMessagesPerSecond,
  },
});
if (config.environment === "production" && !config.tls) {
  logWarn("server.tls_terminated_upstream", {
    message:
      "Direct TLS is disabled. Production must terminate HTTPS/WSS at a trusted reverse proxy.",
  });
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  logInfo("server.shutdown_started", { signal });
  const timeout = new Promise<never>((_resolve, reject) => {
    setTimeout(
      () => reject(new Error("Graceful shutdown timed out.")),
      config.shutdownTimeoutMs,
    ).unref();
  });
  try {
    await Promise.race([gameServer.gracefullyShutdown(false), timeout]);
    logInfo("server.shutdown_complete", { signal });
  } catch (error) {
    logError("server.shutdown_failed", error, { signal });
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => logError("process.unhandled_rejection", error));
process.on("uncaughtException", (error) => {
  logError("process.uncaught_exception", error);
  void shutdown("uncaughtException");
});
