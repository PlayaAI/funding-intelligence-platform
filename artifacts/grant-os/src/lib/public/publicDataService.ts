import { supabase } from "@/lib/supabase";
import type { ProjectRow, ProofItemRow } from "@/types/database";
import type { Project } from "@/data/projects";
import type { ProofItem } from "@/data/proofItems";

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type PublicProject = Pick<
  ProjectRow,
  | "id"
  | "name"
  | "slug"
  | "summary"
  | "problem_statement"
  | "solution"
  | "target_audience"
  | "category"
  | "stage"
  | "impact"
  | "grant_relevance"
  | "featured"
  | "public_visibility"
  | "created_at"
>;

export type PublicProofItem = Pick<
  ProofItemRow,
  | "id"
  | "project_id"
  | "title"
  | "type"
  | "description"
  | "date"
  | "tags"
  | "public_visibility"
  | "created_at"
>;

export type PublicProofItemWithProject = PublicProofItem & {
  project?: Pick<ProjectRow, "id" | "name" | "slug"> | null;
};

function statusVariant(stage: string | null): Project["statusVariant"] {
  const value = (stage ?? "").toLowerCase();
  if (value.includes("live")) return "live";
  if (value.includes("publish")) return "published";
  if (value.includes("prototype") || value.includes("demo")) return "prototype";
  return "active";
}

export function publicProjectToCard(project: PublicProject, proofCount = 0): Project {
  const stage = (project.stage || "Active") as Project["status"];
  return {
    slug: project.slug,
    name: project.name,
    category: project.category ?? "Public project",
    status: stage,
    statusVariant: statusVariant(project.stage),
    summary: project.summary ?? project.impact ?? "Public project details are being documented.",
    problem: project.problem_statement ?? undefined,
    audience: project.target_audience ?? undefined,
    grantRelevance: project.grant_relevance ?? "",
    proofCount,
    featured: project.featured,
  };
}

export function publicProofToCard(item: PublicProofItemWithProject): ProofItem {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    projectSlug: item.project?.slug,
    projectName: item.project?.name,
    description: item.description ?? "Public proof item.",
    date: item.date ?? undefined,
    tags: item.tags ?? [],
    isPublic: item.public_visibility,
  };
}

export async function listPublicProjects(): Promise<PublicProject[]> {
  const result: SupabaseResult<PublicProject[]> = await db
    .from("projects")
    .select("id,name,slug,summary,problem_statement,solution,target_audience,category,stage,impact,grant_relevance,featured,public_visibility,created_at")
    .eq("public_visibility", true)
    .is("archived_at", null)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getPublicProjectBySlug(slug: string): Promise<PublicProject | null> {
  const result: SupabaseResult<PublicProject | null> = await db
    .from("projects")
    .select("id,name,slug,summary,problem_statement,solution,target_audience,category,stage,impact,grant_relevance,featured,public_visibility,created_at")
    .eq("slug", slug)
    .eq("public_visibility", true)
    .is("archived_at", null)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listPublicProofItems(projectId?: string): Promise<PublicProofItemWithProject[]> {
  let query = db
    .from("proof_items")
    .select("id,project_id,title,type,description,date,tags,public_visibility,created_at")
    .eq("public_visibility", true)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const result: SupabaseResult<PublicProofItem[]> = await query;
  if (result.error) throw new Error(result.error.message);

  const proof = result.data ?? [];
  const projectIds = Array.from(new Set(proof.map((item) => item.project_id).filter(Boolean))) as string[];
  if (!projectIds.length) return proof.map((item) => ({ ...item, project: null }));

  const projectsResult: SupabaseResult<Array<Pick<ProjectRow, "id" | "name" | "slug">>> = await db
    .from("projects")
    .select("id,name,slug")
    .in("id", projectIds)
    .eq("public_visibility", true)
    .is("archived_at", null);
  if (projectsResult.error) throw new Error(projectsResult.error.message);
  const projectsById = new Map((projectsResult.data ?? []).map((project) => [project.id, project]));
  return proof
    .filter((item) => !item.project_id || projectsById.has(item.project_id))
    .map((item) => ({ ...item, project: item.project_id ? projectsById.get(item.project_id) ?? null : null }));
}
