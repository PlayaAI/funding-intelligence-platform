import type {
  FunderInsert,
  FunderRow,
  FunderUpdate,
  GrantInsert,
  GrantRow,
  GrantUpdate,
  Json,
} from "@/types/database";

export const IMPORT_TYPES = [
  "instrumentl_opportunities_csv",
  "instrumentl_opportunities_json",
  "instrumentl_funders_csv",
  "instrumentl_funders_json",
] as const;

export type ImportType = (typeof IMPORT_TYPES)[number];
export type ImportEntity = "grant" | "funder";
export type ImportPreviewStatus = "ready" | "duplicate" | "error";

export type RawImportRow = Record<string, unknown>;

export interface ImportValidationIssue {
  level: "error" | "warning";
  message: string;
}

export interface GrantImportCandidate {
  entity: "grant";
  input: Omit<GrantInsert, "id" | "created_at" | "updated_at">;
  raw: RawImportRow;
}

export interface FunderImportCandidate {
  entity: "funder";
  input: Omit<FunderInsert, "id" | "created_at" | "updated_at">;
  raw: RawImportRow;
}

export type ImportCandidate = GrantImportCandidate | FunderImportCandidate;

export interface DuplicateInfo {
  id: string;
  reason: string;
  existing: GrantRow | FunderRow;
}

export interface ImportPreviewRow {
  rowIndex: number;
  status: ImportPreviewStatus;
  displayName: string;
  secondary: string | null;
  candidate: ImportCandidate | null;
  issues: ImportValidationIssue[];
  duplicate: DuplicateInfo | null;
  raw: RawImportRow;
}

export interface ImportPreviewSummary {
  totalRows: number;
  readyRows: number;
  duplicateRows: number;
  errorRows: number;
  warningRows: number;
  unknownColumns: string[];
}

export interface ImportPreview {
  importType: ImportType;
  entity: ImportEntity;
  fileName: string;
  rows: ImportPreviewRow[];
  summary: ImportPreviewSummary;
}

export interface ImportRunRow {
  id: string;
  source: string;
  import_type: ImportType | string;
  file_name: string | null;
  status: "completed" | "completed_with_errors" | "failed" | string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  summary: Json | null;
  created_by: string | null;
  created_at: string;
}

export type ImportRunInsert = {
  id?: string;
  source?: string;
  import_type: ImportType;
  file_name?: string | null;
  status?: string;
  total_rows?: number;
  created_count?: number;
  updated_count?: number;
  skipped_count?: number;
  error_count?: number;
  summary?: Json | null;
  created_by?: string | null;
  created_at?: string;
};

export interface ImportErrorInsert {
  id?: string;
  import_run_id: string;
  row_index?: number | null;
  message: string;
  raw_row?: Json | null;
  created_at?: string;
}

export interface ExecuteImportOptions {
  updateMissingFieldsOnly: boolean;
  createdBy: string | null;
}

export interface ExecuteImportResult {
  importRun: ImportRunRow | null;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ rowIndex: number | null; message: string }>;
}

export type ImportableGrantUpdate = Omit<GrantUpdate, "id" | "created_at">;
export type ImportableFunderUpdate = Omit<FunderUpdate, "id" | "created_at">;
