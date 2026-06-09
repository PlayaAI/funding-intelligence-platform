import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createToolRegistry } from "../src/lib/agent-tools/registry";

function loadLocalEnv() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(scriptDir, "../.env.local"),
    path.resolve(scriptDir, "../.env"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const content = fs.readFileSync(candidate, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const [toolName, rawInput] = args;
  if (!toolName) {
    console.error("Usage: pnpm --filter @workspace/grant-os run agent:tool -- <tool_name> '{\"key\":\"value\"}'");
    process.exit(1);
  }

  loadLocalEnv();

  const { createLiveGrantOsRepository } = await import("../src/lib/agent-tools/repository");
  const input = rawInput ? JSON.parse(rawInput) : {};
  const registry = createToolRegistry({
    repository: createLiveGrantOsRepository(),
    actor: { type: "agent", source: "external_agent", id: "cli-runner" },
  });
  const result = await registry.execute(toolName, input);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

void main();
