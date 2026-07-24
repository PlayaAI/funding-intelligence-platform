import { createHash, randomUUID } from "node:crypto";
import type { JsonRecord } from "./types";

export const APPROVABLE_TOOL_NAMES = new Set([
  "archive_grant",
  "batch_archive_expired_grants",
  "mark_grant_status",
  "update_grant_status",
  "set_top_three_grant",
  "remove_top_three_grant",
  "update_grant_notes",
  "update_grant_priority_fields",
  "create_application_from_grant",
  "update_application_status",
  "add_application_note",
  "generate_application_checklist",
  "bulk_create_tasks_from_checklist",
  "create_task",
  "update_task_status",
  "update_task_due_date",
  "propose_agent_knowledge_update",
]);

export type MutationApprovalStatus =
  | "pending"
  | "executing"
  | "executed"
  | "rejected"
  | "expired"
  | "failed";

export type MutationApprovalRecord = {
  id: string;
  requested_by_user_id: string;
  requested_by_token_id: string;
  requested_by_agent_label: string;
  requested_tool: string;
  requested_action: string;
  status: MutationApprovalStatus;
  request_arguments: JsonRecord;
  dry_run_payload: JsonRecord;
  planned_mutation: unknown;
  payload_hash: string;
  approved_payload_hash: string | null;
  execution_nonce: string;
  affected_record_ids: string[];
  risk_warnings: string[];
  expires_at: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  execution_started_at: string | null;
  executed_at: string | null;
  rejected_at: string | null;
  rejected_by_user_id: string | null;
  rejection_reason: string | null;
  result_payload: JsonRecord | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateMutationApprovalInput = {
  requestedByUserId: string;
  requestedByTokenId: string;
  requestedByAgentLabel: string;
  requestedTool: string;
  requestArguments: JsonRecord;
  dryRunPayload: JsonRecord;
  plannedMutation: unknown;
  payloadHash: string;
  affectedRecordIds: string[];
  riskWarnings: string[];
  expiresAt: string;
};

export interface MutationApprovalStore {
  create(input: CreateMutationApprovalInput): Promise<MutationApprovalRecord>;
  getForToken(approvalId: string, tokenId: string): Promise<MutationApprovalRecord | null>;
  listForToken(tokenId: string, statuses?: MutationApprovalStatus[]): Promise<MutationApprovalRecord[]>;
}

const OMITTED_HASH_KEYS = new Set([
  "dryRun",
  "requestApproval",
  "created_at",
  "updated_at",
  "execution_nonce",
]);

const RUNTIME_GENERATED_TIMESTAMP_KEYS = new Set([
  "archived_at",
]);

function canonicalJson(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}

function normalizeLegacyHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeLegacyHash);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !OMITTED_HASH_KEYS.has(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeLegacyHash(nested)])
    );
  }
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
  ) {
    return "<timestamp>";
  }
  return value;
}

function normalizeForHash(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeForHash(item))
      .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !OMITTED_HASH_KEYS.has(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeForHash(nested, key)])
    );
  }
  if (
    parentKey &&
    RUNTIME_GENERATED_TIMESTAMP_KEYS.has(parentKey) &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
  ) {
    return "<runtime-generated-timestamp>";
  }
  return value;
}

export function stripApprovalControlArguments(input: JsonRecord): JsonRecord {
  const { dryRun: _dryRun, requestApproval: _requestApproval, ...rest } = input;
  return rest;
}

export function extractApprovalPlan(previewData: unknown): unknown {
  if (!previewData || typeof previewData !== "object") return {};
  const data = previewData as JsonRecord;
  return {
    plannedMutation: data.plannedMutation ?? data.planned_mutation ?? null,
    plannedAction: data.planned_action ?? null,
    proposal: data.proposal ?? null,
    eligibleRecordIds: data.eligibleRecordIds ?? null,
    duplicate: data.duplicate ?? null,
    skipped: data.skipped ?? [],
    before: data.before ?? null,
    previousStatus: data.previousStatus ?? null,
    previousDueDate: data.previousDueDate ?? null,
    previousValue: data.previousValue ?? null,
  };
}

