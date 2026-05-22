import type {
  ApplicationRow,
  DocumentRow,
  FunderRow,
  GrantRow,
  MatchTierDb,
  ProjectRow,
  ProofItemRow,
  TaskRow,
} from "@/types/database";

export type MatchTier = MatchTierDb;

export type MatchingInput = {
  project: ProjectRow;
  grant: GrantRow;
  funder?: FunderRow | null;
  proofItems?: ProofItemRow[];
  tasks?: TaskRow[];
  applications?: ApplicationRow[];
  documents?: DocumentRow[];
};

export type MatchingResult = {
  matchScore: number;
  readinessScore: number;
  urgencyScore: number;
  evidenceScore: number;
  matchTier: MatchTier;
  fitReasons: string[];
  risks: string[];
  missingItems: string[];
  recommendedActions: string[];
};

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "but", "for", "from", "has", "have", "into",
  "its", "our", "that", "the", "their", "this", "through", "with", "your", "you",
  "grant", "grants", "funding", "program", "project", "projects", "support",
]);

const GLOBAL_TERMS = ["anywhere", "global", "international", "worldwide", "remote", "all locations"];
const US_TERMS = ["united states", "usa", "u.s.", "us ", "national", "north america"];
const NONPROFIT_TERMS = ["nonprofit", "non-profit", "501c3", "501(c)(3)", "charity", "foundation"];
const ORG_TERMS = ["organization", "community", "collective", "social enterprise", "startup", "company"];

function text(values: Array<unknown>): string {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function keywords(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
  );
}

function overlapScore(a: string, b: string, max: number): { score: number; terms: string[] } {
  const aWords = keywords(a);
  const bWords = keywords(b);
  const terms = [...aWords].filter((word) => bWords.has(word)).slice(0, 8);
  if (aWords.size === 0 || bWords.size === 0) return { score: Math.round(max * 0.35), terms };
  const ratio = terms.length / Math.min(aWords.size, bWords.size, 18);
  return { score: Math.min(max, Math.round(max * Math.min(1, ratio * 2.2))), terms };
}

