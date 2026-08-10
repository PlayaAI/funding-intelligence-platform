import { createHash } from "node:crypto";
import { z } from "zod";
import type { ApplicationRow, GrantInsert, GrantRow, GrantUpdate, TaskRow } from "../../types/database";
import { buildChecklistTemplate } from "./builders";
import { buildDryRunPlan } from "./dryRun";
import type { GrantOsRepository } from "./repository";
import { makeToolError } from "./safety";
import type { ToolDefinition } from "./types";

const DAY_MS = 86_400_000;
const CLOSED_GRANT_STATUSES = new Set(["Submitted", "Awarded", "Declined", "Archived"]);
const OPEN_APPLICATION_STATUSES = new Set(["Not Started", "Drafting", "Internal Review", "Ready to Submit"]);

export const grantCandidateSchema = z.object({
  title: z.string().trim().min(3).max(240),
  funderName: z.string().trim().min(2).max(200),
  sourceUrl: z.string().url().refine((value) => value.startsWith("https://"), "sourceUrl must use HTTPS"),
  applicationUrl: z.string().url().refine((value) => value.startsWith("https://"), "applicationUrl must use HTTPS").optional(),
  sourceType: z.enum(["primary", "secondary", "unknown"]).default("unknown"),
  verificationStatus: z.enum(["verified", "needs_confirmation", "unverified"]).default("unverified"),
  deadline: z.string().date().optional(),
  deadlineVerificationStatus: z.enum(["verified", "needs_confirmation", "rolling", "unknown"]).default("unknown"),
  applicantPathStatus: z.enum(["verified", "needs_confirmation", "ineligible", "unknown"]).default("unknown"),
  lastVerifiedAt: z.string().datetime().optional(),
  externalId: z.string().trim().max(200).optional(),
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().nonnegative().optional(),
  amountDisplay: z.string().trim().max(120).optional(),
  focusAreas: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  geography: z.string().trim().max(200).optional(),
  eligibility: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
  relatedProjectId: z.string().min(1).optional(),
  relatedProjectSlug: z.string().trim().max(120).optional(),
  fitScore: z.number().int().min(0).max(100).optional(),
  priorityScore: z.number().int().min(0).max(100).optional(),
});

export type GrantCandidate = z.infer<typeof grantCandidateSchema>;

type CandidateValidation = {
  valid: boolean;
  riskFlags: string[];
  warnings: string[];
  autoApplicationEligible: boolean;
};

function canonicalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"]) {
      url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    const sorted = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    for (const [key, item] of sorted) url.searchParams.append(key, item);
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

function normalizedText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function candidateFingerprint(candidate: GrantCandidate): string {
  const stable = JSON.stringify({
    source: canonicalUrl(candidate.sourceUrl),
    externalId: candidate.externalId ?? null,
    title: normalizedText(candidate.title),
    funder: normalizedText(candidate.funderName),
    deadline: candidate.deadline ?? null,
  });
  return createHash("sha256").update(stable).digest("hex");
}

function daysRemaining(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const parsed = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((parsed.getTime() - today) / DAY_MS);
}

function claimRiskFlags(candidate: GrantCandidate): string[] {
  const text = [candidate.title, candidate.eligibility, candidate.notes, ...candidate.focusAreas].filter(Boolean).join(" ");
  const flags: string[] = [];
  if (candidate.sourceType !== "primary") flags.push("primary_source_not_verified");
  if (candidate.verificationStatus !== "verified") flags.push("grant_details_need_confirmation");
  if (candidate.deadline && candidate.deadlineVerificationStatus !== "verified") flags.push("deadline_needs_confirmation");
  if (!candidate.deadline) flags.push("deadline_unknown");
  if (candidate.applicantPathStatus !== "verified") flags.push("applicant_path_not_verified");
  if (/\b501\s*\(c\)\(3\)|nonprofit status/i.test(text)) flags.push("nonprofit_status_requires_primary_proof");
  if (/\bburning man\b.*\b(partner|partnership|official)\b/i.test(text)) flags.push("official_partnership_claim_requires_primary_proof");
  if (/\b(clinical|patient|biometric|medical)\b/i.test(text)) flags.push("clinical_or_biometric_claim_requires_review");
  if (/\b(university|research institution|academic institution)\b/i.test(text)) flags.push("research_institution_requirement");
  if (/\b(mystic arts foundation|fiscal sponsor)\b/i.test(text) && candidate.applicantPathStatus !== "verified") {
    flags.push("fiscal_sponsor_path_requires_confirmation");
  }
  return [...new Set(flags)];
}

