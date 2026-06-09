import { loadLocalEnv } from "./agent-cli-env";

function maskProjectRef(projectRef: string | null): string | null {
  if (!projectRef) return null;
  if (projectRef.length <= 8) return "***";
  return `${projectRef.slice(0, 4)}...${projectRef.slice(-4)}`;
}

async function main() {
  loadLocalEnv();

  const [
    { createLiveGrantOsRepository },
    {
      getSupabaseConfigError,
      getSupabaseProjectRef,
      hasSupabaseAnonKey,
      isSupabaseConfigured,
      isSupabaseUrlValid,
    },
    { assertNormalUserAccessToken, describeAgentAuthContext },
  ] = await Promise.all([
    import("../src/lib/agent-tools/repository"),
    import("../src/lib/supabase"),
    import("../src/lib/agent-tools/authContext"),
  ]);

  const userAccessToken = process.env.GRANT_OS_USER_ACCESS_TOKEN?.trim() || null;
  assertNormalUserAccessToken(userAccessToken);
  const authContext = {
    actorType: "cli" as const,
    source: "agent-doctor",
    userAccessToken,
  };
  const authDescription = describeAgentAuthContext(authContext);
  const repository = createLiveGrantOsRepository({ authContext });

  let grants: Array<{ id: string; title: string }> = [];
  let readError: string | null = null;
  try {
    grants = await repository.listGrants();
  } catch (error) {
    readError = error instanceof Error ? error.message : String(error);
  }

  const humanityAiVisible = grants.some((grant) =>
    grant.title.toLowerCase().includes("humanity ai")
  );

  console.log(JSON.stringify({
    supabase: {
      configured: isSupabaseConfigured,
      urlValid: isSupabaseUrlValid,
      configError: getSupabaseConfigError(),
      projectRef: maskProjectRef(getSupabaseProjectRef()),
      anonKeyPresent: hasSupabaseAnonKey,
    },
    auth: {
      mode: authDescription.authMode,
      userAccessTokenPresent: authDescription.userAccessTokenPresent,
    },
    grants: {
      visibleCount: grants.length,
      firstThreeTitles: grants.slice(0, 3).map((grant) => grant.title),
      humanityAiVisible,
      readError,
    },
  }, null, 2));
}

void main();
