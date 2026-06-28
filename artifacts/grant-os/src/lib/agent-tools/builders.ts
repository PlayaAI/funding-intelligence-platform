import type {
  ApplicationRow,
  DocumentRow,
  FunderRow,
  GrantRow,
  PeerFundingRecordRow,
  PeerOrganizationRow,
  ProjectRow,
  ProofItemRow,
  TaskRow,
} from "../../types/database";
import { computeUrgency } from "./deadlineUtils";
import type {
  ApplicationExportPacket,
  ApplicationWorkloadReport,
  ChecklistTemplateItem,
  DashboardSummary,
  DataQualityReport,
  DataQualityStub,
  DeadlineGrantStub,
  DeadlineReport,
  GrantExportPacket,
  PeerExportPacket,
} from "./types";
import type { GrantOsRepository } from "./repository";

function packageBase<TPackageType extends "grant" | "application" | "peer", TRecords extends Record<string, unknown>>(
  packageType: TPackageType,
  records: TRecords,
) {
  return {
    exported_at: new Date().toISOString(),
    app: "Grant OS" as const,
    package_type: packageType,
    records,
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function isOpenTask(task: TaskRow) {
  return task.status !== "Complete" && task.status !== "Archived";
}

export function buildChecklistTemplate(grant: GrantRow, project: ProjectRow | null): ChecklistTemplateItem[] {
  const projectName = project?.name ?? "the linked project";
  return [
    {
      title: `Review grant details for ${grant.title}`,
      description: `Confirm deadline, eligibility, and submission steps for ${projectName}.`,
      priority: "High",
    },
    {
      title: `Assemble core materials for ${grant.title}`,
      description: `Collect narrative, budget, proof items, and linked documents needed to apply from ${projectName}.`,
      priority: "High",
    },
    {
      title: `Prepare internal review for ${grant.title}`,
      description: `Draft the application outline and mark the application ready for human review before any submission activity.`,
      priority: "Medium",
    },
  ];
}

export async function buildGrantPacket(repository: GrantOsRepository, grant: GrantRow, funder: FunderRow | null, compact = true): Promise<GrantExportPacket | Record<string, unknown>> {
  const [applications, tasks, agentNotes, agentReports, grantMatches] = await Promise.all([
    repository.listApplicationsByGrant(grant.id),
    repository.listTasks(),
    repository.listAgentNotes({ relatedGrantId: grant.id }),
    repository.listAgentReports({ relatedGrantId: grant.id }),
    repository.listGrantMatches({ grantId: grant.id }),
  ]);
  const filteredTasks = tasks.filter((task) => task.related_grant_id === grant.id);
  const projectIds = new Set<string>();
  if (grant.related_project_id) projectIds.add(grant.related_project_id);
  for (const application of applications) {
    if (application.project_id) projectIds.add(application.project_id);
  }
  for (const match of grantMatches) {
    const projectId = typeof match.project_id === "string" ? match.project_id : null;
    if (projectId) projectIds.add(projectId);
  }
  const allProjects = await repository.listProjects();
  const relatedProjects = allProjects.filter((project) => projectIds.has(project.id));
  const proofItems = uniqueById(
    (await Promise.all(relatedProjects.map((project) => repository.listProofItems(project.id)))).flat()
  );
  const documents = await repository.listGrantDocuments(grant, funder);

  if (compact) {
    return {
      ...packageBase("grant", {
        grant: { id: grant.id, title: grant.title, status: grant.status, deadline: grant.deadline ?? grant.next_deadline, funder_id: grant.funder_id, url: grant.application_url ?? grant.source_url },
        funder: funder ? { id: funder.id, name: funder.name, website: funder.website } : null,
        projects: relatedProjects.map(p => ({ id: p.id, name: p.name, slug: p.slug })),
        applications: applications.map(a => ({ id: a.id, title: a.title ?? null, status: a.status, project_id: a.project_id, grant_id: a.grant_id })),
        tasks: filteredTasks.map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, owner_name: t.owner_name, related_grant_id: t.related_grant_id, related_application_id: t.related_application_id })),
        proof_items: proofItems.map(p => ({ id: p.id, title: p.title, project_id: p.project_id, proof_type: p.type })),
        documents: documents.map(d => ({ id: d.id, title: d.title, document_type: d.document_type, source_url: d.source_url ?? d.file_url, created_at: d.created_at })),
        notes: agentNotes.map(n => ({ id: n.id, title: n.title, created_at: n.created_at })),
        reports: agentReports.map(r => ({ id: r.id, title: r.title, created_at: r.created_at })),
        matches: grantMatches.map(m => ({ id: m.id, project_id: m.project_id, grant_id: m.grant_id, match_score: m.match_score, decision_label: m.decision_label }))
      }),
      generated_at: new Date().toISOString(),
    };
  }

  return {
    ...packageBase("grant", {
      grant,
      funder,
      related_projects: relatedProjects,
      applications,
      tasks: filteredTasks,
      proof_items: proofItems,
      documents,
      agent_notes: agentNotes,
      agent_reports: agentReports,
      grant_matches: grantMatches,
    }),
    generated_at: new Date().toISOString(),
  };
}

