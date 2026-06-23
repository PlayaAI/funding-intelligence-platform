import { z } from "zod";
import { calculateGrantMatch } from "../matching/matchingEngine";
import type { GrantMatchDecisionLabelDb, GrantMatchInsert, MatchTierDb } from "../../types/database";
import type { GrantOsRepository } from "./repository";
import { buildDryRunPlan } from "./dryRun";
import { makeToolError } from "./safety";
import type { ToolDefinition } from "./types";

function toTenPointScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value / 10)));
}

function deriveTier(fitScore: number): MatchTierDb {
  if (fitScore >= 9) return "best";
  if (fitScore >= 8) return "strong";
  if (fitScore >= 6) return "good";
  if (fitScore >= 4) return "maybe";
  if (fitScore >= 2) return "weak";
  return "needs_review";
}

function deriveDecisionLabel(fitScore: number, priorityScore: number): GrantMatchDecisionLabelDb {
  if (fitScore >= 8 && priorityScore >= 7) return "apply_now";
  if (fitScore >= 7) return "prepare_next";
  if (fitScore >= 5) return "monitor";
  if (fitScore >= 3) return "track_next_cycle";
  return "needs_review";
}

function summarizeMatch(strengths: string[], risks: string[], recommendedNextStep: string, projectName: string, grantTitle: string): string {
  const topStrength = strengths[0] ?? `${projectName} appears relevant to ${grantTitle}.`;
  const topRisk = risks[0] ?? "No critical blockers identified yet.";
  return `${topStrength} Key risk: ${topRisk} Next step: ${recommendedNextStep}`;
}

async function buildMatchContext(repository: GrantOsRepository, grantId: string, projectId: string) {
  const [grant, project, projects, grantApplications, projectProofItems, allTasks, projectNotes, projectReports] = await Promise.all([
    repository.getGrant(grantId),
    repository.getProject(projectId),
    repository.listProjects(),
    repository.listApplicationsByGrant(grantId),
    repository.listProofItems(projectId),
    repository.listTasks(),
    repository.listAgentNotes({ relatedProjectId: projectId, relatedGrantId: grantId }),
    repository.listAgentReports({ relatedProjectId: projectId, relatedGrantId: grantId }),
  ]);

  if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
  if (!project) throw makeToolError("project_not_found", `Project ${projectId} was not found.`);

  const funder = grant.funder_id ? await repository.getFunder(grant.funder_id) : null;
  const projectDocuments = await repository.listDocuments({ relatedProjectId: project.id });
  const grantDocuments = await repository.listDocuments({ relatedGrantId: grant.id });
  const funderDocuments = funder?.id ? await repository.listDocuments({ relatedFunderId: funder.id }) : [];
  const projectApplications = grantApplications.filter((application) => application.project_id === project.id);
  const relatedTasks = allTasks.filter((task) =>
    task.related_project_id === project.id ||
    task.related_grant_id === grant.id ||
    task.related_application_id === projectApplications[0]?.id
  );
  const existingMatch = (await repository.listGrantMatches({ grantId: grant.id, projectId: project.id }))[0] ?? null;

  return {
    grant,
    project,
    funder,
    projectApplications,
    projectProofItems,
    relatedTasks,
    projectNotes,
    projectReports,
    documents: [...projectDocuments, ...grantDocuments, ...funderDocuments],
    existingMatch,
    siblingProjects: projects.filter((item) => item.id !== project.id),
  };
}

function toStructuredMatch(output: ReturnType<typeof calculateGrantMatch>, grantId: string, projectId: string, projectName: string, grantTitle: string, existingMatchId?: string | null) {
  const fitScore = toTenPointScore(output.matchScore);
  const priorityScore = toTenPointScore(Math.round((output.readinessScore + output.urgencyScore) / 2));
  const recommendedNextStep = output.recommendedActions[0] ?? "Review the match with a human before saving.";
  return {
    grantId,
    projectId,
    fitScore,
    priorityScore,
    matchSummary: summarizeMatch(output.fitReasons, output.risks, recommendedNextStep, projectName, grantTitle),
    strengths: output.fitReasons,
    risks: output.risks,
    missingInfo: output.missingItems,
    recommendedNextStep,
    source: "agent_generated" as const,
    existingMatchId: existingMatchId ?? null,
    engine: {
      matchScore: output.matchScore,
      readinessScore: output.readinessScore,
      urgencyScore: output.urgencyScore,
      evidenceScore: output.evidenceScore,
      decisionLabel: output.decisionLabel,
      matchTier: output.matchTier,
      deadlineStatus: output.deadlineStatus,
      dataQualityFlags: output.dataQualityFlags,
      scoreBreakdown: output.scoreBreakdown,
    },
  };
}

