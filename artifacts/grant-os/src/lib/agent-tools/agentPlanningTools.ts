import { z } from "zod";
import type {
  DocumentRow,
  GrantMatchDeadlineStatusDb,
  GrantMatchDecisionLabelDb,
  GrantMatchInsert,
  MatchTierDb,
} from "../../types/database";
import { buildDryRunPlan } from "./dryRun";
import { buildGrantDecisionBrief, buildApplicationPrepContext } from "./builders";
import type { GrantOsRepository } from "./repository";
import { makeToolError } from "./safety";
import type { ToolDefinition } from "./types";

const recommendationSchema = z.enum(["apply_now", "prepare", "watch", "skip", "needs_confirmation"]);
const scoreSchema = z.number().int().min(1).max(10);
const stringListSchema = z.array(z.string().min(1)).default([]);

const saveAgentMatchSchema = z.object({
  grantId: z.string().min(1),
  projectId: z.string().min(1),
  fitScore: scoreSchema,
  urgencyScore: scoreSchema,
  effortScore: scoreSchema,
  strategicValueScore: scoreSchema,
  readinessScore: scoreSchema.optional(),
  recommendation: recommendationSchema,
  summary: z.string().min(1),
  whyItFits: z.string().min(1),
  whyItMightNotFit: z.string().min(1),
  bestProjectAngle: z.string().min(1),
  strongestApplicationStory: z.string().min(1),
  risks: stringListSchema,
  missingInfo: stringListSchema,
  evidenceNeeded: stringListSchema,
  recommendedNextStep: z.string().min(1),
  sourceNotes: z.string().optional(),
  dryRun: z.boolean().default(true),
});

const readinessReportSchema = z.object({
  grantId: z.string().min(1),
  projectId: z.string().min(1),
  applicationId: z.string().min(1).optional(),
  includeSuggestedTasks: z.boolean().default(true),
  includeDrivePackagePreview: z.boolean().default(true),
});

type SaveAgentMatchInput = z.infer<typeof saveAgentMatchSchema>;

function toDecisionLabel(recommendation: SaveAgentMatchInput["recommendation"]): GrantMatchDecisionLabelDb {
  if (recommendation === "prepare") return "prepare_next";
  if (recommendation === "watch") return "monitor";
  if (recommendation === "needs_confirmation") return "needs_review";
  return recommendation;
}

function toMatchTier(score: number): MatchTierDb {
  if (score >= 9) return "best";
  if (score >= 8) return "strong";
  if (score >= 7) return "good";
  if (score >= 5) return "maybe";
  return "weak";
}

function daysUntilDeadline(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const parsed = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  return Math.ceil((target - today) / 86_400_000);
}

function toDeadlineStatus(deadline: string | null | undefined): GrantMatchDeadlineStatusDb {
  const days = daysUntilDeadline(deadline);
  if (days === null) return "unknown";
  if (days < 0) return "past_due";
  if (days === 0) return "due_today";
  return "active";
}

function clampScore100(score10: number): number {
  return Math.max(0, Math.min(100, Math.round(score10 * 10)));
}

function buildAgentMatchPayload(input: SaveAgentMatchInput, funderId: string | null, deadline: string | null): GrantMatchInsert {
  const readinessScore = input.readinessScore ?? Math.max(1, Math.min(10, Math.round((input.fitScore + input.strategicValueScore + (11 - input.effortScore)) / 3)));
  return {
    project_id: input.projectId,
    grant_id: input.grantId,
    funder_id: funderId,
    match_score: clampScore100(input.fitScore),
    match_tier: toMatchTier(input.fitScore),
    decision_label: toDecisionLabel(input.recommendation),
    readiness_score: clampScore100(readinessScore),
    urgency_score: clampScore100(input.urgencyScore),
    evidence_score: clampScore100(readinessScore),
    deadline_status: toDeadlineStatus(deadline),
    score_breakdown: {
      source: "agent_generated",
      fitScore: input.fitScore,
      urgencyScore: input.urgencyScore,
      effortScore: input.effortScore,
      strategicValueScore: input.strategicValueScore,
      readinessScore,
      recommendation: input.recommendation,
      summary: input.summary,
      whyItMightNotFit: input.whyItMightNotFit,
      bestProjectAngle: input.bestProjectAngle,
      strongestApplicationStory: input.strongestApplicationStory,
      sourceNotes: input.sourceNotes ?? null,
    },
    data_quality_flags: input.missingInfo,
    fit_reasons: [input.whyItFits],
    risks: input.risks,
    missing_items: [...input.missingInfo, ...input.evidenceNeeded],
    recommended_actions: [input.recommendedNextStep],
    status: "active",
    hidden_at: null,
    saved_at: null,
    dismissed_reason: null,
    generated_by: "agent_generated",
    generated_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    updated_at: new Date().toISOString(),
  };
}

