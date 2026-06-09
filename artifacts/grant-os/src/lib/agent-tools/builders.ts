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

export async function buildGrantPacket(repository: GrantOsRepository, grant: GrantRow, funder: FunderRow | null): Promise<GrantExportPacket> {
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

export async function buildApplicationPacket(repository: GrantOsRepository, application: ApplicationRow): Promise<ApplicationExportPacket> {
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
  return {
    ...packageBase("application", {
      application,
      grant,
      funder,
      project,
      questions,
      required_documents: requiredDocuments,
      tasks,
      documents: uniqueById([...appDocuments, ...grantDocuments, ...projectDocuments]),
      proof_items: proofItems,
      agent_notes: agentNotes,
      agent_reports: agentReports,
      grant_match: grantMatch,
    }),
    generated_at: new Date().toISOString(),
  };
}

export async function buildPeerPacket(repository: GrantOsRepository, peer: PeerOrganizationRow): Promise<PeerExportPacket> {
  const fundingRecords = await repository.listPeerFundingRecords(peer.id);
  const funders = await repository.listFunders();
  const linkedFunders = funders.filter((funder) => fundingRecords.some((record) => record.funder_id === funder.id));
  return {
    ...packageBase("peer", {
      peer_organization: peer,
      funding_records: fundingRecords,
      linked_funders: linkedFunders,
      source_metadata: (peer.source_metadata ?? {}) as Record<string, unknown>,
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
  const rolling: GrantRow[] = [];
  const unknown: GrantRow[] = [];
  for (const grant of grants) {
    const rawDeadline = grant.next_deadline ?? grant.deadline;
    if (!rawDeadline) {
      if (grant.application_url || grant.source_url) rolling.push(grant);
      else unknown.push(grant);
      continue;
    }
    const deadline = new Date(rawDeadline);
    if (Number.isNaN(deadline.getTime())) {
      unknown.push(grant);
      continue;
    }
    const days = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) windows.within_30_days.push(grant);
    if (days <= 14) windows.within_14_days.push(grant);
    if (days <= 7) windows.within_7_days.push(grant);
    if (days <= 3) windows.within_3_days.push(grant);
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
        application,
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

export async function buildDataQualityReport(repository: GrantOsRepository): Promise<DataQualityReport> {
  const [grants, applications, tasks, documents] = await Promise.all([
    repository.listGrants(),
    repository.listApplications(),
    repository.listTasks(),
    repository.listDocuments(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    grantsMissingDeadlines: grants.filter((grant) => !grant.deadline && !grant.next_deadline),
    grantsMissingUrls: grants.filter((grant) => !grant.application_url && !grant.source_url),
    applicationsWithoutProject: applications.filter((application) => !application.project_id),
    tasksWithoutOwner: tasks.filter((task) => !task.owner_name),
    documentsWithoutSource: documents.filter((document) => !document.source_url && !document.file_url),
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
