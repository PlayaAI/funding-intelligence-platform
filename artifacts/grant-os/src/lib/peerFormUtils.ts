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
    relevance_to_playa: values.relevance || null,
    similarity_score: values.similarity_score === "" || values.similarity_score == null ? null : Number(values.similarity_score),
    known_funders: parseFocusAreasString(values.known_funders ?? ""),
    source_url: values.source_url || null,
    confidence: values.confidence || null,
    import_source: values.import_source || "manual",
    last_researched_at: values.last_researched_at || null,
    source_metadata: {},
    notes: values.notes || null,
    key_people: keyPeopleToJson(values.contact_name, values.contact_title, values.contact_email),
  };
}
