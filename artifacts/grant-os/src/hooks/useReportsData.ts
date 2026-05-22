import { useMemo } from "react";
import { useAgentNotes } from "@/hooks/useAgentNotes";
import { useAgentReports } from "@/hooks/useAgentReports";
import { useApplications } from "@/hooks/useApplications";
import { useDocuments } from "@/hooks/useDocuments";
import { useFunders } from "@/hooks/useFunders";
import { useGrantMatches } from "@/hooks/useGrantMatches";
import { useGrants } from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { useProofItems } from "@/hooks/useProofItems";
import { useTasks } from "@/hooks/useTasks";
import type {
  ApplicationRow,
  DocumentRow,
  FunderRow,
  GrantMatchDecisionLabelDb,
  GrantMatchRow,
  GrantRow,
  ProjectRow,
  TaskRow,
} from "@/types/database";
import {
  deadlineInfo,
  deadlineWindowForDays,
  formatGrantAmount,
  isActiveGrant,
  jsonStringArray,
  matchTopAction,
  matchTopRisk,
  type DeadlineWindow,
} from "@/lib/reports/reportUtils";

export type GrantPipelineRecord = {
  grant: GrantRow;
  project: ProjectRow | null;
  match: GrantMatchRow | null;
  deadlineLabel: string;
  deadlineWindow: DeadlineWindow;
  daysLeft: number | null;
  amount: string;
  topRisk: string;
  recommendedAction: string;
};

export type ProjectReadinessRecord = {
  project: ProjectRow;
  readinessScore: number;
  readinessLevel: string;
  proofCount: number;
  documentCount: number;
  applicationCount: number;
  openTasks: number;
  completedTasks: number;
  matchCount: number;
  topMatches: GrantPipelineRecord[];
  upcomingDeadlines: GrantPipelineRecord[];
  missingMaterials: string[];
};

export type FunderIntelRecord = {
  funder: FunderRow;
  linkedGrantCount: number;
};

export type ApplicationWorkloadRecord = {
  application: ApplicationRow;
  grant: GrantRow | null;
  project: ProjectRow | null;
  deadlineLabel: string;
  daysLeft: number | null;
  openTasks: number;
  completedTasks: number;
  requiredDocuments: number;
};

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function bestMatchesByGrant(matches: GrantMatchRow[]): Map<string, GrantMatchRow> {
  const map = new Map<string, GrantMatchRow>();
  matches.forEach((match) => {
    const current = map.get(match.grant_id);
    if (!current || match.match_score > current.match_score) map.set(match.grant_id, match);
  });
  return map;
}

function profileCompleteness(project: ProjectRow): number {
  const fields = [
    project.summary,
    project.problem_statement,
    project.solution,
    project.target_audience,
    project.geography,
    project.technology,
    project.impact,
    project.grant_relevance,
    project.reusable_grant_language,
  ];
  return Math.round((fields.filter((value) => Boolean(value?.trim())).length / fields.length) * 40);
}

function projectMissingMaterials(project: ProjectRow, proofCount: number, documentCount: number): string[] {
  const missing: string[] = [];
  if (!project.problem_statement) missing.push("Project brief/problem statement");
  if (!project.solution) missing.push("Solution narrative");
  if (!project.impact) missing.push("Impact metrics");
  if (!project.reusable_grant_language) missing.push("Reusable application answers");
  if (!proofCount) {
    missing.push("Proof items");
    missing.push("Demo/screenshots");
  }
  if (!documentCount) missing.push("Linked grant guidelines/documents");
  const text = [project.summary, project.grant_relevance, project.reusable_grant_language].join(" ").toLowerCase();
  if (!text.includes("budget")) missing.push("Budget narrative");
  if (!text.includes("fiscal sponsor") && !text.includes("legal")) missing.push("Legal applicant/fiscal sponsor confirmation");
  return missing.slice(0, 7);
}

