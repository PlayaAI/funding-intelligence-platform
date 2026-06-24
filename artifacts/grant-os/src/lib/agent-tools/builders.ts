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
