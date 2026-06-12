import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentApi } from "../lib/agent-api/agentApi";
import { createMcpAdapter } from "../lib/agent-mcp/adapter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const distPublic = path.resolve(root, "dist/public");
const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const isProduction = process.env.NODE_ENV === "production";
const agentApi = createAgentApi();
const mcpAdapter = createMcpAdapter();

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

async function serveStatic(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const normalizedPath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidatePath = path.resolve(distPublic, `.${normalizedPath}`);
  const candidateIsFile =
    candidatePath.startsWith(distPublic) &&
    existsSync(candidatePath) &&
    statSync(candidatePath).isFile();
  const filePath =
    candidateIsFile
      ? candidatePath
      : path.resolve(distPublic, "index.html");

  response.writeHead(200, { "content-type": contentTypeFor(filePath) });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    }
    response.end("Failed to read Grant OS asset.");
  });
  stream.pipe(response);
}

async function handleApi(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/api/agent/") && !url.pathname.startsWith("/api/mcp/")) return false;

  try {
    if (url.pathname === "/api/agent/doctor" && request.method === "GET") {
      const result = await agentApi.handleDoctor(request.headers);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (url.pathname === "/api/agent/tool" && request.method === "POST") {
      const body = await readJsonBody(request);
      const result = await agentApi.handleTool(request.headers, body);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (url.pathname === "/api/mcp/tools" && request.method === "GET") {
      const result = await mcpAdapter.handleTools(request.headers);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (url.pathname === "/api/mcp/call" && request.method === "POST") {
      const body = await readJsonBody(request);
      const result = await mcpAdapter.handleCall(request.headers, body);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (url.pathname === "/api/mcp/doctor" && request.method === "GET") {
      const result = await mcpAdapter.handleDoctor(request.headers);
      sendJson(response, result.status, result.body);
      return true;
    }

    sendJson(response, 404, {
      ok: false,
      error: { code: "not_found", message: "Agent API route not found." },
    });
    return true;
  } catch {
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "Agent API request failed." },
    });
    return true;
  }
}

async function start() {
  const vite = isProduction
    ? null
    : await import("vite").then(({ createServer: createViteServer }) =>
        createViteServer({
          root,
          server: { middlewareMode: true, host: "0.0.0.0", allowedHosts: true },
          appType: "spa",
          configFile: path.resolve(root, "vite.config.ts"),
        })
      );

  const server = createServer(async (request, response) => {
    if (await handleApi(request, response)) return;

    if (vite) {
      vite.middlewares(request, response, () => {
        sendJson(response, 404, {
          ok: false,
          error: { code: "not_found", message: "Route not found." },
        });
      });
      return;
    }

    if (!existsSync(path.resolve(distPublic, "index.html"))) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("Grant OS build output is missing. Run pnpm build first.");
      return;
    }

    await serveStatic(request, response);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[Grant OS] serving ${isProduction ? "production" : "development"} app on port ${port}`);
  });
}

await start();
