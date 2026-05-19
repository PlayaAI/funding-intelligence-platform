import type {
  FunderImportCandidate,
  GrantImportCandidate,
  ImportCandidate,
  ImportValidationIssue,
  RawImportRow,
} from "./importTypes";
import {
  collectUnknownColumns,
  importTypeToEntity,
  mapInstrumentlFunder,
  mapInstrumentlGrant,
} from "./instrumentlImportMappers";
import type { ImportType } from "./importTypes";

function isBlankRawRow(row: RawImportRow): boolean {
  return Object.values(row).every((value) => {
    if (value == null) return true;
    if (typeof value === "string") return value.trim() === "";
    return false;
  });
}

function validateGrant(candidate: GrantImportCandidate): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = [];
  if (!candidate.input.title.trim()) issues.push({ level: "error", message: "Missing grant title." });
  if (!candidate.input.funder_name?.trim()) {
    issues.push({ level: "warning", message: "Missing funder name." });
  }
  if (!candidate.input.deadline && !candidate.input.next_deadline) {
    issues.push({ level: "warning", message: "Missing deadline." });
  }
  if (
    candidate.input.amount_min != null &&
    candidate.input.amount_max != null &&
    candidate.input.amount_min > candidate.input.amount_max
  ) {
    issues.push({ level: "warning", message: "Minimum amount is greater than maximum amount." });
  }
  return issues;
}

function validateFunder(candidate: FunderImportCandidate): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = [];
  if (!candidate.input.name.trim()) issues.push({ level: "error", message: "Missing funder name." });
  if (!candidate.input.ein && !candidate.input.location) {
    issues.push({ level: "warning", message: "Missing EIN and location; deduplication will use name only." });
  }
  return issues;
}

export function buildCandidates(rows: RawImportRow[], importType: ImportType): {
  candidates: Array<{
    rowIndex: number;
    candidate: ImportCandidate | null;
    issues: ImportValidationIssue[];
    raw: RawImportRow;
  }>;
  unknownColumns: string[];
} {
  const entity = importTypeToEntity(importType);
  const candidates = rows
    .map((row, index) => ({ row, rowIndex: index + 2 }))
    .filter(({ row }) => !isBlankRawRow(row))
    .map(({ row, rowIndex }) => {
      try {
        const candidate = entity === "grant" ? mapInstrumentlGrant(row) : mapInstrumentlFunder(row);
        const issues = candidate.entity === "grant" ? validateGrant(candidate) : validateFunder(candidate);
        return { rowIndex, candidate, issues, raw: row };
      } catch (err) {
        return {
          rowIndex,
          candidate: null,
          issues: [
            {
              level: "error" as const,
              message: err instanceof Error ? err.message : "Failed to map row.",
            },
          ],
          raw: row,
        };
      }
    });

  return {
    candidates,
    unknownColumns: collectUnknownColumns(rows, importType),
  };
}

export function hasErrors(issues: ImportValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}
