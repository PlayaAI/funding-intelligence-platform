export type DeadlineStatus = "upcoming" | "due_today" | "expired" | "unknown";

export interface UrgencyInfo {
  deadline: string | null;
  deadline_status: DeadlineStatus;
  days_until_deadline: number | null;
}

/**
 * Compute deadline urgency from a deadline string.
 *
 * Accepts both:
 *   - Date-only strings:     "2026-06-16"
 *   - Full ISO timestamps:   "2026-06-16T23:59:00.000Z"
 *
 * Previously only date-only strings were handled. Full ISO timestamps were
 * concatenated as "${iso}T00:00:00Z" → invalid date → "unknown".
 */
export function computeUrgency(deadline: string | null | undefined): UrgencyInfo {
  if (!deadline) {
    return { deadline: null, deadline_status: "unknown", days_until_deadline: null };
  }

  let parsed: Date;

  // If the string already contains a time component (indicated by 'T'), parse it
  // directly. Otherwise, treat it as a date-only string and anchor to midnight UTC
  // to avoid timezone-shift surprises.
  if (deadline.includes("T")) {
    parsed = new Date(deadline);
  } else {
    parsed = new Date(`${deadline}T00:00:00Z`);
  }

  if (Number.isNaN(parsed.getTime())) {
    return { deadline, deadline_status: "unknown", days_until_deadline: null };
  }

  // Compare at day granularity in UTC so "2026-06-16T23:59:00.000Z" counts as
  // June 16th, not June 17th, and a grant due today is never reported as expired.
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const days = Math.ceil((target - today) / 86_400_000);

  let status: DeadlineStatus;
  if (days < 0) {
    status = "expired";
  } else if (days === 0) {
    status = "due_today";
  } else {
    status = "upcoming";
  }

  return { deadline, days_until_deadline: days, deadline_status: status };
}
