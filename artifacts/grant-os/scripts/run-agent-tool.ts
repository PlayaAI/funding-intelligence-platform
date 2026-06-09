import { loadLocalEnv } from "./agent-cli-env";

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const [toolName, rawInput] = args;
  if (!toolName) {
    console.error("Usage: pnpm --filter @workspace/grant-os run agent:tool -- <tool_name> '{\"key\":\"value\"}'");
    process.exit(1);
  }

  loadLocalEnv();

  const [
    { createToolRegistry },
    { createLiveGrantOsRepository },
    { assertNormalUserAccessToken, describeAgentAuthContext },
  ] = await Promise.all([
    import("../src/lib/agent-tools/registry"),
    import("../src/lib/agent-tools/repository"),
    import("../src/lib/agent-tools/authContext"),
  ]);
  const userAccessToken = process.env.GRANT_OS_USER_ACCESS_TOKEN?.trim() || null;
  assertNormalUserAccessToken(userAccessToken);
  const authContext = {
    actorType: "cli" as const,
    source: "agent-tool-cli",
    userAccessToken,
  };
  const input = rawInput ? JSON.parse(rawInput) : {};
  console.error("[Grant OS Agent Tool]", {
    authMode: describeAgentAuthContext(authContext).authMode,
    tokenPresent: Boolean(userAccessToken),
  });
  const registry = createToolRegistry({
    repository: createLiveGrantOsRepository({ authContext }),
    actor: { type: "agent", source: "external_agent", id: "cli-runner" },
  });
  const result = await registry.execute(toolName, input);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

void main();
