import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import type {
  Database,
  DocumentInsert,
  DocumentRow,
  FunderInsert,
  FunderRow,
  FunderUpdate,
  GrantInsert,
  GrantRow,
  GrantUpdate,
  Json,
  ProjectInsert,
  ProjectRow,
  ProjectUpdate,
} from "../artifacts/grant-os/src/types/database";

type RawRow = Record<string, unknown>;
type Mode = "dry-run" | "apply";
type EntityType = "grant" | "funder";
type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string; code?: string } };

type SourceProject = {
  zipMatchers: string[];
  name: string;
  slug: string;
  category: string;
};

type ParsedFile = {
  sourceZip: string;
  sourceFile: string;
  entity: EntityType;
  rows: RawRow[];
};

type GrantCandidate = {
  entity: "grant";
  sourceZip: string;
  sourceFile: string;
  rowIndex: number;
  sourceProject: SourceProject;
  input: Omit<GrantInsert, "id" | "created_at" | "updated_at">;
  raw: RawRow;
  keys: string[];
};

type FunderCandidate = {
  entity: "funder";
  sourceZip: string;
  sourceFile: string;
  rowIndex: number;
  sourceProject: SourceProject;
  input: Omit<FunderInsert, "id" | "created_at" | "updated_at">;
  raw: RawRow;
  keys: string[];
};

type Candidate = GrantCandidate | FunderCandidate;

type DedupeEntry = {
  entity: EntityType | "document";
  key: string;
  action: "create" | "update_missing" | "skip_duplicate" | "skip_invalid";
  reason: string;
  sourceZip?: string;
  sourceFile?: string;
  rowIndex?: number;
  existingId?: string | null;
  displayName?: string;
};

type ImportError = {
  sourceZip?: string;
  sourceFile?: string;
  rowIndex?: number | null;
  message: string;
  raw?: Json | null;
};

type Summary = {
  mode: Mode;
  generated_at: string;
  input_dir: string;
  output_dir: string;
  zips_processed: string[];
  projects: { created: number; updated: number; existing: number; planned: number };
  opportunities: { raw_rows: number; created: number; updated: number; skipped: number; invalid: number };
  funders: { raw_rows: number; created: number; updated: number; skipped: number; invalid: number };
  documents: { registered: number; skipped: number };
  duplicates_detected: number;
  errors_count: number;
  warnings: string[];
  next_steps: string[];
};

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const INPUT_DIR = path.join(ROOT, "import-data", "instrumentl-zips");
const OUTPUT_DIR = path.join(ROOT, "import-data", "output");

const SOURCE_PROJECTS: SourceProject[] = [
  {
    zipMatchers: ["Decommodified Dataset.zip"],
    name: "Playa AI Decommodified Dataset",
    slug: "decommodified-dataset",
    category: "Dataset",
  },
  {
    zipMatchers: ["Tech for Human Flourish.zip", "Tech for Human Flourish(1).zip"],
    name: "Playa AI Tech for Human Flourish",
    slug: "tech-for-human-flourish",
    category: "Human Flourishing",
  },
  {
    zipMatchers: ["Foundation.zip", "Foundation(2).zip"],
    name: "Playa AI Foundation",
    slug: "foundation",
    category: "Foundation",
  },
  {
    zipMatchers: ["Democracy 2.0 Initiatives.zip", "Democracy 2.0 Initiatives(1).zip"],
    name: "Playa AI Democracy 2.0 Initiatives",
    slug: "democracy-2-0-initiatives",
    category: "Democracy",
  },
  {
    zipMatchers: ["Science.zip", "Science(1).zip"],
    name: "Playa AI Art / Science",
    slug: "art-science",
    category: "Art / Science",
  },
];

function parseArgs(): { mode: Mode; useServiceRole: boolean } {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const apply = args.has("--apply");
  if (dryRun === apply) {
    throw new Error("Pass exactly one mode: --dry-run or --apply.");
  }
  return { mode: apply ? "apply" : "dry-run", useServiceRole: args.has("--use-service-role") };
}

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/gu, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function loadLocalEnv(): void {
  loadEnvFile(path.join(ROOT, ".env"));
  loadEnvFile(path.join(ROOT, ".env.local"));
  loadEnvFile(path.join(ROOT, "artifacts", "grant-os", ".env"));
  loadEnvFile(path.join(ROOT, "artifacts", "grant-os", ".env.local"));
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeComparable(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\/+$/u, "");
}

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function normalizeRow(row: RawRow): RawRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
}

function pick(row: RawRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = cleanString(row[key]);
    if (value) return value;
  }
  return null;
}

function pickJson(row: RawRow, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return row[key];
  }
  return null;
}

function parseJsonMaybe(value: unknown): Json | null {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value as Json;
  const asString = cleanString(value);
  if (!asString) return null;
  try {
    return JSON.parse(asString) as Json;
  } catch {
    return asString;
  }
}

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter((item): item is string => Boolean(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => parseArray(item));
  }
  const asString = cleanString(value);
  if (!asString) return [];
  try {
    const parsed = JSON.parse(asString) as unknown;
    if (Array.isArray(parsed) || (parsed && typeof parsed === "object")) return parseArray(parsed);
  } catch {
    // Fall through to delimiter parsing.
  }
  return asString
    .split(/\n|;|\|/u)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickArray(row: RawRow, keys: string[]): string[] {
  for (const key of keys) {
    const value = parseArray(row[key]);
    if (value.length > 0) return [...new Set(value)].slice(0, 30);
  }
  return [];
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/u)?.[0];
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: unknown): boolean | null {
  const asString = cleanString(value);
  if (!asString) return null;
  if (/^(true|yes|y|1)$/iu.test(asString)) return true;
  if (/^(false|no|n|0)$/iu.test(asString)) return false;
  return null;
}

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
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
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