function includesAny(value: string, terms: string[]): boolean {
  const normalized = normalize(value);
  return terms.some((term) => normalized.includes(normalize(term)));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseDeadline(grant: GrantRow): { date: Date | null; label: "date" | "rolling" | "unknown" } {
  const raw = (grant.deadline || grant.next_deadline || "").trim();
  if (!raw) return { date: null, label: "unknown" };
  if (/rolling|ongoing|open/i.test(raw)) return { date: null, label: "rolling" };
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? { date: null, label: "unknown" } : { date, label: "date" };
}

function deadlineScores(grant: GrantRow): { weighted: number; urgency: number; reason: string; risk?: string; action: string } {
  const deadline = parseDeadline(grant);
  if (deadline.label === "rolling") {
    return { weighted: 9, urgency: 55, reason: "Rolling or ongoing deadline.", action: "Confirm next review cycle and prepare a reusable application packet." };
  }
  if (!deadline.date) {
    return { weighted: 5, urgency: 35, reason: "Deadline is unknown.", risk: "Deadline needs review.", action: "Confirm the next deadline before prioritizing this opportunity." };
  }
  const days = Math.ceil((deadline.date.getTime() - Date.now()) / 86400000);
  if (days < 0) return { weighted: 1, urgency: 5, reason: "Deadline has passed.", risk: "Deadline appears to have passed.", action: "Skip unless a new cycle is available." };
  if (days <= 7) return { weighted: 8, urgency: 100, reason: `Deadline is within ${days} day${days === 1 ? "" : "s"}.`, risk: "Very short runway before deadline.", action: "Apply now only if eligibility and core proof are already ready." };
  if (days <= 30) return { weighted: 14, urgency: 90, reason: `Deadline is within ${days} days.`, action: "Prioritize eligibility review and application drafting this week." };
  if (days <= 60) return { weighted: 11, urgency: 65, reason: `Deadline is within ${days} days.`, action: "Start gathering proof and required documents." };
  return { weighted: 7, urgency: 30, reason: `Deadline is in ${days} days.`, action: "Keep on watchlist and review after nearer-deadline matches." };
}

function scoreGeography(project: ProjectRow, grant: GrantRow, reasons: string[], risks: string[]): number {
  const projectGeo = text([project.geography]);
  const grantGeo = text([grant.geography, grant.eligibility, grant.notes]);
  if (!grantGeo) {
    risks.push("Grant geography is unclear.");
    return 7;
  }
  if (includesAny(grantGeo, GLOBAL_TERMS)) {
    reasons.push("Grant geography appears broad or global.");
    return 15;
  }
  if (projectGeo && includesAny(grantGeo, US_TERMS) && includesAny(projectGeo, US_TERMS)) {
    reasons.push("Project and grant both appear eligible for United States or North America geography.");
    return 14;
  }
  const overlap = overlapScore(projectGeo, grantGeo, 15);
  if (overlap.score >= 9) reasons.push(`Geography overlaps on ${overlap.terms.slice(0, 3).join(", ")}.`);
  if (overlap.score < 6) risks.push("Geographic fit needs review.");
  return Math.max(projectGeo ? 4 : 6, overlap.score);
}

function scoreEligibility(project: ProjectRow, grant: GrantRow, reasons: string[], risks: string[], missing: string[]): number {
  const eligibility = text([grant.eligibility]);
  const projectText = text([project.name, project.summary, project.category, project.target_audience, project.grant_relevance]);
  if (!eligibility) {
    risks.push("Eligibility language is missing.");
    missing.push("Grant eligibility requirements");
    return 7;
  }
  if (includesAny(eligibility, NONPROFIT_TERMS) && !includesAny(projectText, NONPROFIT_TERMS)) {
    risks.push("Nonprofit or 501(c)(3) eligibility may need a fiscal sponsor or partner.");
    return 8;
  }
  if (includesAny(eligibility, ORG_TERMS)) {
    reasons.push("Eligibility appears compatible with organizations or community initiatives.");
    return 12;
  }
  risks.push("Applicant eligibility needs human review.");
  return 9;
}

function scoreEvidence(input: MatchingInput, reasons: string[], risks: string[], missing: string[]): { weighted: number; readiness: number; evidence: number } {
  const proofItems = input.proofItems ?? [];
  const docs = input.documents ?? [];
  const apps = input.applications ?? [];
  const tasks = input.tasks ?? [];
  const publicProof = proofItems.filter((item) => item.public_visibility).length;
  const completedTasks = tasks.filter((task) => task.status === "Complete").length;
  const openTasks = tasks.filter((task) => !["Complete", "Archived"].includes(task.status)).length;
  const hasExtractedDocs = docs.some((doc) => (doc.extracted_text ?? "").trim().length > 40);
  const hasApplication = apps.some((app) => app.grant_id === input.grant.id || app.project_id === input.project.id);

  let evidence = Math.min(45, proofItems.length * 12) + Math.min(15, publicProof * 5) + Math.min(20, docs.length * 8);
  if (hasExtractedDocs) evidence += 10;
  evidence = clamp(evidence);

  let readiness = evidence * 0.7 + Math.min(15, completedTasks * 4) - Math.min(15, openTasks * 2);
  if (hasApplication) readiness += 15;
  readiness = clamp(readiness);

  if (proofItems.length > 0) reasons.push(`${proofItems.length} linked proof item${proofItems.length === 1 ? "" : "s"} available.`);
  if (hasExtractedDocs) reasons.push("At least one linked document has extracted text.");
  if (!proofItems.length) {
    risks.push("No linked proof items found for the project.");
    missing.push("Project proof items");
  }
  if (!docs.length) missing.push("Linked supporting documents");
  if (openTasks > completedTasks + 2) risks.push("Several open tasks may reduce application readiness.");

  return { weighted: Math.round(readiness * 0.15), readiness, evidence };
}

export function calculateGrantMatch(input: MatchingInput): MatchingResult {
  const { project, grant, funder } = input;
  const fitReasons: string[] = [];
  const risks: string[] = [];
  const missingItems: string[] = [];
  const recommendedActions: string[] = [];

  const projectCauseText = text([
    project.name, project.summary, project.problem_statement, project.solution,
    project.target_audience, project.technology, project.impact, project.grant_relevance,
  ]);
  const grantCauseText = text([
    grant.title, grant.focus_areas, grant.eligibility, grant.notes,
    grant.required_documents, funder?.giving_areas, funder?.notes,
  ]);
  const cause = overlapScore(projectCauseText, grantCauseText, 25);
  if (cause.terms.length) fitReasons.push(`Topic overlap: ${cause.terms.slice(0, 5).join(", ")}.`);
  if (cause.score < 9) risks.push("Cause/topic overlap is weak based on available keywords.");

  const geography = scoreGeography(project, grant, fitReasons, risks);
  const eligibility = scoreEligibility(project, grant, fitReasons, risks, missingItems);

  const fundingUse = overlapScore(
    text([project.solution, project.technology, project.impact, project.reusable_grant_language, project.grant_relevance]),
    text([grant.focus_areas, grant.required_documents, grant.eligibility, grant.notes]),
    15
  );
  if (fundingUse.terms.length) fitReasons.push(`Funding-use language overlaps on ${fundingUse.terms.slice(0, 4).join(", ")}.`);
  if (fundingUse.score < 6) risks.push("Funding use fit is not clear from current grant fields.");

  const deadline = deadlineScores(grant);
  fitReasons.push(deadline.reason);
  if (deadline.risk) risks.push(deadline.risk);
  recommendedActions.push(deadline.action);

  const evidence = scoreEvidence(input, fitReasons, risks, missingItems);
  if (evidence.readiness < 50) recommendedActions.push("Add or link stronger proof before committing to a full application.");
  if (eligibility < 10) recommendedActions.push("Confirm applicant eligibility and fiscal sponsor requirements.");
  if (cause.score >= 16 && evidence.readiness >= 55) recommendedActions.push("Draft a short go/no-go note and assign an application owner.");

  const matchScore = clamp(cause.score + geography + eligibility + fundingUse.score + deadline.weighted + evidence.weighted);
  const readinessScore = evidence.readiness;
  const urgencyScore = deadline.urgency;
  const evidenceScore = evidence.evidence;
  const matchTier: MatchTier =
    matchScore >= 85 ? "best" :
    matchScore >= 72 ? "strong" :
    matchScore >= 60 ? "good" :
    matchScore >= 45 ? "maybe" :
    matchScore >= 25 ? "weak" :
    "needs_review";

  if (fitReasons.length === 0) fitReasons.push("Not enough structured data to explain a strong fit.");
  if (missingItems.length === 0 && readinessScore >= 65) fitReasons.push("Readiness looks workable based on linked proof and documents.");

  return {
    matchScore,
    readinessScore,
    urgencyScore,
    evidenceScore,
    matchTier,
    fitReasons: [...new Set(fitReasons)].slice(0, 8),
    risks: [...new Set(risks)].slice(0, 8),
    missingItems: [...new Set(missingItems)].slice(0, 8),
    recommendedActions: [...new Set(recommendedActions)].slice(0, 8),
  };
}