function summarizeMatchPayload(payload: GrantMatchInsert) {
  return {
    source: "agent_generated",
    grantId: payload.grant_id,
    projectId: payload.project_id,
    matchScore: payload.match_score,
    recommendation: payload.decision_label,
    risksCount: Array.isArray(payload.risks) ? payload.risks.length : 0,
    missingItemsCount: Array.isArray(payload.missing_items) ? payload.missing_items.length : 0,
    recommendedActionsCount: Array.isArray(payload.recommended_actions) ? payload.recommended_actions.length : 0,
  };
}

function hasMatchingDocument(documents: DocumentRow[], requiredTitle: string): boolean {
  const normalizedRequired = requiredTitle.toLowerCase();
  return documents.some((document) => {
    const title = document.title.toLowerCase();
    return title.includes(normalizedRequired) || normalizedRequired.includes(title);
  });
}

function buildDrivePackagePreview(grantTitle: string) {
  return {
    root: `${grantTitle} - Playa AI Application Package/`,
    sections: [
      { name: "01 - START HERE", materialType: "active_application_materials" },
      { name: "02 - ACTIVE APPLICATION", materialType: "active_application_materials" },
      { name: "03 - GRANT SOURCE MATERIALS", materialType: "source_materials" },
      { name: "04 - SHARED PLAYA AI SOURCE MATERIALS", materialType: "shared_playa_ai_materials" },
      { name: "05 - BACKGROUND ONLY - DO NOT USE DIRECTLY", materialType: "background_only_materials" },
      { name: "06 - REVIEW AND APPROVAL", materialType: "active_application_materials" },
    ],
  };
}

