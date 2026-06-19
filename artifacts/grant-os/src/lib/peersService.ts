import { supabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type GrantOsSupabaseClient = SupabaseClient<Database>;

import type {
  PeerFundingRecordInsert,
  PeerFundingRecordRow,
  PeerFundingRecordUpdate,
  PeerOrganizationInsert,
  PeerOrganizationRow,
  PeerOrganizationUpdate,
} from "@/types/database";

export type {
  PeerOrganizationRow,
  PeerOrganizationInsert,
  PeerOrganizationUpdate,
  PeerFundingRecordRow,
  PeerFundingRecordInsert,
  PeerFundingRecordUpdate,
};

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };



const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ListPeerOrganizationsOptions = {
  includeArchived?: boolean;
};

export async function listPeerOrganizations(opts?: ListPeerOrganizationsOptions, client?: GrantOsSupabaseClient): Promise<PeerOrganizationRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  let query = db
    .from("peer_organizations")
    .select("*")
    .order("name", { ascending: true });
  if (!opts?.includeArchived) query = query.is("archived_at", null);
  const result: SupabaseResult<PeerOrganizationRow[]> = await query;

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getPeerByIdOrLegacy(id: string, client?: GrantOsSupabaseClient): Promise<PeerOrganizationRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  if (UUID_RE.test(id)) {
    const result: SupabaseResult<PeerOrganizationRow | null> = await db
      .from("peer_organizations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  const result: SupabaseResult<PeerOrganizationRow | null> = await db
    .from("peer_organizations")
    .select("*")
    .eq("legacy_id", id)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listAllPeerFundingRecords(client?: GrantOsSupabaseClient): Promise<PeerFundingRecordRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<PeerFundingRecordRow[]> = await db
    .from("peer_funding_records")
    .select("*")
    .is("archived_at", null)
    .order("award_year", { ascending: false, nullsFirst: false });

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function listPeerFundingRecords(
  peerOrganizationId: string
, client?: GrantOsSupabaseClient): Promise<PeerFundingRecordRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<PeerFundingRecordRow[]> = await db
    .from("peer_funding_records")
    .select("*")
    .eq("peer_organization_id", peerOrganizationId)
    .is("archived_at", null)
    .order("award_year", { ascending: false, nullsFirst: false });

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createPeerOrganization(
  input: Omit<PeerOrganizationInsert, "id" | "created_at" | "updated_at">
, client?: GrantOsSupabaseClient): Promise<PeerOrganizationRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<PeerOrganizationRow> = await db
    .from("peer_organizations")
    .insert(input)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updatePeerOrganization(
  id: string,
  updates: Omit<PeerOrganizationUpdate, "id" | "created_at">
, client?: GrantOsSupabaseClient): Promise<PeerOrganizationRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<PeerOrganizationRow> = await db
    .from("peer_organizations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archivePeerOrganization(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db
    .from("peer_organizations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}

export async function deletePeerOrganization(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db
    .from("peer_organizations")
    .delete()
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}

export async function createPeerFundingRecord(
  input: Omit<PeerFundingRecordInsert, "id" | "created_at" | "updated_at">
, client?: GrantOsSupabaseClient): Promise<PeerFundingRecordRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<PeerFundingRecordRow> = await db
    .from("peer_funding_records")
    .insert(input)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updatePeerFundingRecord(
  id: string,
  updates: Omit<PeerFundingRecordUpdate, "id" | "created_at">
, client?: GrantOsSupabaseClient): Promise<PeerFundingRecordRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<PeerFundingRecordRow> = await db
    .from("peer_funding_records")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archivePeerFundingRecord(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db
    .from("peer_funding_records")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}

export async function deletePeerFundingRecord(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db
    .from("peer_funding_records")
    .delete()
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}
