import type { GrantInsert } from "@/types/database";
import type { ProjectRow } from "@/types/database";
import type { GrantFormValues } from "@/components/dashboard/GrantFormDialog";
import { parseFocusAreasString } from "@/components/dashboard/GrantFormDialog";

export function grantFormValuesToInsert(
  values: GrantFormValues,
  projects: ProjectRow[]
): Omit<GrantInsert, "id" | "created_at" | "updated_at"> {
  const project = values.related_project_id
    ? projects.find((p) => p.id === values.related_project_id)
    : undefined;

  return {
    title: values.title,
    funder_name: values.funder_name,
    funder_id: values.funder_id || null,
    status: values.status,
    deadline: values.deadline || null,
    amount_min: values.amount_min ?? null,
    amount_max: values.amount_max ?? null,
    focus_areas: parseFocusAreasString(values.focus_areas ?? ""),
    geography: values.geography || null,
    eligibility: values.eligibility || null,
    application_url: values.application_url || null,
    notes: values.notes || null,
    related_project_id: values.related_project_id || null,
    related_project_slug: project?.slug ?? null,
    fit_score: values.fit_score ?? null,
    priority_score: values.priority_score ?? null,
    difficulty_score: values.difficulty_score ?? null,
    is_top_three: values.is_top_three ?? false,
  };
}
