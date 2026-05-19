import type { FunderInsert, GrantDbStatus, GrantInsert, Json } from "@/types/database";
import type {
  FunderImportCandidate,
  GrantImportCandidate,
  ImportType,
  RawImportRow,
} from "./importTypes";

const GRANT_STATUSES: GrantDbStatus[] = [
  "Planned",
  "Researching",
  "Applying",
  "Submitted",
  "Awarded",
  "Declined",
  "Archived",
];

export const GRANT_KNOWN_KEYS = [
  "grant_name",
  "opportunity_name",
  "title",
  "funder_name",
  "deadline",
  "next_deadline_date",
  "next_deadline",
  "amount",
  "award_amount",
  "amount_display",
  "amount_min",
  "min_amount",
  "amount_max",
  "max_amount",
  "summary",
  "overview",
  "overview_full",
  "cause_areas",
  "focus_areas",
  "geography",
  "location",
  "locations",
  "eligibility",
  "application_url",
  "public_url",
  "source_url",
  "instrumentl_url",
  "required_documents",
  "status",
];

export const FUNDER_KNOWN_KEYS = [
  "name",
  "funder_name",
  "ein",
  "website",
  "location",
  "city_state",
  "address",
  "phone",
  "total_assets",
  "assets",
  "total_giving",
  "annual_giving",
  "median_grant_amount",
  "giving_areas",
  "cause_areas",
  "giving_rate_to_new_grantees",
  "openness",
  "openness_to_new_grantees",
  "key_people",
  "notes",
  "raw_summary",
];

export function importTypeToEntity(importType: ImportType): "grant" | "funder" {
  return importType.includes("funder") ? "funder" : "grant";
}

export function normalizeKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeRow(row: RawImportRow): RawImportRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
}

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function pick(row: RawImportRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = cleanString(row[key]);
    if (value) return value;
  }
  return null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/u)?.[0];
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter((item): item is string => Boolean(item));
  }

  const asString = cleanString(value);
  if (!asString) return [];

  try {
    const parsed = JSON.parse(asString) as unknown;
    if (Array.isArray(parsed)) return parseStringArray(parsed);
  } catch {
    // Fall through to delimiter parsing.
  }

  return asString
    .split(/\n|;|,/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonValue(value: unknown): Json | null {
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

function pickArray(row: RawImportRow, keys: string[]): string[] {
  for (const key of keys) {
    const parsed = parseStringArray(row[key]);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

function normalizeStatus(value: string | null): GrantDbStatus {
  if (!value) return "Researching";
  const normalized = value.trim().toLowerCase();
  return GRANT_STATUSES.find((status) => status.toLowerCase() === normalized) ?? "Researching";
}

export function mapInstrumentlGrant(row: RawImportRow): GrantImportCandidate {
  const normalized = normalizeRow(row);
  const amountDisplay = pick(normalized, ["amount", "award_amount", "amount_display"]);
  const input: Omit<GrantInsert, "id" | "created_at" | "updated_at"> = {
    title: pick(normalized, ["grant_name", "opportunity_name", "title"]) ?? "",
    funder_name: pick(normalized, ["funder_name"]),
    deadline: pick(normalized, ["deadline", "next_deadline_date"]),
    next_deadline: pick(normalized, ["next_deadline", "next_deadline_date"]),
    amount_display: amountDisplay,
    amount_min: parseNumber(pick(normalized, ["amount_min", "min_amount"])),
    amount_max: parseNumber(pick(normalized, ["amount_max", "max_amount"])),
    notes: pick(normalized, ["summary", "overview", "overview_full"]),
    focus_areas: pickArray(normalized, ["cause_areas", "focus_areas"]),
    geography: pick(normalized, ["geography", "location", "locations"]),
    eligibility: pick(normalized, ["eligibility"]),
    application_url: pick(normalized, ["application_url", "public_url"]),
    source_url: pick(normalized, ["source_url", "instrumentl_url", "public_url"]),
    required_documents: pickArray(normalized, ["required_documents"]),
    status: normalizeStatus(pick(normalized, ["status"])),
    is_top_three: false,
  };

  return { entity: "grant", input, raw: row };
}

export function mapInstrumentlFunder(row: RawImportRow): FunderImportCandidate {
  const normalized = normalizeRow(row);
  const input: Omit<FunderInsert, "id" | "created_at" | "updated_at"> = {
    name: pick(normalized, ["name", "funder_name"]) ?? "",
    ein: pick(normalized, ["ein"]),
    website: pick(normalized, ["website"]),
    location: pick(normalized, ["location", "city_state"]),
    address: pick(normalized, ["address"]),
    phone: pick(normalized, ["phone"]),
    assets: parseNumber(pick(normalized, ["total_assets", "assets"])),
    annual_giving: parseNumber(pick(normalized, ["total_giving", "annual_giving"])),
    median_grant_amount: parseNumber(pick(normalized, ["median_grant_amount"])),
    giving_areas: pickArray(normalized, ["giving_areas", "cause_areas"]),
    openness_to_new_grantees: pick(normalized, [
      "giving_rate_to_new_grantees",
      "openness",
      "openness_to_new_grantees",
    ]),
    key_people: parseJsonValue(normalized.key_people),
    notes: pick(normalized, ["notes", "raw_summary"]),
    open_applications: false,
    past_grantees: [],
  };

  return { entity: "funder", input, raw: row };
}

export function knownKeysForImportType(importType: ImportType): string[] {
  return importTypeToEntity(importType) === "grant" ? GRANT_KNOWN_KEYS : FUNDER_KNOWN_KEYS;
}

export function collectUnknownColumns(rows: RawImportRow[], importType: ImportType): string[] {
  const known = new Set(knownKeysForImportType(importType));
  const columns = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const normalized = normalizeKey(key);
      if (!known.has(normalized)) columns.add(key);
    });
  });
  return Array.from(columns).sort();
}
