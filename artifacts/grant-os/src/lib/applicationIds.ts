/** Fixed UUIDs for seeded applications (migration 005). Maps legacy mock ids → Supabase id. */
export const SEED_APPLICATION_UUIDS = {
  a1: "55555555-5555-4555-8555-555555550001",
  a2: "55555555-5555-4555-8555-555555550002",
  a3: "55555555-5555-4555-8555-555555550003",
} as const;

export type LegacyApplicationId = keyof typeof SEED_APPLICATION_UUIDS;

export function legacyApplicationIdFromUuid(uuid: string): LegacyApplicationId | undefined {
  const entry = Object.entries(SEED_APPLICATION_UUIDS).find(([, id]) => id === uuid);
  return entry ? (entry[0] as LegacyApplicationId) : undefined;
}

export function uuidFromLegacyApplicationId(legacyId: string): string | undefined {
  return SEED_APPLICATION_UUIDS[legacyId as LegacyApplicationId];
}
