import type {
  AgentNoteRow,
  AgentReportRow,
  ApplicationRow,
  DocumentRow,
  FunderRow,
  GrantRow,
  Json,
  MatchTierDb,
  ProjectRow,
  ProofItemRow,
  TaskRow,
} from "@/types/database";

export type MatchTier = MatchTierDb;
export type DecisionLabel = "apply_now" | "prepare_next" | "monitor" | "skip" | "track_next_cycle" | "needs_review";
export type DeadlineStatus = "due_today" | "past_due" | "active" | "rolling" | "unknown";
export type ScoreBreakdown = Record<string, { score: number; max: number }>;

export type MatchingInput = {
  project: ProjectRow;
  grant: GrantRow;
  funder?: FunderRow | null;
  proofItems?: ProofItemRow[];
  tasks?: TaskRow[];
  applications?: ApplicationRow[];
  documents?: DocumentRow[];
  agentNotes?: AgentNoteRow[];
  agentReports?: AgentReportRow[];
};

export type MatchingResult = {
  matchScore: number;
  readinessScore: number;
  urgencyScore: number;
  evidenceScore: number;
  matchTier: MatchTier;
  decisionLabel: DecisionLabel;
  deadlineStatus: DeadlineStatus;
  scoreBreakdown: ScoreBreakdown;
  dataQualityFlags: string[];
  fitReasons: string[];
  risks: string[];
  missingItems: string[];
  recommendedActions: string[];
};

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "but", "for", "from", "has", "have", "into",
  "its", "our", "that", "the", "their", "this", "through", "with", "your", "you",
  "application", "applications", "apply", "dataset", "export", "exported", "foundation",
  "funder", "funders", "funding", "grant", "grants", "imported", "instrumentl",
  "opportunities", "opportunity", "playa", "program", "project", "projects", "public",
  "row", "source", "support",
]);

const GLOBAL_TERMS = ["anywhere", "global", "international", "worldwide", "remote", "all locations"];
const US_TERMS = ["united states", "usa", "u.s.", "us ", "national", "north america"];
const NONPROFIT_TERMS = ["nonprofit", "non-profit", "501c3", "501(c)(3)", "tax exempt", "registered charity", "charity", "foundation"];
const UNIVERSITY_TERMS = ["university", "academic institution", "college", "research institution"];
const GOVERNMENT_TERMS = ["government agency", "municipality", "public agency", "state agency", "federal agency"];
const FISCAL_SPONSOR_TERMS = ["fiscal sponsor", "fiscally sponsored"];
const INVITE_ONLY_TERMS = ["invite only", "invitation only", "by invitation"];
const DOT_ORG_TERMS = [".org", "dot org"];
const INDIVIDUAL_TERMS = ["individual", "artists", "researchers"];
const ORG_TERMS = ["organization", "community", "collective", "social enterprise", "startup", "company"];
const APPLICATION_MATERIAL_TERMS = ["problem statement", "solution", "impact", "budget", "team", "demo", "screenshot", "metric", "legal", "eligibility", "fiscal sponsor"];
const HEALTHCARE_SPECIAL_CASE_TERMS = [
  "nih",
  "national institutes of health",
  "health human services",
  "health & human services",
  "brain initiative",
  "clinical trial not allowed",
  "clinical trial",
  "r01",
  "r03",
  "r18",
  "r21",
  "neuroscience",
  "nervous system",
  "biomedical",
  "patient",
  "patients",
  "hospital",
  "disease",
  "treatment",
  "medical research",
  "healthcare safety",
  "wearable devices",
];
const PROJECT_HEALTHCARE_RESEARCH_TERMS = [
  "clinical research",
  "healthcare",
  "neuroscience",
  "biomedical",
  "patient",
  "hospital",
  "medical research",
  "clinical trial",
  "disease treatment",
];

// Calibration invariant: NIH/BRAIN/R01/R03 clinical grants against non-healthcare
// Playa AI projects must finish at <= 49, not strong/best, with decision_label=skip.
// Human-connection opportunities such as MIT Solve should not trigger this override.

