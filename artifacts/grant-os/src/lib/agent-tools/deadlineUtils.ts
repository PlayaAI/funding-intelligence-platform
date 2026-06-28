export type DeadlineStatus = "upcoming" | "due_today" | "expired" | "unknown";

export interface UrgencyInfo {
  deadline: string | null;
  deadline_status: DeadlineStatus;
  days_until_deadline: number | null;
}

export function computeUrgency(deadline: string | null | undefined): UrgencyInfo {
  if (!deadline) {
    return { deadline: null, deadline_status: "unknown", days_until_deadline: null };
  }
  
  const parsed = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { deadline, deadline_status: "unknown", days_until_deadline: null };
  }
  
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
