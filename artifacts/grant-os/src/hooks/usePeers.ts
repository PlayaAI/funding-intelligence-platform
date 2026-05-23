import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPeerOrganizations,
  getPeerByIdOrLegacy,
  listAllPeerFundingRecords,
  listPeerFundingRecords,
  createPeerOrganization,
  updatePeerOrganization,
  archivePeerOrganization,
  deletePeerOrganization,
  createPeerFundingRecord,
  updatePeerFundingRecord,
  archivePeerFundingRecord,
  deletePeerFundingRecord,
  type PeerOrganizationRow,
  type PeerOrganizationInsert,
  type PeerOrganizationUpdate,
  type PeerFundingRecordRow,
  type PeerFundingRecordInsert,
  type PeerFundingRecordUpdate,
  type ListPeerOrganizationsOptions,
} from "@/lib/peersService";
import { mapPeerRow } from "@/lib/peerMappers";
import type { PeerOrg } from "@/data/peers";
import { FUNDERS_QUERY_KEY, PEER_FUNDING_ALL_KEY } from "@/hooks/useFunders";

export type {
  PeerOrganizationRow,
  PeerOrganizationInsert,
  PeerOrganizationUpdate,
  PeerFundingRecordRow,
  PeerFundingRecordInsert,
  PeerFundingRecordUpdate,
  ListPeerOrganizationsOptions,
};

export const PEERS_QUERY_KEY = ["peer_organizations"] as const;

export function usePeerOrganizations(opts?: ListPeerOrganizationsOptions) {
  return useQuery({
    queryKey: opts?.includeArchived ? [...PEERS_QUERY_KEY, "includeArchived"] : PEERS_QUERY_KEY,
    queryFn: () => listPeerOrganizations(opts),
    staleTime: 1000 * 60,
  });
}

export function usePeer(id: string | undefined) {
  return useQuery({
    queryKey: [...PEERS_QUERY_KEY, id],
    queryFn: () => getPeerByIdOrLegacy(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });
}

export function usePeerFundingRecords(peerId: string | undefined) {
  return useQuery({
    queryKey: [...PEERS_QUERY_KEY, peerId, "funding_records"],
    queryFn: () => listPeerFundingRecords(peerId!),
    enabled: Boolean(peerId),
    staleTime: 1000 * 60,
  });
}

export function useMappedPeers(opts?: ListPeerOrganizationsOptions) {
  const peersQuery = usePeerOrganizations(opts);
  const recordsQuery = useQuery({
    queryKey: PEER_FUNDING_ALL_KEY,
    queryFn: listAllPeerFundingRecords,
    staleTime: 1000 * 60,
  });

  const peers: PeerOrg[] = useMemo(() => {
    if (!peersQuery.data) return [];
    const allRecords = recordsQuery.data ?? [];
    return peersQuery.data.map((row) => {
      const records = allRecords.filter((r) => r.peer_organization_id === row.id);
      return mapPeerRow(row, records);
    });
  }, [peersQuery.data, recordsQuery.data]);

  return {
    peers,
    peerRows: peersQuery.data ?? [],
    isLoading: peersQuery.isLoading || recordsQuery.isLoading,
    isError: peersQuery.isError || recordsQuery.isError,
    error: peersQuery.error ?? recordsQuery.error,
    refetch: peersQuery.refetch,
  };
}

export function useMappedPeer(id: string | undefined) {
  const peerQuery = usePeer(id);
  const recordsQuery = usePeerFundingRecords(peerQuery.data?.id);

  const peer = useMemo(() => {
    if (!peerQuery.data) return null;
    return mapPeerRow(peerQuery.data, recordsQuery.data ?? []);
  }, [peerQuery.data, recordsQuery.data]);

  return {
    peer,
    peerRow: peerQuery.data ?? null,
    isLoading: peerQuery.isLoading || recordsQuery.isLoading,
    isError: peerQuery.isError || recordsQuery.isError,
    error: peerQuery.error ?? recordsQuery.error,
  };
}

export function useCreatePeerOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<PeerOrganizationInsert, "id" | "created_at" | "updated_at">) =>
      createPeerOrganization(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PEERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PEER_FUNDING_ALL_KEY });
    },
  });
}

export function useUpdatePeerOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Omit<PeerOrganizationUpdate, "id" | "created_at">;
    }) => updatePeerOrganization(id, updates),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: PEERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...PEERS_QUERY_KEY, id] });
      qc.invalidateQueries({ queryKey: PEER_FUNDING_ALL_KEY });
    },
  });
}

export function useArchivePeerOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archivePeerOrganization(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PEERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PEER_FUNDING_ALL_KEY });
    },
  });
}

export function useDeletePeerOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePeerOrganization(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PEERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PEER_FUNDING_ALL_KEY });
    },
  });
}

export function useCreatePeerFundingRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<PeerFundingRecordInsert, "id" | "created_at" | "updated_at">) =>
      createPeerFundingRecord(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PEERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PEER_FUNDING_ALL_KEY });
    },
  });
}

export function useUpdatePeerFundingRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Omit<PeerFundingRecordUpdate, "id" | "created_at">;
    }) => updatePeerFundingRecord(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PEERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PEER_FUNDING_ALL_KEY });
    },
  });
}

export function useArchivePeerFundingRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archivePeerFundingRecord(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PEERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PEER_FUNDING_ALL_KEY });
    },
  });
}

export function useDeletePeerFundingRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePeerFundingRecord(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PEERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PEER_FUNDING_ALL_KEY });
    },
  });
}