export async function buildApplicationPacket(repository: GrantOsRepository, application: ApplicationRow, compact = true): Promise<ApplicationExportPacket | Record<string, unknown>> {
  const [grant, project, questions, requiredDocuments, tasks, appDocuments, agentNotes, agentReports] = await Promise.all([
    application.grant_id ? repository.getGrant(application.grant_id) : Promise.resolve(null),
    application.project_id ? repository.getProject(application.project_id) : Promise.resolve(null),
    repository.listApplicationQuestions(application.id),
    repository.listApplicationRequiredDocuments(application.id),
    repository.listTasksByApplication(application.id),
    repository.listDocuments({ relatedApplicationId: application.id }),
    repository.listAgentNotes({ relatedApplicationId: application.id }),
    repository.listAgentReports({ relatedApplicationId: application.id }),
  ]);
  const funder = grant?.funder_id ? await repository.getFunder(grant.funder_id) : null;
  const grantDocuments = grant ? await repository.listGrantDocuments(grant, funder) : [];
  const projectDocuments = application.project_id
    ? await repository.listDocuments({ relatedProjectId: application.project_id })
    : [];
  const proofItems = application.project_id ? await repository.listProofItems(application.project_id) : [];
  const grantMatch = application.project_id && application.grant_id
    ? (await repository.listGrantMatches({ projectId: application.project_id, grantId: application.grant_id }))[0] ?? null
    : null;

  const allDocuments = uniqueById([...appDocuments, ...grantDocuments, ...projectDocuments]);

  if (compact) {
    return {
      ...packageBase("application", {
        application: { id: application.id, title: application.title ?? null, status: application.status, project_id: application.project_id, grant_id: application.grant_id },
        grant: grant ? { id: grant.id, title: grant.title, status: grant.status, deadline: grant.deadline ?? grant.next_deadline, funder_id: grant.funder_id, url: grant.application_url ?? grant.source_url } : null,
        project: project ? { id: project.id, name: project.name, slug: project.slug } : null,
        funder: funder ? { id: funder.id, name: funder.name, website: funder.website } : null,
        tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, owner_name: t.owner_name })),
        documents: allDocuments.map(d => ({ id: d.id, title: d.title, document_type: d.document_type, source_url: d.source_url ?? d.file_url, created_at: d.created_at })),
        questions: questions.map(q => ({ id: q.id, prompt: q.question, status: q.status })),
        required_documents: requiredDocuments.map(r => ({ id: r.id, title: r.title, status: r.status })),
        proof_items: proofItems.map(p => ({ id: p.id, title: p.title, project_id: p.project_id, proof_type: p.type })),
      }),
      generated_at: new Date().toISOString(),
    };
  }

  return {
    ...packageBase("application", {
      application,
      grant,
      funder,
      project,
      questions,
      required_documents: requiredDocuments,
      tasks,
      documents: allDocuments,
      proof_items: proofItems,
      agent_notes: agentNotes,
      agent_reports: agentReports,
      grant_match: grantMatch,
    }),
    generated_at: new Date().toISOString(),
  };
}