const STRATEGIC_KEYWORDS = {
  high: [
    "ai", "artificial intelligence", "responsible ai", "human connection", "loneliness", "belonging",
    "social isolation", "relationship", "relationships", "relational ai", "social trust",
    "civic trust", "community wellbeing", "community well being", "mental well being",
    "mental wellbeing", "digital well being", "digital wellbeing", "future of work",
    "workplace belonging", "learning communities", "social cohesion", "ai for humanity",
    "human centered ai", "human centred ai", "social impact technology", "public benefit technology",
    "public benefit data", "nonprofit technology", "community infrastructure",
  ],
  medium: [
    "community", "technology", "digital inclusion", "social cohesion", "pluralism", "trust",
    "education", "research", "innovation", "wellbeing", "well being",
  ],
  lower: ["arts", "exhibition", "performance", "curatorial", "healthcare safety", "neuroscience", "government program", "speaker program", "leadership exchange"],
  artsSignals: ["art", "arts", "artist", "art science", "installation", "exhibition", "performance", "creative", "cultural", "participatory"],
  healthcareSignals: HEALTHCARE_SPECIAL_CASE_TERMS,
  healthcareProjectSignals: PROJECT_HEALTHCARE_RESEARCH_TERMS,
  governmentSignals: ["government program", "public sector", "civil service", "speaker program", "leadership exchange"],
};

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
  const terms = [...aWords].filter((word) => bWords.has(word) && !isNoiseTerm(word)).slice(0, 8);
  if (aWords.size === 0 || bWords.size === 0) return { score: Math.round(max * 0.35), terms };
  const ratio = terms.length / Math.min(aWords.size, bWords.size, 18);
  return { score: Math.min(max, Math.round(max * Math.min(1, ratio * 2.2))), terms };
}

