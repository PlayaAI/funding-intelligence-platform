import type { FundingRecord, PeerOrg, SavedOpportunity } from "@/data/peers";
import type { Json, PeerFundingRecordRow, PeerOrganizationRow } from "@/types/database";
import { parseKeyPeople } from "@/lib/funderMappers";

export function parseSavedOpportunities(json: Json | null): SavedOpportunity[] {
  if (!json || !Array.isArray(json)) return [];
  return json as unknown as SavedOpportunity[];
}

export function mapFundingRecordRow(row: PeerFundingRecordRow): FundingRecord {
  return {
    id: row.id,
    funderName: row.funder_name ?? "Unknown funder",
    year: row.year ?? 0,
    amount: Number(row.amount ?? 0),
    notes: row.notes ?? undefined,
  };
}

export function mapPeerRow(
  row: PeerOrganizationRow,
  fundingRecords: PeerFundingRecordRow[] = []
): PeerOrg {
  const people = parseKeyPeople(row.key_people);
  const primary = people.find((p) => p.role === "primary") ?? people[0];

  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    name: row.name,
    ein: row.ein ?? undefined,
    website: row.website ?? undefined,
    description: row.description ?? "",
    location: row.location ?? "",
    focusAreas: row.focus_areas ?? [],
    fundingRecords: fundingRecords.map(mapFundingRecordRow),
    notes: row.notes ?? undefined,
    relevance: row.relevance ?? "",
    contactName: primary?.name,
    contactTitle: primary?.title,
    contactEmail: primary?.email,
    savedOpportunities: parseSavedOpportunities(row.saved_opportunities),
  };
}
