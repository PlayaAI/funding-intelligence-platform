import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import { buildChecklistTemplate } from "./builders";
import { buildDryRunPlan } from "./dryRun";
import { makeToolError } from "./safety";
import type { GrantRow } from "../../types/database";
import type { ToolDefinition } from "./types";

const DAY_MS = 86_400_000;
const CLOSED_GRANT_STATUSES = new Set(["Submitted", "Awarded", "Declined", "Archived"]);
const OPEN_APPLICATION_STATUSES = new Set(["Not Started", "Drafting", "Internal Review", "Ready to Submit"]);
const RISK_PATTERNS: Array<[RegExp, string]> = [
  [/\b501\s*\(c\)\(3\)|nonprofit status/i, "nonprofit_status_requires_verified_applicant_path"],
  [/\bburning man\b.*\b(partner|partnership|official)\b/i, "official_partnership_claim_requires_primary_proof"],
  [/\b(clinical|patient|biometric|medical)\b/i, "clinical_or_biometric_claim_requires_review"],
  [/\b(university|research institution|academic institution)\b/i, "research_institution_requirement"],
  [/\b(lead applicant|eligible applicant|fiscal sponsor)\b/i, "applicant_path_requires_confirmation"],
];

function dayStart(value = new Date()): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function deadlineFor(grant: GrantRow): string | null {
  return grant.deadline ?? grant.next_deadline;
}

function daysRemaining(deadline: string | null): number | null {
  if (!deadline) return null;
  const parsed = new Date(deadline.length === 10 ? `${deadline}T00:00:00Z` : deadline);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.ceil((dayStart(parsed) - dayStart()) / DAY_MS);
}

function riskFlags(grant: GrantRow): string[] {
  const text = [grant.title, grant.eligibility, grant.notes, ...(grant.focus_areas ?? [])].filter(Boolean).join(" ");
  const flags = RISK_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, flag]) => flag);
  if (!grant.eligibility) flags.push("eligibility_not_captured");
  if (!grant.source_url) flags.push("source_url_missing");
  if (!grant.application_url) flags.push("application_url_missing");
  return [...new Set(flags)];
}

function compactGrant(grant: GrantRow) {
  const deadline = deadlineFor(grant);
  const days = daysRemaining(deadline);
  return {
    id: grant.id,
    title: grant.title,
    funder: grant.funder_name,
    deadline,
    days_remaining: days,
    status: grant.status,
    fit_score: grant.fit_score,
    priority_score: grant.priority_score,
    proof_readiness: grant.proof_readiness,
    application_readiness: grant.application_readiness,
    is_top_three: grant.is_top_three,
    risk_flags: riskFlags(grant),
    recommended_next_action: days !== null && days <= 7
      ? "Confirm eligibility and application readiness today."
      : grant.application_readiness === "ready"
        ? "Start or advance the application."
        : "Resolve eligibility and evidence gaps.",
    source_url: grant.source_url,
    application_url: grant.application_url,
  };
}

function duplicateApplicationGroups(applications: Awaited<ReturnType<GrantOsRepository["listApplications"]>>) {
  const groups = new Map<string, typeof applications>();
  for (const application of applications) {
    if (!application.grant_id || !application.project_id) continue;
    const key = `${application.grant_id}:${application.project_id}`;
    groups.set(key, [...(groups.get(key) ?? []), application]);
  }
  return [...groups.values()]
    .filter((items) => items.length > 1)
    .map((items) => ({
      grant_id: items[0].grant_id,
      project_id: items[0].project_id,
      application_ids: items.map((item) => item.id),
      titles: items.map((item) => item.title),
    }));
}

function knowledgeWarnings(items: Awaited<ReturnType<GrantOsRepository["listAgentKnowledgeItems"]>>) {
  return items
    .filter((item) => ["needs_confirmation", "background_only", "do_not_use", "outdated"].includes(item.confidence_status))
    .slice(0, 20)
    .map((item) => ({
      id: item.id,
      title: item.title,
      confidence: item.confidence_status,
      warning: `Do not treat this item as an approved claim (${item.confidence_status}).`,
    }));
}

