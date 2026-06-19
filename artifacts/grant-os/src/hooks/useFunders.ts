import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listFunders,
  getFunderByIdOrLegacy,
  createFunder,
  updateFunder,
  archiveFunder,
  deleteFunder,
  type FunderRow,
  type FunderInsert,
  type FunderUpdate,
} from "@/lib/fundersService";
import { listAllPeerFundingRecords } from "@/lib/peersService";
import {
  mapFunderRow,
  grantsForFunder,
  peerConnectionCountForFunder,
} from "@/lib/funderMappers";
import { useMappedGrants } from "@/hooks/useGrants";
import type { Funder } from "@/data/funders";

export type { FunderRow, FunderInsert, FunderUpdate };

export const FUNDERS_QUERY_KEY = ["funders"] as const;
export const PEER_FUNDING_ALL_KEY = ["peer_funding_records", "all"] as const;

export function useFunders() {
  return useQuery({
    queryKey: FUNDERS_QUERY_KEY,
    queryFn: () => listFunders(),
    staleTime: 1000 * 60,
  });
}

export function useFunder(id: string | undefined) {
  return useQuery({
    queryKey: [...FUNDERS_QUERY_KEY, id],
    queryFn: () => getFunderByIdOrLegacy(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });
}

export function useAllPeerFundingRecords() {
  return useQuery({
    queryKey: PEER_FUNDING_ALL_KEY,
    queryFn: () => listAllPeerFundingRecords(),
    staleTime: 1000 * 60,
  });
}

export function useMappedFunders() {
  const fundersQuery = useFunders();
  const { grants, isLoading: grantsLoading, isError: grantsError, error: grantsErr } =
    useMappedGrants();
  const recordsQuery = useAllPeerFundingRecords();

  const funders: Funder[] = useMemo(() => {
    if (!fundersQuery.data) return [];
    const records = recordsQuery.data ?? [];
    return fundersQuery.data.map((row) =>
      mapFunderRow(row, {
        relatedGrants: grantsForFunder(row, grants),
        peerConnectionCount: peerConnectionCountForFunder(row.id, records),
      })
    );
  }, [fundersQuery.data, grants, recordsQuery.data]);

  return {
    funders,
    funderRows: fundersQuery.data ?? [],
    isLoading: fundersQuery.isLoading || grantsLoading || recordsQuery.isLoading,
    isError: fundersQuery.isError || grantsError || recordsQuery.isError,
    error: fundersQuery.error ?? grantsErr ?? recordsQuery.error,
    refetch: fundersQuery.refetch,
  };
}

export function useMappedFunder(id: string | undefined) {
  const funderQuery = useFunder(id);
  const { grants, isLoading: grantsLoading } = useMappedGrants();
  const recordsQuery = useAllPeerFundingRecords();

  const funder = useMemo(() => {
    if (!funderQuery.data) return null;
    const records = recordsQuery.data ?? [];
    return mapFunderRow(funderQuery.data, {
      relatedGrants: grantsForFunder(funderQuery.data, grants),
      peerConnectionCount: peerConnectionCountForFunder(funderQuery.data.id, records),
    });
  }, [funderQuery.data, grants, recordsQuery.data]);

  return {
    funder,
    funderRow: funderQuery.data ?? null,
    isLoading: funderQuery.isLoading || grantsLoading || recordsQuery.isLoading,
    isError: funderQuery.isError,
    error: funderQuery.error,
  };
}

export function useCreateFunder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<FunderInsert, "id" | "created_at" | "updated_at">) =>
      createFunder(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNDERS_QUERY_KEY }),
  });
}

export function useUpdateFunder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Omit<FunderUpdate, "id" | "created_at">;
    }) => updateFunder(id, updates),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: FUNDERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...FUNDERS_QUERY_KEY, id] });
    },
  });
}

export function useArchiveFunder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveFunder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNDERS_QUERY_KEY }),
  });
}

export function useDeleteFunder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFunder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNDERS_QUERY_KEY }),
  });
}
