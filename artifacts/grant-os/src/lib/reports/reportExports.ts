type Primitive = string | number | boolean | null | undefined;
type CsvRow = Record<string, Primitive>;

function escapeCsv(value: Primitive): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function rowsToCsv(rows: CsvRow[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\n");
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(filename: string, rows: CsvRow[]): void {
  downloadTextFile(filename, rowsToCsv(rows), "text/csv;charset=utf-8");
}

export function exportJson(filename: string, payload: unknown): void {
  downloadTextFile(filename, `${JSON.stringify(payload, null, 2)}\n`, "application/json;charset=utf-8");
}