export async function buildPeerPacket(repository: GrantOsRepository, peer: PeerOrganizationRow, compact = true): Promise<PeerExportPacket> {
  const fundingRecords = await repository.listPeerFundingRecords(peer.id);
  const funders = await repository.listFunders();
  const linkedFunders = funders.filter((funder) => fundingRecords.some((record) => record.funder_id === funder.id));

  const peerRecord = compact
    ? {
        id: peer.id,
        name: peer.name,
        slug: peer.slug,
        website: peer.website,
        confidence: peer.confidence,
        focus_areas: peer.focus_areas,
        location: peer.location,
        relevance: peer.relevance,
      }
    : peer;

  const fundingRecordItems = compact
    ? fundingRecords.map((record) => ({
        id: record.id,
        funder_name: record.funder_name,
        year: record.year,
        amount: record.amount,
        purpose: record.purpose,
        confidence: record.confidence,
      }))
    : fundingRecords;

  const funderItems = compact
    ? linkedFunders.map((funder) => ({ id: funder.id, name: funder.name, website: funder.website }))
    : linkedFunders;

  return {
    ...packageBase("peer", {
      peer_organization: peerRecord,
      funding_records: fundingRecordItems,
      linked_funders: funderItems,
      source_metadata: compact ? {} : ((peer.source_metadata ?? {}) as Record<string, unknown>),
    }),
    generated_at: new Date().toISOString(),
  };
}

export async function buildDashboardSummary(repository: GrantOsRepository): Promise<DashboardSummary> {
  const [grants, applications, tasks, projects, documents, peers, peerFundingRecords] = await Promise.all([
    repository.listGrants(),
    repository.listApplications(),
    repository.listTasks(),
    repository.listProjects(),
    repository.listDocuments(),
    repository.listPeers(),
    repository.listAllPeerFundingRecords(),
  ]);
  const now = new Date().toISOString();
  return {
    grants: { total: grants.length, byStatus: countBy(grants, (grant) => grant.status) },
    applications: { total: applications.length, byStatus: countBy(applications, (application) => application.status) },
    tasks: {
      total: tasks.length,
      byStatus: countBy(tasks, (task) => task.status),
      overdue: tasks.filter((task) => !!task.due_date && task.due_date < now && isOpenTask(task)).length,
    },
    projects: { total: projects.length },
    documents: { total: documents.length },
    peers: { total: peers.length, fundingRecords: peerFundingRecords.length },
  };
}

export async function buildDeadlineReport(repository: GrantOsRepository): Promise<DeadlineReport> {
  const grants = await repository.listGrants();
  const now = new Date();
  const windows: DeadlineReport["windows"] = {
    within_30_days: [],
    within_14_days: [],
    within_7_days: [],
    within_3_days: [],
  };
  const rolling: DeadlineGrantStub[] = [];
  const unknown: DeadlineGrantStub[] = [];
  for (const grant of grants) {
    const rawDeadline = grant.next_deadline ?? grant.deadline;
    const stub: DeadlineGrantStub = {
      id: grant.id,
      title: grant.title,
      status: grant.status ?? null,
      deadline: rawDeadline ?? null,
      days_remaining: null,
    };
    if (!rawDeadline) {
      if (grant.application_url || grant.source_url) rolling.push(stub);
      else unknown.push(stub);
      continue;
    }
    const deadline = new Date(rawDeadline);
    if (Number.isNaN(deadline.getTime())) {
      unknown.push(stub);
      continue;
    }
    const days = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const stubWithDays: DeadlineGrantStub = { ...stub, days_remaining: days };
    // Each grant appears in at most one window (the tightest one), avoiding duplication
    if (days <= 3) windows.within_3_days.push(stubWithDays);
    else if (days <= 7) windows.within_7_days.push(stubWithDays);
    else if (days <= 14) windows.within_14_days.push(stubWithDays);
    else if (days <= 30) windows.within_30_days.push(stubWithDays);
  }
  return { generatedAt: new Date().toISOString(), windows, rolling, unknown };
}

