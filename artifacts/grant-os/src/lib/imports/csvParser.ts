import type { RawImportRow } from "./importTypes";

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

export function parseCsv(text: string): RawImportRow[] {
  const parsedRows = parseCsvRows(stripBom(text)).filter((row) => !isBlankRow(row));
  if (parsedRows.length === 0) return [];

  const headers = parsedRows[0].map((header, index) => {
    const trimmed = header.trim();
    return trimmed || `column_${index + 1}`;
  });

  return parsedRows.slice(1).map((row) => {
    const record: RawImportRow = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? "";
    });
    return record;
  });
}

export function parseJsonRows(text: string): RawImportRow[] {
  const parsed = JSON.parse(stripBom(text)) as unknown;
  const candidate =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { data?: unknown }).data)
        ? (parsed as { data: unknown[] }).data
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { opportunities?: unknown }).opportunities)
          ? (parsed as { opportunities: unknown[] }).opportunities
          : parsed && typeof parsed === "object" && Array.isArray((parsed as { grants?: unknown }).grants)
            ? (parsed as { grants: unknown[] }).grants
            : parsed && typeof parsed === "object" && Array.isArray((parsed as { funders?: unknown }).funders)
              ? (parsed as { funders: unknown[] }).funders
              : null;

  if (!candidate) {
    throw new Error("JSON import must be an array or contain a data/opportunities/grants/funders array.");
  }

  return candidate
    .filter((item): item is RawImportRow => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as RawImportRow);
}
