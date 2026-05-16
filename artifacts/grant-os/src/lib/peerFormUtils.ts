import type { PeerOrganizationInsert } from "@/types/database";
import type { PeerOrganizationFormValues } from "@/components/dashboard/PeerOrganizationFormDialog";
import { keyPeopleToJson } from "@/lib/funderMappers";

export function parseFocusAreasString(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function peerFormValuesToInsert(
  values: PeerOrganizationFormValues
): Omit<PeerOrganizationInsert, "id" | "created_at" | "updated_at"> {
  return {
    name: values.name,
    legacy_id: values.legacy_id || null,
    website: values.website || null,
    ein: values.ein || null,
    location: values.location || null,
    description: values.description || null,
    focus_areas: parseFocusAreasString(values.focus_areas ?? ""),
    relevance: values.relevance || null,
    notes: values.notes || null,
    key_people: keyPeopleToJson(values.contact_name, values.contact_title, values.contact_email),
  };
}