export function createOperationsTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "get_cleanup_preview",
      description: "Return a compact, read-only preview of stale, duplicate, orphaned, and risky operational records.",
      permissionLevel: "read",
      inputSchema: z.object({ limitPerGroup: z.number().int().min(1).max(100).default(25) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Cleanup recommendations require operator review before mutation."],
      relatedTables: ["grants", "applications", "tasks"],
      touchesRealDb: true,
      async execute({ limitPerGroup }) {
        const [grants, applications, tasks] = await Promise.all([
          repository.listGrants(),
          repository.listApplications(),
          repository.listTasks(),
        ]);
        const grantIds = new Set(grants.map((grant) => grant.id));
        const applicationIds = new Set(applications.map((application) => application.id));
        const expired = grants.filter((grant) => {
          const days = daysRemaining(deadlineFor(grant));
          return days !== null && days < 0 && !CLOSED_GRANT_STATUSES.has(grant.status);
        });
        const openApplicationsByGrant = new Map<string, string[]>();
        for (const application of applications) {
          if (application.grant_id && OPEN_APPLICATION_STATUSES.has(application.status)) {
            openApplicationsByGrant.set(application.grant_id, [...(openApplicationsByGrant.get(application.grant_id) ?? []), application.id]);
          }
        }
        const groups = {
          past_deadline_active_grants: expired.map(compactGrant),
          past_deadline_top_three_grants: expired.filter((grant) => grant.is_top_three).map(compactGrant),
          expired_grants_with_open_applications: expired
            .filter((grant) => openApplicationsByGrant.has(grant.id))
            .map((grant) => ({ ...compactGrant(grant), application_ids: openApplicationsByGrant.get(grant.id) })),
          duplicate_applications: duplicateApplicationGroups(applications),
          orphan_tasks: tasks
            .filter((task) =>
              (task.related_grant_id && !grantIds.has(task.related_grant_id)) ||
              (task.related_application_id && !applicationIds.has(task.related_application_id)) ||
              (!task.related_grant_id && !task.related_application_id && !task.related_project_id)
            )
            .map((task) => ({ id: task.id, title: task.title, status: task.status, related_grant_id: task.related_grant_id, related_application_id: task.related_application_id })),
          grants_missing_urls: grants
            .filter((grant) => !grant.source_url || !grant.application_url)
            .map((grant) => ({ id: grant.id, title: grant.title, source_url: grant.source_url, application_url: grant.application_url })),
          active_priority_unknown_deadline: grants
            .filter((grant) => !deadlineFor(grant) && (grant.is_top_three || grant.priority || grant.priority_score !== null))
            .map(compactGrant),
          risky_eligibility: grants.filter((grant) => riskFlags(grant).some((flag) => flag.includes("require"))).map(compactGrant),
        };
        const bounded = Object.fromEntries(Object.entries(groups).map(([key, items]) => [key, items.slice(0, limitPerGroup)]));
        return {
          counts: Object.fromEntries(Object.entries(groups).map(([key, items]) => [key, items.length])),
          groups: bounded,
          truncated: Object.values(groups).some((items) => items.length > limitPerGroup),
          warnings: ["Preview only. Archive or repair records through explicit scoped tools."],
        };
      },
    },
    {
      name: "batch_archive_expired_grants",
      description: "Soft-archive eligible expired grants, clear Top 3, and skip closed grants or grants with open applications.",
      permissionLevel: "write_safe",
      inputSchema: z.object({
        grantIds: z.array(z.string().min(1)).max(100).optional(),
        includeWithOpenApplications: z.boolean().default(false),
        reason: z.string().min(3).default("Deadline passed"),
        limit: z.number().int().min(1).max(100).default(50),
        dryRun: z.boolean().default(true),
      }),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Archived grants leave active triage views but are not deleted."],
      relatedTables: ["grants", "applications"],
      touchesRealDb: true,
      async execute(input) {
        const [grants, applications] = await Promise.all([repository.listGrants(), repository.listApplications()]);
        const requested: Set<string> | null = input.grantIds ? new Set(input.grantIds as string[]) : null;
        const openByGrant = new Set(applications.filter((app) => OPEN_APPLICATION_STATUSES.has(app.status) && app.grant_id).map((app) => app.grant_id as string));
        const candidates = grants.filter((grant) => !requested || requested.has(grant.id)).slice(0, input.limit);
        const eligible: GrantRow[] = [];
        const skipped: Array<{ id: string; title: string; reason: string }> = [];
        if (requested) {
          const foundIds = new Set(candidates.map((grant) => grant.id));
          for (const id of requested) {
            if (!foundIds.has(id)) skipped.push({ id, title: "Unknown grant", reason: "record_not_found_or_inaccessible" });
          }
        }
        for (const grant of candidates) {
          const days = daysRemaining(deadlineFor(grant));
          if (days === null) skipped.push({ id: grant.id, title: grant.title, reason: "deadline_unknown" });
          else if (days >= 0) skipped.push({ id: grant.id, title: grant.title, reason: "deadline_not_passed" });
          else if (CLOSED_GRANT_STATUSES.has(grant.status)) skipped.push({ id: grant.id, title: grant.title, reason: `closed_status:${grant.status}` });
          else if (!input.includeWithOpenApplications && openByGrant.has(grant.id)) skipped.push({ id: grant.id, title: grant.title, reason: "open_application_exists" });
          else eligible.push(grant);
        }
        const now = new Date().toISOString();
        const plannedMutation = {
          table: "grants",
          action: "soft_archive_many",
          records: eligible.map((grant) => ({
            id: grant.id,
            before: { status: grant.status, archived_at: grant.archived_at, is_top_three: grant.is_top_three },
            after: { status: "Archived", archived_at: now, is_top_three: false },
          })),
        };
        if (input.dryRun) {
          return {
            ...buildDryRunPlan(plannedMutation, ["grants"]),
            affectedRecordIds: [],
            eligibleRecordIds: eligible.map((grant) => grant.id),
            skipped,
            warnings: skipped.length ? ["Skipped records require human review."] : [],
          };
        }
        const updated = [];
        for (const grant of eligible) {
          updated.push(await repository.updateGrant(grant.id, {
            status: "Archived",
            archived_at: now,
            is_top_three: false,
            notes: [grant.notes, `Archive reason: ${input.reason}`].filter(Boolean).join("\n"),
          }));
        }
        return {
          dryRun: false,
          mutationPerformed: updated.length > 0,
          affectedRecordIds: updated.map((grant) => grant.id),
          appliedMutation: plannedMutation,
          before: plannedMutation.records.map((record) => ({ id: record.id, ...record.before })),
          after: updated.map((grant) => ({ id: grant.id, status: grant.status, archived_at: grant.archived_at, is_top_three: grant.is_top_three })),
          skipped,
          warnings: skipped.length ? ["Skipped records were not modified."] : [],
        };
      },
    },
    {
      name: "list_active_priority_grants_compact",
      description: "Return a bounded, low-token list of active, unexpired priority grants.",
      permissionLevel: "read",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(10),
        includeUnknownDeadline: z.boolean().default(false),
        includeClosed: z.boolean().default(false),
        projectId: z.string().optional(),
      }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Priority output is decision support, not an eligibility determination."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute(input) {
        let grants = await repository.listGrants();
        grants = grants.filter((grant) => {
          const days = daysRemaining(deadlineFor(grant));
          if (!input.includeClosed && CLOSED_GRANT_STATUSES.has(grant.status)) return false;
          if (days !== null && days < 0) return false;
          if (days === null && !input.includeUnknownDeadline) return false;
          if (input.projectId && grant.related_project_id !== input.projectId) return false;
          return grant.is_top_three || grant.priority || grant.priority_score !== null || grant.fit_score !== null;
        });
        grants.sort((a, b) =>
          Number(b.is_top_three) - Number(a.is_top_three) ||
          (b.priority_score ?? -1) - (a.priority_score ?? -1) ||
          (b.fit_score ?? -1) - (a.fit_score ?? -1) ||
          (daysRemaining(deadlineFor(a)) ?? 99999) - (daysRemaining(deadlineFor(b)) ?? 99999)
        );
        return {
          items: grants.slice(0, input.limit).map(compactGrant),
          total: grants.length,
          limit: input.limit,
          truncated: grants.length > input.limit,
          warnings: ["Eligibility and applicant path still require source verification."],
        };
      },
    },
    {
      name: "get_deadline_brief",
      description: "Return a compact deadline queue, stale Top 3 warnings, and three recommended actions.",
      permissionLevel: "read",
      inputSchema: z.object({
        daysWindow: z.number().int().min(1).max(365).default(30),
        limit: z.number().int().min(1).max(50).default(15),
        includeExpired: z.boolean().default(false),
        includeArchived: z.boolean().default(false),
        projectId: z.string().optional(),
      }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Deadline calculations depend on stored dates and should be verified at source."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute(input) {
        let grants = await repository.listGrants();
        grants = grants.filter((grant) => {
          const days = daysRemaining(deadlineFor(grant));
          if (!input.includeArchived && grant.status === "Archived") return false;
          if (!input.includeExpired && days !== null && days < 0) return false;
          if (days !== null && days > input.daysWindow) return false;
          if (input.projectId && grant.related_project_id !== input.projectId) return false;
          return days !== null;
        });
        grants.sort((a, b) => (daysRemaining(deadlineFor(a)) ?? 99999) - (daysRemaining(deadlineFor(b)) ?? 99999));
        const items = grants.slice(0, input.limit).map(compactGrant);
        const expiredCount = grants.filter((grant) => (daysRemaining(deadlineFor(grant)) ?? 0) < 0).length;
        return {
          windows: {
            overdue: items.filter((grant) => (grant.days_remaining ?? 0) < 0),
            within_3_days: items.filter((grant) => grant.days_remaining !== null && grant.days_remaining >= 0 && grant.days_remaining <= 3),
            within_7_days: items.filter((grant) => grant.days_remaining !== null && grant.days_remaining > 3 && grant.days_remaining <= 7),
            later: items.filter((grant) => grant.days_remaining !== null && grant.days_remaining > 7),
          },
          expiredCount,
          staleTopThree: items.filter((grant) => grant.is_top_three && (grant.days_remaining ?? 0) < 0),
          nextActions: items.slice(0, 3).map((grant) => ({ grant_id: grant.id, title: grant.title, action: grant.recommended_next_action })),
          total: grants.length,
          truncated: grants.length > input.limit,
          warnings: ["Verify deadlines against each grant's primary source URL."],
        };
      },
    },
    {
      name: "get_application_readiness_report",
      description: "Return a compact readiness report for one existing application.",
      permissionLevel: "read",
      inputSchema: z.object({ applicationId: z.string().min(1), taskLimit: z.number().int().min(1).max(50).default(20) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Readiness is advisory and cannot establish legal eligibility."],
      relatedTables: ["applications", "grants", "projects", "tasks", "proof_items", "application_questions", "application_required_documents", "agent_knowledge_items"],
      touchesRealDb: true,
      async execute({ applicationId, taskLimit }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("record_not_found", `Application ${applicationId} was not found.`);
        const [grant, project, tasks, questions, requiredDocuments, proof, knowledge] = await Promise.all([
          application.grant_id ? repository.getGrant(application.grant_id) : Promise.resolve(null),
          application.project_id ? repository.getProject(application.project_id) : Promise.resolve(null),
          repository.listTasksByApplication(application.id),
          repository.listApplicationQuestions(application.id),
          repository.listApplicationRequiredDocuments(application.id),
          application.project_id ? repository.listProofItems(application.project_id) : Promise.resolve([]),
          repository.listAgentKnowledgeItems(),
        ]);
        const missingAnswers = questions.filter((question) => !question.final_answer && !question.draft_answer).map((question) => ({ id: question.id, question: question.question, status: question.status }));
        const missingDocuments = requiredDocuments.filter((document) => document.status !== "Complete" && document.status !== "Not Applicable").map((document) => ({ id: document.id, title: document.title, status: document.status }));
        return {
          application: { id: application.id, title: application.title, status: application.status, grant_id: application.grant_id, project_id: application.project_id },
          grant: grant ? { id: grant.id, title: grant.title, deadline: deadlineFor(grant), days_remaining: daysRemaining(deadlineFor(grant)), source_url: grant.source_url } : null,
          applicantPathStatus: grant?.eligibility ? "needs_human_verification" : "not_captured",
          missingEvidence: [
            ...(proof.length ? [] : ["No proof items linked to the application project."]),
            ...(missingDocuments.length ? [`${missingDocuments.length} required documents are not ready.`] : []),
          ],
          missingAnswers,
          missingDocuments,
          riskyClaims: knowledgeWarnings(knowledge),
          linkedTasks: tasks.slice(0, taskLimit).map((task) => ({ id: task.id, title: task.title, status: task.status, due_date: task.due_date })),
          proofCount: proof.length,
          recommendedNextSteps: [
            ...(grant?.eligibility ? ["Verify applicant path against the primary grant rules."] : ["Capture grant eligibility and fiscal-sponsor rules."]),
            ...(missingAnswers.length ? ["Draft missing application answers."] : []),
            ...(missingDocuments.length ? ["Resolve required document gaps."] : []),
            ...(proof.length ? [] : ["Link verified proof to the project."]),
          ].slice(0, 5),
          truncated: tasks.length > taskLimit,
          warnings: project ? [] : ["Application has no accessible linked project."],
        };
      },
    },
    {
      name: "bulk_create_tasks_from_checklist",
      description: "Create missing application checklist tasks with duplicate prevention and linked record IDs.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ applicationId: z.string().min(1), titles: z.array(z.string().min(1)).max(25).optional(), dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "task_created",
      risks: ["Creates operational tasks that may affect human workload."],
      relatedTables: ["applications", "grants", "projects", "tasks"],
      touchesRealDb: true,
      async execute({ applicationId, titles, dryRun }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("record_not_found", `Application ${applicationId} was not found.`);
        const [grant, project, existing] = await Promise.all([
          application.grant_id ? repository.getGrant(application.grant_id) : Promise.resolve(null),
          application.project_id ? repository.getProject(application.project_id) : Promise.resolve(null),
          repository.listTasksByApplication(applicationId),
        ]);
        if (!grant) throw makeToolError("record_not_found", "The application has no accessible linked grant.");
        const template = buildChecklistTemplate(grant, project);
        const selected = titles?.length ? template.filter((item) => titles.includes(item.title)) : template;
        const existingTitles = new Set(existing.map((task) => task.title.trim().toLowerCase()));
        const missing = selected.filter((item) => !existingTitles.has(item.title.trim().toLowerCase()));
        const skipped = selected.filter((item) => existingTitles.has(item.title.trim().toLowerCase())).map((item) => ({ title: item.title, reason: "duplicate_task" }));
        const dueDate = deadlineFor(grant);
        const plannedMutation = {
          table: "tasks",
          action: "create_many",
          records: missing.map((item) => ({
            title: item.title,
            description: item.description,
            status: "Not Started" as const,
            priority: item.priority,
            due_date: dueDate,
            related_application_id: application.id,
            related_grant_id: grant.id,
            related_project_id: application.project_id,
          })),
        };
        if (dryRun) return { ...buildDryRunPlan(plannedMutation, ["tasks"]), affectedRecordIds: [], skipped, warnings: [] };
        const created = [];
        for (const item of plannedMutation.records) {
          created.push(await repository.createTask({
            ...item,
            owner_name: application.owner_name,
            related_proof_item_id: null,
            notes: "Generated from Grant OS application checklist.",
            archived_at: null,
          }));
        }
        return {
          dryRun: false,
          mutationPerformed: created.length > 0,
          affectedRecordIds: created.map((task) => task.id),
          appliedMutation: { ...plannedMutation, created_ids: created.map((task) => task.id) },
          before: { taskCount: existing.length },
          after: { taskCount: existing.length + created.length },
          skipped,
          warnings: [],
        };
      },
    },
    {
      name: "list_proof_items_compact",
      description: "Return bounded proof metadata without descriptions, metrics, notes, or extracted document text.",
      permissionLevel: "read",
      inputSchema: z.object({ projectId: z.string().optional(), limit: z.number().int().min(1).max(100).default(25) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Proof metadata may still describe internal evidence."],
      relatedTables: ["proof_items"],
      touchesRealDb: true,
      async execute({ projectId, limit }) {
        const items = await repository.listProofItems(projectId);
        return {
          items: items.slice(0, limit).map((item) => ({
            id: item.id,
            title: item.title,
            status: null,
            source_type: item.type,
            related_project_id: item.project_id,
            related_grant_id: null,
            related_application_id: null,
            verification_status: null,
            last_verified: null,
            owner: null,
            source_url: item.document_url ?? item.media_url,
            updated_at: item.updated_at,
          })),
          total: items.length,
          limit,
          truncated: items.length > limit,
          warnings: ["The current proof_items schema has no verification status, owner, last_verified, grant link, or application link columns."],
        };
      },
    },
    {
      name: "get_missing_evidence_report",
      description: "Return compact evidence gaps and Claim Register warnings without document text.",
      permissionLevel: "read",
      inputSchema: z.object({ grantId: z.string().optional(), applicationId: z.string().optional(), projectId: z.string().optional() }).refine((value) => value.grantId || value.applicationId || value.projectId, "Provide grantId, applicationId, or projectId."),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Gap detection is heuristic and requires human verification."],
      relatedTables: ["grants", "applications", "projects", "proof_items", "documents", "agent_knowledge_items"],
      touchesRealDb: true,
      async execute(input) {
        const application = input.applicationId ? await repository.getApplication(input.applicationId) : null;
        const grantId = input.grantId ?? application?.grant_id ?? null;
        const projectId = input.projectId ?? application?.project_id ?? null;
        const [grant, project, proof, documents, knowledge] = await Promise.all([
          grantId ? repository.getGrant(grantId) : Promise.resolve(null),
          projectId ? repository.getProject(projectId) : Promise.resolve(null),
          projectId ? repository.listProofItems(projectId) : Promise.resolve([]),
          repository.listDocuments({ relatedGrantId: grantId ?? undefined, relatedApplicationId: application?.id, relatedProjectId: projectId ?? undefined }),
          repository.listAgentKnowledgeItems(),
        ]);
        const documentTitles = documents.map((document) => document.title.toLowerCase());
        const has = (terms: string[]) => documentTitles.some((title) => terms.some((term) => title.includes(term)));
        return {
          target: { grant_id: grantId, application_id: application?.id ?? null, project_id: projectId },
          missing: {
            applicant_proof: grant?.eligibility ? ["Applicant path needs human verification against primary rules."] : ["Grant eligibility/applicant path is not captured."],
            fiscal_sponsor_proof: has(["fiscal sponsor", "sponsorship", "irs", "determination"]) ? [] : ["No fiscal-sponsor or primary nonprofit documentation linked."],
            product_proof: proof.length ? [] : ["No project proof items linked."],
            metrics_proof: proof.some((item) => item.type === "metric") ? [] : ["No metrics proof item linked."],
            privacy_security_proof: has(["privacy", "security", "consent", "data"]) ? [] : ["No privacy/security/consent evidence document linked."],
            budget_proof: has(["budget", "financial"]) ? [] : ["No budget or financial evidence document linked."],
            source_urls: grant && (!grant.source_url || !grant.application_url) ? ["Grant source or application URL is missing."] : [],
          },
          claimRegisterWarnings: knowledgeWarnings(knowledge),
          counts: { proof_items: proof.length, documents: documents.length },
          warnings: [
            "Google Drive Grant Knowledge & Evidence Library remains the evidence source of truth.",
            "ProPublica and similar databases are secondary public sources only.",
            "Do not claim Playa AI standalone 501(c)(3) status or an official Burning Man partnership without primary proof.",
          ],
        };
      },
    },
    {
      name: "list_agent_knowledge_items_compact",
      description: "Return compact Agent Knowledge metadata and summaries without full content.",
      permissionLevel: "read",
      inputSchema: z.object({ category: z.string().optional(), status: z.string().optional(), limit: z.number().int().min(1).max(100).default(25) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: [],
      relatedTables: ["agent_knowledge_items"],
      touchesRealDb: true,
      async execute({ category, status, limit }) {
        let items = await repository.listAgentKnowledgeItems({ category });
        if (status) items = items.filter((item) => item.status === status);
        return {
          items: items.slice(0, limit).map((item) => ({
            id: item.id,
            title: item.title,
            category: item.category,
            status: item.status,
            confidence: item.confidence_status,
            source: item.source_label ?? item.source_url,
            last_verified: null,
            owner: item.updated_by ?? item.created_by,
            summary: item.content.slice(0, 180),
            updated_at: item.updated_at,
          })),
          total: items.length,
          limit,
          truncated: items.length > limit,
          warnings: ["No last_verified column exists; updated_at is returned separately and must not be treated as verification."],
        };
      },
    },
    {
      name: "get_next_best_grant_target",
      description: "Rank active grants using stored fit/priority/readiness while penalizing deadline and applicant-path risks.",
      permissionLevel: "read",
      inputSchema: z.object({ limit: z.number().int().min(1).max(10).default(3), includeUnknownDeadline: z.boolean().default(false) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Ranking is decision support and cannot replace eligibility verification."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute({ limit, includeUnknownDeadline }) {
        const grants = (await repository.listGrants())
          .filter((grant) => {
            const days = daysRemaining(deadlineFor(grant));
            return !CLOSED_GRANT_STATUSES.has(grant.status) && (days === null ? includeUnknownDeadline : days >= 0);
          })
          .map((grant) => {
            const days = daysRemaining(deadlineFor(grant));
            const risks = riskFlags(grant);
            const urgency = days === null ? 0 : days <= 7 ? 20 : days <= 30 ? 10 : 2;
            const score = (grant.fit_score ?? 0) + (grant.priority_score ?? 0) + urgency + (grant.is_top_three ? 10 : 0) - risks.length * 8;
            return { ...compactGrant(grant), decision_score: score };
          })
          .sort((a, b) => b.decision_score - a.decision_score);
        return {
          items: grants.slice(0, limit),
          total: grants.length,
          limit,
          truncated: grants.length > limit,
          warnings: ["Confirm applicant eligibility, fiscal-sponsor path, deadline, and risky claims before applying."],
        };
      },
    },
    {
      name: "get_grant_application_action_plan",
      description: "Return the next concrete, compact application-preparation actions for one grant.",
      permissionLevel: "read",
      inputSchema: z.object({ grantId: z.string().min(1), projectId: z.string().optional(), limit: z.number().int().min(1).max(20).default(10) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Action plans remain subject to eligibility and claim verification."],
      relatedTables: ["grants", "applications", "projects", "tasks", "proof_items"],
      touchesRealDb: true,
      async execute({ grantId, projectId, limit }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("record_not_found", `Grant ${grantId} was not found.`);
        const applications = await repository.listApplicationsByGrant(grantId);
        const application = projectId
          ? applications.find((item) => item.project_id === projectId) ?? null
          : applications[0] ?? null;
        const resolvedProjectId = projectId ?? application?.project_id ?? grant.related_project_id;
        const [project, tasks, proof] = await Promise.all([
          resolvedProjectId ? repository.getProject(resolvedProjectId) : Promise.resolve(null),
          application ? repository.listTasksByApplication(application.id) : Promise.resolve([]),
          resolvedProjectId ? repository.listProofItems(resolvedProjectId) : Promise.resolve([]),
        ]);
        const actions = [
          ...(!grant.eligibility ? [{ priority: "P0", action: "Capture and verify applicant eligibility from the primary source." }] : []),
          ...(!grant.source_url ? [{ priority: "P0", action: "Add the primary grant source URL." }] : []),
          ...(!application ? [{ priority: "P0", action: "Preview create_application_from_grant for the selected project." }] : []),
          ...(!project ? [{ priority: "P0", action: "Select and verify the application project." }] : []),
          ...(proof.length ? [] : [{ priority: "P1", action: "Link verified project proof and metrics." }]),
          ...(application && !tasks.length ? [{ priority: "P1", action: "Preview generate_application_checklist." }] : []),
          ...tasks.filter((task) => task.status !== "Complete" && task.status !== "Archived").map((task) => ({ priority: task.priority === "Urgent" ? "P0" : "P1", action: task.title, task_id: task.id, due_date: task.due_date })),
        ];
        return {
          grant: compactGrant(grant),
          application: application ? { id: application.id, title: application.title, status: application.status } : null,
          project: project ? { id: project.id, name: project.name } : null,
          actions: actions.slice(0, limit),
          total: actions.length,
          truncated: actions.length > limit,
          warnings: riskFlags(grant),
        };
      },
    },
    {
      name: "update_grant_priority_fields",
      description: "Update only safe grant prioritization fields; never changes imported source, eligibility, deadline, or application data.",
      permissionLevel: "write_safe",
      inputSchema: z.object({
        grantId: z.string().min(1),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]).nullable().optional(),
        fitScore: z.number().min(0).max(100).nullable().optional(),
        priorityScore: z.number().min(0).max(100).nullable().optional(),
        proofReadiness: z.string().max(100).nullable().optional(),
        applicationReadiness: z.string().max(100).nullable().optional(),
        priorityNote: z.string().min(3).max(1000).optional(),
        dryRun: z.boolean().default(true),
      }).refine((value) => ["priority", "fitScore", "priorityScore", "proofReadiness", "applicationReadiness", "priorityNote"].some((key) => value[key as keyof typeof value] !== undefined), "Provide at least one priority field."),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Priority changes affect recommendations and operator focus."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute(input) {
        const grant = await repository.getGrant(input.grantId);
        if (!grant) throw makeToolError("record_not_found", `Grant ${input.grantId} was not found.`);
        const values = {
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.fitScore !== undefined ? { fit_score: input.fitScore } : {}),
          ...(input.priorityScore !== undefined ? { priority_score: input.priorityScore } : {}),
          ...(input.proofReadiness !== undefined ? { proof_readiness: input.proofReadiness } : {}),
          ...(input.applicationReadiness !== undefined ? { application_readiness: input.applicationReadiness } : {}),
          ...(input.priorityNote ? { notes: [grant.notes, `Priority note: ${input.priorityNote}`].filter(Boolean).join("\n") } : {}),
        };
        const before = {
          priority: grant.priority,
          fit_score: grant.fit_score,
          priority_score: grant.priority_score,
          proof_readiness: grant.proof_readiness,
          application_readiness: grant.application_readiness,
        };
        const plannedMutation = { table: "grants", action: "update_priority_fields", id: grant.id, values };
        if (input.dryRun) return { ...buildDryRunPlan(plannedMutation, ["grants"], { before }), affectedRecordIds: [], warnings: [] };
        const updated = await repository.updateGrant(grant.id, values);
        return {
          dryRun: false,
          mutationPerformed: true,
          affectedRecordIds: [grant.id],
          appliedMutation: plannedMutation,
          before,
          after: {
            priority: updated.priority,
            fit_score: updated.fit_score,
            priority_score: updated.priority_score,
            proof_readiness: updated.proof_readiness,
            application_readiness: updated.application_readiness,
          },
          warnings: [],
        };
      },
    },
  ];
}
