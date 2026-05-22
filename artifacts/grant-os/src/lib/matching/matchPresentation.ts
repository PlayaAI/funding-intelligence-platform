import type { GrantMatchDecisionLabelDb, GrantMatchDeadlineStatusDb, Json } from "@/types/database";

export const DECISION_LABELS: Record<GrantMatchDecisionLabelDb, string> = {
  apply_now: "Apply Now",
  prepare_next: "Prepare Next",
  monitor: "Monitor",
  skip: "Skip",
  track_next_cycle: "Track Next Cycle",
  needs_review: "Needs Review",
};

export const DECISION_CLASSES: Record<GrantMatchDecisionLabelDb, string> = {
  apply_now: "bg-emerald-50 text-emerald-700 border-emerald-200",
  prepare_next: "bg-blue-50 text-blue-700 border-blue-200",
  monitor: "bg-slate-100 text-slate-700 border-slate-200",
  skip: "bg-red-50 text-red-700 border-red-200",
  track_next_cycle: "bg-amber-50 text-amber-700 border-amber-200",
  needs_review: "bg-violet-50 text-violet-700 border-violet-200",
};

export const DEADLINE_STATUS_LABELS: Record<GrantMatchDeadlineStatusDb, string> = {
  due_today: "Due today",
  past_due: "Past due",
  active: "Active deadline",
  rolling: "Rolling deadline",
  unknown: "Deadline unknown",
};

export type ScoreBreakdownItem = {
  key: string;
  label: string;
  score: number;
  max: number;
};

const SCORE_LABELS: Record<string, string> = {
  topic_fit: "Topic fit",
  geography: "Geography",
  eligibility: "Eligibility",
  funding_use: "Funding use",
  deadline: "Deadline",
  evidence: "Evidence",
};

export function jsonStringArray(value: Json | unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function scoreBreakdownItems(value: Json | unknown): ScoreBreakdownItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const item = raw as Record<string, unknown>;
      const score = typeof item.score === "number" ? item.score : Number(item.score ?? 0);
      const max = typeof item.max === "number" ? item.max : Number(item.max ?? 0);
      if (!Number.isFinite(score) || !Number.isFinite(max)) return null;
      return { key, label: SCORE_LABELS[key] ?? key.replace(/_/g, " "), score, max };
    })
    .filter((item): item is ScoreBreakdownItem => Boolean(item));
}

export function deadlineLanguage(value?: string | null): { label: string; days: number | null; status: GrantMatchDeadlineStatusDb } {
  if (!value) return { label: "Deadline unknown", days: null, status: "unknown" };
  if (/rolling|ongoing|open/i.test(value)) return { label: "Rolling deadline", days: null, status: "rolling" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: "Deadline unknown", days: null, status: "unknown" };
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `Past due by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, days, status: "past_due" };
  if (days === 0) return { label: "Due today", days, status: "due_today" };
  return { label: `${days} days left`, days, status: "active" };
}
