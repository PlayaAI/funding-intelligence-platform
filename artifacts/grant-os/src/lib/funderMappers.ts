import type { Funder } from "@/data/funders";
import type { PeerOrg } from "@/data/peers";
import type { FunderRow, Json } from "@/types/database";
import type { Grant } from "@/data/grants";

export type KeyPerson = {
  name?: string;
  title?: string;
  email?: string;
  role?: string;
};

export function parseKeyPeople(json: Json | null): KeyPerson[] {
  if (!json || !Array.isArray(json)) return [];
  return json as KeyPerson[];
}

export function keyPeopleToJson(
  name?: string,
  title?: string,
  email?: string
): Json | null {
  if (!name && !title && !email) return null;
  return [{ name: name || undefined, title: title || undefined, email: email || undefined, role: "primary" }];
}

export type FunderMapperContext = {
  relatedGrants?: Grant[];
  peerConnectionCount?: number;
};

export function mapFunderRow(row: FunderRow, ctx: FunderMapperContext = {}): Funder {
  const people = parseKeyPeople(row.key_people);
  const primary = people.find((p) => p.role === "primary") ?? people[0];
  const related = ctx.relatedGrants ?? [];

  const totalAssets =
    row.assets != null
      ? row.assets >= 1_000_000_000
        ? `$${(row.assets / 1_000_000_000).toFixed(1)}B`
        : row.assets >= 1_000_000
          ? `$${(row.assets / 1_000_000).toFixed(0)}M`
          : `$${(row.assets / 1000).toFixed(0)}K`
      : undefined;

  const annualGiving =
    row.annual_giving != null
      ? row.annual_giving >= 1_000_000
        ? `$${(row.annual_giving / 1_000_000).toFixed(0)}M+`
        : `$${(row.annual_giving / 1000).toFixed(0)}K`
      : undefined;

  return {
    id: row.id,
    legacyId: row.legacy_id ?? undefined,
    name: row.name,
    ein: row.ein ?? undefined,
    website: row.website ?? undefined,
    location: row.location ?? "",
    totalAssets,
    annualGiving,
    medianGrantAmount: row.median_grant_amount ?? 0,
    givingCategories: row.giving_areas ?? [],
    openApplications: row.open_applications,
    relationshipStatus: (row.relationship_status as Funder["relationshipStatus"]) ?? "None",
    pastGrantees: row.past_grantees?.length ? row.past_grantees : undefined,
    notes: row.notes ?? undefined,
    relatedGrantIds: related.map((g) => g.id),
    peerConnections: ctx.peerConnectionCount ?? 0,
    contactName: primary?.name,
    contactTitle: primary?.title,
    contactEmail: primary?.email,
  };
}

export function grantsForFunder(funder: FunderRow, grants: Grant[]): Grant[] {
  const legacy = funder.legacy_id;
  const nameLower = funder.name.toLowerCase();
  return grants.filter((g) => {
    if (g.funderId === funder.id || (legacy && g.funderId === legacy)) return true;
    return g.funderName.toLowerCase() === nameLower;
  });
}

export function funderDetailPath(f: Pick<Funder, "id" | "legacyId">): string {
  return `/dashboard/funders/${f.legacyId ?? f.id}`;
}

export function resolveFunderForGrant(
  grant: { funderId: string; funderName: string },
  funders: Funder[]
): Funder | null {
  const fid = grant.funderId;
  const nameLower = grant.funderName.toLowerCase();
  return (
    funders.find(
      (f) =>
        f.id === fid ||
        f.legacyId === fid ||
        f.name.toLowerCase() === nameLower
    ) ?? null
  );
}

export function peerDetailPath(p: Pick<PeerOrg, "id" | "legacyId">): string {
  return `/dashboard/peers/${p.legacyId ?? p.id}`;
}

export function peerConnectionCountForFunder(
  funderId: string,
  records: { funder_id: string | null; peer_organization_id: string }[]
): number {
  return new Set(
    records.filter((r) => r.funder_id === funderId).map((r) => r.peer_organization_id)
  ).size;
}
