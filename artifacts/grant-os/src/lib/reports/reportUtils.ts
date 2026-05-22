import type { GrantMatchDecisionLabelDb, GrantMatchRow, Json } from "@/types/database";

export type DeadlineWindow = "all" | "today" | "7" | "14" | "30" | "60" | "rolling" | "past" | "unknown";

export function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function formatGrantAmount(grant: { amount_display?: string | null; amount_min?: number | null; amount_max?: number | null }): string {
  if (grant.amount_display) return grant.amount_display;
  if (grant.amount_min && grant.amount_max) return `${formatCurrency(grant.amount_min)}–${formatCurrency(grant.amount_max)}`;
  if (grant.amount_max) return `Up to ${formatCurrency(grant.amount_max)}`;
  if (grant.amount_min) return formatCurrency(grant.amount_min);
  return "—";
}

export function jsonStringArray(value: Json | unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function decisionLabelText(value?: GrantMatchDecisionLabelDb | null): string {
  const labels: Record<GrantMatchDecisionLabelDb, string> = {
    apply_now: "Apply Now",
    prepare_next: "Prepare Next",
    monitor: "Monitor",
    skip: "Skip",
    track_next_cycle: "Track Next Cycle",
    needs_review: "Needs Review",
  };
  return value ? labels[value] : "Not generated";
}

export function decisionBadgeClass(value?: GrantMatchDecisionLabelDb | null): string {
  switch (value) {
    case "apply_now":
      return "bg-green-50 text-green-700 border-green-200";
    case "prepare_next":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "monitor":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "skip":
      return "bg-red-50 text-red-700 border-red-200";
    case "track_next_cycle":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "needs_review":
      return "bg-violet-50 text-violet-700 border-violet-200";
    default:
      return "bg-slate-50 text-slate-500 border-slate-200";
  }
}

export function deadlineInfo(grant: { deadline?: string | null; next_deadline?: string | null }): {
  status: DeadlineWindow;
  label: string;
  days: number | null;
  date: Date | null;
} {
  const raw = (grant.deadline || grant.next_deadline || "").trim();
  if (!raw) return { status: "unknown", label: "Unknown", days: null, date: null };
  if (/rolling|ongoing|open/i.test(raw)) return { status: "rolling", label: "Rolling", days: null, date: null };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { status: "unknown", label: "Unknown", days: null, date: null };
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return { status: "past", label: `Past due by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, days, date };
  if (days === 0) return { status: "today", label: "Due today", days, date };
  return { status: "all", label: `${days} days left`, days, date };
}

export function deadlineWindowForDays(days: number | null, status: DeadlineWindow): DeadlineWindow {
  if (status === "rolling" || status === "past" || status === "unknown" || status === "today") return status;
  if (days === null) return "unknown";
  if (days <= 7) return "7";
  if (days <= 14) return "14";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return "all";
}

export function matchTopRisk(match?: GrantMatchRow | null): string {
  return jsonStringArray(match?.risks).at(0) ?? "—";
}

export function matchTopAction(match?: GrantMatchRow | null): string {
  return jsonStringArray(match?.recommended_actions).at(0) ?? "—";
}

export function isActiveGrant(status: string): boolean {
  return !["Awarded", "Declined", "Archived"].includes(status);
}
