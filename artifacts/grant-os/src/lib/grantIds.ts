/** Fixed UUIDs for seeded grants (migration 003). Maps legacy mock ids → Supabase id. */
export const SEED_GRANT_UUIDS = {
  g1: "11111111-1111-4111-8111-111111110001",
  g2: "11111111-1111-4111-8111-111111110002",
  g3: "11111111-1111-4111-8111-111111110003",
  g4: "11111111-1111-4111-8111-111111110004",
  g5: "11111111-1111-4111-8111-111111110005",
  g6: "11111111-1111-4111-8111-111111110006",
  g7: "11111111-1111-4111-8111-111111110007",
  g8: "11111111-1111-4111-8111-111111110008",
  g9: "11111111-1111-4111-8111-111111110009",
} as const;

export type LegacyGrantId = keyof typeof SEED_GRANT_UUIDS;

export function legacyGrantIdFromUuid(uuid: string): LegacyGrantId | undefined {
  const entry = Object.entries(SEED_GRANT_UUIDS).find(([, id]) => id === uuid);
  return entry ? (entry[0] as LegacyGrantId) : undefined;
}

export function uuidFromLegacyGrantId(legacyId: string): string | undefined {
  return SEED_GRANT_UUIDS[legacyId as LegacyGrantId];
}