export function validateGrantCandidate(candidate: GrantCandidate): CandidateValidation {
  const riskFlags = claimRiskFlags(candidate);
  const warnings: string[] = [];
  if (candidate.amountMin !== undefined && candidate.amountMax !== undefined && candidate.amountMin > candidate.amountMax) {
    warnings.push("amount_min_exceeds_amount_max");
  }
  const days = daysRemaining(candidate.deadline);
  if (days !== null && days < 0) warnings.push("deadline_passed");
  if (!candidate.applicationUrl) warnings.push("application_url_missing");
  const blockingApplicationRisks = new Set([
    "primary_source_not_verified",
    "grant_details_need_confirmation",
    "deadline_needs_confirmation",
    "deadline_unknown",
    "applicant_path_not_verified",
    "nonprofit_status_requires_primary_proof",
    "official_partnership_claim_requires_primary_proof",
    "clinical_or_biometric_claim_requires_review",
    "research_institution_requirement",
    "fiscal_sponsor_path_requires_confirmation",
  ]);
  return {
    valid: !warnings.includes("amount_min_exceeds_amount_max"),
    riskFlags,
    warnings,
    autoApplicationEligible:
      candidate.sourceType === "primary" &&
      candidate.verificationStatus === "verified" &&
      candidate.deadlineVerificationStatus === "verified" &&
      candidate.applicantPathStatus === "verified" &&
      (days ?? -1) >= 14 &&
      (candidate.fitScore ?? 0) >= 80 &&
      candidate.relatedProjectId !== undefined &&
      !riskFlags.some((flag) => blockingApplicationRisks.has(flag)),
  };
}

type Duplicate = { grant: GrantRow; reason: "source_url" | "application_url" | "fingerprint" | "title_funder_deadline" };

function findDuplicate(grants: GrantRow[], candidate: GrantCandidate): Duplicate | null {
  const source = canonicalUrl(candidate.sourceUrl);
  const application = canonicalUrl(candidate.applicationUrl);
  const fingerprint = candidateFingerprint(candidate);
  for (const grant of grants) {
    if (source && canonicalUrl(grant.source_url) === source) return { grant, reason: "source_url" };
    if (application && canonicalUrl(grant.application_url) === application) return { grant, reason: "application_url" };
    if (grant.source_fingerprint && grant.source_fingerprint === fingerprint) return { grant, reason: "fingerprint" };
    if (
      normalizedText(grant.title) === normalizedText(candidate.title) &&
      normalizedText(grant.funder_name) === normalizedText(candidate.funderName) &&
      (grant.deadline ?? grant.next_deadline ?? null) === (candidate.deadline ?? null)
    ) return { grant, reason: "title_funder_deadline" };
  }
  return null;
}

function grantValues(candidate: GrantCandidate, actorId: string | null, discoveryRunId?: string): Omit<GrantInsert, "id" | "created_at" | "updated_at"> {
  const validation = validateGrantCandidate(candidate);
  return {
    title: candidate.title,
    funder_name: candidate.funderName,
    related_project_id: candidate.relatedProjectId ?? null,
    related_project_slug: candidate.relatedProjectSlug ?? null,
    deadline: candidate.deadline ?? null,
    next_deadline: null,
    amount_min: candidate.amountMin ?? null,
    amount_max: candidate.amountMax ?? null,
    amount_display: candidate.amountDisplay ?? null,
    focus_areas: candidate.focusAreas,
    geography: candidate.geography ?? null,
    eligibility: candidate.eligibility ?? null,
    application_url: candidate.applicationUrl ?? null,
    source_url: canonicalUrl(candidate.sourceUrl),
    source_type: candidate.sourceType,
    verification_status: candidate.verificationStatus,
    deadline_verification_status: candidate.deadlineVerificationStatus,
    applicant_path_status: candidate.applicantPathStatus,
    last_verified_at: candidate.lastVerifiedAt ?? null,
    discovered_at: new Date().toISOString(),
    discovered_by_agent_token_id: actorId,
    source_fingerprint: candidateFingerprint(candidate),
    discovery_run_id: discoveryRunId ?? null,
    risk_flags: validation.riskFlags,
    required_documents: [],
    application_questions: null,
    status: "Researching",
    priority: null,
    fit_score: candidate.fitScore ?? null,
    priority_score: candidate.priorityScore ?? candidate.fitScore ?? null,
    difficulty_score: null,
    proof_readiness: "needs_review",
    application_readiness: validation.autoApplicationEligible ? "eligible_for_internal_workspace" : "needs_review",
    is_top_three: false,
    notes: candidate.notes ?? null,
    archived_at: null,
  };
}