export async function buildApplicationWorkloadReport(repository: GrantOsRepository): Promise<ApplicationWorkloadReport> {
  const applications = await repository.listApplications();
  const rows = await Promise.all(
    applications.map(async (application) => {
      const [tasks, documents, questions, requiredDocuments] = await Promise.all([
        repository.listTasksByApplication(application.id),
        repository.listDocuments({ relatedApplicationId: application.id }),
        repository.listApplicationQuestions(application.id),
        repository.listApplicationRequiredDocuments(application.id),
      ]);
      return {
        applicationId: application.id,
        title: application.title ?? null,
        status: application.status ?? null,
        taskCount: tasks.length,
        openTaskCount: tasks.filter(isOpenTask).length,
        documentCount: documents.length,
        questionCount: questions.length,
        requiredDocumentCount: requiredDocuments.length,
      };
    })
  );
  return { generatedAt: new Date().toISOString(), applications: rows };
}

export async function buildAgentContextBrief(repository: GrantOsRepository) {
  const [grants, applications, tasks, knowledgeItems] = await Promise.all([
    repository.listGrants(),
    repository.listApplications(),
    repository.listTasks(),
    repository.listAgentKnowledgeItems ? repository.listAgentKnowledgeItems() : Promise.resolve([]),
  ]);

  const now = new Date();
  const nowStr = now.toISOString();

  // Find open tasks and overdue tasks
  let openTaskCount = 0;
  let overdueTaskCount = 0;
  for (const task of tasks) {
    if (isOpenTask(task)) {
      openTaskCount++;
      if (task.due_date && task.due_date < nowStr) {
        overdueTaskCount++;
      }
    }
  }

  // Get top 3 applications (e.g. by status progression, or just first 3)
  const top_3_applications = applications
    .slice(0, 3)
    .map((app) => ({ id: app.id, title: app.title ?? null, status: app.status ?? null }));

  // Get grants due soon (next 5)
  const upcomingGrants = grants
    .filter((g) => g.deadline || g.next_deadline)
    .map((g) => {
      const d = new Date((g.deadline ?? g.next_deadline)!);
      const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { id: g.id, title: g.title, deadline: g.deadline ?? g.next_deadline, days_remaining: days, dateObj: d };
    })
    .filter((g) => g.days_remaining >= 0)
    .sort((a, b) => a.days_remaining - b.days_remaining)
    .slice(0, 5)
    .map((g) => ({ id: g.id, title: g.title, deadline: g.deadline, days_remaining: g.days_remaining }));

  return {
    grant_count: grants.length,
    application_count: applications.length,
    open_task_count: openTaskCount,
    overdue_task_count: overdueTaskCount,
    grants_due_soon: upcomingGrants,
    top_3_applications,
    knowledge_item_count: knowledgeItems.length,
  };
}

export async function buildDataQualityReport(repository: GrantOsRepository): Promise<DataQualityReport> {
  const [grants, applications, tasks, documents] = await Promise.all([
    repository.listGrants(),
    repository.listApplications(),
    repository.listTasks(),
    repository.listDocuments(),
  ]);
  const toGrantStub = (g: GrantRow, issue: string): DataQualityStub => ({ id: g.id, title: g.title ?? null, issue });
  const toAppStub = (a: ApplicationRow, issue: string): DataQualityStub => ({ id: a.id, title: (a as any).title ?? null, issue });
  const toTaskStub = (t: TaskRow, issue: string): DataQualityStub => ({ id: t.id, title: t.title ?? null, issue });
  const toDocStub = (d: DocumentRow, issue: string): DataQualityStub => ({ id: d.id, title: d.title ?? null, issue });
  return {
    generatedAt: new Date().toISOString(),
    grantsMissingDeadlines: grants.filter((g) => !g.deadline && !g.next_deadline).map((g) => toGrantStub(g, "missing_deadline")),
    grantsMissingUrls: grants.filter((g) => !g.application_url && !g.source_url).map((g) => toGrantStub(g, "missing_url")),
    applicationsWithoutProject: applications.filter((a) => !a.project_id).map((a) => toAppStub(a, "no_project_link")),
    tasksWithoutOwner: tasks.filter((t) => !t.owner_name).map((t) => toTaskStub(t, "no_owner")),
    documentsWithoutSource: documents.filter((d) => !d.source_url && !d.file_url).map((d) => toDocStub(d, "no_source")),
  };
}

