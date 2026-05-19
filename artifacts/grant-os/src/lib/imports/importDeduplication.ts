import type { FunderRow, GrantRow } from "@/types/database";
import type { DuplicateInfo, ImportCandidate } from "./importTypes";

export function normalizeComparable(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceUrlKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\/+$/u, "");
}

export function findGrantDuplicate(
  candidate: Extract<ImportCandidate, { entity: "grant" }>,
  existingGrants: GrantRow[]
): DuplicateInfo | null {
  const sourceUrl = sourceUrlKey(candidate.input.source_url);
  if (sourceUrl) {
    const existing = existingGrants.find((grant) => sourceUrlKey(grant.source_url) === sourceUrl);
    if (existing) return { id: existing.id, reason: "Source URL match", existing };
  }

  const title = normalizeComparable(candidate.input.title);
  const funder = normalizeComparable(candidate.input.funder_name);

  if (title && funder) {
    const existing = existingGrants.find(
      (grant) =>
        normalizeComparable(grant.title) === title &&
        normalizeComparable(grant.funder_name) === funder
    );
    if (existing) return { id: existing.id, reason: "Title and funder match", existing };
  }

  if (title) {
    const existing = existingGrants.find((grant) => normalizeComparable(grant.title) === title);
    if (existing) return { id: existing.id, reason: "Title match", existing };
  }

  return null;
}

export function findFunderDuplicate(
  candidate: Extract<ImportCandidate, { entity: "funder" }>,
  existingFunders: FunderRow[]
): DuplicateInfo | null {
  const ein = normalizeComparable(candidate.input.ein);
  if (ein) {
    const existing = existingFunders.find((funder) => normalizeComparable(funder.ein) === ein);
    if (existing) return { id: existing.id, reason: "EIN match", existing };
  }

  const name = normalizeComparable(candidate.input.name);
  const location = normalizeComparable(candidate.input.location);

  if (name && location) {
    const existing = existingFunders.find(
      (funder) =>
        normalizeComparable(funder.name) === name &&
        normalizeComparable(funder.location) === location
    );
    if (existing) return { id: existing.id, reason: "Name and location match", existing };
  }

  if (name) {
    const existing = existingFunders.find((funder) => normalizeComparable(funder.name) === name);
    if (existing) return { id: existing.id, reason: "Name match", existing };
  }

  return null;
}