function isNoiseTerm(term: string): boolean {
  const normalized = normalize(term);
  if (!normalized) return true;
  const parts = normalized.split(" ");
  return STOP_WORDS.has(normalized) || parts.some((part) => STOP_WORDS.has(part));
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

function deadlineScores(grant: GrantRow): { weighted: number; urgency: number; status: DeadlineStatus; days: number | null; reason: string; risk?: string; action: string } {
  const deadline = parseDeadline(grant);
  if (deadline.label === "rolling") {
    return { weighted: 10, urgency: 45, status: "rolling", days: null, reason: "Rolling deadline.", action: "Confirm next review cycle and prepare a reusable application packet." };
  }
  if (!deadline.date) {
    return { weighted: 5, urgency: 30, status: "unknown", days: null, reason: "Deadline unknown.", risk: "Deadline needs review.", action: "Confirm the next deadline before prioritizing this opportunity." };
  }
  const days = Math.ceil((deadline.date.getTime() - Date.now()) / 86400000);
  if (days < 0) return { weighted: 1, urgency: 5, status: "past_due", days, reason: `Past due by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}.`, risk: "Deadline appears to have passed.", action: "Track the next cycle unless the fit is weak or eligibility is blocked." };
  if (days === 0) return { weighted: 7, urgency: 100, status: "due_today", days, reason: "Due today.", risk: "Deadline is today.", action: "Submit only if eligibility and core materials are already ready." };
  if (days <= 7) return { weighted: 8, urgency: 95, status: "active", days, reason: `${days} day${days === 1 ? "" : "s"} left.`, risk: "Very short runway before deadline.", action: "Prepare only if the application is already drafted." };
  if (days <= 30) return { weighted: 15, urgency: 85, status: "active", days, reason: `${days} days left.`, action: "Prioritize eligibility review and application drafting this week." };
  if (days <= 60) return { weighted: 12, urgency: 60, status: "active", days, reason: `${days} days left.`, action: "Start gathering proof and required documents." };
  return { weighted: 8, urgency: 25, status: "active", days, reason: `${days} days left.`, action: "Keep on watchlist and review after nearer-deadline matches." };
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

function scoreEligibility(project: ProjectRow, grant: GrantRow, funder: FunderRow | null | undefined, reasons: string[], risks: string[], missing: string[]): { score: number; blockingRisk: boolean; unclear: boolean } {
  const eligibility = text([grant.eligibility, grant.notes, funder?.notes]);
  const projectText = text([project.name, project.summary, project.category, project.target_audience, project.grant_relevance]);
  if (!eligibility) {
    risks.push("Eligibility language is missing.");
    risks.push("Applicant type is unclear.");
    missing.push("Grant eligibility requirements");
    return { score: 7, blockingRisk: false, unclear: true };
  }
  let score = 12;
  let blockingRisk = false;
  let unclear = false;
  if (includesAny(eligibility, NONPROFIT_TERMS) && !includesAny(projectText, NONPROFIT_TERMS.concat(FISCAL_SPONSOR_TERMS))) {
    risks.push("Nonprofit or fiscal sponsor eligibility may need confirmation.");
    score -= 4;
    unclear = true;
  }
  if (includesAny(eligibility, UNIVERSITY_TERMS) && !includesAny(projectText, UNIVERSITY_TERMS)) {
    risks.push("University/academic eligibility may be required.");
    score -= 5;
    blockingRisk = true;
  }
  if (includesAny(eligibility, GOVERNMENT_TERMS) && !includesAny(projectText, GOVERNMENT_TERMS)) {
    risks.push("Government agency eligibility may be required.");
    score -= 6;
    blockingRisk = true;
  }
  if (includesAny(eligibility, INVITE_ONLY_TERMS)) {
    risks.push("Invite-only language detected.");
    score -= 6;
    blockingRisk = true;
  }
  if (includesAny(eligibility, DOT_ORG_TERMS) && !includesAny(projectText, DOT_ORG_TERMS)) {
    risks.push(".ORG eligibility may need confirmation.");
    score -= 3;
    unclear = true;
  }
  if (includesAny(eligibility, INDIVIDUAL_TERMS)) {
    reasons.push("Eligibility appears to allow individual applicants or broad applicant types.");
    score += 1;
  }
  if (includesAny(eligibility, ORG_TERMS)) {
    reasons.push("Eligibility appears compatible with organizations or community initiatives.");
    score += 1;
  }
  if (score < 10 && !blockingRisk) risks.push("Applicant eligibility needs human review.");
  return { score: Math.max(3, Math.min(15, score)), blockingRisk, unclear };
}

function scoreReadiness(input: MatchingInput, reasons: string[], risks: string[], missing: string[]): { weighted: number; readiness: number; evidence: number } {
  const proofItems = input.proofItems ?? [];
  const docs = input.documents ?? [];
  const apps = input.applications ?? [];
  const tasks = input.tasks ?? [];
  const agentNotes = input.agentNotes ?? [];
  const agentReports = input.agentReports ?? [];
  const publicProof = proofItems.filter((item) => item.public_visibility).length;
  const completedTasks = tasks.filter((task) => task.status === "Complete").length;
  const openTasks = tasks.filter((task) => !["Complete", "Archived"].includes(task.status)).length;
  const hasExtractedDocs = docs.some((doc) => (doc.extracted_text ?? "").trim().length > 40);
  const hasApplication = apps.some((app) => app.grant_id === input.grant.id || app.project_id === input.project.id);
  const readinessText = text([
    input.project.problem_statement, input.project.solution, input.project.impact, input.project.reusable_grant_language,
    ...proofItems.flatMap((item) => [item.title, item.description, item.grant_relevance, item.tags]),
    ...docs.flatMap((doc) => [doc.title, doc.extracted_text]),
    ...apps.flatMap((app) => [app.title, app.notes]),
    ...agentNotes.flatMap((note) => [note.title, note.content]),
    ...agentReports.flatMap((report) => [report.title, report.content]),
  ]);

  const projectFields = [
    input.project.summary,
    input.project.problem_statement,
    input.project.solution,
    input.project.target_audience,
    input.project.geography,
    input.project.technology,
    input.project.impact,
    input.project.grant_relevance,
  ];
  const profileScore = Math.round((projectFields.filter((value) => Boolean(value && value.trim())).length / projectFields.length) * 20);
  const proofScore = Math.min(25, proofItems.length * 8 + publicProof * 3);
  const documentScore = Math.min(15, docs.length * 4 + (hasExtractedDocs ? 7 : 0));
  const applicationScore = hasApplication ? Math.min(15, 8 + apps.filter((app) => app.status !== "Not Started").length * 4) : 0;
  const taskScore = tasks.length ? Math.max(0, Math.min(10, completedTasks * 3 + Math.max(0, 4 - openTasks))) : 4;
  const noteScore = Math.min(10, agentNotes.length * 3 + agentReports.length * 5);
  const materialScore = Math.min(5, APPLICATION_MATERIAL_TERMS.filter((term) => includesAny(readinessText, [term])).length);

  const readiness = clamp(profileScore + proofScore + documentScore + applicationScore + taskScore + noteScore + materialScore);
  const evidence = clamp(proofScore * 2.2 + documentScore * 1.8 + noteScore * 1.5 + materialScore * 3);

  if (proofItems.length > 0) reasons.push(`${proofItems.length} linked proof item${proofItems.length === 1 ? "" : "s"} available.`);
  if (hasExtractedDocs) reasons.push("At least one linked document has extracted text.");
  if (hasApplication) reasons.push("Application workspace exists for this project or grant.");
  if (agentNotes.length || agentReports.length) reasons.push("Agent notes or reports provide extra readiness context.");
  if (!proofItems.length) {
    risks.push("No linked proof items found for the project.");
    missing.push("Project proof items");
    missing.push("Demo/screenshots");
    missing.push("Impact metrics");
  }
  if (!docs.length) {
    missing.push("Linked supporting documents");
    missing.push("Grant guidelines or source document");
  }
  if (!input.project.problem_statement) missing.push("Project brief or problem statement");
  if (!input.project.impact) missing.push("Impact metrics");
  if (!includesAny(readinessText, ["budget"])) missing.push("Budget narrative");
  if (!includesAny(readinessText, ["legal", "eligibility", "fiscal sponsor"])) missing.push("Confirmed legal applicant or fiscal sponsor");
  if (!input.project.reusable_grant_language) missing.push("Reusable application answers");
  if (openTasks > completedTasks + 2) risks.push("Several open tasks may reduce application readiness.");

  return { weighted: Math.round(readiness * 0.15), readiness, evidence };
}

function strategicTopicScore(projectText: string, grantText: string, reasons: string[], risks: string[]): {
  score: number;
  terms: string[];
  clinicalSpecialCase: boolean;
  artsSpecialCase: boolean;
  governmentSpecialCase: boolean;
} {
  const overlap = overlapScore(projectText, grantText, 25);
  const normalizedProject = normalize(projectText);
  const normalizedGrant = normalize(grantText);
  const high = STRATEGIC_KEYWORDS.high.filter((term) => normalizedProject.includes(normalize(term)) && normalizedGrant.includes(normalize(term)));
  const medium = STRATEGIC_KEYWORDS.medium.filter((term) => normalizedProject.includes(normalize(term)) && normalizedGrant.includes(normalize(term)));
  const lower = STRATEGIC_KEYWORDS.lower.filter((term) => normalizedGrant.includes(normalize(term)));
  const projectHasArts = includesAny(projectText, STRATEGIC_KEYWORDS.artsSignals);
  const projectHasHealthcare = includesAny(projectText, STRATEGIC_KEYWORDS.healthcareProjectSignals);
  const projectHasGovernment = includesAny(projectText, STRATEGIC_KEYWORDS.governmentSignals);
  const clinicalSpecialCase = includesAny(grantText, STRATEGIC_KEYWORDS.healthcareSignals) && !projectHasHealthcare;
  const artsSpecialCase =
    includesAny(grantText, STRATEGIC_KEYWORDS.artsSignals) &&
    !projectHasArts &&
    !includesAny(grantText, ["technology", "community", "participatory", "social connection", "human connection"]);
  const governmentSpecialCase = includesAny(grantText, STRATEGIC_KEYWORDS.governmentSignals) && !projectHasGovernment;

  let score = overlap.score + Math.min(9, high.length * 4) + Math.min(4, medium.length * 2);
  if (high.length) reasons.push(`Strategic fit on ${high.slice(0, 3).join(", ")}.`);
  if (artsSpecialCase || (lower.length && !projectHasArts && lower.some((term) => STRATEGIC_KEYWORDS.artsSignals.includes(term)))) {
    score -= 7;
    risks.push("Arts or cultural language detected; fit depends on an explicit arts/community-installation framing.");
  }
  if (clinicalSpecialCase) {
    score -= 14;
    risks.push("Healthcare, NIH, clinical, or neuroscience framing appears special-case for this project.");
  }
  if (governmentSpecialCase) {
    score -= 7;
    risks.push("Government, speaker, or leadership-program framing appears special-case.");
  }

  return {
    score: Math.max(0, Math.min(25, score)),
    terms: [...new Set([...high, ...medium, ...overlap.terms])].slice(0, 8),
    clinicalSpecialCase,
    artsSpecialCase,
    governmentSpecialCase,
  };
}

function addDataQualityFlags(input: MatchingInput, risks: string[], missing: string[]): string[] {
  const { project, grant } = input;
  const flags: string[] = [];
  if (!grant.eligibility) flags.push("Match score may be unreliable because eligibility data is missing.");
  if (!grant.focus_areas?.length) flags.push("Grant details are sparse because focus/cause areas are missing.");
  if (!grant.deadline && !grant.next_deadline) flags.push("Grant details are sparse because deadline data is missing.");
  if (!grant.amount_display && !grant.amount_min && !grant.amount_max) flags.push("Grant details are sparse because award amount data is missing.");
  if (!grant.notes && !grant.focus_areas?.length && !grant.eligibility) flags.push("Grant details are sparse; verify official source before applying.");
  if (!project.problem_statement || !project.solution || !project.impact || !project.geography) flags.push("Project profile is incomplete, so readiness may be underestimated.");
  if (!(input.proofItems ?? []).length) flags.push("Project has no linked proof items, so readiness may be underestimated.");
  flags.forEach((flag) => {
    if (flag.includes("missing") || flag.includes("sparse")) risks.push(flag);
    missing.push(flag);
  });
  return [...new Set(flags)];
}

function decideLabel(params: {
  matchScore: number;
  readinessScore: number;
  deadlineStatus: DeadlineStatus;
  days: number | null;
  eligibilityBlockingRisk: boolean;
  eligibilityUnclear: boolean;
  dataQualityFlags: string[];
  clinicalSpecialCase: boolean;
}): DecisionLabel {
  const { matchScore, readinessScore, deadlineStatus, days, eligibilityBlockingRisk, eligibilityUnclear, dataQualityFlags, clinicalSpecialCase } = params;
  if (clinicalSpecialCase) return matchScore >= 45 ? "needs_review" : "skip";
  if (deadlineStatus === "past_due") return matchScore >= 60 ? "track_next_cycle" : "skip";
  if (matchScore < 35 && eligibilityBlockingRisk) return "skip";
  if (dataQualityFlags.length >= 3 || eligibilityUnclear) return "needs_review";
  if (deadlineStatus === "unknown") return "needs_review";
  if (deadlineStatus === "due_today") return readinessScore >= 75 && matchScore >= 70 ? "apply_now" : "needs_review";
  if (days !== null && days <= 7 && readinessScore < 65) return matchScore >= 70 ? "prepare_next" : "monitor";
  if (matchScore >= 75 && readinessScore >= 60 && (deadlineStatus === "active" || deadlineStatus === "rolling")) return "apply_now";
  if (matchScore >= 70 && readinessScore < 60 && (days === null || days > 7)) return "prepare_next";
  if (matchScore >= 55 && (deadlineStatus === "rolling" || days === null || days > 30)) return "monitor";
  if (matchScore < 45 && eligibilityBlockingRisk) return "skip";
  if (matchScore < 45) return "monitor";
  return "needs_review";
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
  const grantFullText = text([
    grant.title,
    grant.funder_name,
    grant.focus_areas,
    grant.eligibility,
    grant.notes,
    grant.required_documents,
    funder?.name,
    funder?.notes,
  ]);
  const projectFullText = text([
    project.name,
    project.summary,
    project.problem_statement,
    project.solution,
    project.target_audience,
    project.technology,
    project.impact,
    project.grant_relevance,
  ]);
  const healthcareSpecialCase = includesAny(grantFullText, HEALTHCARE_SPECIAL_CASE_TERMS);
  const projectIsHealthcareResearch = includesAny(projectFullText, PROJECT_HEALTHCARE_RESEARCH_TERMS);
  const cause = strategicTopicScore(projectCauseText, grantCauseText, fitReasons, risks);
  const cleanCauseTerms = cause.terms.filter((term) => !isNoiseTerm(term));
  if (cleanCauseTerms.length) fitReasons.push(`Topic overlap: ${cleanCauseTerms.slice(0, 5).join(", ")}.`);
  if (cause.score < 9) risks.push("Cause/topic overlap is weak based on available keywords.");

  const geography = scoreGeography(project, grant, fitReasons, risks);
  const eligibility = scoreEligibility(project, grant, funder, fitReasons, risks, missingItems);

  const fundingUse = overlapScore(
    text([project.solution, project.technology, project.impact, project.reusable_grant_language, project.grant_relevance]),
    text([grant.focus_areas, grant.required_documents, grant.eligibility, grant.notes]),
    15
  );
  if (cause.clinicalSpecialCase) fundingUse.score = Math.max(0, fundingUse.score - 6);
  if (cause.artsSpecialCase) fundingUse.score = Math.max(0, fundingUse.score - 4);
  if (fundingUse.terms.length) fitReasons.push(`Funding-use language overlaps on ${fundingUse.terms.slice(0, 4).join(", ")}.`);
  if (fundingUse.score < 6) risks.push("Funding use fit is not clear from current grant fields.");

  const deadline = deadlineScores(grant);
  fitReasons.push(deadline.reason);
  if (deadline.risk) risks.push(deadline.risk);
  recommendedActions.push(deadline.action);

  const evidence = scoreReadiness(input, fitReasons, risks, missingItems);
  const dataQualityFlags = addDataQualityFlags(input, risks, missingItems);
  if (evidence.readiness < 50) recommendedActions.push("Add proof items, a demo/screenshots, impact metrics, and a project brief before committing to a full application.");
  if (eligibility.score < 10) recommendedActions.push("Confirm applicant eligibility and fiscal sponsor requirements.");
  if (deadline.status === "past_due") recommendedActions.push("Look for the next application cycle before investing more time.");
  if (deadline.status === "due_today" && evidence.readiness < 75) recommendedActions.push("Treat as too late unless a full draft and required proof already exist.");
  if (cause.score >= 16 && evidence.readiness >= 55) recommendedActions.push("Draft a short go/no-go note and assign an application owner.");

  const scoreBreakdown: ScoreBreakdown = {
    topic_fit: { score: cause.score, max: 25 },
    geography: { score: geography, max: 15 },
    eligibility: { score: cause.clinicalSpecialCase ? Math.max(0, eligibility.score - 5) : eligibility.score, max: 15 },
    funding_use: { score: fundingUse.score, max: 15 },
    deadline: { score: deadline.weighted, max: 15 },
    evidence: { score: evidence.weighted, max: 15 },
  };
  let matchScore = clamp(Object.values(scoreBreakdown).reduce((sum, item) => sum + item.score, 0));
  const readinessScore = evidence.readiness;
  const urgencyScore = deadline.urgency;
  const evidenceScore = evidence.evidence;
  let matchTier: MatchTier =
    matchScore >= 85 ? "best" :
    matchScore >= 72 ? "strong" :
    matchScore >= 60 ? "good" :
    matchScore >= 45 ? "maybe" :
    matchScore >= 25 ? "weak" :
    "needs_review";
  let decisionLabel = decideLabel({
    matchScore,
    readinessScore,
    deadlineStatus: deadline.status,
    days: deadline.days,
    eligibilityBlockingRisk: eligibility.blockingRisk,
    eligibilityUnclear: eligibility.unclear,
    dataQualityFlags,
    clinicalSpecialCase: cause.clinicalSpecialCase,
  });

  if (healthcareSpecialCase && !projectIsHealthcareResearch) {
    matchScore = Math.min(matchScore, 49);
    matchTier = matchScore >= 40 ? "maybe" : "weak";
    decisionLabel = "skip";
    risks.push("Healthcare, NIH, clinical, or neuroscience framing is a special-case mismatch for Playa AI unless the project is deliberately reframed as healthcare/neuroscience research.");
    missingItems.push("Healthcare/neuroscience research framing and eligible research applicant");
    recommendedActions.push("Skip unless Playa AI is deliberately reframed as a healthcare/neuroscience research project with an eligible research partner.");
  }
  if (decisionLabel === "skip") recommendedActions.push("Skip unless the project can be reframed to meet the eligibility and focus requirements.");
  if (decisionLabel === "track_next_cycle") recommendedActions.push("Track the next cycle and reuse this match as a planning reference.");
  if (decisionLabel === "prepare_next") recommendedActions.push("Prepare reusable application answers and close readiness gaps before the deadline window tightens.");

  if (fitReasons.length === 0) fitReasons.push("Not enough structured data to explain a strong fit.");
  if (missingItems.length === 0 && readinessScore >= 65) fitReasons.push("Readiness looks workable based on linked proof and documents.");

  return {
    matchScore,
    readinessScore,
    urgencyScore,
    evidenceScore,
    matchTier,
    decisionLabel,
    deadlineStatus: deadline.status,
    scoreBreakdown: scoreBreakdown as Json as ScoreBreakdown,
    dataQualityFlags: [...new Set(dataQualityFlags)].slice(0, 8),
    fitReasons: [...new Set(fitReasons)].slice(0, 8),
    risks: [...new Set(risks)].slice(0, 8),
    missingItems: [...new Set(missingItems)].slice(0, 8),
    recommendedActions: [...new Set(recommendedActions)].slice(0, 8),
  };
}
