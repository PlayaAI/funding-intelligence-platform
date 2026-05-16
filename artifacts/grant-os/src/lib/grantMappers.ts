import type { Grant, GrantStatus } from "@/data/grants";
import { PROJECT_COLORS } from "@/data/grants";
import type { GrantRow } from "@/types/database";
import type { ProjectRow } from "@/types/database";

export function computeUrgencyScore(deadline: string | null): number {
  if (!deadline) return 0;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 0;
  if (days <= 14) return 95;
  if (days <= 30) return 80;
  if (days <= 60) return 65;
  if (days <= 90) return 45;
  return 25;
}

export function mapGrantRow(row: GrantRow, projectsById?: Map<string, ProjectRow>): Grant {
  const project =
    row.related_project_id && projectsById
      ? projectsById.get(row.related_project_id)
      : undefined;
  const slug = row.related_project_slug ?? project?.slug;
  const amountMin = row.amount_min ?? 0;
  const amountMax = row.amount_max ?? 0;

  return {
    id: row.id,
    title: row.title,
    funderId: row.funder_id ?? "",
    funderName: row.funder_name ?? "",
    deadline: row.deadline ?? "",
    amountMin,
    amountMax,
    focusAreas: row.focus_areas ?? [],
    geography: row.geography ?? "",
    eligibility: row.eligibility ?? "",
    applicationUrl: row.application_url ?? undefined,
    status: row.status as GrantStatus,
    assignedOwner: "",
    relatedProjectSlug: slug ?? undefined,
    relatedProjectName: project?.name,
    projectColor: slug ? PROJECT_COLORS[slug] : undefined,
    fitScore: row.fit_score ?? 0,
    priorityScore: row.priority_score ?? 0,
    urgencyScore: computeUrgencyScore(row.deadline),
    difficultyScore: row.difficulty_score ?? 0,
    notes: row.notes ?? undefined,
    isTop3: row.is_top_three,
  };
}

export function mapGrantRows(rows: GrantRow[], projects: ProjectRow[]): Grant[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  return rows.map((r) => mapGrantRow(r, byId));
}