function toPersistedGrantMatch(input: {
  grantId: string;
  projectId: string;
  funderId?: string | null;
  fitScore: number;
  priorityScore: number;
  matchSummary: string;
  strengths: string[];
  risks: string[];
  missingInfo: string[];
  recommendedNextStep: string;
}): GrantMatchInsert {
  const matchScore = Math.max(0, Math.min(100, Math.round(input.fitScore * 10)));
  const priorityScore100 = Math.max(0, Math.min(100, Math.round(input.priorityScore * 10)));
  return {
    project_id: input.projectId,
    grant_id: input.grantId,
    funder_id: input.funderId ?? null,
    match_score: matchScore,
    match_tier: deriveTier(input.fitScore),
    decision_label: deriveDecisionLabel(input.fitScore, input.priorityScore),
    readiness_score: priorityScore100,
    urgency_score: priorityScore100,
    evidence_score: Math.max(10, Math.min(100, input.strengths.length * 20)),
    deadline_status: "active",
    score_breakdown: {
      source: "agent_generated",
      fitScore10: input.fitScore,
      priorityScore10: input.priorityScore,
      matchSummary: input.matchSummary,
    },
    data_quality_flags: [],
    fit_reasons: input.strengths,
    risks: input.risks,
    missing_items: input.missingInfo,
    recommended_actions: [input.recommendedNextStep],
    status: "saved",
    hidden_at: null,
    saved_at: new Date().toISOString(),
    dismissed_reason: null,
    generated_by: "agent_generated",
    generated_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    updated_at: new Date().toISOString(),
  };
}

export function createMatchTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_grant_matches",
      description: "List saved or generated grant matches for the dashboard.",
      permissionLevel: "read",
      inputSchema: z.object({
        grantId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Grant match records may reveal internal prioritization logic and strategy."],
      relatedTables: ["grant_matches", "grants", "projects", "funders"],
      touchesRealDb: false,
      async execute({ grantId, projectId, limit }) {
        const DEFAULT_LIMIT = 20;
        const cap = Math.min(limit ?? DEFAULT_LIMIT, 100);
        const matches = await repository.listGrantMatches({ grantId, projectId });
        return { items: matches.slice(0, cap), total: matches.length, limit: cap };
      },
    },
    {
      name: "get_grant_match",
      description: "Fetch a single grant match by match id.",
      permissionLevel: "read",
      inputSchema: z.object({ matchId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Grant match detail may include internal fit reasoning and risks."],
      relatedTables: ["grant_matches", "grants", "projects", "funders"],
      touchesRealDb: false,
      async execute({ matchId }) {
        const match = await repository.getGrantMatch(matchId);
        if (!match) throw makeToolError("grant_match_not_found", `Grant match ${matchId} was not found.`);
        return match;
      },
    },
    {
      name: "generate_grant_match",
      description: "Generate a structured grant/project match preview without persisting by default.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ grantId: z.string().min(1), projectId: z.string().min(1), dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Generated match reasoning can influence prioritization and follow-on work."],
      relatedTables: ["grant_matches", "grants", "projects", "documents", "tasks", "applications"],
      touchesRealDb: true,
      async execute({ grantId, projectId, dryRun }) {
        const context = await buildMatchContext(repository, grantId, projectId);
        const output = calculateGrantMatch({
          project: context.project,
          grant: context.grant,
          funder: context.funder,
          proofItems: context.projectProofItems,
          documents: context.documents,
          applications: context.projectApplications,
          tasks: context.relatedTasks,
          agentNotes: context.projectNotes,
          agentReports: context.projectReports,
        });
        const structured = toStructuredMatch(output, grantId, projectId, context.project.name, context.grant.title, context.existingMatch?.id ?? null);
        if (dryRun) {
          return buildDryRunPlan(
            {
              action: "preview_match_generation",
              table: "grant_matches",
              grantId,
              projectId,
            },
            ["grant_matches"],
            structured,
          );
        }
        return {
          dryRun: false,
          mutationPerformed: false,
          persistence: "not_implemented_persistence",
          message: "generate_grant_match does not persist records directly. Use save_grant_match for explicit persistence.",
          ...structured,
        };
      },
    },
    {
      name: "save_grant_match",
      description: "Persist agent-provided grant match reasoning to the dashboard, defaulting to dry-run.",
      permissionLevel: "write_safe",
      inputSchema: z.object({
        grantId: z.string().min(1),
        projectId: z.string().min(1),
        fitScore: z.number().min(0).max(10),
        priorityScore: z.number().min(0).max(10),
        matchSummary: z.string().min(1),
        strengths: z.array(z.string()).default([]),
        risks: z.array(z.string()).default([]),
        missingInfo: z.array(z.string()).default([]),
        recommendedNextStep: z.string().min(1),
        dryRun: z.boolean().default(true),
      }),
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Saving a match updates dashboard prioritization state that humans may act on."],
      relatedTables: ["grant_matches", "grants", "projects"],
      touchesRealDb: true,
      async execute(input) {
        const { grantId, projectId, dryRun, fitScore, priorityScore, matchSummary, strengths, risks, missingInfo, recommendedNextStep } = input;
        const context = await buildMatchContext(repository, grantId, projectId);
        const persisted = toPersistedGrantMatch({
          grantId,
          projectId,
          funderId: context.funder?.id ?? context.grant.funder_id,
          fitScore,
          priorityScore,
          matchSummary,
          strengths,
          risks,
          missingInfo,
          recommendedNextStep,
        });
        if (dryRun) {
          return buildDryRunPlan(
            {
              action: context.existingMatch ? "update" : "upsert",
              table: "grant_matches",
              values: persisted,
            },
            ["grant_matches"],
            { existingMatchId: context.existingMatch?.id ?? null }
          );
        }
        const match = await repository.upsertGrantMatch(persisted);
        return {
          dryRun: false,
          mutationPerformed: true,
          created: !context.existingMatch,
          updated: Boolean(context.existingMatch),
          match,
        };
      },
    },
  ];
}
