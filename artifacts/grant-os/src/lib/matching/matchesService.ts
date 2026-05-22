import { supabase } from "@/lib/supabase";
import { calculateGrantMatch } from "@/lib/matching/matchingEngine";
import type {
  ApplicationRow,
  DocumentRow,
  FunderRow,
  GrantMatchRow,
  GrantMatchStatusDb,
  GrantRow,
  ProjectRow,
  ProofItemRow,
  TaskRow,
} from "@/types/database";

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type GrantMatchWithRelations = GrantMatchRow & {
  project?: ProjectRow | null;
  grant?: GrantRow | null;
  funder?: FunderRow | null;
};

export type MatchFilters = {
  projectId?: string;
  grantId?: string;
  status?: GrantMatchStatusDb | "all";
  tier?: string;
  search?: string;
  minScore?: number;
  maxScore?: number;
};

const arrayFromJson = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function matchJsonArray(value: unknown): string[] {
  return arrayFromJson(value);
}

function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

async function selectAll<T>(table: string): Promise<T[]> {
  const result: SupabaseResult<T[]> = await db.from(table).select("*");
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function fetchMatchingInputs(projectId?: string, grantId?: string) {
  let projectsQuery = db.from("projects").select("*").is("archived_at", null);
  if (projectId) projectsQuery = projectsQuery.eq("id", projectId);
  const projectsResult: SupabaseResult<ProjectRow[]> = await projectsQuery;
  if (projectsResult.error) throw new Error(projectsResult.error.message);

  let grantsQuery = db.from("grants").select("*").is("archived_at", null).neq("status", "Archived");
  if (grantId) grantsQuery = grantsQuery.eq("id", grantId);
  const grantsResult: SupabaseResult<GrantRow[]> = await grantsQuery;
  if (grantsResult.error) throw new Error(grantsResult.error.message);

  const [funders, proofItems, documents, applications, tasks] = await Promise.all([
    selectAll<FunderRow>("funders"),
    selectAll<ProofItemRow>("proof_items"),
    selectAll<DocumentRow>("documents"),
    selectAll<ApplicationRow>("applications"),
    selectAll<TaskRow>("tasks"),
  ]);

  return {
    projects: projectsResult.data ?? [],
    grants: grantsResult.data ?? [],
    funders,
    proofItems,
    documents,
    applications,
    tasks,
  };
}

function findFunder(grant: GrantRow, funders: FunderRow[]): FunderRow | null {
  return funders.find((funder) =>
    (isUuid(grant.funder_id) && funder.id === grant.funder_id) ||
    funder.legacy_id === grant.funder_id ||
    (grant.funder_name && funder.name.toLowerCase() === grant.funder_name.toLowerCase())
  ) ?? null;
}

function preserveStatus(existing?: GrantMatchRow | null) {
  if (!existing) return {};
  return {
    status: existing.status,
    hidden_at: existing.hidden_at,
    saved_at: existing.saved_at,
    dismissed_reason: existing.dismissed_reason,
    reviewed_by: existing.reviewed_by,
    reviewed_at: existing.reviewed_at,
  };
}

async function getExistingMatches(projectIds: string[], grantIds: string[]): Promise<GrantMatchRow[]> {
  if (!projectIds.length || !grantIds.length) return [];
  const result: SupabaseResult<GrantMatchRow[]> = await db
    .from("grant_matches")
    .select("*")
    .in("project_id", projectIds)
    .in("grant_id", grantIds);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function generateMatches(projectId?: string, grantId?: string): Promise<GrantMatchRow[]> {
  const inputs = await fetchMatchingInputs(projectId, grantId);
  const existing = await getExistingMatches(
    inputs.projects.map((project) => project.id),
    inputs.grants.map((grant) => grant.id)
  );
  const existingByPair = new Map(existing.map((match) => [`${match.project_id}:${match.grant_id}`, match]));

  const rows = inputs.projects.flatMap((project) =>
    inputs.grants.map((grant) => {
      const funder = findFunder(grant, inputs.funders);
      const result = calculateGrantMatch({
        project,
        grant,
        funder,
        proofItems: inputs.proofItems.filter((item) => item.project_id === project.id && !item.archived_at),
        documents: inputs.documents.filter((doc) =>
          !doc.archived_at && (
            doc.related_project_id === project.id ||
            doc.related_grant_id === grant.id ||
            (funder?.id && doc.related_funder_id === funder.id)
          )
        ),
        applications: inputs.applications.filter((app) =>
          !app.archived_at && (app.project_id === project.id || app.grant_id === grant.id)
        ),
        tasks: inputs.tasks.filter((task) =>
          !task.archived_at && (task.related_project_id === project.id || task.related_grant_id === grant.id)
        ),
      });
      return {
        project_id: project.id,
        grant_id: grant.id,
        funder_id: funder?.id ?? null,
        match_score: result.matchScore,
        match_tier: result.matchTier,
        readiness_score: result.readinessScore,
        urgency_score: result.urgencyScore,
        evidence_score: result.evidenceScore,
        fit_reasons: result.fitReasons,
        risks: result.risks,
        missing_items: result.missingItems,
        recommended_actions: result.recommendedActions,
        generated_by: "rules_engine",
        generated_at: new Date().toISOString(),
        ...preserveStatus(existingByPair.get(`${project.id}:${grant.id}`)),
      };
    })
  );

  if (!rows.length) return [];
  const result: SupabaseResult<GrantMatchRow[]> = await db
    .from("grant_matches")
    .upsert(rows, { onConflict: "project_id,grant_id" })
    .select("*");
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function generateMatchesForProject(projectId: string): Promise<GrantMatchRow[]> {
  return generateMatches(projectId);
}

export async function generateMatchesForGrant(grantId: string): Promise<GrantMatchRow[]> {
  return generateMatches(undefined, grantId);
}

export async function generateMatchesForAllProjects(): Promise<GrantMatchRow[]> {
  return generateMatches();
}

export async function refreshMatch(matchId: string): Promise<GrantMatchRow> {
  const current = await getMatch(matchId);
  if (!current) throw new Error("Match not found");
  const rows = await generateMatches(current.project_id, current.grant_id);
  const refreshed = rows.find((row) => row.id === matchId || (row.project_id === current.project_id && row.grant_id === current.grant_id));
  if (!refreshed) throw new Error("Match refresh did not return a row");
  return refreshed;
}

export async function getMatch(matchId: string): Promise<GrantMatchRow | null> {
  const result: SupabaseResult<GrantMatchRow | null> = await db.from("grant_matches").select("*").eq("id", matchId).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listMatches(filters?: MatchFilters): Promise<GrantMatchWithRelations[]> {
  let query = db.from("grant_matches").select("*").order("match_score", { ascending: false });
  if (filters?.projectId) query = query.eq("project_id", filters.projectId);
  if (filters?.grantId) query = query.eq("grant_id", filters.grantId);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters?.tier && filters.tier !== "all") query = query.eq("match_tier", filters.tier);
  if (typeof filters?.minScore === "number") query = query.gte("match_score", filters.minScore);
  if (typeof filters?.maxScore === "number") query = query.lte("match_score", filters.maxScore);
  const result: SupabaseResult<GrantMatchRow[]> = await query;
  if (result.error) throw new Error(result.error.message);

  const rows = result.data ?? [];
  if (!rows.length) return [];

  const [projects, grants, funders] = await Promise.all([
    selectAll<ProjectRow>("projects"),
    selectAll<GrantRow>("grants"),
    selectAll<FunderRow>("funders"),
  ]);
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const grantsById = new Map(grants.map((grant) => [grant.id, grant]));
  const fundersById = new Map(funders.map((funder) => [funder.id, funder]));

  const search = filters?.search?.trim().toLowerCase();
  return rows
    .map((match) => ({
      ...match,
      project: projectsById.get(match.project_id) ?? null,
      grant: grantsById.get(match.grant_id) ?? null,
      funder: match.funder_id ? fundersById.get(match.funder_id) ?? null : null,
    }))
    .filter((match) => {
      if (!search) return true;
      return [
        match.project?.name,
        match.grant?.title,
        match.grant?.funder_name,
        match.funder?.name,
        ...matchJsonArray(match.fit_reasons),
      ].some((value) => (value ?? "").toLowerCase().includes(search));
    });
}

export async function listMatchesForProject(projectId: string) {
  return listMatches({ projectId });
}

export async function listMatchesForGrant(grantId: string) {
  return listMatches({ grantId });
}

async function updateMatchStatus(matchId: string, updates: Partial<GrantMatchRow>): Promise<GrantMatchRow> {
  const result: SupabaseResult<GrantMatchRow> = await db
    .from("grant_matches")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", matchId)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from match update");
  return result.data;
}

export function saveMatch(matchId: string) {
  return updateMatchStatus(matchId, { status: "saved", saved_at: new Date().toISOString(), hidden_at: null, dismissed_reason: null });
}

export function hideMatch(matchId: string, reason?: string) {
  return updateMatchStatus(matchId, { status: "hidden", hidden_at: new Date().toISOString(), dismissed_reason: reason ?? null });
}

export function dismissMatch(matchId: string, reason?: string) {
  return updateMatchStatus(matchId, { status: "dismissed", hidden_at: new Date().toISOString(), dismissed_reason: reason ?? "Dismissed from matching dashboard" });
}

export function markReviewed(matchId: string, userId?: string | null) {
  return updateMatchStatus(matchId, { reviewed_at: new Date().toISOString(), reviewed_by: userId ?? null });
}
