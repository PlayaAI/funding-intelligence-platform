import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FUNDERS_QUERY_KEY } from "@/hooks/useFunders";
import { GRANTS_QUERY_KEY } from "@/hooks/useGrants";
import {
  buildImportPreview,
  executeImport,
  listImportRuns,
} from "@/lib/imports/importsService";
import type {
  ExecuteImportOptions,
  ImportPreview,
  ImportType,
} from "@/lib/imports/importTypes";

export const IMPORT_RUNS_QUERY_KEY = ["import_runs"] as const;

export function useImportRuns() {
  return useQuery({
    queryKey: IMPORT_RUNS_QUERY_KEY,
    queryFn: listImportRuns,
    staleTime: 1000 * 60,
  });
}

export function useBuildImportPreview() {
  return useMutation({
    mutationFn: ({
      importType,
      fileName,
      text,
    }: {
      importType: ImportType;
      fileName: string;
      text: string;
    }) => buildImportPreview(importType, fileName, text),
  });
}

export function useExecuteImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      preview,
      options,
    }: {
      preview: ImportPreview;
      options: ExecuteImportOptions;
    }) => executeImport(preview, options),
    onSuccess: (_result, { preview }) => {
      qc.invalidateQueries({ queryKey: IMPORT_RUNS_QUERY_KEY });
      if (preview.entity === "grant") {
        qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY });
      } else {
        qc.invalidateQueries({ queryKey: FUNDERS_QUERY_KEY });
      }
    },
  });
}