export function createAgentPlanningTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "save_agent_match",
      description: "Save or preview AI-agent-generated grant/project match reasoning. The tool accepts reasoning generated by the agent and defaults to dry-run.",
      permissionLevel: "write_safe",
      inputSchema: saveAgentMatchSchema,
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Writes agent-generated recommendation context into grant_matches when dryRun is false."],
      relatedTables: ["grant_matches", "grants", "projects"],
      touchesRealDb: true,
      async execute(input) {
        const [grant, project, existingMatches] = await Promise.all([
          repository.getGrant(input.grantId),
          repository.getProject(input.projectId),
          repository.listGrantMatches({ grantId: input.grantId, projectId: input.projectId }),
        ]);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${input.grantId} was not found.`);
        if (!project) throw makeToolError("project_not_found", `Project ${input.projectId} was not found.`);

        const payload = buildAgentMatchPayload(input, grant.funder_id, grant.deadline ?? grant.next_deadline);
        const plannedMutation = {
          action: existingMatches.length ? "update" : "upsert",
          table: "grant_matches",
          target: { table: "grant_matches", conflictKey: "project_id,grant_id" },
          payloadSummary: summarizeMatchPayload(payload),
        };

        if (input.dryRun) {
          return {
            ...buildDryRunPlan(plannedMutation, ["grant_matches"], { existingMatchId: existingMatches[0]?.id ?? null }),
            writeDisposition: "dry_run",
          };
        }

        const match = await repository.upsertGrantMatch(payload);
        return {
          dryRun: false,
          mutationPerformed: true,
          writeDisposition: "committed",
          match,
        };
      },
    },
    {
      name: "generate_application_readiness_report",
      description: "Read existing Grant OS records and return an application readiness report without mutating data.",
      permissionLevel: "read",
      inputSchema: readinessReportSchema,
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Readiness analysis may reveal internal gaps and prioritization."],
      relatedTables: ["grants", "projects", "applications", "proof_items", "documents", "tasks"],
      touchesRealDb: true,
      async execute(input) {
        const [grant, project] = await Promise.all([
          repository.getGrant(input.grantId),
          repository.getProject(input.projectId),
        ]);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${input.grantId} was not found.`);
        if (!project) throw makeToolError("project_not_found", `Project ${input.projectId} was not found.`);

        const [applicationsForGrant, proofItems, grantDocuments, projectDocuments] = await Promise.all([
          repository.listApplicationsByGrant(grant.id),
          repository.listProofItems(project.id),
          repository.listDocuments({ relatedGrantId: grant.id }),
          repository.listDocuments({ relatedProjectId: project.id }),
        ]);
        const pairApplications = applicationsForGrant.filter((application) => application.project_id === project.id);
        const selectedApplication = input.applicationId
          ? pairApplications.find((application) => application.id === input.applicationId) ?? await repository.getApplication(input.applicationId)
          : pairApplications[0] ?? null;
        const applicationDocuments = selectedApplication
          ? await repository.listDocuments({ relatedApplicationId: selectedApplication.id })
          : [];
        const documents = [...grantDocuments, ...projectDocuments, ...applicationDocuments];
        const missingDocuments = (grant.required_documents ?? []).filter((required) => !hasMatchingDocument(documents, required));
        const missingEvidence = proofItems.length ? [] : ["No proof items are linked to this project."];
        const missingFacts = [
          !project.summary ? "Project summary" : null,
          !project.problem_statement ? "Problem statement" : null,
          !project.solution ? "Solution description" : null,
          !grant.eligibility ? "Grant eligibility notes" : null,
          !grant.application_url ? "Application URL" : null,
          !grant.deadline && !grant.next_deadline ? "Deadline" : null,
        ].filter((item): item is string => Boolean(item));
        const eligibilityRisks = grant.eligibility ? [] : ["Eligibility has not been captured in Grant OS."];
        const applicationRisks = [
          !selectedApplication ? "No active application workspace exists for this grant/project pair." : null,
          missingDocuments.length ? "Required documents are missing or not linked." : null,
          missingEvidence.length ? "Evidence package is thin." : null,
        ].filter((item): item is string => Boolean(item));
        const gapCount = missingDocuments.length + missingEvidence.length + missingFacts.length + eligibilityRisks.length + applicationRisks.length;
        const readinessScore = Math.max(1, Math.min(10, 10 - Math.min(9, gapCount)));
        const deadline = grant.deadline ?? grant.next_deadline;
        const days = daysUntilDeadline(deadline);
        const recommendation = readinessScore >= 8 && (days === null || days > 7)
          ? "apply_now"
          : readinessScore >= 5
            ? "prepare"
            : "needs_confirmation";
        const suggestedTasks = input.includeSuggestedTasks
          ? [
              ...missingDocuments.map((title) => ({ title: `Collect ${title}`, priority: "High", relatedTable: "documents" })),
              ...missingEvidence.map((title) => ({ title, priority: "High", relatedTable: "proof_items" })),
              ...missingFacts.map((title) => ({ title: `Fill in ${title}`, priority: "Medium", relatedTable: "projects" })),
            ]
          : [];

        return {
          readinessScore,
          recommendation,
          deadline,
          daysUntilDeadline: days,
          existingApplicationStatus: selectedApplication?.status ?? null,
          missingEvidence,
          missingDocuments,
          missingFacts,
          eligibilityRisks,
          applicationRisks,
          suggestedProofItems: proofItems.length ? [] : ["Add 2-3 proof items tied to project outcomes and audience."],
          suggestedDocuments: missingDocuments,
          suggestedTasks,
          drivePackagePreview: input.includeDrivePackagePreview ? buildDrivePackagePreview(grant.title) : null,
          nextAction: suggestedTasks[0]?.title ?? (selectedApplication ? "Human review readiness report and approve next step." : "Create a dry-run application workspace plan."),
          humanApprovalNeeded: true,
          sourceRecordsUsed: {
            grantId: grant.id,
            projectId: project.id,
            applicationIds: pairApplications.map((application) => application.id),
            proofItemIds: proofItems.map((proofItem) => proofItem.id),
            documentIds: documents.map((document) => document.id),
          },
          materialGroups: {
            activeApplicationMaterials: applicationDocuments.map((document) => document.title),
            sourceMaterials: grantDocuments.map((document) => document.title),
            sharedPlayaAiMaterials: [...projectDocuments.map((document) => document.title), ...proofItems.map((proofItem) => proofItem.title)],
            backgroundOnlyMaterials: [],
          },
          mutationPerformed: false,
        };
      },
    },
    {
      name: "get_grant_decision_brief",
      description: "PREFERRED for narrow grant-ranking tasks. Compact single-call decision brief for a grant: urgency, fit, funder, candidate projects, existing match/application, recommendation, risks, missing info, and next step. Replaces get_grant + get_funder + list_projects + list_proof_items + list_applications + generate_grant_match for initial triage. Use this before any broader report or export.",
      permissionLevel: "read",
      inputSchema: z.object({
        grantId: z.string().min(1),
        projectId: z.string().optional(),
        projectIds: z.array(z.string()).optional(),
        maxProjects: z.number().int().min(1).max(5).optional(),
      }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Brief may surface internal fit scores and prioritization reasoning."],
      relatedTables: ["grants", "funders", "projects", "grant_matches", "applications", "proof_items"],
      touchesRealDb: true,
      async execute(input) {
        const grant = await repository.getGrant(input.grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${input.grantId} was not found.`);
        return buildGrantDecisionBrief(repository, input.grantId, {
          projectId: input.projectId,
          projectIds: input.projectIds,
          maxProjects: input.maxProjects,
        });
      },
    },
    {
      name: "get_application_prep_context",
      description: "PREFERRED for application-prep tasks. Compact single-call prep context for an application: open tasks, linked documents, required docs, proof items, missing info, blockers, and next actions. Replaces get_application + get_documents_for_application + list_tasks + list_proof_items + generate_application_readiness_report for prep triage. Use this before any broader report or export.",
      permissionLevel: "read",
      inputSchema: z.object({
        applicationId: z.string().min(1),
        includeSuggestedTasks: z.boolean().optional().default(false),
      }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Context may reveal internal application gaps and blockers."],
      relatedTables: ["applications", "grants", "projects", "tasks", "documents", "proof_items"],
      touchesRealDb: true,
      async execute(input) {
        const application = await repository.getApplication(input.applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${input.applicationId} was not found.`);
        return buildApplicationPrepContext(repository, input.applicationId, {
          includeSuggestedTasks: input.includeSuggestedTasks,
        });
      },
    },
  ];
}
