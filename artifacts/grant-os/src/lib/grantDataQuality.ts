/**
 * grantDataQuality.ts
 *
 * Pure helper for deriving data-quality warning flags from existing grant fields.
 * No DB calls. No new schema fields required.
 *
 * Reusable by:
 *  - Dashboard UI components
 *  - Future MCP/agent tools that want to surface data-quality context
 */

// ─── Flag types ────────────────────────────────────────────────────────────────

export type DataQualityFlagKey =
  | "past_deadline"
  | "deadline_soon"
  | "eligibility_unknown"
  | "amount_unclear"
  | "application_url_missing"
  | "no_linked_documents"
  | "no_linked_application"
  | "no_linked_proof"
  | "needs_source_verification"
  | "potentially_ineligible"
  | "system_only_recommendation";

export interface DataQualityFlag {
  key: DataQualityFlagKey;
  label: string;
  /** Short advisory sentence shown on hover / in the detail card */
  description: string;
  /** Visual severity: "warn" = amber, "info" = slate/blue, "critical" = red */
  severity: "info" | "warn" | "critical";
}

// ─── Input shapes ──────────────────────────────────────────────────────────────

/**
 * Minimal set of grant fields required to derive most flags.
 * Matches both the raw GrantRow and the mapped Grant where possible.
 */
export interface GrantQualityInput {
  /** ISO date string or null/empty */
  deadline?: string | null;
  /** Display amount string e.g. "$10K–$75K" or null */
  amount_display?: string | null;
  /** Numeric min amount */
  amount_min?: number | null;
  /** Numeric max amount */
  amount_max?: number | null;
  /** Direct application URL */
  application_url?: string | null;
  /** Source / funder page URL */
  source_url?: string | null;
  /** Eligibility text */
  eligibility?: string | null;
  /** Freeform notes field */
  notes?: string | null;
}

/**
 * Optional related data that, if available, enables more flags.
 */
export interface GrantQualityRelatedData {
  /** Number of linked documents. Pass relatedDocs.length or undefined if not loaded. */
  documentCount?: number;
  /** Number of linked applications. Pass relatedApps.length or undefined if not loaded. */
  applicationCount?: number;
  /** Number of linked proof items. Pass result of filtering proofItems by project id or undefined. */
  proofItemCount?: number;
  /**
   * True if the only matches for this grant are system/rules-engine generated.
   * False or undefined means agent matches exist (no flag).
   */
  hasOnlySystemMatches?: boolean;
}

// ─── Helper ────────────────────────────────────────────────────────────────────

const VERIFICATION_KEYWORDS = [
  "verify",
  "unverified",
  "eligibility",
  "university-led",
  "not active priority",
  "monitor only",
  "confirm",
  "check",
  "unclear",
];

