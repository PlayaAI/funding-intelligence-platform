/** Fixed UUIDs for seeded peer organizations (migration 004). */
export const SEED_PEER_UUIDS = {
  po1: "33333333-3333-4333-8333-333333330001",
  po2: "33333333-3333-4333-8333-333333330002",
  po3: "33333333-3333-4333-8333-333333330003",
  po4: "33333333-3333-4333-8333-333333330004",
  po5: "33333333-3333-4333-8333-333333330005",
} as const;

export type LegacyPeerId = keyof typeof SEED_PEER_UUIDS;

export function legacyPeerIdFromUuid(uuid: string): LegacyPeerId | undefined {
  const entry = Object.entries(SEED_PEER_UUIDS).find(([, id]) => id === uuid);
  return entry ? (entry[0] as LegacyPeerId) : undefined;
}

export function uuidFromLegacyPeerId(legacyId: string): string | undefined {
  return SEED_PEER_UUIDS[legacyId as LegacyPeerId];
}
