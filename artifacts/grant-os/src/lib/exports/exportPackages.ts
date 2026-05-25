import { supabase } from "@/lib/supabase";
import { listGrantDocuments } from "@/lib/documentsService";

type PackageType = "project" | "grant" | "application" | "funder" | "document" | "peer";

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function selectMany<T>(table: string, column: string, value: string): Promise<T[]> {
  const result: SupabaseResult<T[]> = await db.from(table).select("*").eq(column, value);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function selectManyActive<T>(table: string, column: string, value: string): Promise<T[]> {
  const result: SupabaseResult<T[]> = await db
    .from(table)
    .select("*")
    .eq(column, value)
    .is("archived_at", null);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function selectOne<T>(table: string, column: string, value: string): Promise<T | null> {
  const result: SupabaseResult<T | null> = await db.from(table).select("*").eq(column, value).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function selectIn<T>(table: string, column: string, values: string[]): Promise<T[]> {
  if (!values.length) return [];
  const result: SupabaseResult<T[]> = await db.from(table).select("*").in(column, values);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function selectInActive<T>(table: string, column: string, values: string[]): Promise<T[]> {
  if (!values.length) return [];
  const result: SupabaseResult<T[]> = await db
    .from(table)
    .select("*")
    .in(column, values)
    .is("archived_at", null);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

function packageBase(packageType: PackageType, records: Record<string, unknown>) {
  return { exported_at: new Date().toISOString(), package_type: packageType, app: "Grant OS", records };
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cleanName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "grant-os";
}

export async function exportProjectPackage(projectId: string, filenameHint: string) {
  const project = await selectOne("projects", "id", projectId);
  const [grants, proofItems, applications, tasks, documents, agentNotes, agentReports, grantMatches] = await Promise.all([
    selectManyActive("grants", "related_project_id", projectId),
    selectManyActive("proof_items", "project_id", projectId),
    selectManyActive("applications", "project_id", projectId),
    selectManyActive("tasks", "related_project_id", projectId),
    selectManyActive("documents", "related_project_id", projectId),
    selectManyActive("agent_notes", "related_project_id", projectId),
    selectManyActive("agent_reports", "related_project_id", projectId),
    selectMany("grant_matches", "project_id", projectId),
  ]);
  const payload = packageBase("project", { project, grants, proof_items: proofItems, applications, tasks, documents, agent_notes: agentNotes, agent_reports: agentReports, grant_matches: grantMatches });
  downloadJson(`grant-os-project-${cleanName(filenameHint)}.json`, payload);
  return payload;
}

export async function exportGrantPackage(grantId: string, filenameHint: string) {
  const grant: any = await selectOne("grants", "id", grantId);
  const [funder, applications, tasks, agentNotes, agentReports, grantMatches] = await Promise.all([
    grant?.funder_id ? selectOne("funders", "id", grant.funder_id) : Promise.resolve(null),
    selectManyActive("applications", "grant_id", grantId),
    selectManyActive("tasks", "related_grant_id", grantId),
    selectManyActive("agent_notes", "related_grant_id", grantId),
    selectManyActive("agent_reports", "related_grant_id", grantId),
    selectMany("grant_matches", "grant_id", grantId),
  ]);
  const projectIds = Array.from(new Set([
    grant?.related_project_id,
    ...applications.map((app: any) => app.project_id),
    ...grantMatches.map((match: any) => match.project_id),
  ].filter(Boolean)));
  const [projects, proofItems, documents] = await Promise.all([
    selectInActive("projects", "id", projectIds),
    projectIds.length ? selectInActive("proof_items", "project_id", projectIds) : Promise.resolve([]),
    grant ? listGrantDocuments({
      grantId,
      funderId: (funder as any)?.id ?? grant.funder_id,
      title: grant.title,
      funderName: grant.funder_name,
      sourceUrl: grant.source_url,
      applicationUrl: grant.application_url,
    }) : Promise.resolve([]),
  ]);
  const payload = {
    ...packageBase("grant", {
      grant,
      funder,
      related_projects: projects,
      applications,
      tasks,
      proof_items: proofItems,
      documents,
      agent_notes: agentNotes,
      agent_reports: agentReports,
      grant_matches: grantMatches,
      generated_at: new Date().toISOString(),
    }),
    generated_at: new Date().toISOString(),
  };
  downloadJson(`grant-os-grant-${cleanName(filenameHint)}.json`, payload);
  return payload;
}

export async function exportApplicationPackage(applicationId: string, filenameHint: string) {
  const application: any = await selectOne("applications", "id", applicationId);
  const [grant, project, questions, requiredDocs, tasks, applicationDocuments, agentNotes, agentReports] = await Promise.all([
    application?.grant_id ? selectOne("grants", "id", application.grant_id) : Promise.resolve(null),
    application?.project_id ? selectOne("projects", "id", application.project_id) : Promise.resolve(null),
    selectMany("application_questions", "application_id", applicationId),
    selectMany("application_required_documents", "application_id", applicationId),
    selectManyActive("tasks", "related_application_id", applicationId),
    selectManyActive("documents", "related_application_id", applicationId),
    selectManyActive("agent_notes", "related_application_id", applicationId),
    selectManyActive("agent_reports", "related_application_id", applicationId),
  ]);
  const [funder, grantDocuments, projectDocuments, proofItems, grantMatch] = await Promise.all([
    (grant as any)?.funder_id ? selectOne("funders", "id", (grant as any).funder_id) : Promise.resolve(null),
    grant ? listGrantDocuments({
      grantId: (grant as any).id,
      funderId: (grant as any).funder_id,
      title: (grant as any).title,
      funderName: (grant as any).funder_name,
      sourceUrl: (grant as any).source_url,
      applicationUrl: (grant as any).application_url,
    }) : Promise.resolve([]),
    application?.project_id ? selectManyActive("documents", "related_project_id", application.project_id) : Promise.resolve([]),
    application?.project_id ? selectManyActive("proof_items", "project_id", application.project_id) : Promise.resolve([]),
    application?.project_id && application?.grant_id
      ? db.from("grant_matches").select("*").eq("project_id", application.project_id).eq("grant_id", application.grant_id).maybeSingle().then((result: SupabaseResult<any>) => {
          if (result.error) throw new Error(result.error.message);
          return result.data;
        })
      : Promise.resolve(null),
  ]);
  const docsById = new Map([...(applicationDocuments as any[]), ...(grantDocuments as any[]), ...(projectDocuments as any[])].map((doc) => [doc.id, doc]));
  const payload = {
    ...packageBase("application", {
      application,
      grant,
      funder,
      project,
      questions,
      required_documents: requiredDocs,
      tasks,
      documents: [...docsById.values()],
      proof_items: proofItems,
      agent_notes: agentNotes,
      agent_reports: agentReports,
      grant_match: grantMatch,
      generated_at: new Date().toISOString(),
    }),
    generated_at: new Date().toISOString(),
  };
  downloadJson(`grant-os-application-${cleanName(filenameHint)}.json`, payload);
  return payload;
}

export async function exportFunderPackage(funderId: string, filenameHint: string) {
  const funder = await selectOne("funders", "id", funderId);
  const [grants, peerFundingRecords, documents, agentNotes] = await Promise.all([
    selectManyActive("grants", "funder_id", funderId),
    selectManyActive("peer_funding_records", "funder_id", funderId),
    selectManyActive("documents", "related_funder_id", funderId),
    selectManyActive("agent_notes", "related_funder_id", funderId),
  ]);
  const payload = packageBase("funder", { funder, grants, peer_funding_records: peerFundingRecords, documents, agent_notes: agentNotes, agent_reports: [] });
  downloadJson(`grant-os-funder-${cleanName(filenameHint)}.json`, payload);
  return payload;
}

export async function exportPeerPackage(peerId: string, filenameHint: string) {
  const peer: any = await selectOne("peer_organizations", "id", peerId);
  const fundingRecords: any[] = await selectManyActive("peer_funding_records", "peer_organization_id", peerId);
  const funderIds = Array.from(new Set(fundingRecords.map((record) => record.funder_id).filter(Boolean)));
  const linkedFunders = await selectInActive("funders", "id", funderIds);
  const payload = {
    ...packageBase("peer", {
      peer_organization: peer,
      funding_records: fundingRecords,
      linked_funders: linkedFunders,
      source_metadata: peer?.source_metadata ?? {},
      generated_at: new Date().toISOString(),
    }),
    generated_at: new Date().toISOString(),
  };
  downloadJson(`grant-os-peer-${cleanName(filenameHint)}.json`, payload);
  return payload;
}