export function summarizeDocuments(documents: DocumentRow[]) {
  return documents.map((document) => ({
    id: document.id,
    title: document.title,
    type: document.document_type,
    related_grant_id: document.related_grant_id,
    related_application_id: document.related_application_id,
  }));
}

/** Strip extracted_text (and other heavy blob fields) from a document for compact list responses. */
export function stripDocumentContent(document: DocumentRow): Omit<DocumentRow, "extracted_text"> {
  const { extracted_text: _removed, ...rest } = document as DocumentRow & { extracted_text?: unknown };
  return rest as Omit<DocumentRow, "extracted_text">;
}

export function sortGrantsForSearch(grants: GrantRow[], query: string) {
  const normalized = query.trim().toLowerCase();
  return [...grants].sort((a, b) => {
    const aScore = `${a.title} ${a.funder_name ?? ""}`.toLowerCase().includes(normalized) ? 1 : 0;
    const bScore = `${b.title} ${b.funder_name ?? ""}`.toLowerCase().includes(normalized) ? 1 : 0;
    return bScore - aScore;
  });
}

export function filterDocumentsForGrant(grant: GrantRow, funder: FunderRow | null, documents: DocumentRow[]) {
  return documents.filter((document) =>
    document.related_grant_id === grant.id ||
    (funder?.id ? document.related_funder_id === funder.id : false)
  );
}

export function filterFundingRecordsForFunder(records: PeerFundingRecordRow[], funderId: string) {
  return records.filter((record) => record.funder_id === funderId);
}

export function filterDocumentsForApplication(applicationId: string, documents: DocumentRow[]) {
  return documents.filter((document) => document.related_application_id === applicationId);
}

export function filterGrantApplications(grantId: string, applications: ApplicationRow[]) {
  return applications.filter((application) => application.grant_id === grantId);
}

export function filterApplicationTasks(applicationId: string, tasks: TaskRow[]) {
  return tasks.filter((task) => task.related_application_id === applicationId);
}

export function filterProjectProofItems(projectId: string, proofItems: ProofItemRow[]) {
  return proofItems.filter((item) => item.project_id === projectId);
}

export function filterTasks(tasks: TaskRow[], filters: {
  relatedGrantId?: string;
  relatedApplicationId?: string;
  status?: string;
}) {
  return tasks.filter((task) => {
    if (filters.relatedGrantId && task.related_grant_id !== filters.relatedGrantId) return false;
    if (filters.relatedApplicationId && task.related_application_id !== filters.relatedApplicationId) return false;
    if (filters.status && task.status !== filters.status) return false;
    return true;
  });
}

// ─── Composite: get_grant_decision_brief ─────────────────────────────────────

const MAX_CANDIDATE_PROJECTS = 5;
const MAX_BRIEF_PROOF_IDS = 10;