function safeUpdateValues(candidate: GrantCandidate, existing: GrantRow, discoveryRunId?: string): GrantUpdate {
  const values = grantValues(candidate, null, discoveryRunId);
  const safe: Record<string, unknown> = {
    title: values.title,
    funder_name: values.funder_name,
    source_url: values.source_url,
  };
  if (discoveryRunId) safe.discovery_run_id = discoveryRunId;
  if (candidate.lastVerifiedAt) safe.last_verified_at = candidate.lastVerifiedAt;
  const copyWhenProvided: Array<[keyof GrantCandidate, keyof GrantInsert]> = [
    ["applicationUrl", "application_url"], ["deadline", "deadline"], ["amountMin", "amount_min"],
    ["amountMax", "amount_max"], ["amountDisplay", "amount_display"], ["geography", "geography"],
    ["eligibility", "eligibility"], ["notes", "notes"], ["relatedProjectId", "related_project_id"],
    ["relatedProjectSlug", "related_project_slug"], ["fitScore", "fit_score"], ["priorityScore", "priority_score"],
  ];
  for (const [candidateKey, databaseKey] of copyWhenProvided) {
    if (candidate[candidateKey] !== undefined) safe[databaseKey] = (values as Record<string, unknown>)[databaseKey];
  }
  if (candidate.focusAreas.length > 0) safe.focus_areas = values.focus_areas;

  const existingSource = existing.source_type === "primary" || existing.source_type === "secondary" ? existing.source_type : "unknown";
  const existingVerification = existing.verification_status === "verified" || existing.verification_status === "needs_confirmation" ? existing.verification_status : "unverified";
  const existingDeadlineVerification = ["verified", "needs_confirmation", "rolling"].includes(existing.deadline_verification_status ?? "") ? existing.deadline_verification_status as GrantCandidate["deadlineVerificationStatus"] : "unknown";
  const existingApplicantPath = ["verified", "needs_confirmation", "ineligible"].includes(existing.applicant_path_status ?? "") ? existing.applicant_path_status as GrantCandidate["applicantPathStatus"] : "unknown";
  const effectiveSource = candidate.sourceType !== "unknown" ? candidate.sourceType : existingSource;
  const effectiveVerification = candidate.verificationStatus !== "unverified" ? candidate.verificationStatus : existingVerification;
  const effectiveDeadlineVerification = candidate.deadlineVerificationStatus !== "unknown" ? candidate.deadlineVerificationStatus : existingDeadlineVerification;
  const effectiveApplicantPath = candidate.applicantPathStatus !== "unknown" ? candidate.applicantPathStatus : existingApplicantPath;
  safe.source_type = effectiveSource;
  safe.verification_status = effectiveVerification;
  safe.deadline_verification_status = effectiveDeadlineVerification;
  safe.applicant_path_status = effectiveApplicantPath;
  const effectiveCandidate: GrantCandidate = {
    ...candidate,
    sourceType: effectiveSource,
    verificationStatus: effectiveVerification,
    deadline: candidate.deadline ?? existing.deadline ?? existing.next_deadline ?? undefined,
    deadlineVerificationStatus: effectiveDeadlineVerification,
    applicantPathStatus: effectiveApplicantPath,
    applicationUrl: candidate.applicationUrl ?? existing.application_url ?? undefined,
    eligibility: candidate.eligibility ?? existing.eligibility ?? undefined,
    notes: candidate.notes ?? existing.notes ?? undefined,
    relatedProjectId: candidate.relatedProjectId ?? existing.related_project_id ?? undefined,
    fitScore: candidate.fitScore ?? existing.fit_score ?? undefined,
  };
  safe.source_fingerprint = candidateFingerprint(effectiveCandidate);
  safe.risk_flags = claimRiskFlags(effectiveCandidate);
  if (validateGrantCandidate(effectiveCandidate).autoApplicationEligible) safe.application_readiness = "eligible_for_internal_workspace";
  return safe as GrantUpdate;
}

