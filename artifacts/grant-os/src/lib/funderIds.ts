/** Fixed UUIDs for seeded funders (migration 004). Maps legacy mock ids → Supabase id. */
export const SEED_FUNDER_UUIDS = {
  f1: "22222222-2222-4222-8222-222222220001",
  f2: "22222222-2222-4222-8222-222222220002",
  f3: "22222222-2222-4222-8222-222222220003",
  f4: "22222222-2222-4222-8222-222222220004",
  f5: "22222222-2222-4222-8222-222222220005",
  f6: "22222222-2222-4222-8222-222222220006",
  f7: "22222222-2222-4222-8222-222222220007",
  f8: "22222222-2222-4222-8222-222222220008",
  f9: "22222222-2222-4222-8222-222222220009",
} as const;

export type LegacyFunderId = keyof typeof SEED_FUNDER_UUIDS;

export function legacyFunderIdFromUuid(uuid: string): LegacyFunderId | undefined {
  const entry = Object.entries(SEED_FUNDER_UUIDS).find(([, id]) => id === uuid);
  return entry ? (entry[0] as LegacyFunderId) : undefined;
}

export function uuidFromLegacyFunderId(legacyId: string): string | undefined {
  return SEED_FUNDER_UUIDS[legacyId as LegacyFunderId];
}
