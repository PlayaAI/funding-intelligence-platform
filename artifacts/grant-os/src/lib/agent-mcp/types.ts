import type { PermissionLevel } from "../agent-tools/types";

export type JsonRecord = Record<string, unknown>;

export type McpAdapterHeaders = Record<string, string | string[] | undefined>;

export type McpAdapterResponse = {
  status: number;
  body: JsonRecord;
};

export type McpToolManifestEntry = {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
  enabled: boolean;
  defaultDryRun?: boolean;
  schemaSummary: string;
  exampleInput?: JsonRecord;
};

export type McpCallRequest = {
  name: string;
  arguments?: JsonRecord;
};

export type AgentToolForwardRequest = {
  tool: string;
  input: JsonRecord;
};

export type AgentApiClientResponse = {
  status: number;
  body: JsonRecord;
};