export function useReportsData() {
  const projectsQuery = useProjects();
  const grantsQuery = useGrants();
  const fundersQuery = useFunders();
  const documentsQuery = useDocuments();
  const proofItemsQuery = useProofItems();
  const applicationsQuery = useApplications();
  const tasksQuery = useTasks();
  const matchesQuery = useGrantMatches({ status: "all" });
  const notesQuery = useAgentNotes();
  const reportsQuery = useAgentReports();

  const data = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const grants = grantsQuery.data ?? [];
    const funders = fundersQuery.data ?? [];
    const documents = documentsQuery.data ?? [];
    const proofItems = proofItemsQuery.data ?? [];
    const applications = applicationsQuery.data ?? [];
    const tasks = tasksQuery.data ?? [];
    const matches = matchesQuery.data ?? [];
    const notes = notesQuery.data ?? [];
    const reports = reportsQuery.data ?? [];

    const projectById = byId(projects);
    const projectBySlug = new Map(projects.map((project) => [project.slug, project]));
    const grantById = byId(grants);
    const bestMatchByGrant = bestMatchesByGrant(matches);
    const grantsByFunder = new Map<string, number>();
    grants.forEach((grant) => {
      if (grant.funder_id) grantsByFunder.set(grant.funder_id, (grantsByFunder.get(grant.funder_id) ?? 0) + 1);
      if (grant.funder_name) grantsByFunder.set(grant.funder_name.toLowerCase(), (grantsByFunder.get(grant.funder_name.toLowerCase()) ?? 0) + 1);
    });

    const pipelineRecords: GrantPipelineRecord[] = grants
      .filter((grant) => !grant.archived_at)
      .map((grant) => {
        const match = bestMatchByGrant.get(grant.id) ?? null;
        const deadline = deadlineInfo(grant);
        const project = match?.project_id
          ? projectById.get(match.project_id) ?? null
          : grant.related_project_id
            ? projectById.get(grant.related_project_id) ?? null
            : grant.related_project_slug
              ? projectBySlug.get(grant.related_project_slug) ?? null
              : null;
        return {
          grant,
          project,
          match,
          deadlineLabel: deadline.label,
          deadlineWindow: deadlineWindowForDays(deadline.days, deadline.status),
          daysLeft: deadline.days,
          amount: formatGrantAmount(grant),
          topRisk: matchTopRisk(match),
          recommendedAction: matchTopAction(match),
        };
      })
      .sort((a, b) => {
        const scoreDiff = (b.match?.match_score ?? 0) - (a.match?.match_score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
      });

    const projectRecords: ProjectReadinessRecord[] = projects.map((project) => {
      const projectGrants = pipelineRecords.filter((record) => record.project?.id === project.id || record.grant.related_project_id === project.id || record.grant.related_project_slug === project.slug);
      const projectProof = proofItems.filter((item) => item.project_id === project.id && !item.archived_at);
      const projectDocs = documents.filter((doc) => doc.related_project_id === project.id && !doc.archived_at);
      const projectApps = applications.filter((app) => app.project_id === project.id && !app.archived_at);
      const projectTasks = tasks.filter((task) => task.related_project_id === project.id && !task.archived_at);
      const completedTasks = projectTasks.filter((task) => task.status === "Complete").length;
      const openTasks = projectTasks.length - completedTasks;
      const projectNotes = notes.filter((note) => note.related_project_id === project.id && !note.archived_at);
      const projectReports = reports.filter((report) => report.related_project_id === project.id && !report.archived_at);
      const matchCount = matches.filter((match) => match.project_id === project.id).length;
      const readinessScore = Math.min(100, profileCompleteness(project) + Math.min(20, projectProof.length * 5) + Math.min(15, projectDocs.length * 3) + Math.min(10, projectApps.length * 5) + Math.min(10, completedTasks * 2) + Math.min(5, projectNotes.length + projectReports.length));
      return {
        project,
        readinessScore,
        readinessLevel: readinessScore >= 75 ? "Ready" : readinessScore >= 50 ? "Needs Proof" : "Incomplete",
        proofCount: projectProof.length,
        documentCount: projectDocs.length,
        applicationCount: projectApps.length,
        openTasks,
        completedTasks,
        matchCount,
        topMatches: projectGrants.filter((record) => record.match).slice(0, 3),
        upcomingDeadlines: projectGrants.filter((record) => record.daysLeft !== null && record.daysLeft >= 0).sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)).slice(0, 3),
        missingMaterials: projectMissingMaterials(project, projectProof.length, projectDocs.length),
      };
    });

    const funderRecords: FunderIntelRecord[] = funders
      .filter((funder) => !funder.archived_at)
      .map((funder) => ({
        funder,
        linkedGrantCount: grantsByFunder.get(funder.id) ?? grantsByFunder.get(funder.name.toLowerCase()) ?? 0,
      }))
      .sort((a, b) => (b.linkedGrantCount - a.linkedGrantCount) || ((b.funder.annual_giving ?? 0) - (a.funder.annual_giving ?? 0)));

    const applicationRecords: ApplicationWorkloadRecord[] = applications
      .filter((application) => !application.archived_at)
      .map((application) => {
        const grant = application.grant_id ? grantById.get(application.grant_id) ?? null : null;
        const project = application.project_id ? projectById.get(application.project_id) ?? null : null;
        const appTasks = tasks.filter((task) => task.related_application_id === application.id && !task.archived_at);
        const completedTasks = appTasks.filter((task) => task.status === "Complete").length;
        const deadline = grant ? deadlineInfo(grant) : { label: "—", days: null };
        return {
          application,
          grant,
          project,
          deadlineLabel: deadline.label,
          daysLeft: deadline.days,
          openTasks: appTasks.length - completedTasks,
          completedTasks,
          requiredDocuments: grant?.required_documents?.length ?? 0,
        };
      });

    const metrics = {
      grants: grants.length,
      activeGrants: grants.filter((grant) => isActiveGrant(grant.status)).length,
      rollingGrants: pipelineRecords.filter((record) => record.deadlineWindow === "rolling").length,
      dueSoonGrants: pipelineRecords.filter((record) => record.daysLeft !== null && record.daysLeft >= 0 && record.daysLeft <= 30).length,
      pastDeadlineGrants: pipelineRecords.filter((record) => record.deadlineWindow === "past").length,
      highValueGrants: grants.filter((grant) => (grant.amount_max ?? grant.amount_min ?? 0) >= 100000).length,
      missingEligibility: grants.filter((grant) => !grant.eligibility).length,
      needsReview: pipelineRecords.filter((record) => record.match?.decision_label === "needs_review" || (!record.match && !record.grant.eligibility)).length,
      projects: projects.length,
      funders: funders.length,
      documents: documents.length,
      matches: matches.length,
      applications: applications.length,
      activeApplications: applications.filter((app) => !["Submitted", "Awarded", "Declined", "Archived"].includes(app.status)).length,
      submittedApplications: applications.filter((app) => app.status === "Submitted").length,
      openTasks: tasks.filter((task) => !["Complete", "Archived"].includes(task.status)).length,
      overdueTasks: tasks.filter((task) => task.due_date && new Date(task.due_date).getTime() < Date.now() && !["Complete", "Archived"].includes(task.status)).length,
      highPriorityTasks: tasks.filter((task) => ["High", "Urgent"].includes(task.priority) && !["Complete", "Archived"].includes(task.status)).length,
      fundersWithEin: funders.filter((funder) => Boolean(funder.ein)).length,
      fundersWithWebsite: funders.filter((funder) => Boolean(funder.website)).length,
      inviteOnlyFunders: funders.filter((funder) => /invite|invitation/i.test(`${funder.openness_to_new_grantees ?? ""} ${funder.notes ?? ""}`)).length,
      fundersWithAvailableGrants: funderRecords.filter((record) => record.linkedGrantCount > 0 || record.funder.open_applications).length,
      documentsUnsupported: documents.filter((doc) => doc.extraction_status === "unsupported").length,
      documentsUnlinked: documents.filter((doc) => !doc.related_project_id && !doc.related_grant_id && !doc.related_funder_id && !doc.related_application_id).length,
      grantsMissingDeadline: grants.filter((grant) => !grant.deadline && !grant.next_deadline).length,
      grantsMissingAmount: grants.filter((grant) => !grant.amount_display && !grant.amount_min && !grant.amount_max).length,
      grantsMissingFunder: grants.filter((grant) => !grant.funder_id && !grant.funder_name).length,
      fundersMissingWebsite: funders.filter((funder) => !funder.website).length,
      fundersMissingEin: funders.filter((funder) => !funder.ein).length,
      duplicateRiskGrants: grants.length - new Set(grants.map((grant) => `${grant.title.toLowerCase()}::${(grant.funder_name ?? "").toLowerCase()}`)).size,
    };

    return { projects, grants, funders, documents, applications, tasks, matches, pipelineRecords, projectRecords, funderRecords, applicationRecords, metrics };
  }, [projectsQuery.data, grantsQuery.data, fundersQuery.data, documentsQuery.data, proofItemsQuery.data, applicationsQuery.data, tasksQuery.data, matchesQuery.data, notesQuery.data, reportsQuery.data]);

  return {
    ...data,
    isLoading: projectsQuery.isLoading || grantsQuery.isLoading || fundersQuery.isLoading || documentsQuery.isLoading || proofItemsQuery.isLoading || applicationsQuery.isLoading || tasksQuery.isLoading || matchesQuery.isLoading || notesQuery.isLoading || reportsQuery.isLoading,
    isError: projectsQuery.isError || grantsQuery.isError || fundersQuery.isError || documentsQuery.isError || proofItemsQuery.isError || applicationsQuery.isError || tasksQuery.isError || matchesQuery.isError || notesQuery.isError || reportsQuery.isError,
    error: projectsQuery.error ?? grantsQuery.error ?? fundersQuery.error ?? documentsQuery.error ?? proofItemsQuery.error ?? applicationsQuery.error ?? tasksQuery.error ?? matchesQuery.error ?? notesQuery.error ?? reportsQuery.error,
  };
}