export async function buildGrantDecisionBrief(
  repository: GrantOsRepository,
  grantId: string,
  opts: { projectId?: string; projectIds?: string[]; maxProjects?: number } = {}
) {
  const cap = Math.min(opts.maxProjects ?? MAX_CANDIDATE_PROJECTS, MAX_CANDIDATE_PROJECTS);

  // Parallel fetch of core records
  const [grant, allProjects, allApplications, allMatches] = await Promise.all([
    repository.getGrant(grantId),
    repository.listProjects(),
    repository.listApplications(),
    repository.listGrantMatches({ grantId }),
  ]);

  if (!grant) throw new Error(`Grant ${grantId} not found.`);

  // Funder (conditional)
  const funder = grant.funder_id ? await repository.getFunder(grant.funder_id) : null;

  // Determine candidate project set
  const requestedIds = new Set<string>([
    ...(opts.projectId ? [opts.projectId] : []),
    ...(opts.projectIds ?? []),
  ]);
  const candidateProjects = requestedIds.size > 0
    ? allProjects.filter((p) => requestedIds.has(p.id))
    : allProjects;
  const capped = candidateProjects.slice(0, cap);
  const truncated = candidateProjects.length > cap;

  // Existing matches and applications for this grant
  const existingMatches = allMatches;
  const grantApplications = allApplications.filter((a) => a.grant_id === grantId);

  // Build candidate project stubs (use existing match data for fit scoring)
  const candidateStubs = capped.map((project) => {
    const match = existingMatches.find((m) => m.project_id === project.id);
    return {
      id: project.id,
      name: project.name,
      slug: project.slug ?? null,
      fitScore: match ? Math.round((match.match_score ?? 0) / 10) : null,
      topReason: (match?.fit_reasons as string[] | null | undefined)?.[0] ?? null,
      topRisk: (match?.risks as string[] | null | undefined)?.[0] ?? null,
    };
  });

  // Pick best project: highest fitScore, then first candidate
  const sorted = [...candidateStubs].sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1));
  const bestProject = sorted[0] ?? null;

  // Existing application for best project
  const existingApplication = bestProject
    ? grantApplications.find((a) => a.project_id === bestProject.id) ?? null
    : grantApplications[0] ?? null;

  // Existing match record for best project
  const existingMatch = bestProject
    ? existingMatches.find((m) => m.project_id === bestProject.id) ?? null
    : existingMatches[0] ?? null;

  // Proof items for best project (IDs only for source tracking)
  const proofItems = bestProject
    ? await repository.listProofItems(bestProject.id)
    : [];

  // Urgency
  const rawDeadline = grant.deadline ?? grant.next_deadline ?? null;
  const urgency = computeUrgency(rawDeadline);

  // Build heuristic signals
  const missingInfo: string[] = [];
  const topReasons: string[] = [];
  const topRisks: string[] = [];

  if (!grant.eligibility) missingInfo.push("Grant eligibility not captured.");
  if (!grant.deadline && !grant.next_deadline) missingInfo.push("Deadline unknown.");
  if (!grant.application_url && !grant.source_url) missingInfo.push("Application URL missing.");
  if (capped.length === 0) missingInfo.push("No projects to evaluate against.");
  if (proofItems.length === 0 && bestProject) missingInfo.push("No proof items linked to best project.");

  if (existingMatch) {
    topReasons.push(...((existingMatch.fit_reasons as string[] | null)?.slice(0, 3) ?? []));
    topRisks.push(...((existingMatch.risks as string[] | null)?.slice(0, 3) ?? []));
  } else {
    if (bestProject?.topReason) topReasons.push(bestProject.topReason);
    if (bestProject?.topRisk) topRisks.push(bestProject.topRisk);
  }

  const fitScore = existingMatch?.match_score ?? null;
  const readinessScore = existingMatch?.readiness_score ?? null;

  let recommendation: "apply_now" | "prepare_first" | "monitor" | "skip" | "needs_review" | "missed_deadline";
  if (missingInfo.length >= 3 || capped.length === 0) {
    recommendation = "needs_review";
  } else if (urgency.deadline_status === "expired") {
    recommendation = "missed_deadline";
  } else if (fitScore !== null && fitScore >= 80 && urgency.deadline_status !== "unknown") {
    recommendation = "apply_now";
  } else if (fitScore !== null && fitScore >= 60) {
    recommendation = "prepare_first";
  } else if (fitScore !== null && fitScore < 40) {
    recommendation = "monitor";
  } else {
    recommendation = "needs_review";
  }

  const recommendedNextStep =
    recommendation === "apply_now" ? "Create or review the application workspace and begin drafting." :
    recommendation === "prepare_first" ? "Gather missing documents and proof items before applying." :
    recommendation === "monitor" ? "Monitor for updated guidelines or next cycle." :
    recommendation === "missed_deadline" ? "Deadline has passed — archive or monitor for next cycle." :
    "Gather missing information and run generate_grant_match for deeper analysis.";

  return {
    grant: {
      id: grant.id,
      title: grant.title,
      status: grant.status ?? null,
      deadline: rawDeadline,
      funder_id: grant.funder_id ?? null,
      funder_name: grant.funder_name ?? null,
      url: grant.application_url ?? grant.source_url ?? null,
    },
    urgency,
    funder: funder
      ? { id: funder.id, name: funder.name, website: funder.website ?? null }
      : null,
    bestProject: bestProject
      ? { id: bestProject.id, name: bestProject.name, slug: bestProject.slug, fitScore: bestProject.fitScore, topReason: bestProject.topReason, topRisk: bestProject.topRisk }
      : null,
    candidateProjects: candidateStubs,
    existingApplication: existingApplication
      ? { id: existingApplication.id, title: existingApplication.title ?? existingApplication.id, status: existingApplication.status ?? null }
      : null,
    existingMatch: existingMatch
      ? {
          id: existingMatch.id,
          project_id: existingMatch.project_id,
          grant_id: existingMatch.grant_id,
          match_score: existingMatch.match_score ?? null,
          decision_label: existingMatch.decision_label ?? null,
          recommendation: (existingMatch.recommended_actions as string[] | null)?.[0] ?? null,
        }
      : null,
    recommendation,
    readinessScore: readinessScore !== null ? Math.round(readinessScore / 10) : null,
    topReasons,
    topRisks,
    missingInfo,
    recommendedNextStep,
    sourceRecordIds: {
      grantId: grant.id,
      funderId: funder?.id ?? null,
      projectIds: capped.map((p) => p.id),
      applicationIds: grantApplications.map((a) => a.id),
      matchIds: existingMatches.map((m) => m.id),
      proofItemIds: proofItems.slice(0, MAX_BRIEF_PROOF_IDS).map((p) => p.id),
    },
    truncated,
  };
}

