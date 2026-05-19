import { supabase } from "@/lib/supabase";
import { listFunders } from "@/lib/fundersService";
import { listGrants } from "@/lib/grantsService";
import type {
  FunderInsert,
  FunderRow,
  FunderUpdate,
  GrantInsert,
  GrantRow,
  GrantUpdate,
  Json,
} from "@/types/database";
import { parseCsv, parseJsonRows } from "./csvParser";
import { findFunderDuplicate, findGrantDuplicate } from "./importDeduplication";
import {
  buildCandidates,
  hasErrors,
} from "./importValidation";
import { importTypeToEntity } from "./instrumentlImportMappers";
import type {
  ExecuteImportOptions,
  ExecuteImportResult,
  FunderImportCandidate,
  ImportErrorInsert,
  ImportPreview,
  ImportPreviewRow,
  ImportRunInsert,
  ImportRunRow,
  ImportType,
  RawImportRow,
} from "./importTypes";

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function parseImportFileText(text: string, importType: ImportType): RawImportRow[] {
  return importType.endsWith("_csv") ? parseCsv(text) : parseJsonRows(text);
}

function buildSummary(rows: ImportPreviewRow[], unknownColumns: string[]) {
  return {
    totalRows: rows.length,
    readyRows: rows.filter((row) => row.status === "ready").length,
    duplicateRows: rows.filter((row) => row.status === "duplicate").length,
    errorRows: rows.filter((row) => row.status === "error").length,
    warningRows: rows.filter((row) => row.issues.some((issue) => issue.level === "warning")).length,
    unknownColumns,
  };
}

function markFileDuplicates(rows: ImportPreviewRow[]): ImportPreviewRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    if (!row.candidate || row.status === "error") return row;

    const key =
      row.candidate.entity === "grant"
        ? [
            "grant",
            row.candidate.input.source_url?.trim().toLowerCase() ||
              row.candidate.input.title.trim().toLowerCase(),
            row.candidate.input.funder_name?.trim().toLowerCase() ?? "",
          ].join("|")
        : [
            "funder",
            row.candidate.input.ein?.trim().toLowerCase() ||
              row.candidate.input.name.trim().toLowerCase(),
            row.candidate.input.location?.trim().toLowerCase() ?? "",
          ].join("|");

    const firstRow = seen.get(key);
    if (firstRow) {
      return {
        ...row,
        status: "duplicate" as const,
        issues: [
          ...row.issues,
          { level: "warning" as const, message: `Duplicate within file; first seen on row ${firstRow}.` },
        ],
        duplicate: {
          id: `file-row-${firstRow}`,
          reason: `Duplicate within file; first seen on row ${firstRow}`,
          existing: {} as GrantRow | FunderRow,
        },
      };
    }
    seen.set(key, row.rowIndex);
    return row;
  });
}

export async function buildImportPreview(
  importType: ImportType,
  fileName: string,
  text: string
): Promise<ImportPreview> {
  const rawRows = parseImportFileText(text, importType);
  const { candidates, unknownColumns } = buildCandidates(rawRows, importType);
  const entity = importTypeToEntity(importType);
  const existingRows = entity === "grant" ? await listGrants({ includeSoftArchived: true }) : await listFunders();

  const rows = candidates.map<ImportPreviewRow>(({ rowIndex, candidate, issues, raw }) => {
    const errored = hasErrors(issues);
    const duplicate =
      !errored && candidate
        ? candidate.entity === "grant"
          ? findGrantDuplicate(candidate, existingRows as GrantRow[])
          : findFunderDuplicate(candidate, existingRows as FunderRow[])
        : null;

    return {
      rowIndex,
      status: errored ? "error" : duplicate ? "duplicate" : "ready",
      displayName:
        candidate?.entity === "grant"
          ? candidate.input.title || "(Untitled grant)"
          : candidate?.input.name || "(Unnamed funder)",
      secondary:
        candidate?.entity === "grant"
          ? candidate.input.funder_name ?? null
          : candidate?.input.ein ?? candidate?.input.location ?? null,
      candidate,
      issues,
      duplicate,
      raw,
    };
  });

  const dedupedRows = markFileDuplicates(rows);

  return {
    importType,
    entity,
    fileName,
    rows: dedupedRows,
    summary: buildSummary(dedupedRows, unknownColumns),
  };
}

