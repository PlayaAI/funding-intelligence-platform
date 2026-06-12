import packageJson from "../../package.json";

export type DeploymentMetadata = {
  app: "grant-os";
  commit: string;
  commitFull: string;
  versionSource: "git" | "package_json" | "unknown";
  environment: string;
  apiSurface: "v2.3A";
  capabilities: string[];
};

const DEPLOYMENT_CAPABILITIES = [
  "agent_api",
  "mcp_http_adapter",
  "safe_write_dry_run",
  "grant_match_generation",
] as const;

const COMMIT_ENV_KEYS = [
  "REPLIT_GIT_COMMIT",
  "GIT_COMMIT",
  "VERCEL_GIT_COMMIT_SHA",
  "COMMIT_SHA",
  "SOURCE_VERSION",
] as const;

const ENVIRONMENT_KEYS = [
  "GRANT_OS_DEPLOYMENT_ENV",
  "REPLIT_DEPLOYMENT",
  "REPLIT_ENVIRONMENT",
  "VERCEL_ENV",
  "NODE_ENV",
] as const;

function firstDefined(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function shortenCommit(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "unknown";
  if (/^[a-f0-9]{8,}$/i.test(normalized)) return normalized.slice(0, 7);
  return normalized.length > 12 ? normalized.slice(0, 12) : normalized;
}

function resolveVersionFallback(): { commit: string; commitFull: string; versionSource: DeploymentMetadata["versionSource"] } {
  const packageVersion = process.env.npm_package_version?.trim() || packageJson.version?.trim() || "";
  if (packageVersion) {
    return {
      commit: packageVersion,
      commitFull: packageVersion,
      versionSource: "package_json",
    };
  }

  return {
    commit: "unknown",
    commitFull: "unknown",
    versionSource: "unknown",
  };
}

export function getGrantOsDeploymentMetadata(): DeploymentMetadata {
  const envCommit = firstDefined(COMMIT_ENV_KEYS);
  const environment = firstDefined(ENVIRONMENT_KEYS) ?? "unknown";

  if (envCommit) {
    return {
      app: "grant-os",
      commit: shortenCommit(envCommit),
      commitFull: envCommit,
      versionSource: "git",
      environment,
      apiSurface: "v2.3A",
      capabilities: [...DEPLOYMENT_CAPABILITIES],
    };
  }

  const fallback = resolveVersionFallback();
  return {
    app: "grant-os",
    commit: fallback.commit,
    commitFull: fallback.commitFull,
    versionSource: fallback.versionSource,
    environment,
    apiSurface: "v2.3A",
    capabilities: [...DEPLOYMENT_CAPABILITIES],
  };
}