// ─── Composite: get_application_prep_context ─────────────────────────────────

const MAX_OPEN_TASKS = 10;
const MAX_LINKED_DOCS = 10;
const MAX_PROOF_STRONGEST = 5;

export async function buildApplicationPrepContext(
  repository: GrantOsRepository,
  applicationId: string,
  opts: { includeSuggestedTasks?: boolean } = {}
) {
  const application = await repository.getApplication(applicationId);
  if (!application) throw new Error(`Application ${applicationId} not found.`);

  // Parallel fetch
  const [grant, project, tasks, appDocs, requiredDocs, proofItems] = await Promise.all([
    application.grant_id ? repository.getGrant(application.grant_id) : Promise.resolve(null),
    application.project_id ? repository.getProject(application.project_id) : Promise.resolve(null),
    repository.listTasksByApplication(applicationId),
    repository.listDocuments({ relatedApplicationId: applicationId }),
    repository.listApplicationRequiredDocuments(applicationId),
    application.project_id ? repository.listProofItems(application.project_id) : Promise.resolve([]),
  ]);

  // Grant documents (linked to the grant)
  const grantDocs = grant ? await repository.listDocuments({ relatedGrantId: grant.id }) : [];

  // Deduplicate + merge documents (compact stubs only — no extracted_text)
  const seenDocIds = new Set<string>();
  const allLinkedDocs = [...appDocs, ...grantDocs].filter((d) => {
    if (seenDocIds.has(d.id)) return false;
    seenDocIds.add(d.id);
    return true;
  });

  // Urgency from grant deadline
  const rawDeadline = grant?.deadline ?? grant?.next_deadline ?? null;
  const deadline = computeUrgency(rawDeadline);

  // Open tasks (capped)
  const allOpenTasks = tasks.filter((t) => t.status !== "Complete" && t.status !== "Archived");
  const openTasksCapped = allOpenTasks.slice(0, MAX_OPEN_TASKS);
  const tasksTruncated = allOpenTasks.length > MAX_OPEN_TASKS;

  // Linked document stubs (compact — no extracted_text, no source_metadata)
  const linkedDocStubs = allLinkedDocs.slice(0, MAX_LINKED_DOCS).map((d) => ({
    id: d.id,
    title: d.title,
    document_type: d.document_type ?? null,
    source_url: d.source_url ?? d.file_url ?? null,
    created_at: d.created_at,
  }));
  const docsTruncated = allLinkedDocs.length > MAX_LINKED_DOCS;

  // Required documents
  const requiredDocStubs = requiredDocs.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status ?? null,
  }));

  // Missing documents = required but not matched in linked docs
  const linkedTitlesLower = allLinkedDocs.map((d) => d.title.toLowerCase());
  const missingDocuments = requiredDocs
    .filter((r) => {
      const rl = r.title.toLowerCase();
      return !linkedTitlesLower.some((t) => t.includes(rl) || rl.includes(t));
    })
    .map((r) => r.title);

  // Missing facts
  const missingFacts: string[] = [];
  if (!project?.summary) missingFacts.push("Project summary");
  if (!project?.problem_statement) missingFacts.push("Problem statement");
  if (!grant?.eligibility) missingFacts.push("Grant eligibility notes");
  if (!grant?.application_url) missingFacts.push("Application URL");
  if (!rawDeadline) missingFacts.push("Deadline");

  // Blockers
  const blockers: string[] = [];
  if (missingDocuments.length > 0) blockers.push(`${missingDocuments.length} required document(s) missing.`);
  if (proofItems.length === 0 && application.project_id) blockers.push("No proof items linked to project.");
  if (tasks.length === 0) blockers.push("No tasks created for this application yet.");

  // Next actions
  const nextActions: string[] = [];
  if (missingDocuments.length > 0) nextActions.push(`Collect: ${missingDocuments.slice(0, 3).join(", ")}`);
  if (missingFacts.length > 0) nextActions.push(`Fill in: ${missingFacts.slice(0, 3).join(", ")}`);
  if (openTasksCapped.length > 0) nextActions.push(`Complete ${allOpenTasks.length} open task(s).`);
  if (nextActions.length === 0) nextActions.push("Review application with a human and prepare for submission.");

  // Proof summary (type counts only — no content)
  const proofTypes = [...new Set(proofItems.map((p) => p.type).filter(Boolean))] as string[];
  const strongest = proofItems.slice(0, MAX_PROOF_STRONGEST).map((p) => ({
    id: p.id,
    title: p.title,
    proof_type: p.type ?? null,
  }));

  // Suggested tasks (only if requested)
  const suggestedTasks: Array<{ title: string; priority: string; source: string }> = [];
  if (opts.includeSuggestedTasks) {
    for (const doc of missingDocuments.slice(0, 3)) {
      suggestedTasks.push({ title: `Collect ${doc}`, priority: "High", source: "required_document" });
    }
    for (const fact of missingFacts.slice(0, 3)) {
      suggestedTasks.push({ title: `Fill in ${fact}`, priority: "Medium", source: "missing_fact" });
    }
  }

  const openTaskStubs = openTasksCapped.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status ?? null,
    due_date: t.due_date ?? null,
    owner_name: t.owner_name ?? null,
  }));

  return {
    application: {
      id: application.id,
      title: application.title ?? application.id,
      status: application.status ?? null,
      project_id: application.project_id ?? null,
      grant_id: application.grant_id ?? null,
    },
    grant: grant
      ? {
          id: grant.id,
          title: grant.title,
          status: grant.status ?? null,
          deadline: rawDeadline,
          funder_id: grant.funder_id ?? null,
          funder_name: grant.funder_name ?? null,
          url: grant.application_url ?? grant.source_url ?? null,
        }
      : null,
    project: project
      ? { id: project.id, name: project.name, slug: project.slug ?? null }
      : null,
    deadline,
    openTasks: openTaskStubs,
    linkedDocuments: linkedDocStubs,
    requiredDocuments: requiredDocStubs,
    proofItemsSummary: {
      count: proofItems.length,
      types: proofTypes,
      strongest,
    },
    missingDocuments,
    missingFacts,
    blockers,
    nextActions,
    ...(opts.includeSuggestedTasks ? { suggestedTasks } : {}),
    sourceRecordIds: {
      applicationId: application.id,
      grantId: application.grant_id ?? null,
      projectId: application.project_id ?? null,
      taskIds: tasks.map((t) => t.id),
      documentIds: allLinkedDocs.map((d) => d.id),
      proofItemIds: proofItems.map((p) => p.id),
    },
    truncated: tasksTruncated || docsTruncated,
  };
}
