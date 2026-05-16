import type { FunderInsert } from "@/types/database";
import type { FunderFormValues } from "@/components/dashboard/FunderFormDialog";
import { keyPeopleToJson } from "@/lib/funderMappers";

export function parsePastGranteesString(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseGivingAreasString(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function funderFormValuesToInsert(
  values: FunderFormValues
): Omit<FunderInsert, "id" | "created_at" | "updated_at"> {
  return {
    name: values.name,
    legacy_id: values.legacy_id || null,
    website: values.website || null,
    ein: values.ein || null,
    location: values.location || null,
    median_grant_amount: values.median_grant_amount ?? null,
    giving_areas: parseGivingAreasString(values.giving_areas ?? ""),
    open_applications: values.open_applications ?? false,
    relationship_status: values.relationship_status || "None",
    past_grantees: parsePastGranteesString(values.past_grantees ?? ""),
    notes: values.notes || null,
    key_people: keyPeopleToJson(values.contact_name, values.contact_title, values.contact_email),
    openness_to_new_grantees: values.open_applications
      ? "Open applications"
      : "By invitation only",
  };
}