function isEmptyExisting(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function missingGrantFields(existing: GrantRow, input: GrantInsert): GrantUpdate {
  const updates: GrantUpdate = {};
  (Object.keys(input) as Array<keyof GrantInsert>).forEach((key) => {
    if (key === "title") return;
    const value = input[key];
    if (!isEmptyExisting(existing[key as keyof GrantRow]) || isEmptyExisting(value)) return;
    (updates as Record<string, unknown>)[key] = value;
  });
  return updates;
}

function missingFunderFields(existing: FunderRow, input: FunderInsert): FunderUpdate {
  const updates: FunderUpdate = {};
  (Object.keys(input) as Array<keyof FunderInsert>).forEach((key) => {
    if (key === "name") return;
    const value = input[key];
    if (!isEmptyExisting(existing[key as keyof FunderRow]) || isEmptyExisting(value)) return;
    (updates as Record<string, unknown>)[key] = value;
  });
  return updates;
}

async function insertImportRun(input: ImportRunInsert): Promise<ImportRunRow> {
  const result: SupabaseResult<ImportRunRow> = await db
    .from("import_runs")
    .insert(input)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No import run returned.");
  return result.data;
}

async function insertImportErrors(errors: ImportErrorInsert[]): Promise<void> {
  if (errors.length === 0) return;
  const result: SupabaseResult<null> = await db.from("import_errors").insert(errors);
  if (result.error) throw new Error(result.error.message);
}

async function insertGrants(inputs: Array<Omit<GrantInsert, "id" | "created_at" | "updated_at">>) {
  if (inputs.length === 0) return [];
  const result: SupabaseResult<GrantRow[]> = await db.from("grants").insert(inputs).select();
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function insertFunders(inputs: Array<Omit<FunderInsert, "id" | "created_at" | "updated_at">>) {
  if (inputs.length === 0) return [];
  const result: SupabaseResult<FunderRow[]> = await db.from("funders").insert(inputs).select();
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function updateGrantMissingFields(id: string, updates: GrantUpdate) {
  if (Object.keys(updates).length === 0) return null;
  const result: SupabaseResult<GrantRow> = await db
    .from("grants")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function updateFunderMissingFields(id: string, updates: FunderUpdate) {
  if (Object.keys(updates).length === 0) return null;
  const result: SupabaseResult<FunderRow> = await db
    .from("funders")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function executeImport(
  preview: ImportPreview,
  options: ExecuteImportOptions
): Promise<ExecuteImportResult> {
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = preview.rows.filter((row) => row.status !== "ready").length;
  const errors: Array<{ rowIndex: number | null; message: string }> = preview.rows
    .filter((row) => row.status === "error")
    .flatMap((row) =>
      row.issues
        .filter((issue) => issue.level === "error")
        .map((issue) => ({ rowIndex: row.rowIndex, message: issue.message }))
    );

  const readyRows = preview.rows.filter((row) => row.status === "ready" && row.candidate);

  try {
    if (preview.entity === "grant") {
      const createInputs = readyRows
        .map((row) => row.candidate)
        .filter((candidate): candidate is Extract<NonNullable<typeof candidate>, { entity: "grant" }> =>
          Boolean(candidate && candidate.entity === "grant")
        )
        .map((candidate) => candidate.input);
      createdCount = (await insertGrants(createInputs)).length;
    } else {
      const createInputs = readyRows
        .map((row) => row.candidate)
        .filter((candidate): candidate is FunderImportCandidate =>
          Boolean(candidate && candidate.entity === "funder")
        )
        .map((candidate) => candidate.input);
      createdCount = (await insertFunders(createInputs)).length;
    }

    if (options.updateMissingFieldsOnly) {
      for (const row of preview.rows) {
        if (!row.candidate || !row.duplicate || row.duplicate.id.startsWith("file-row-")) continue;
        if (row.candidate.entity === "grant") {
          const updates = missingGrantFields(row.duplicate.existing as GrantRow, row.candidate.input);
          const updated = await updateGrantMissingFields(row.duplicate.id, updates);
          if (updated) updatedCount += 1;
        } else {
          const updates = missingFunderFields(row.duplicate.existing as FunderRow, row.candidate.input);
          const updated = await updateFunderMissingFields(row.duplicate.id, updates);
          if (updated) updatedCount += 1;
        }
      }
    }

    skippedCount = Math.max(0, skippedCount - updatedCount);

    const importRun = await insertImportRun({
      source: "instrumentl",
      import_type: preview.importType,
      file_name: preview.fileName,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      total_rows: preview.summary.totalRows,
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      error_count: errors.length,
      created_by: options.createdBy,
      summary: {
        entity: preview.entity,
        duplicateRows: preview.summary.duplicateRows,
        warningRows: preview.summary.warningRows,
        unknownColumns: preview.summary.unknownColumns,
        updateMissingFieldsOnly: options.updateMissingFieldsOnly,
      } as Json,
    });

    await insertImportErrors(
      errors.map((error) => ({
        import_run_id: importRun.id,
        row_index: error.rowIndex,
        message: error.message,
        raw_row:
          preview.rows.find((row) => row.rowIndex === error.rowIndex)?.raw as Json | undefined,
      }))
    );

    return { importRun, createdCount, updatedCount, skippedCount, errorCount: errors.length, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    errors.push({ rowIndex: null, message });
    let importRun: ImportRunRow | null = null;
    try {
      importRun = await insertImportRun({
        source: "instrumentl",
        import_type: preview.importType,
        file_name: preview.fileName,
        status: "failed",
        total_rows: preview.summary.totalRows,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        error_count: errors.length,
        created_by: options.createdBy,
        summary: { message } as Json,
      });
      await insertImportErrors([
        {
          import_run_id: importRun.id,
          row_index: null,
          message,
          raw_row: null,
        },
      ]);
    } catch {
      // If audit writes fail, return the original import error to the UI.
    }
    return { importRun, createdCount, updatedCount, skippedCount, errorCount: errors.length, errors };
  }
}

export async function listImportRuns(): Promise<ImportRunRow[]> {
  const result: SupabaseResult<ImportRunRow[]> = await db
    .from("import_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}
