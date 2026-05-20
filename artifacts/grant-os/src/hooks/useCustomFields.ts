import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveCustomField,
  createCustomField,
  deleteCustomField,
  listCustomFields,
  updateCustomField,
  type CustomFieldInsert,
  type CustomFieldRow,
  type CustomFieldUpdate,
} from "@/lib/customFieldsService";

export type { CustomFieldInsert, CustomFieldRow, CustomFieldUpdate };

export const CUSTOM_FIELDS_QUERY_KEY = ["custom_fields"] as const;

export function useCustomFields() {
  return useQuery({
    queryKey: CUSTOM_FIELDS_QUERY_KEY,
    queryFn: listCustomFields,
    staleTime: 1000 * 60,
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CustomFieldInsert, "id" | "created_at" | "updated_at">) =>
      createCustomField(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY }),
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Omit<CustomFieldUpdate, "id" | "created_at"> }) =>
      updateCustomField(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY }),
  });
}

export function useArchiveCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveCustomField,
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY }),
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY }),
  });
}
