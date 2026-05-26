export const APP_ROLES = ["Admin", "Grant Lead", "Contributor", "Viewer"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type WritableTable =
  | "projects"
  | "proof_items"
  | "grants"
  | "funders"
  | "peer_organizations"
  | "peer_funding_records"
  | "applications"
  | "application_questions"
  | "application_required_documents"
  | "tasks"
  | "custom_fields"
  | "documents"
  | "agent_notes"
  | "agent_reports"
  | "agent_activity_logs"
  | "grant_matches"
  | "grant_shortlist_items";

const CONTRIBUTOR_CREATABLE: WritableTable[] = [
  "proof_items",
  "application_questions",
  "application_required_documents",
  "tasks",
  "agent_notes",
  "agent_reports",
  "agent_activity_logs",
  "documents",
  "grant_shortlist_items",
];

const CONTRIBUTOR_UPDATABLE: WritableTable[] = [
  ...CONTRIBUTOR_CREATABLE,
  "applications",
];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

export function canWrite(role: AppRole | null | undefined): boolean {
  return role === "Admin" || role === "Grant Lead";
}

export function canContribute(role: AppRole | null | undefined): boolean {
  return canWrite(role) || role === "Contributor";
}

export function isViewer(role: AppRole | null | undefined): boolean {
  return role === "Viewer";
}

export function isAdmin(role: AppRole | null | undefined): boolean {
  return role === "Admin";
}

export function canCreateTable(
  role: AppRole | null | undefined,
  table: WritableTable
): boolean {
  if (!role) return false;
  if (canWrite(role)) return true;
  if (role === "Contributor") {
    return CONTRIBUTOR_CREATABLE.includes(table);
  }
  return false;
}

export function canUpdateTable(
  role: AppRole | null | undefined,
  table: WritableTable
): boolean {
  if (!role) return false;
  if (canWrite(role)) return true;
  if (role === "Contributor") {
    return CONTRIBUTOR_UPDATABLE.includes(table);
  }
  return false;
}

/** @deprecated Use canCreateTable or canUpdateTable for finer control */
export function canWriteTable(
  role: AppRole | null | undefined,
  table: WritableTable
): boolean {
  return canCreateTable(role, table);
}

export function canDeleteRecords(role: AppRole | null | undefined): boolean {
  return canWrite(role);
}