async function upsertCandidate(
  repository: GrantOsRepository,
  candidate: GrantCandidate,
  actorId: string | null,
  discoveryRunId: string | undefined,
  allowUpdate: boolean,
) {
  const validation = validateGrantCandidate(candidate);
  if (!validation.valid) throw makeToolError("validation_failed", validation.warnings.join(", "));
  const grants = await repository.listGrants({ includeSoftArchived: true });
  const duplicate = findDuplicate(grants, candidate);
  if (duplicate?.grant.archived_at) {
    return { action: "skipped" as const, grant: duplicate.grant, duplicate, validation, reason: "archived_duplicate_requires_review" };
  }
  if (duplicate && !allowUpdate) {
    throw makeToolError("duplicate_record", `Grant already exists as ${duplicate.grant.id} (${duplicate.reason}).`);
  }
  if (duplicate) {
    const updated = await repository.updateGrant(duplicate.grant.id, safeUpdateValues(candidate, duplicate.grant, discoveryRunId));
    return { action: "updated" as const, grant: updated, duplicate, validation };
  }
  const created = await repository.createGrant(grantValues(candidate, actorId, discoveryRunId));
  return { action: "created" as const, grant: created, duplicate: null, validation };
}

function compactGrant(grant: GrantRow) {
  return {
    id: grant.id,
    title: grant.title,
    funder: grant.funder_name,
    status: grant.status,
    deadline: grant.deadline ?? grant.next_deadline,
    source_url: grant.source_url,
    application_url: grant.application_url,
    verification_status: grant.verification_status ?? null,
    applicant_path_status: grant.applicant_path_status ?? null,
    fit_score: grant.fit_score,
    priority_score: grant.priority_score,
    risk_flags: grant.risk_flags ?? [],
  };
}