const INELIGIBLE_KEYWORDS = [
  "university-led",
  "not active priority",
  "ineligible",
  "not eligible",
  "does not qualify",
  "not qualify",
];

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isAmountUnclear(
  amount_display: string | null | undefined,
  amount_min: number | null | undefined,
  amount_max: number | null | undefined,
): boolean {
  // If amount_display looks like a real value, it's clear
  if (amount_display && amount_display.trim() && !amount_display.match(/^\$0[Kk]?[–\-]?\$?0[Kk]?$/)) {
    return false;
  }
  // If we have numeric amounts, it's clear
  if ((amount_min && amount_min > 0) || (amount_max && amount_max > 0)) {
    return false;
  }
  return true;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Derive an ordered list of data-quality warning flags for a grant.
 *
 * All inputs are optional — missing values generate appropriate flags.
 * Critical flags come first (past deadline), then warnings, then info.
 *
 * @example
 * // In a React component using the raw GrantRow:
 * const flags = deriveGrantDataQualityFlags(grantRow, {
 *   documentCount: relatedDocs.length,
 *   applicationCount: relatedApps.length,
 * });
 *
 * @example
 * // In an MCP tool / agent context with partial data:
 * const flags = deriveGrantDataQualityFlags({ deadline: grant.deadline, notes: grant.notes });
 */
export function deriveGrantDataQualityFlags(
  grant: GrantQualityInput,
  related?: GrantQualityRelatedData,
): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];
  const days = daysUntil(grant.deadline);
  const notes = (grant.notes ?? "").toLowerCase();

  // ── Critical ──────────────────────────────────────────────────────────────

  if (grant.deadline && days !== null && days <= 0) {
    flags.push({
      key: "past_deadline",
      label: "Past deadline",
      description: "The recorded deadline has passed. Confirm whether a new cycle is open before committing effort.",
      severity: "critical",
    });
  }

  // ── Warnings ──────────────────────────────────────────────────────────────

  if (grant.deadline && days !== null && days > 0 && days <= 14) {
    flags.push({
      key: "deadline_soon",
      label: "Deadline soon",
      description: `Deadline is in ${days} day${days === 1 ? "" : "s"}. Prioritise immediately if applying.`,
      severity: "warn",
    });
  }

  if (INELIGIBLE_KEYWORDS.some((kw) => notes.includes(kw))) {
    flags.push({
      key: "potentially_ineligible",
      label: "Potentially ineligible",
      description: "Notes contain language suggesting eligibility constraints. Confirm applicant structure before proceeding.",
      severity: "warn",
    });
  }

  if (VERIFICATION_KEYWORDS.some((kw) => notes.includes(kw))) {
    flags.push({
      key: "needs_source_verification",
      label: "Needs source verification",
      description: "Notes contain language suggesting the data should be verified against the official source.",
      severity: "warn",
    });
  }

  if (!grant.eligibility || !grant.eligibility.trim()) {
    flags.push({
      key: "eligibility_unknown",
      label: "Eligibility unknown",
      description: "No eligibility criteria are stored. Review the official program page before applying.",
      severity: "warn",
    });
  }

  if (isAmountUnclear(grant.amount_display, grant.amount_min, grant.amount_max)) {
    flags.push({
      key: "amount_unclear",
      label: "Amount unclear",
      description: "No verified award amount or range is stored. Check the official funder page.",
      severity: "warn",
    });
  }

  if (!grant.application_url) {
    flags.push({
      key: "application_url_missing",
      label: "Application URL missing",
      description: "No application portal URL is stored. Locate the submission portal before starting.",
      severity: "warn",
    });
  }

  // ── Info ──────────────────────────────────────────────────────────────────

  if (related?.documentCount !== undefined && related.documentCount === 0) {
    flags.push({
      key: "no_linked_documents",
      label: "No linked documents",
      description: "No source files or grant guidelines are attached. Add documents to support readiness assessment.",
      severity: "info",
    });
  }

  if (related?.applicationCount !== undefined && related.applicationCount === 0) {
    flags.push({
      key: "no_linked_application",
      label: "No linked application",
      description: "No application workspace has been started for this grant.",
      severity: "info",
    });
  }

  if (related?.proofItemCount !== undefined && related.proofItemCount === 0) {
    flags.push({
      key: "no_linked_proof",
      label: "No linked proof",
      description: "No proof items are linked to the related project. Review readiness evidence.",
      severity: "info",
    });
  }

  if (related?.hasOnlySystemMatches === true) {
    flags.push({
      key: "system_only_recommendation",
      label: "System-only recommendation",
      description: "Matches for this grant were generated by the rules engine only — no agent review has been performed.",
      severity: "info",
    });
  }

  // Deduplicate by key (in case caller calls multiple times)
  const seen = new Set<DataQualityFlagKey>();
  return flags.filter((f) => {
    if (seen.has(f.key)) return false;
    seen.add(f.key);
    return true;
  });
}

/**
 * Returns a single one-sentence recommended next check based on the highest-priority flag.
 */
export function getDataQualityNextCheck(flags: DataQualityFlag[]): string | null {
  const critical = flags.find((f) => f.severity === "critical");
  if (critical) return critical.description;
  const warn = flags.find((f) => f.severity === "warn");
  if (warn) return warn.description;
  const info = flags.find((f) => f.severity === "info");
  if (info) return info.description;
  return null;
}
