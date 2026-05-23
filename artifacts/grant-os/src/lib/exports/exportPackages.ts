import { supabase } from "@/lib/supabase";
import { listGrantDocuments } from "@/lib/documentsService";

type PackageType = "project" | "grant" | "application" | "funder" | "document";

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function selectMany<T>(table: string, column: string, value: string): Promise<T[]> {
  const result: SupabaseResult<T[]> = await db.from(table).select("*").eq(column, value);
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
    selectMany("grants", "related_project_id", projectId),
    selectMany("proof_items", "project_id", projectId),
    selectMany("applications", "project_id", projectId),
    selectMany("tasks", "related_project_id", projectId),
    selectMany("documents", "related_project_id", projectId),
    selectMany("agent_notes", "related_project_id", projectId),
    selectMany("agent_reports", "related_project_id", projectId),
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
    selectMany("applications", "grant_id", grantId),
    selectMany("tasks", "related_grant_id", grantId),
    selectMany("agent_notes", "related_grant_id", grantId),
    selectMany("agent_reports", "related_grant_id", grantId),
    selectMany("grant_matches", "grant_id", grantId),
  ]);
  const projectIds = Array.from(new Set([
    grant?.related_project_id,
    ...applications.map((app: any) => app.project_id),
    ...grantMatches.map((match: any) => match.project_id),
  ].filter(Boolean)));
  const [projects, proofItems, documents] = await Promise.all([
    selectIn("projects", "id", projectIds),
    projectIds.length ? selectIn("proof_items", "project_id", projectIds) : Promise.resolve([]),
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
  const [grant, project, questions, requiredDocs, tasks, documents, agentNotes, agentReports] = await Promise.all([
    application?.grant_id ? selectOne("grants", "id", application.grant_id) : Promise.resolve(null),
    application?.project_id ? selectOne("projects", "id", application.project_id) : Promise.resolve(null),
    selectMany("application_questions", "application_id", applicationId),
    selectMany("application_required_documents", "application_id", applicationId),
    selectMany("tasks", "related_application_id", applicationId),
    selectMany("documents", "related_application_id", applicationId),
    selectMany("agent_notes", "related_application_id", applicationId),
    selectMany("agent_reports", "related_application_id", applicationId),
  ]);
  const payload = packageBase("application", { application, grant, project, questions, required_documents: requiredDocs, tasks, documents, agent_notes: agentNotes, agent_reports: agentReports });
  downloadJson(`grant-os-application-${cleanName(filenameHint)}.json`, payload);
  return payload;
}

export async function exportFunderPackage(funderId: string, filenameHint: string) {
  const funder = await selectOne("funders", "id", funderId);
  const [grants, peerFundingRecords, documents, agentNotes] = await Promise.all([
    selectMany("grants", "funder_id", funderId),
    selectMany("peer_funding_records", "funder_id", funderId),
    selectMany("documents", "related_funder_id", funderId),
    selectMany("agent_notes", "related_funder_id", funderId),
  ]);
  const payload = packageBase("funder", { funder, grants, peer_funding_records: peerFundingRecords, documents, agent_notes: agentNotes, agent_reports: [] });
  downloadJson(`grant-os-funder-${cleanName(filenameHint)}.json`, payload);
  return payload;
}
