import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAgentKnowledgeItems,
  createAgentKnowledgeItem,
  updateAgentKnowledgeItem,
  archiveAgentKnowledgeItem,
  listAgentKnowledgeProposals,
  proposeAgentKnowledgeUpdate,
  approveAgentKnowledgeProposal,
  rejectAgentKnowledgeProposal,
  type AgentKnowledgeItem,
  type AgentKnowledgeUpdate,
} from "@/lib/agentKnowledgeService";

export const KNOWLEDGE_ITEMS_QUERY_KEY = ["agentKnowledgeItems"] as const;
export const KNOWLEDGE_PROPOSALS_QUERY_KEY = ["agentKnowledgeProposals"] as const;

export function useKnowledgeItems() {
  return useQuery({
    queryKey: KNOWLEDGE_ITEMS_QUERY_KEY,
    queryFn: listAgentKnowledgeItems,
    staleTime: 1000 * 60,
  });
}

export function useCreateKnowledgeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAgentKnowledgeItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KNOWLEDGE_ITEMS_QUERY_KEY });
    },
  });
}

export function useUpdateKnowledgeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AgentKnowledgeItem> }) =>
      updateAgentKnowledgeItem(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KNOWLEDGE_ITEMS_QUERY_KEY });
    },
  });
}

export function useArchiveKnowledgeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveAgentKnowledgeItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KNOWLEDGE_ITEMS_QUERY_KEY });
    },
  });
}

export function useKnowledgeProposals() {
  return useQuery({
    queryKey: KNOWLEDGE_PROPOSALS_QUERY_KEY,
    queryFn: listAgentKnowledgeProposals,
    staleTime: 1000 * 60,
  });
}

export function useProposeKnowledgeUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: proposeAgentKnowledgeUpdate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KNOWLEDGE_PROPOSALS_QUERY_KEY });
    },
  });
}

export function useApproveKnowledgeProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveAgentKnowledgeProposal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KNOWLEDGE_PROPOSALS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: KNOWLEDGE_ITEMS_QUERY_KEY });
    },
  });
}

export function useRejectKnowledgeProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewerNotes }: { id: string; reviewerNotes?: string }) =>
      rejectAgentKnowledgeProposal(id, reviewerNotes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KNOWLEDGE_PROPOSALS_QUERY_KEY });
    },
  });
}