function parseCsv(text: string): RawRow[] {
  const rows = parseCsvRows(stripBom(text)).filter((row) => row.some((cell) => cell.trim()));
  if (!rows.length) return [];
  const headers = rows[0].map((header, index) => header.trim() || `column_${index + 1}`);
  return rows.slice(1).map((row) => {
    const record: RawRow = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? "";
    });
    return record;
  });
}

function findJsonRows(parsed: unknown): RawRow[] {
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is RawRow => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }
  if (!parsed || typeof parsed !== "object") return [];
  const object = parsed as Record<string, unknown>;
  for (const key of ["data", "opportunities", "grants", "funders", "results", "items"]) {
    if (Array.isArray(object[key])) return findJsonRows(object[key]);
  }
  return [object];
}

function parseJsonRows(text: string): RawRow[] {
  return findJsonRows(JSON.parse(stripBom(text)) as unknown);
}

function zipList(zipPath: string): string[] {
  return execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function zipText(zipPath: string, entry: string): string {
  return execFileSync("unzip", ["-p", zipPath, entry], { encoding: "utf8", maxBuffer: 250 * 1024 * 1024 });
}

function classifyEntry(entry: string): EntityType | null {
  const lower = entry.toLowerCase();
  if (!/\.(csv|json)$/u.test(lower)) return null;
  if (/opportunit|grant/u.test(lower) && !/funder/u.test(lower)) return "grant";
  if (/funder|foundation/u.test(lower) && !/opportunit/u.test(lower)) return "funder";
  return null;
}

function isDocumentEntry(entry: string): boolean {
  const lower = entry.toLowerCase();
  if (lower.endsWith("/")) return false;
  if (/\.(csv|json|html?|png|jpe?g|gif|webp)$/u.test(lower)) return false;
  return /\.(pdf|docx?|xlsx?|txt|rtf|md)$/u.test(lower) || /document|guideline|application|attachment/u.test(lower);
}

function sourceProjectForZip(zipName: string): SourceProject | null {
  return SOURCE_PROJECTS.find((project) => project.zipMatchers.some((matcher) => matcher === zipName)) ?? null;
}

function sourceMetadata(args: {
  sourceZip: string;
  sourceFile: string;
  sourceProject: SourceProject;
  raw: RawRow;
}): Record<string, unknown> {
  const row = normalizeRow(args.raw);
  return {
    source: "instrumentl_zip_import",
    source_zip: args.sourceZip,
    source_file: args.sourceFile,
    source_project_slug: args.sourceProject.slug,
    source_project_name: args.sourceProject.name,
    instrumentl_project_id: pick(row, ["project_id", "instrumentl_project_id"]),
    instrumentl_grant_id: pick(row, ["grant_id", "opportunity_id", "instrumentl_grant_id"]),
    instrumentl_funder_id: pick(row, ["funder_id", "instrumentl_funder_id"]),
    instrumentl_deep_link: pick(row, ["instrumentl_deep_link", "instrumentl_url", "instrumentl_funder_deep_link"]),
    detail_api_url: pick(row, ["detail_api_url"]),
    public_url: pick(row, ["public_url", "document_url"]),
    imported_at: new Date().toISOString(),
  };
}

function notesWithMetadata(primary: string | null, metadata: Record<string, unknown>, raw: RawRow): string {
  const parts = [];
  if (primary) parts.push(primary);
  parts.push(`Instrumentl source metadata:\n${JSON.stringify({ ...metadata, raw_source_row: raw }, null, 2)}`);
  return parts.join("\n\n");
}

function mapGrant(row: RawRow, sourceZip: string, sourceFile: string, sourceProject: SourceProject, rowIndex: number): GrantCandidate | null {
  const normalized = normalizeRow(row);
  const title = pick(normalized, ["grant_name", "opportunity_name", "title", "name"]);
  if (!title) return null;
  const rolling = parseBoolean(normalized.rolling);
  const amountDisplay = pick(normalized, ["amount", "award_amount", "amount_display"]);
  const eligibility = [
    pick(normalized, ["eligibility", "applicant_type"]),
    pick(normalized, ["ineligibility"]) ? `Ineligibility: ${pick(normalized, ["ineligibility"])}` : null,
  ].filter(Boolean).join("\n\n") || null;
  const metadata = sourceMetadata({ sourceZip, sourceFile, sourceProject, raw: row });
  const input: Omit<GrantInsert, "id" | "created_at" | "updated_at"> = {
    title,
    funder_name: pick(normalized, ["funder_name", "foundation_name"]),
    funder_id: null,
    related_project_id: null,
    related_project_slug: sourceProject.slug,
    deadline: pick(normalized, ["next_deadline_date", "deadline", "deadline_display"]),
    next_deadline: pick(normalized, ["next_deadline_date", "deadline_display"]),
    amount_display: amountDisplay,
    amount_min: parseNumber(pick(normalized, ["amount_min", "min_amount"])),
    amount_max: parseNumber(pick(normalized, ["amount_max", "max_amount", "amount"])),
    focus_areas: pickArray(normalized, ["cause_areas", "focus_areas", "funding_uses"]),
    geography: pick(normalized, ["location_of_project", "location_of_residency", "geography", "location", "locations"]),
    eligibility,
    application_url: pick(normalized, ["application_url", "public_url", "document_url"]),
    source_url: pick(normalized, ["instrumentl_deep_link", "public_url", "detail_api_url", "source_url", "document_url"]),
    required_documents: pickArray(normalized, ["required_documents", "help_or_doc_urls", "document_url"]),
    application_questions: parseJsonMaybe(pickJson(normalized, ["application_cycles"])),
    status: rolling ? "Researching" : "Researching",
    priority: null,
    fit_score: null,
    priority_score: null,
    difficulty_score: null,
    proof_readiness: null,
    application_readiness: null,
    is_top_three: false,
    notes: notesWithMetadata(
      pick(normalized, ["summary", "overview", "match_insights", "funder_snapshot"]),
      metadata,
      row
    ),
  };
  return {
    entity: "grant",
    sourceZip,
    sourceFile,
    rowIndex,
    sourceProject,
    input,
    raw: row,
    keys: grantKeys(normalized, input),
  };
}

function mapFunder(row: RawRow, sourceZip: string, sourceFile: string, sourceProject: SourceProject, rowIndex: number): FunderCandidate | null {
  const normalized = normalizeRow(row);
  const name = pick(normalized, ["name", "funder_name", "foundation_name"]);
  if (!name) return null;
  const inviteOnly = parseBoolean(normalized.invite_only);
  const metadata = sourceMetadata({ sourceZip, sourceFile, sourceProject, raw: row });
  const cityState = [pick(normalized, ["city"]), pick(normalized, ["state"])].filter(Boolean).join(", ") || null;
  const input: Omit<FunderInsert, "id" | "created_at" | "updated_at"> = {
    legacy_id: pick(normalized, ["funder_id", "instrumentl_funder_id"]),
    name,
    slug: null,
    website: pick(normalized, ["website", "instrumentl_funder_deep_link"]),
    ein: pick(normalized, ["ein"]),
    location: pick(normalized, ["location"]) ?? cityState,
    address: pick(normalized, ["address"]),
    phone: pick(normalized, ["phone"]),
    contact_info: null,
    key_people: parseJsonMaybe(pickJson(normalized, ["key_people"])),
    assets: parseNumber(pick(normalized, ["total_assets", "assets"])),
    annual_giving: parseNumber(pick(normalized, ["total_giving", "annual_giving"])),
    median_grant_amount: parseNumber(pick(normalized, ["median_grant_amount"])),
    giving_areas: pickArray(normalized, ["giving_areas", "cause_areas", "available_grants", "history_of_giving"]),
    openness_to_new_grantees: pick(normalized, ["giving_rate_to_new_grantees", "openness", "openness_to_new_grantees"]) ?? (inviteOnly === true ? "Invite only" : null),
    relationship_status: "None",
    past_grantees: [],
    open_applications: inviteOnly === null ? false : !inviteOnly,
    notes: notesWithMetadata(pick(normalized, ["notes", "raw_summary", "funder_type", "similarity"]), metadata, row),
  };
  return {
    entity: "funder",
    sourceZip,
    sourceFile,
    rowIndex,
    sourceProject,
    input,
    raw: row,
    keys: funderKeys(normalized, input),
  };
}

function grantKeys(row: RawRow, input: Omit<GrantInsert, "id" | "created_at" | "updated_at">): string[] {
  return [
    pick(row, ["grant_id", "opportunity_id", "instrumentl_grant_id"]) ? `grant_id:${pick(row, ["grant_id", "opportunity_id", "instrumentl_grant_id"])}` : null,
    pick(row, ["detail_api_url"]) ? `detail_api_url:${normalizeUrl(pick(row, ["detail_api_url"]))}` : null,
    pick(row, ["instrumentl_deep_link"]) ? `instrumentl_deep_link:${normalizeUrl(pick(row, ["instrumentl_deep_link"]))}` : null,
    pick(row, ["public_url"]) ? `public_url:${normalizeUrl(pick(row, ["public_url"]))}` : null,
    input.source_url ? `source_url:${normalizeUrl(input.source_url)}` : null,
    `title_funder:${normalizeComparable(input.title)}|${normalizeComparable(input.funder_name)}`,
  ].filter((key): key is string => Boolean(key && !key.endsWith(":") && !key.endsWith("|")));
}

function funderKeys(row: RawRow, input: Omit<FunderInsert, "id" | "created_at" | "updated_at">): string[] {
  return [
    input.ein ? `ein:${normalizeComparable(input.ein)}` : null,
    input.legacy_id ? `funder_id:${normalizeComparable(input.legacy_id)}` : null,
    pick(row, ["funder_id", "instrumentl_funder_id"]) ? `funder_id:${normalizeComparable(pick(row, ["funder_id", "instrumentl_funder_id"]))}` : null,
    input.name && input.location ? `name_location:${normalizeComparable(input.name)}|${normalizeComparable(input.location)}` : null,
    input.name ? `name:${normalizeComparable(input.name)}` : null,
  ].filter((key): key is string => Boolean(key && !key.endsWith(":") && !key.endsWith("|")));
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function mergeArrays(existing: string[] | null | undefined, incoming: string[] | null | undefined): string[] | undefined {
  const merged = [...new Set([...(existing ?? []), ...(incoming ?? [])].filter(Boolean))];
  if (merged.length === (existing ?? []).length) return undefined;
  return merged;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function missingGrantFields(existing: GrantRow, input: Omit<GrantInsert, "id" | "created_at" | "updated_at">): GrantUpdate {
  const updates: GrantUpdate = {};
  for (const key of Object.keys(input) as Array<keyof GrantInsert>) {
    if (["title", "notes"].includes(key)) continue;
    const incoming = input[key];
    const current = existing[key as keyof GrantRow];
    if (isStringArray(incoming) && isStringArray(current)) {
      const merged = mergeArrays(current, incoming);
      if (merged) (updates as Record<string, unknown>)[key] = merged;
      continue;
    }
    if (isEmpty(current) && !isEmpty(incoming)) (updates as Record<string, unknown>)[key] = incoming;
  }
  if (isEmpty(existing.notes) && !isEmpty(input.notes)) updates.notes = input.notes;
  return updates;
}

function missingFunderFields(existing: FunderRow, input: Omit<FunderInsert, "id" | "created_at" | "updated_at">): FunderUpdate {
  const updates: FunderUpdate = {};
  for (const key of Object.keys(input) as Array<keyof FunderInsert>) {
    if (["name", "notes"].includes(key)) continue;
    const incoming = input[key];
    const current = existing[key as keyof FunderRow];
    if (isStringArray(incoming) && isStringArray(current)) {
      const merged = mergeArrays(current, incoming);
      if (merged) (updates as Record<string, unknown>)[key] = merged;
      continue;
    }
    if (isEmpty(current) && !isEmpty(incoming)) (updates as Record<string, unknown>)[key] = incoming;
  }
  if (isEmpty(existing.notes) && !isEmpty(input.notes)) updates.notes = input.notes;
  return updates;
}

function buildClient(useServiceRole: boolean) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/u.test(url)) {
    throw new Error("Set VITE_SUPABASE_URL or SUPABASE_URL to the project API URL, e.g. https://xxxx.supabase.co.");
  }
  if (useServiceRole) {
    if (!serviceRoleKey) throw new Error("Pass SUPABASE_SERVICE_ROLE_KEY when using --use-service-role.");
    return createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  if (!anonKey) throw new Error("Set VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY.");
  if (!accessToken) {
    throw new Error(
      "Set SUPABASE_ACCESS_TOKEN to an authenticated user JWT for RLS-safe imports, or explicitly pass --use-service-role with SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function selectAll<T>(db: ReturnType<typeof buildClient>, table: string): Promise<T[]> {
  const result = await (db as any).from(table).select("*") as SupabaseResult<T[]>;
  if (result.error) throw new Error(`${table} select failed: ${result.error.message}`);
  return result.data ?? [];
}

async function ensureProjects(
  db: ReturnType<typeof buildClient>,
  mode: Mode,
  summary: Summary
): Promise<Map<string, ProjectRow | ProjectInsert>> {
  const existing = await selectAll<ProjectRow>(db, "projects");
  const bySlug = new Map(existing.map((project) => [project.slug, project]));
  const result = new Map<string, ProjectRow | ProjectInsert>();

  for (const sourceProject of SOURCE_PROJECTS) {
    const current = bySlug.get(sourceProject.slug);
    if (!current) {
      const input: ProjectInsert = {
        name: sourceProject.name,
        slug: sourceProject.slug,
        category: sourceProject.category,
        summary: "Imported Instrumentl dataset project shell.",
        stage: "Researching",
        public_visibility: false,
        featured: false,
      };
      summary.projects.planned += 1;
      if (mode === "apply") {
        const inserted = await (db as any).from("projects").insert(input).select("*").single() as SupabaseResult<ProjectRow>;
        if (inserted.error) throw new Error(`Project insert failed for ${sourceProject.slug}: ${inserted.error.message}`);
        result.set(sourceProject.slug, inserted.data);
        summary.projects.created += 1;
      } else {
        result.set(sourceProject.slug, input);
      }
      continue;
    }

    const updates: ProjectUpdate = {};
    if (isEmpty(current.category)) updates.category = sourceProject.category;
    if (isEmpty(current.summary)) updates.summary = "Imported Instrumentl dataset project shell.";
    result.set(sourceProject.slug, current);
    if (Object.keys(updates).length > 0) {
      if (mode === "apply") {
        const updated = await (db as any)
          .from("projects")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", current.id)
          .select("*")
          .single() as SupabaseResult<ProjectRow>;
        if (updated.error) throw new Error(`Project update failed for ${sourceProject.slug}: ${updated.error.message}`);
        result.set(sourceProject.slug, updated.data);
        summary.projects.updated += 1;
      } else {
        summary.projects.planned += 1;
      }
    } else {
      summary.projects.existing += 1;
    }
  }

  return result;
}

function parseZips(errors: ImportError[]): { parsedFiles: ParsedFile[]; documentRefs: Array<{ sourceZip: string; sourceFile: string; sourceProject: SourceProject; size?: null }>; zips: string[] } {
  if (!existsSync(INPUT_DIR)) {
    throw new Error(`Input directory does not exist: ${INPUT_DIR}`);
  }
  const zipNames = readdirSync(INPUT_DIR).filter((name) => name.toLowerCase().endsWith(".zip")).sort();
  const parsedFiles: ParsedFile[] = [];
  const documentRefs: Array<{ sourceZip: string; sourceFile: string; sourceProject: SourceProject; size?: null }> = [];
  const processed: string[] = [];

  for (const zipName of zipNames) {
    const sourceProject = sourceProjectForZip(zipName);
    if (!sourceProject) {
      errors.push({ sourceZip: zipName, message: "ZIP name does not match a configured source project; skipped.", raw: null });
      continue;
    }
    const zipPath = path.join(INPUT_DIR, zipName);
    processed.push(zipName);
    let entries: string[] = [];
    try {
      entries = zipList(zipPath);
    } catch (err) {
      errors.push({ sourceZip: zipName, message: `Could not list ZIP: ${err instanceof Error ? err.message : String(err)}`, raw: null });
      continue;
    }

    for (const entry of entries) {
      const entity = classifyEntry(entry);
      if (entity) {
        try {
          const content = zipText(zipPath, entry);
          const rows = entry.toLowerCase().endsWith(".csv") ? parseCsv(content) : parseJsonRows(content);
          parsedFiles.push({ sourceZip: zipName, sourceFile: entry, entity, rows });
        } catch (err) {
          errors.push({ sourceZip: zipName, sourceFile: entry, message: `Could not parse file: ${err instanceof Error ? err.message : String(err)}`, raw: null });
        }
        continue;
      }
      if (isDocumentEntry(entry)) documentRefs.push({ sourceZip: zipName, sourceFile: entry, sourceProject });
    }
  }

  return { parsedFiles, documentRefs, zips: processed };
}

function buildCandidates(parsedFiles: ParsedFile[], errors: ImportError[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const file of parsedFiles) {
    const sourceProject = sourceProjectForZip(file.sourceZip);
    if (!sourceProject) continue;
    file.rows.forEach((row, index) => {
      const candidate = file.entity === "grant"
        ? mapGrant(row, file.sourceZip, file.sourceFile, sourceProject, index + 2)
        : mapFunder(row, file.sourceZip, file.sourceFile, sourceProject, index + 2);
      if (candidate) {
        candidates.push(candidate);
      } else {
        errors.push({
          sourceZip: file.sourceZip,
          sourceFile: file.sourceFile,
          rowIndex: index + 2,
          message: file.entity === "grant" ? "Skipped row without grant title." : "Skipped row without funder name.",
          raw: row as Json,
        });
      }
    });
  }
  return candidates;
}

function indexExistingFunders(existing: FunderRow[]): Map<string, FunderRow> {
  const index = new Map<string, FunderRow>();
  for (const funder of existing) {
    for (const key of funderKeys({ funder_id: funder.legacy_id ?? "" }, funder)) {
      if (!index.has(key)) index.set(key, funder);
    }
  }
  return index;
}

function indexExistingGrants(existing: GrantRow[]): Map<string, GrantRow> {
  const index = new Map<string, GrantRow>();
  for (const grant of existing) {
    for (const key of grantKeys({ detail_api_url: grant.source_url ?? "" }, grant)) {
      if (!index.has(key)) index.set(key, grant);
    }
  }
  return index;
}

function dedupeCandidates<T extends Candidate>(
  candidates: T[],
  existingIndex: Map<string, T["entity"] extends "grant" ? GrantRow : FunderRow>,
  dedupe: DedupeEntry[]
): Array<{ candidate: T; existing: GrantRow | FunderRow | null; duplicateReason: string | null }> {
  const seen = new Map<string, T>();
  const output: Array<{ candidate: T; existing: GrantRow | FunderRow | null; duplicateReason: string | null }> = [];

  for (const candidate of candidates) {
    const existingKey = candidate.keys.find((key) => existingIndex.has(key));
    if (existingKey) {
      const existing = existingIndex.get(existingKey) as GrantRow | FunderRow;
      output.push({ candidate, existing, duplicateReason: existingKey });
      dedupe.push({
        entity: candidate.entity,
        key: existingKey,
        action: "update_missing",
        reason: "Matched existing database record.",
        sourceZip: candidate.sourceZip,
        sourceFile: candidate.sourceFile,
        rowIndex: candidate.rowIndex,
        existingId: existing.id,
        displayName: candidate.entity === "grant" ? candidate.input.title : candidate.input.name,
      });
      continue;
    }
    const seenKey = candidate.keys.find((key) => seen.has(key));
    if (seenKey) {
      const first = seen.get(seenKey)!;
      output.push({ candidate, existing: null, duplicateReason: seenKey });
      dedupe.push({
        entity: candidate.entity,
        key: seenKey,
        action: "skip_duplicate",
        reason: `Duplicate within ZIP batch; first seen in ${first.sourceZip}/${first.sourceFile} row ${first.rowIndex}.`,
        sourceZip: candidate.sourceZip,
        sourceFile: candidate.sourceFile,
        rowIndex: candidate.rowIndex,
        existingId: null,
        displayName: candidate.entity === "grant" ? candidate.input.title : candidate.input.name,
      });
      continue;
    }
    candidate.keys.forEach((key) => seen.set(key, candidate));
    output.push({ candidate, existing: null, duplicateReason: null });
  }
  return output;
}

function linkGrantFunder(grant: GrantCandidate, funders: Array<{ candidate: FunderCandidate; row: FunderRow | null }>, existingFunders: FunderRow[]): void {
  const name = normalizeComparable(grant.input.funder_name);
  if (!name) return;
  const matchedNew = funders.find((item) => normalizeComparable(item.candidate.input.name) === name && item.row?.id);
  const matchedExisting = existingFunders.find((funder) => normalizeComparable(funder.name) === name);
  grant.input.funder_id = matchedNew?.row?.id ?? matchedExisting?.id ?? null;
}

async function importFunders(
  db: ReturnType<typeof buildClient>,
  mode: Mode,
  candidates: FunderCandidate[],
  existingFunders: FunderRow[],
  summary: Summary,
  dedupe: DedupeEntry[],
  errors: ImportError[]
): Promise<Array<{ candidate: FunderCandidate; row: FunderRow | null }>> {
  const deduped = dedupeCandidates(candidates, indexExistingFunders(existingFunders), dedupe);
  const rows: Array<{ candidate: FunderCandidate; row: FunderRow | null }> = [];
  for (const item of deduped) {
    if (item.duplicateReason && !item.existing) {
      summary.funders.skipped += 1;
      rows.push({ candidate: item.candidate, row: null });
      continue;
    }
    if (item.existing) {
      const updates = missingFunderFields(item.existing as FunderRow, item.candidate.input);
      if (Object.keys(updates).length > 0) {
        if (mode === "apply") {
          const result = await (db as any).from("funders").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", item.existing.id).select("*").single() as SupabaseResult<FunderRow>;
          if (result.error) {
            errors.push({ sourceZip: item.candidate.sourceZip, sourceFile: item.candidate.sourceFile, rowIndex: item.candidate.rowIndex, message: result.error.message, raw: item.candidate.raw as Json });
          } else {
            summary.funders.updated += 1;
            rows.push({ candidate: item.candidate, row: result.data });
          }
        } else {
          summary.funders.updated += 1;
          rows.push({ candidate: item.candidate, row: item.existing as FunderRow });
        }
      } else {
        summary.funders.skipped += 1;
        rows.push({ candidate: item.candidate, row: item.existing as FunderRow });
      }
      continue;
    }
    if (mode === "apply") {
      const result = await (db as any).from("funders").insert(item.candidate.input).select("*").single() as SupabaseResult<FunderRow>;
      if (result.error) {
        errors.push({ sourceZip: item.candidate.sourceZip, sourceFile: item.candidate.sourceFile, rowIndex: item.candidate.rowIndex, message: result.error.message, raw: item.candidate.raw as Json });
      } else {
        summary.funders.created += 1;
        rows.push({ candidate: item.candidate, row: result.data });
      }
    } else {
      summary.funders.created += 1;
      rows.push({ candidate: item.candidate, row: null });
    }
  }
  return rows;
}

async function importGrants(
  db: ReturnType<typeof buildClient>,
  mode: Mode,
  candidates: GrantCandidate[],
  projects: Map<string, ProjectRow | ProjectInsert>,
  funderRows: Array<{ candidate: FunderCandidate; row: FunderRow | null }>,
  existingFunders: FunderRow[],
  existingGrants: GrantRow[],
  summary: Summary,
  dedupe: DedupeEntry[],
  errors: ImportError[]
): Promise<Array<{ candidate: GrantCandidate; row: GrantRow | null }>> {
  candidates.forEach((candidate) => {
    const project = projects.get(candidate.sourceProject.slug);
    candidate.input.related_project_id = "id" in (project ?? {}) ? (project as ProjectRow).id : null;
    candidate.input.related_project_slug = candidate.sourceProject.slug;
    linkGrantFunder(candidate, funderRows, existingFunders);
  });

  const deduped = dedupeCandidates(candidates, indexExistingGrants(existingGrants), dedupe);
  const rows: Array<{ candidate: GrantCandidate; row: GrantRow | null }> = [];
  for (const item of deduped) {
    if (item.duplicateReason && !item.existing) {
      summary.opportunities.skipped += 1;
      rows.push({ candidate: item.candidate, row: null });
      continue;
    }
    if (item.existing) {
      const updates = missingGrantFields(item.existing as GrantRow, item.candidate.input);
      if (Object.keys(updates).length > 0) {
        if (mode === "apply") {
          const result = await (db as any).from("grants").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", item.existing.id).select("*").single() as SupabaseResult<GrantRow>;
          if (result.error) {
            errors.push({ sourceZip: item.candidate.sourceZip, sourceFile: item.candidate.sourceFile, rowIndex: item.candidate.rowIndex, message: result.error.message, raw: item.candidate.raw as Json });
          } else {
            summary.opportunities.updated += 1;
            rows.push({ candidate: item.candidate, row: result.data });
          }
        } else {
          summary.opportunities.updated += 1;
          rows.push({ candidate: item.candidate, row: item.existing as GrantRow });
        }
      } else {
        summary.opportunities.skipped += 1;
        rows.push({ candidate: item.candidate, row: item.existing as GrantRow });
      }
      continue;
    }
    if (mode === "apply") {
      const result = await (db as any).from("grants").insert(item.candidate.input).select("*").single() as SupabaseResult<GrantRow>;
      if (result.error) {
        errors.push({ sourceZip: item.candidate.sourceZip, sourceFile: item.candidate.sourceFile, rowIndex: item.candidate.rowIndex, message: result.error.message, raw: item.candidate.raw as Json });
      } else {
        summary.opportunities.created += 1;
        rows.push({ candidate: item.candidate, row: result.data });
      }
    } else {
      summary.opportunities.created += 1;
      rows.push({ candidate: item.candidate, row: null });
    }
  }
  return rows;
}

function docKey(input: Omit<DocumentInsert, "id" | "created_at" | "updated_at">): string {
  return [
    normalizeComparable(input.file_path ?? input.source_url ?? input.file_name ?? input.title),
    input.related_project_id ?? "",
    input.related_grant_id ?? "",
  ].join("|");
}

function candidateGrantForDocument(entry: string, grants: Array<{ candidate: GrantCandidate; row: GrantRow | null }>): GrantRow | null {
  const normalizedEntry = normalizeComparable(entry);
  const match = grants.find((grant) => {
    const grantId = normalizeComparable(pick(normalizeRow(grant.candidate.raw), ["grant_id", "opportunity_id", "instrumentl_grant_id"]));
    const title = normalizeComparable(grant.candidate.input.title);
    return Boolean(grant.row && ((grantId && normalizedEntry.includes(grantId)) || (title && normalizedEntry.includes(title))));
  });
  return match?.row ?? null;
}

async function registerDocuments(
  db: ReturnType<typeof buildClient>,
  mode: Mode,
  refs: Array<{ sourceZip: string; sourceFile: string; sourceProject: SourceProject }>,
  projects: Map<string, ProjectRow | ProjectInsert>,
  grantRows: Array<{ candidate: GrantCandidate; row: GrantRow | null }>,
  summary: Summary,
  dedupe: DedupeEntry[],
  errors: ImportError[]
): Promise<void> {
  const existingDocs = await selectAll<DocumentRow>(db, "documents");
  const existingKeys = new Set(existingDocs.map((doc) => docKey(doc)));
  const seen = new Set<string>();

  async function registerOne(input: Omit<DocumentInsert, "id" | "created_at" | "updated_at">, context: { sourceZip?: string; sourceFile?: string }): Promise<void> {
    const key = docKey(input);
    if (existingKeys.has(key) || seen.has(key)) {
      summary.documents.skipped += 1;
      dedupe.push({ entity: "document", key, action: "skip_duplicate", reason: "Document reference already exists or was seen in this run.", sourceZip: context.sourceZip, sourceFile: context.sourceFile });
      return;
    }
    seen.add(key);
    if (mode === "apply") {
      const result = await (db as any).from("documents").insert(input).select("*").single() as SupabaseResult<DocumentRow>;
      if (result.error) {
        errors.push({ sourceZip: context.sourceZip, sourceFile: context.sourceFile, message: result.error.message, raw: input as Json });
      } else {
        summary.documents.registered += 1;
      }
    } else {
      summary.documents.registered += 1;
    }
  }

  for (const ref of refs) {
    const project = projects.get(ref.sourceProject.slug);
    const projectId = project && "id" in project ? project.id : null;
    const linkedGrant = candidateGrantForDocument(ref.sourceFile, grantRows);
    const extension = path.extname(ref.sourceFile).toLowerCase();
    await registerOne({
      title: path.basename(ref.sourceFile),
      document_type: /guideline|application|opportunit|grant/u.test(ref.sourceFile.toLowerCase()) ? "grant_guidelines" : "general",
      file_name: path.basename(ref.sourceFile),
      file_path: path.join("import-data", "instrumentl-zips", ref.sourceZip, ref.sourceFile),
      file_url: null,
      source_url: null,
      mime_type: extension === ".pdf" ? "application/pdf" : null,
      file_size_bytes: null,
      extracted_text: null,
      extraction_status: extension === ".txt" || extension === ".md" ? "not_started" : "unsupported",
      extraction_error: null,
      metadata: {
        local_import_reference: true,
        source_zip: ref.sourceZip,
        source_file: ref.sourceFile,
        source_project_slug: ref.sourceProject.slug,
        storage_uploaded: false,
      } as Json,
      related_project_id: projectId,
      related_grant_id: linkedGrant?.id ?? null,
      related_funder_id: linkedGrant?.funder_id ?? null,
      related_application_id: null,
      uploaded_by: null,
      archived_at: null,
    }, { sourceZip: ref.sourceZip, sourceFile: ref.sourceFile });
  }

  for (const grant of grantRows) {
    const project = projects.get(grant.candidate.sourceProject.slug);
    const projectId = project && "id" in project ? project.id : null;
    const urls = [...new Set([
      ...(grant.candidate.input.required_documents ?? []),
      grant.candidate.input.application_url,
    ].filter((value): value is string => Boolean(value && /^https?:\/\//iu.test(value))))];
    for (const url of urls) {
      await registerOne({
        title: `${grant.candidate.input.title} source document`,
        document_type: "grant_guidelines",
        file_name: null,
        file_path: null,
        file_url: null,
        source_url: url,
        mime_type: null,
        file_size_bytes: null,
        extracted_text: null,
        extraction_status: "unsupported",
        extraction_error: null,
        metadata: {
          local_import_reference: false,
          source_zip: grant.candidate.sourceZip,
          source_file: grant.candidate.sourceFile,
          source_project_slug: grant.candidate.sourceProject.slug,
          source_url_from_row: true,
          storage_uploaded: false,
        } as Json,
        related_project_id: projectId,
        related_grant_id: grant.row?.id ?? null,
        related_funder_id: grant.row?.funder_id ?? grant.candidate.input.funder_id ?? null,
        related_application_id: null,
        uploaded_by: null,
        archived_at: null,
      }, { sourceZip: grant.candidate.sourceZip, sourceFile: grant.candidate.sourceFile });
    }
  }
}

function emptySummary(mode: Mode): Summary {
  return {
    mode,
    generated_at: new Date().toISOString(),
    input_dir: INPUT_DIR,
    output_dir: OUTPUT_DIR,
    zips_processed: [],
    projects: { created: 0, updated: 0, existing: 0, planned: 0 },
    opportunities: { raw_rows: 0, created: 0, updated: 0, skipped: 0, invalid: 0 },
    funders: { raw_rows: 0, created: 0, updated: 0, skipped: 0, invalid: 0 },
    documents: { registered: 0, skipped: 0 },
    duplicates_detected: 0,
    errors_count: 0,
    warnings: [],
    next_steps: [
      "Confirm migrations 011 and 012 have been applied.",
      "Open /dashboard/matching.",
      "Click Generate Matches.",
      "Review Top Matches, Ending Soon, Needs Review, and Saved Matches.",
      "Compare calibrated results with the external grant-fit report.",
    ],
  };
}

function writeReports(summary: Summary, errors: ImportError[], dedupe: DedupeEntry[]): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  summary.duplicates_detected = dedupe.filter((entry) => entry.action === "skip_duplicate" || entry.reason.includes("Matched existing")).length;
  summary.errors_count = errors.length;
  writeFileSync(path.join(OUTPUT_DIR, "instrumentl-import-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(path.join(OUTPUT_DIR, "instrumentl-import-errors.json"), `${JSON.stringify(errors, null, 2)}\n`);
  writeFileSync(path.join(OUTPUT_DIR, "instrumentl-dedupe-report.json"), `${JSON.stringify(dedupe, null, 2)}\n`);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const { mode, useServiceRole } = parseArgs();
  const summary = emptySummary(mode);
  const errors: ImportError[] = [];
  const dedupe: DedupeEntry[] = [];

  const parsed = parseZips(errors);
  summary.zips_processed = parsed.zips;
  summary.opportunities.raw_rows = parsed.parsedFiles.filter((file) => file.entity === "grant").reduce((sum, file) => sum + file.rows.length, 0);
  summary.funders.raw_rows = parsed.parsedFiles.filter((file) => file.entity === "funder").reduce((sum, file) => sum + file.rows.length, 0);

  const db = buildClient(useServiceRole);
  const projects = await ensureProjects(db, mode, summary);
  const existingFunders = await selectAll<FunderRow>(db, "funders");
  const existingGrants = await selectAll<GrantRow>(db, "grants");
  const candidates = buildCandidates(parsed.parsedFiles, errors);
  const funderCandidates = candidates.filter((candidate): candidate is FunderCandidate => candidate.entity === "funder");
  const grantCandidates = candidates.filter((candidate): candidate is GrantCandidate => candidate.entity === "grant");
  summary.funders.invalid = summary.funders.raw_rows - funderCandidates.length;
  summary.opportunities.invalid = summary.opportunities.raw_rows - grantCandidates.length;

  const funderRows = await importFunders(db, mode, funderCandidates, existingFunders, summary, dedupe, errors);
  const latestFunders = mode === "apply" ? await selectAll<FunderRow>(db, "funders") : existingFunders;
  const grantRows = await importGrants(db, mode, grantCandidates, projects, funderRows, latestFunders, existingGrants, summary, dedupe, errors);
  await registerDocuments(db, mode, parsed.documentRefs, projects, grantRows, summary, dedupe, errors);

  if (summary.zips_processed.length === 0) {
    summary.warnings.push("No configured ZIP files were processed. Check import-data/instrumentl-zips/ filenames.");
  }
  if (mode === "dry-run") {
    summary.warnings.push("Dry run only. No records were written to Supabase.");
  }
  writeReports(summary, errors, dedupe);

  console.log(JSON.stringify({
    mode,
    zips_processed: summary.zips_processed.length,
    raw_opportunity_rows: summary.opportunities.raw_rows,
    raw_funder_rows: summary.funders.raw_rows,
    grants: summary.opportunities,
    funders: summary.funders,
    documents: summary.documents,
    errors: errors.length,
    reports: {
      summary: path.join(OUTPUT_DIR, "instrumentl-import-summary.json"),
      errors: path.join(OUTPUT_DIR, "instrumentl-import-errors.json"),
      dedupe: path.join(OUTPUT_DIR, "instrumentl-dedupe-report.json"),
    },
    next_steps: summary.next_steps,
  }, null, 2));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, "instrumentl-import-errors.json"), `${JSON.stringify([{ message }], null, 2)}\n`);
  console.error(`[instrumentl-import] ${message}`);
  process.exit(1);
});