function checklistDueDate(deadline: string | null, index: number): string | null {
  if (!deadline) return null;
  const date = new Date(`${deadline}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - [21, 14, 7][index]);
  const now = new Date();
  if (date <= now) date.setUTCDate(now.getUTCDate() + index + 1);
  return date.toISOString().slice(0, 10);
}

async function createApplicationAndTasks(repository: GrantOsRepository, grant: GrantRow) {
  if (!grant.related_project_id) return { application: null, tasks: [], skipped: "project_missing" };
  const existing = (await repository.listApplicationsByGrant(grant.id)).find((app) => app.project_id === grant.related_project_id);
  if (existing) return { application: existing, tasks: await repository.listTasksByApplication(existing.id), skipped: "application_exists" };
  const project = await repository.getProject(grant.related_project_id);
  if (!project) return { application: null, tasks: [], skipped: "project_not_found" };
  const application = await repository.createApplication({
    grant_id: grant.id,
    project_id: project.id,
    title: `${project.name} — ${grant.title}`,
    status: "Not Started",
    owner_name: null,
    google_doc_url: null,
    drive_folder_url: null,
    portal_url: null,
    submitted_at: null,
    result: null,
    notes: "Created automatically by the bounded Grant OS autonomous operator. External submission remains blocked.",
    archived_at: null,
  });
  const template = buildChecklistTemplate(grant, project);
  const tasks: TaskRow[] = [];
  for (const [index, item] of template.entries()) {
    tasks.push(await repository.createTask({
      title: item.title,
      description: item.description,
      owner_name: null,
      status: "Not Started",
      priority: item.priority,
      due_date: checklistDueDate(grant.deadline ?? grant.next_deadline, index),
      related_project_id: project.id,
      related_grant_id: grant.id,
      related_application_id: application.id,
      related_proof_item_id: null,
      notes: "Generated by the bounded Grant OS autonomous operator.",
      archived_at: null,
    }));
  }
  return { application, tasks, skipped: null };
}

function planCandidate(candidate: GrantCandidate, existing: GrantRow[], allowUpdate: boolean) {
  const validation = validateGrantCandidate(candidate);
  const duplicate = findDuplicate(existing, candidate);
  return {
    action: duplicate ? (allowUpdate && !duplicate.grant.archived_at ? "update" : "skip") : "create",
    existingGrantId: duplicate?.grant.id ?? null,
    duplicateReason: duplicate?.reason ?? null,
    candidate: {
      title: candidate.title,
      funder_name: candidate.funderName,
      deadline: candidate.deadline ?? null,
      source_url: canonicalUrl(candidate.sourceUrl),
      source_type: candidate.sourceType,
      verification_status: candidate.verificationStatus,
      applicant_path_status: candidate.applicantPathStatus,
      fit_score: candidate.fitScore ?? null,
      risk_flags: validation.riskFlags,
    },
    validation,
  };
}

export function createAutonomousGrantTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  const candidateInput = grantCandidateSchema;
  const tools: Array<ToolDefinition<any, any>> = [
    {
      name: "get_grant_discovery_brief",
      description: "Return a low-token search brief and ingestion contract for an external browsing-capable agent.",
      permissionLevel: "read",
      inputSchema: z.object({ projectLimit: z.number().int().min(1).max(10).default(5) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["The browsing agent must verify deadlines and eligibility on primary funder sources."],
      relatedTables: ["projects", "grants"],
      touchesRealDb: true,
      async execute({ projectLimit }) {
        const [projects, grants] = await Promise.all([repository.listProjects(), repository.listGrants()]);
        return {
          projects: projects.slice(0, projectLimit).map((project) => ({ id: project.id, name: project.name, slug: project.slug, category: project.category, grant_relevance: project.grant_relevance })),
          existing_source_urls: grants.map((grant) => canonicalUrl(grant.source_url)).filter(Boolean).slice(0, 100),
          search_rules: [
            "Prefer official funder program pages, government notices, and primary application portals.",
            "Verify deadline, applicant eligibility, applicant path, amount, and application URL before marking verified.",
            "Treat aggregators and search snippets as secondary sources only.",
            "Never infer Playa AI standalone 501(c)(3) status or an official Burning Man partnership.",
            "Return no more than 50 structured candidates per cycle.",
          ],
          next_tool: "run_grant_discovery_cycle",
          candidate_contract: ["title", "funderName", "sourceUrl", "sourceType", "verificationStatus", "deadline", "deadlineVerificationStatus", "applicantPathStatus", "lastVerifiedAt", "applicationUrl", "relatedProjectId", "fitScore", "priorityScore"],
          warnings: ["MCP supplies ingestion and operations. Web searching is performed by the browsing-capable agent or a scheduler using this brief."],
        };
      },
    },
    {
      name: "validate_grant_candidate",
      description: "Validate one discovered grant without writing or returning long source content.",
      permissionLevel: "read",
      inputSchema: candidateInput,
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Validation is decision support; primary-source facts still require verification."],
      relatedTables: ["grants"],
      touchesRealDb: false,
      async execute(candidate) {
        return { candidate: { title: candidate.title, funder: candidate.funderName, source_url: canonicalUrl(candidate.sourceUrl) }, ...validateGrantCandidate(candidate), fingerprint: candidateFingerprint(candidate), warnings: validateGrantCandidate(candidate).warnings };
      },
    },
    {
      name: "find_duplicate_grants",
      description: "Return compact duplicate candidates using normalized URLs, fingerprints, and title/funder/deadline.",
      permissionLevel: "read",
      inputSchema: candidateInput,
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Fuzzy matching is conservative and may require a later merge decision."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute(candidate) {
        const duplicate = findDuplicate(await repository.listGrants({ includeSoftArchived: true }), candidate);
        return { duplicate: duplicate ? { ...compactGrant(duplicate.grant), reason: duplicate.reason, archived: Boolean(duplicate.grant.archived_at) } : null, warnings: [] };
      },
    },
    ...(["create_grant", "upsert_grant_from_source", "refresh_grant_from_source"] as const).map((name) => ({
      name,
      description: name === "create_grant"
        ? "Create one source-backed Researching grant; duplicates are rejected."
        : name === "refresh_grant_from_source"
          ? "Refresh allowlisted research fields from a source-backed candidate without changing workflow status."
          : "Create or safely refresh one source-backed grant using deterministic deduplication.",
      permissionLevel: "write_safe" as const,
      inputSchema: z.object({ candidate: candidateInput, dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "manual_entry" as const,
      risks: ["Creates or refreshes internal grant research records only; never submits or contacts a funder."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute(input: { candidate: GrantCandidate; dryRun: boolean }, context: { actor: { tokenId?: string | null } }) {
        const grants = await repository.listGrants({ includeSoftArchived: true });
        const allowUpdate = name !== "create_grant";
        const plannedMutation = { table: "grants", action: name, record: planCandidate(input.candidate, grants, allowUpdate) };
        if (input.dryRun) return { ...buildDryRunPlan(plannedMutation, ["grants"]), affectedRecordIds: [], warnings: plannedMutation.record.validation.warnings };
        const result = await upsertCandidate(repository, input.candidate, context.actor.tokenId ?? null, undefined, allowUpdate);
        return {
          dryRun: false,
          mutationPerformed: result.action === "created" || result.action === "updated",
          affectedRecordIds: result.action === "skipped" ? [] : [result.grant.id],
          appliedMutation: { table: "grants", action: result.action, id: result.grant.id },
          grant: compactGrant(result.grant),
          duplicate: result.duplicate ? { id: result.duplicate.grant.id, reason: result.duplicate.reason } : null,
          before: result.duplicate ? compactGrant(result.duplicate.grant) : null,
          after: compactGrant(result.grant),
          warnings: [...result.validation.warnings, ...(result.action === "skipped" ? [result.reason] : [])],
        };
      },
    })),
    {
      name: "bulk_upsert_grants_from_sources",
      description: "Deduplicate and create/refresh up to 50 compact source-backed grant candidates in one call.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ candidates: z.array(candidateInput).min(1).max(50), dryRun: z.boolean().default(true), discoveryRunId: z.string().uuid().optional() }),
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Large batches are bounded and uncertain records remain Researching."],
      relatedTables: ["grants", "agent_discovery_runs"],
      touchesRealDb: true,
      async execute(input: { candidates: GrantCandidate[]; dryRun: boolean; discoveryRunId?: string }, context) {
        const grants = await repository.listGrants({ includeSoftArchived: true });
        const plan: Array<ReturnType<typeof planCandidate>> = input.candidates.map((candidate) => planCandidate(candidate, grants, true));
        if (input.dryRun) return { ...buildDryRunPlan({ table: "grants", action: "bulk_upsert", records: plan }, ["grants"]), affectedRecordIds: [], counts: { candidates: plan.length, creates: plan.filter((item) => item.action === "create").length, updates: plan.filter((item) => item.action === "update").length, skips: plan.filter((item) => item.action === "skip").length }, warnings: plan.flatMap((item) => item.validation.warnings) };
        const results = [];
        for (const candidate of input.candidates as GrantCandidate[]) results.push(await upsertCandidate(repository, candidate, context.actor.tokenId ?? null, input.discoveryRunId, true));
        const affected = results.filter((item) => item.action !== "skipped").map((item) => item.grant.id);
        return { dryRun: false, mutationPerformed: affected.length > 0, affectedRecordIds: affected, appliedMutation: { table: "grants", action: "bulk_upsert", created: results.filter((item) => item.action === "created").map((item) => item.grant.id), updated: results.filter((item) => item.action === "updated").map((item) => item.grant.id) }, counts: { candidates: results.length, created: results.filter((item) => item.action === "created").length, updated: results.filter((item) => item.action === "updated").length, skipped: results.filter((item) => item.action === "skipped").length }, items: results.map((item) => ({ action: item.action, grant: compactGrant(item.grant), warnings: item.validation.warnings })), warnings: [] };
      },
    },
    {
      name: "run_autonomous_grant_ops_cycle",
      description: "Run one bounded agent-native cycle: ingest candidates, archive safely expired grants, refresh Top 3, and start only strictly eligible internal applications/tasks.",
      permissionLevel: "write_safe",
      inputSchema: z.object({
        candidates: z.array(candidateInput).max(50).default([]),
        querySummary: z.string().trim().max(1000).optional(),
        sourcesChecked: z.number().int().min(0).max(1000).default(0),
        archiveExpired: z.boolean().default(true),
        recalculateTopThree: z.boolean().default(true),
        startEligibleApplications: z.boolean().default(true),
        maxApplications: z.number().int().min(0).max(5).default(3),
        dryRun: z.boolean().default(true),
      }),
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Automates reversible internal operations only. Submission, outreach, deletion, and knowledge approval remain blocked."],
      relatedTables: ["grants", "applications", "tasks", "agent_autonomy_events"],
      touchesRealDb: true,
      async execute(input, context) {
        const [allGrants, applications] = await Promise.all([repository.listGrants({ includeSoftArchived: true }), repository.listApplications()]);
        const candidatePlan = (input.candidates as GrantCandidate[]).map((candidate) => planCandidate(candidate, allGrants, true));
        const openByGrant = new Set(applications.filter((app) => app.grant_id && OPEN_APPLICATION_STATUSES.has(app.status)).map((app) => app.grant_id as string));
        const expiring = allGrants.filter((grant) => {
          const days = daysRemaining(grant.deadline ?? grant.next_deadline);
          return !grant.archived_at && !CLOSED_GRANT_STATUSES.has(grant.status) && days !== null && days < 0 && !openByGrant.has(grant.id);
        });
        const eligibleCandidates = candidatePlan.filter((item) => item.validation.autoApplicationEligible).slice(0, input.maxApplications);
        const plannedMutation = {
          action: "autonomous_grant_ops_cycle",
          ingest: candidatePlan,
          archive: input.archiveExpired ? expiring.map((grant) => ({ id: grant.id, before: { status: grant.status, is_top_three: grant.is_top_three }, after: { status: "Archived", is_top_three: false } })) : [],
          top_three: input.recalculateTopThree ? "recalculate_from_verified_active_grants" : "unchanged",
          applications: input.startEligibleApplications ? eligibleCandidates.map((item) => ({ title: item.candidate.title, existingGrantId: item.existingGrantId })) : [],
        };
        if (input.dryRun) return { ...buildDryRunPlan(plannedMutation, ["grants", "applications", "tasks"]), affectedRecordIds: [], counts: { candidates: candidatePlan.length, archive: plannedMutation.archive.length, eligibleApplications: plannedMutation.applications.length }, warnings: ["Dry-run only. Real execution requires an enabled token-bound autonomy policy."] };

        const affected = new Set<string>();
        const ingested: Array<{ action: string; grant: GrantRow; validation: CandidateValidation }> = [];
        const discoveryRun = context.actor.tokenId && context.actor.userId
          ? await repository.createDiscoveryRun({ tokenId: context.actor.tokenId, userId: context.actor.userId, querySummary: input.querySummary ?? null })
          : null;
        for (const candidate of input.candidates as GrantCandidate[]) {
          const result = await upsertCandidate(repository, candidate, context.actor.tokenId ?? null, discoveryRun?.id, true);
          ingested.push({ action: result.action, grant: result.grant, validation: result.validation });
          if (result.action !== "skipped") affected.add(result.grant.id);
        }

        const archived: string[] = [];
        if (input.archiveExpired) {
          for (const grant of expiring) {
            const updated = await repository.updateGrant(grant.id, { status: "Archived", archived_at: new Date().toISOString(), is_top_three: false, notes: [grant.notes, "Archived automatically after verified stored deadline passed."].filter(Boolean).join("\n") });
            archived.push(updated.id);
            affected.add(updated.id);
          }
        }

        const current = await repository.listGrants();
        const ranked = current.filter((grant) => {
          const days = daysRemaining(grant.deadline ?? grant.next_deadline);
          return days !== null && days >= 0 && grant.source_type === "primary" && grant.verification_status === "verified" && grant.deadline_verification_status === "verified" && grant.applicant_path_status === "verified" && !(grant.risk_flags ?? []).length;
        }).sort((a, b) => (b.priority_score ?? b.fit_score ?? 0) - (a.priority_score ?? a.fit_score ?? 0) || (daysRemaining(a.deadline ?? a.next_deadline) ?? 99999) - (daysRemaining(b.deadline ?? b.next_deadline) ?? 99999) || a.id.localeCompare(b.id));
        const topIds = new Set(ranked.slice(0, 3).map((grant) => grant.id));
        const topThreeChanged: string[] = [];
        if (input.recalculateTopThree) {
          for (const grant of current) {
            const next = topIds.has(grant.id);
            if (grant.is_top_three !== next) {
              await repository.updateGrant(grant.id, { is_top_three: next });
              topThreeChanged.push(grant.id);
              affected.add(grant.id);
            }
          }
        }

        const applicationsCreated: ApplicationRow[] = [];
        const tasksCreated: TaskRow[] = [];
        const applicationSkips: Array<{ grantId: string; reason: string }> = [];
        if (input.startEligibleApplications) {
          const applicationCandidates = ingested.filter((item) => item.validation.autoApplicationEligible).slice(0, input.maxApplications);
          for (const item of applicationCandidates) {
            const result = await createApplicationAndTasks(repository, item.grant);
            if (result.application && !result.skipped) {
              applicationsCreated.push(result.application);
              tasksCreated.push(...result.tasks);
              affected.add(result.application.id);
              result.tasks.forEach((task) => affected.add(task.id));
            } else if (result.skipped) applicationSkips.push({ grantId: item.grant.id, reason: result.skipped });
          }
        }

        if (discoveryRun) {
          await repository.completeDiscoveryRun(discoveryRun.id, {
            status: "completed",
            sourcesChecked: input.sourcesChecked,
            candidatesFound: input.candidates.length,
            grantsCreated: ingested.filter((item) => item.action === "created").length,
            grantsUpdated: ingested.filter((item) => item.action === "updated").length,
            grantsSkipped: ingested.filter((item) => item.action === "skipped").length,
            warnings: applicationSkips.map((item) => `${item.grantId}:${item.reason}`),
          });
          affected.add(discoveryRun.id);
        }

        return {
          dryRun: false,
          mutationPerformed: affected.size > 0,
          affectedRecordIds: [...affected],
          appliedMutation: { action: "autonomous_grant_ops_cycle", discoveryRunId: discoveryRun?.id ?? null, ingested: ingested.map((item) => ({ id: item.grant.id, action: item.action })), archived, topThreeChanged, applicationsCreated: applicationsCreated.map((app) => app.id), tasksCreated: tasksCreated.map((task) => task.id) },
          before: { grants: allGrants.length, applications: applications.length },
          after: { grants: (await repository.listGrants({ includeSoftArchived: true })).length, activeGrants: (await repository.listGrants()).length, applications: (await repository.listApplications()).length },
          counts: { sourcesChecked: input.sourcesChecked, candidates: input.candidates.length, archived: archived.length, topThreeChanged: topThreeChanged.length, applicationsCreated: applicationsCreated.length, tasksCreated: tasksCreated.length },
          discoveryRunId: discoveryRun?.id ?? null,
          exceptions: { applicationSkips, expiredWithOpenApplications: allGrants.filter((grant) => (daysRemaining(grant.deadline ?? grant.next_deadline) ?? 0) < 0 && openByGrant.has(grant.id)).map((grant) => ({ id: grant.id, title: grant.title })) },
          warnings: ["External submission and outreach were not performed."],
        };
      },
    },
    {
      name: "get_agent_changes_since",
      description: "Return a compact delta of grants, applications, and tasks changed since an ISO timestamp.",
      permissionLevel: "read",
      inputSchema: z.object({ since: z.string().datetime(), limit: z.number().int().min(1).max(100).default(50) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: [],
      relatedTables: ["grants", "applications", "tasks"],
      touchesRealDb: true,
      async execute({ since, limit }) {
        const threshold = new Date(since).getTime();
        const [grants, applications, tasks] = await Promise.all([repository.listGrants({ includeSoftArchived: true }), repository.listApplications(), repository.listTasks({ includeSoftArchived: true })]);
        const items = [
          ...grants.filter((item) => new Date(item.updated_at).getTime() > threshold).map((item) => ({ type: "grant", id: item.id, title: item.title, status: item.status, updated_at: item.updated_at })),
          ...applications.filter((item) => new Date(item.updated_at).getTime() > threshold).map((item) => ({ type: "application", id: item.id, title: item.title, status: item.status, updated_at: item.updated_at })),
          ...tasks.filter((item) => new Date(item.updated_at).getTime() > threshold).map((item) => ({ type: "task", id: item.id, title: item.title, status: item.status, updated_at: item.updated_at })),
        ].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        return { items: items.slice(0, limit), total: items.length, cursor: items[0]?.updated_at ?? since, truncated: items.length > limit, warnings: [] };
      },
    },
  ];
  const cycle = tools.find((tool) => tool.name === "run_autonomous_grant_ops_cycle");
  if (cycle) {
    tools.push({
      ...cycle,
      name: "run_grant_discovery_cycle",
      description: "Alias for the bounded autonomous Grant OS discovery/cleanup/application cycle.",
    });
  }
  return tools;
}
