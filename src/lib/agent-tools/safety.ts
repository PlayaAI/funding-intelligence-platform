import type { ToolActor, ToolAuditPayload, ToolError } from "./types";

export function makeToolError(code: string, message: string, details?: Record<string, unknown>): ToolError {
  return { code, message, details };
}

export function normalizeError(error: unknown, fallbackCode = "tool_execution_failed"): ToolError {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    return error as ToolError;
  }
  if (error instanceof Error) {
    return { code: fallbackCode, message: error.message };
  }
  return { code: fallbackCode, message: String(error) };
}

export function makeAuditPayload(input: {
  tool_name: string;
  permission_level: ToolAuditPayload["permission_level"];
  actor: ToolActor;
  payload: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  dry_run: boolean;
  status: ToolAuditPayload["status"];
  error_message?: string | null;
}): ToolAuditPayload {
  return {
    tool_name: input.tool_name,
    permission_level: input.permission_level,
    input: input.payload,
    output_summary: input.output_summary,
    dry_run: input.dry_run,
    status: input.status,
    error_message: input.error_message ?? null,
    actor_type: input.actor.type,
    actor_id: input.actor.id ?? null,
    created_at: new Date().toISOString(),
  };
}

export function summarizeOutput(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return { kind: typeof data };
  if (Array.isArray(data)) return { kind: "array", count: data.length };
  const objectData = data as Record<string, unknown>;
  if (objectData.requires_approval === true) {
    return { kind: "approval_required", affected_records: objectData.proposed_action };
  }
  if ("items" in objectData && Array.isArray(objectData.items)) {
    return { kind: "items", count: objectData.items.length };
  }
  return { kind: "object", keys: Object.keys(objectData).slice(0, 12) };
}