export function buildMutationApprovalHash(
  toolName: string,
  requestArguments: JsonRecord,
  previewData: unknown
): string {
  const payload = normalizeForHash({
    tool: toolName,
    arguments: stripApprovalControlArguments(requestArguments),
    plan: extractApprovalPlan(previewData),
  });
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

/** Compatibility for approvals requested before deterministic array sorting. */
export function buildLegacyMutationApprovalHash(
  toolName: string,
  requestArguments: JsonRecord,
  previewData: unknown
): string {
  const payload = normalizeLegacyHash({
    tool: toolName,
    arguments: stripApprovalControlArguments(requestArguments),
    plan: extractApprovalPlan(previewData),
  });
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

export type MutationApprovalPayloadVerification =
  | {
      ok: true;
      currentHash: string;
      expectedHashForClaim: string;
      hashVersion: "canonical-v2" | "legacy-v1";
    }
  | {
      ok: false;
      currentHash: string;
      error: {
        code: "payload_hash_mismatch";
        message: string;
      };
    };

export function buildPayloadHashMismatchResponse(approvalId: string) {
  return {
    status: 409,
    body: {
      ok: false,
      error: {
        code: "payload_hash_mismatch",
        message: "The current mutation plan differs from the approved preview. Request a new approval before writing.",
      },
      approvalId,
      mutationPerformed: false,
      writeDisposition: "rejected",
      requiredAction: "request_new_approval",
    },
  } as const;
}

export function verifyMutationApprovalPayload(
  approval: Pick<
    MutationApprovalRecord,
    "requested_tool" | "request_arguments" | "dry_run_payload" | "payload_hash"
  >,
  previewData: unknown
): MutationApprovalPayloadVerification {
  const currentHash = buildMutationApprovalHash(
    approval.requested_tool,
    approval.request_arguments,
    previewData
  );
  if (currentHash === approval.payload_hash) {
    return {
      ok: true,
      currentHash,
      expectedHashForClaim: approval.payload_hash,
      hashVersion: "canonical-v2",
    };
  }

  const originalLegacyHash = buildLegacyMutationApprovalHash(
    approval.requested_tool,
    approval.request_arguments,
    approval.dry_run_payload
  );
  if (originalLegacyHash === approval.payload_hash) {
    const originalCanonicalHash = buildMutationApprovalHash(
      approval.requested_tool,
      approval.request_arguments,
      approval.dry_run_payload
    );
    if (originalCanonicalHash === currentHash) {
      return {
        ok: true,
        currentHash,
        expectedHashForClaim: approval.payload_hash,
        hashVersion: "legacy-v1",
      };
    }
  }
  return {
    ok: false,
    currentHash,
    error: {
      code: "payload_hash_mismatch",
      message: "The current mutation plan differs from the approved preview. Request a new approval before writing.",
    },
  };
}

export function collectApprovalAffectedRecordIds(
  requestArguments: JsonRecord,
  previewData: unknown
): string[] {
  const ids = new Set<string>();
  const previewRecord = previewData && typeof previewData === "object"
    ? previewData as JsonRecord
    : null;
  const hasEligibleRecordIds = Array.isArray(previewRecord?.eligibleRecordIds);
  for (const [key, value] of Object.entries(requestArguments)) {
    if (/Id$/.test(key) && typeof value === "string") ids.add(value);
    // Batch tools report the records they actually plan to mutate through
    // eligibleRecordIds. Do not present skipped input IDs as affected records.
    if (!hasEligibleRecordIds && /Ids$/.test(key) && Array.isArray(value)) {
      value.filter((item): item is string => typeof item === "string").forEach((item) => ids.add(item));
    }
  }
  if (previewRecord) {
    const data = previewRecord;
    for (const key of ["affectedRecordIds", "eligibleRecordIds"]) {
      const values = data[key];
      if (Array.isArray(values)) {
        values.filter((item): item is string => typeof item === "string").forEach((item) => ids.add(item));
      }
    }
    const planned = (data.plannedMutation ?? data.planned_mutation) as JsonRecord | undefined;
    if (Array.isArray(planned?.records)) {
      planned.records.forEach((record) => {
        if (record && typeof record === "object" && typeof (record as JsonRecord).id === "string") {
          ids.add((record as JsonRecord).id as string);
        }
      });
    }
  }
  return [...ids];
}

export function collectApprovalWarnings(previewData: unknown): string[] {
  if (!previewData || typeof previewData !== "object") return [];
  const warnings = (previewData as JsonRecord).warnings;
  return Array.isArray(warnings)
    ? warnings.filter((warning): warning is string => typeof warning === "string").slice(0, 20)
    : [];
}

export function mutationApprovalPublicView(record: MutationApprovalRecord): JsonRecord {
  return {
    id: record.id,
    requestedByAgentLabel: record.requested_by_agent_label,
    requestedTool: record.requested_tool,
    requestedAction: record.requested_action,
    status: record.status,
    affectedRecordIds: record.affected_record_ids,
    warnings: record.risk_warnings,
    expiresAt: record.expires_at,
    approvedAt: record.approved_at,
    executedAt: record.executed_at,
    rejectionReason: record.rejection_reason,
    result: record.result_payload,
    error: record.error_code
      ? { code: record.error_code, message: record.error_message }
      : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function createInMemoryMutationApprovalStore(): MutationApprovalStore & {
  snapshot(): MutationApprovalRecord[];
  update(approvalId: string, updates: Partial<MutationApprovalRecord>): MutationApprovalRecord | null;
} {
  const records: MutationApprovalRecord[] = [];
  return {
    async create(input) {
      const now = new Date().toISOString();
      const record: MutationApprovalRecord = {
        id: randomUUID(),
        requested_by_user_id: input.requestedByUserId,
        requested_by_token_id: input.requestedByTokenId,
        requested_by_agent_label: input.requestedByAgentLabel,
        requested_tool: input.requestedTool,
        requested_action: input.requestedTool,
        status: "pending",
        request_arguments: input.requestArguments,
        dry_run_payload: input.dryRunPayload,
        planned_mutation: input.plannedMutation,
        payload_hash: input.payloadHash,
        approved_payload_hash: null,
        execution_nonce: randomUUID(),
        affected_record_ids: input.affectedRecordIds,
        risk_warnings: input.riskWarnings,
        expires_at: input.expiresAt,
        approved_by_user_id: null,
        approved_at: null,
        execution_started_at: null,
        executed_at: null,
        rejected_at: null,
        rejected_by_user_id: null,
        rejection_reason: null,
        result_payload: null,
        error_code: null,
        error_message: null,
        created_at: now,
        updated_at: now,
      };
      records.push(record);
      return structuredClone(record);
    },
    async getForToken(approvalId, tokenId) {
      const record = records.find(
        (candidate) => candidate.id === approvalId && candidate.requested_by_token_id === tokenId
      );
      return record ? structuredClone(record) : null;
    },
    async listForToken(tokenId, statuses) {
      return records
        .filter(
          (record) =>
            record.requested_by_token_id === tokenId &&
            (!statuses?.length || statuses.includes(record.status))
        )
        .map((record) => structuredClone(record));
    },
    snapshot: () => structuredClone(records),
    update(approvalId, updates) {
      const index = records.findIndex((record) => record.id === approvalId);
      if (index < 0) return null;
      records[index] = {
        ...records[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      return structuredClone(records[index]);
    },
  };
}
