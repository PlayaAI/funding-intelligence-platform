export type FactStatus = "approved" | "needs_confirmation" | "background_only";
export type InitiativeStatus = "built" | "tested" | "planned" | "conceptual" | "needs_confirmation";
export type ProofStatus = "missing" | "needed" | "available" | "needs_confirmation";
export type RecommendationRule = "apply_now" | "prepare_first" | "monitor" | "skip";

export interface KnowledgeFact {
  label: string;
  value: string;
  status: FactStatus;
  note?: string;
}

export interface ProjectAngle {
  code: string;
  name: string;
  focus: string;
  bestFor: string[];
  summary: string;
  recommendedLanguage: string[];
  evidenceNeeded: string[];
  claimsToAvoid: string[];
}

export interface Initiative {
  name: string;
  status: InitiativeStatus;
  description: string;
  grantUsefulness: string;
  evidenceStatus: string;
  claimSafety: string;
}

export interface ProofItemNeed {
  name: string;
  status: ProofStatus;
  relatedProjectAngle: string;
  whyItMatters: string;
}

export const briefing = {
  safeDescription:
    "Playa AI is a public-benefit initiative building human-centered AI tools and research infrastructure for human connection, belonging, social trust, responsible AI, and community wellbeing. It uses cultural and community contexts as living labs for testing relational AI, ethical governance, public-interest data, and connection tools.",
  mission:
    "Build public-benefit AI systems that strengthen human connection, belonging, trust, and community wellbeing.",
  problem:
    "Social technology and AI systems often optimize extraction, scale, or engagement without enough attention to social health, consent, governance, and community trust.",
  solution:
    "Develop and test responsible relational AI tools, community governance practices, and consent-first research infrastructure through Grant OS-backed projects.",
  longTermVision:
    "A governed, noncommercial social connection infrastructure layer that helps communities use AI for human flourishing, civic trust, and public-interest research.",
  currentStage:
    "Early production MVP and grant-readiness stage with tested prototypes, community activity, fiscal sponsorship, and evidence collection still in progress.",
  agentsShouldKnowFirst: [
    "Use funder-safe language by default.",
    "Separate built, tested, planned, and conceptual work.",
    "Treat fiscal sponsorship as distinct from independent 501(c)(3) status.",
    "Do not claim formal institutional partnerships unless a source record confirms them.",
    "Prioritize proof items before recommending apply_now.",
  ],
};

export const approvedFacts: KnowledgeFact[] = [
  { label: "Founded", value: "October 2024", status: "approved" },
  { label: "Fiscal sponsorship", value: "Mystic Arts Foundation", status: "approved", note: "Do not describe this as independent 501(c)(3) status." },
  { label: "Current product/prototype", value: "Connect App MVP", status: "approved" },
  { label: "User testing", value: "Approximately 80 users", status: "needs_confirmation", note: "Use approximate language until a test summary is linked." },
  { label: "Community activity", value: "150+ group calls and 150+ Telegram/community members", status: "needs_confirmation", note: "Needs a transcript index or activity snapshot." },
  { label: "Website", value: "Playa-AI.org", status: "approved" },
  { label: "Operational system", value: "Grant OS", status: "approved" },
  { label: "Current internal tooling", value: "agent/MCP workflow, Replit, Claude, Mission Control HQ, and related tools", status: "background_only", note: "Useful context, not usually funder-facing evidence." },
];

export const projectAngles: ProjectAngle[] = [
  {
    code: "A",
    name: "Playa AI Foundation",
    focus: "Governance, ethics, fiscal sponsorship, public-benefit structure, community stewardship, and responsible AI.",
    bestFor: ["ethical AI", "governance", "public-benefit technology", "nonprofit/fiscal-sponsor readiness", "community infrastructure"],
    summary: "The organizational and governance home for Playa AI's public-benefit work.",
    recommendedLanguage: ["public-benefit AI initiative", "community stewardship", "responsible governance", "fiscal sponsorship pathway"],
    evidenceNeeded: ["fiscal sponsorship agreement", "governance notes", "Playa AI Accord / Guidelines", "team and advisor bios"],
    claimsToAvoid: ["independent 501(c)(3) status", "formal institutional partnerships without proof", "unsupported board or VIP claims"],
  },
  {
    code: "B",
    name: "Playa AI Tech for Human Flourish",
    focus: "Human connection tools, responsible relational AI, belonging, digital wellbeing, and workplace/learning community wellbeing.",
    bestFor: ["human flourishing", "loneliness", "belonging", "responsible AI", "future of work", "social wellbeing"],
    summary: "The product and research angle for using AI to improve connection and social health.",
    recommendedLanguage: ["human-centered AI tools", "responsible relational AI", "belonging infrastructure", "social health"],
    evidenceNeeded: ["Connect App screenshots", "user feedback logs", "80-user test summary", "project roadmap"],
    claimsToAvoid: ["clinical outcomes", "mature healthcare evidence", "biometric impacts without a confirmed study"],
  },
  {
    code: "C",
    name: "Playa AI Decommodified Dataset",
    focus: "Public-interest data, decommodified social graph, responsible AI research, data sovereignty, and noncommercial social connection infrastructure.",
    bestFor: ["open data", "digital commons", "data governance", "AI alignment", "public-interest technology", "research infrastructure"],
    summary: "The data-governance angle for consent-first, noncommercial research infrastructure.",
    recommendedLanguage: ["governed data commons", "consent-first research", "public-interest data infrastructure", "data sovereignty"],
    evidenceNeeded: ["dataset concept note", "consent model", "governance guidelines", "research roadmap"],
    claimsToAvoid: ["completed dataset", "pure human data", "biometric dataset availability", "AI alignment breakthroughs"],
  },
  {
    code: "D",
    name: "Playa AI Democracy 2.0 Initiatives",
    focus: "Civic trust, pluralism, community dialogue, social cohesion, deliberative democracy, and responsible AI for civic life.",
    bestFor: ["democracy", "civic tech", "pluralism", "polarization reduction", "community dialogue", "trust"],
    summary: "The civic life angle for applying responsible AI to trust, dialogue, and social cohesion.",
    recommendedLanguage: ["civic trust", "pluralistic dialogue", "community dialogue tools", "social cohesion"],
    evidenceNeeded: ["dialogue session notes", "participant feedback", "use case briefs", "partner interest records"],
    claimsToAvoid: ["government mandate", "top-down control", "formal civic partnerships without confirmation"],
  },
  {
    code: "E",
    name: "Playa AI Art / Science",
    focus: "Creative technology, public engagement, art/science collaborations, participatory experiences, and installations as research containers.",
    bestFor: ["art/science", "creative technology", "public engagement", "cultural innovation", "community learning"],
    summary: "The cultural innovation angle for using participatory experiences to test and explain responsible AI.",
    recommendedLanguage: ["participatory art/science research", "creative technology", "public engagement", "community learning"],
    evidenceNeeded: ["installation concepts", "public engagement notes", "Socratic dialogue videos", "AI Art Grants concept brief"],
    claimsToAvoid: ["physical Oracle cube built/deployed", "official Burning Man support", "speculative spiritual claims"],
  },
];

export const initiatives: Initiative[] = [
  {
    name: "Connect App MVP",
    status: "tested",
    description: "A working prototype for helping people make more intentional human connections.",
    grantUsefulness: "Strong evidence anchor for human connection, belonging, and responsible relational AI grants.",
    evidenceStatus: "Needs screenshots, user feedback logs, and a concise test summary.",
    claimSafety: "Safe to call an MVP/prototype; avoid broad impact claims without linked evidence.",
  },
  {
    name: "Relationship Assistant / Elevation Co-pilot",
    status: "planned",
    description: "Assistant concept for helping users reflect, connect, and improve relationship quality.",
    grantUsefulness: "Useful for responsible AI, future of work, learning communities, and wellbeing proposals.",
    evidenceStatus: "Needs roadmap, product brief, and prototype evidence before strong claims.",
    claimSafety: "Describe as planned unless build evidence exists.",
  },
  {
    name: "Connect Protocol",
    status: "conceptual",
    description: "Protocol idea for consent-first, community-centered connection infrastructure.",
    grantUsefulness: "Useful for digital commons, social infrastructure, and data governance frames.",
    evidenceStatus: "Needs concept note and governance model.",
    claimSafety: "Use as a concept, not deployed infrastructure.",
  },
  {
    name: "Oracle concept",
    status: "conceptual",
    description: "Participatory AI installation concept for dialogue, reflection, and community sensemaking.",
    grantUsefulness: "Useful for art/science, public engagement, and cultural innovation grants.",
    evidenceStatus: "Needs concept deck, prototype proof, or installation plan.",
    claimSafety: "Do not claim the physical Oracle cube is built or deployed.",
  },
  {
    name: "Burner Bot",
    status: "needs_confirmation",
    description: "Community-facing bot concept or tool associated with Playa AI community workflows.",
    grantUsefulness: "May support community infrastructure or public engagement applications.",
    evidenceStatus: "Needs demo, launch record, or operating proof.",
    claimSafety: "Do not overstate until build and usage evidence is linked.",
  },
  {
    name: "Playa Bot Squad",
    status: "needs_confirmation",
    description: "Operating group or workflow for community AI helpers.",
    grantUsefulness: "Could support agent operations, community stewardship, and learning infrastructure grants.",
    evidenceStatus: "Needs operating evidence and team roles.",
    claimSafety: "Use internally unless confirmed for funder-facing claims.",
  },
  {
    name: "Playa AI Accord / Guidelines",
    status: "planned",
    description: "Governance and safety guidelines for responsible AI use in the Playa AI ecosystem.",
    grantUsefulness: "Strong fit for ethics, governance, and public-benefit technology proposals.",
    evidenceStatus: "Needs current document or approved draft.",
    claimSafety: "Safe as draft/guidelines if source document exists.",
  },
  {
    name: "Collective Awareness Dataset concept",
    status: "conceptual",
    description: "Concept for public-interest, consent-first research data related to social connection and community awareness.",
    grantUsefulness: "Useful for data commons, research infrastructure, and responsible AI grants.",
    evidenceStatus: "Needs concept note, consent model, and governance plan.",
    claimSafety: "Do not claim the dataset is complete.",
  },
  {
    name: "AI Art Grants concept",
    status: "conceptual",
    description: "Grantmaking or program concept for AI-enabled art/science and public engagement work.",
    grantUsefulness: "Useful for arts, cultural innovation, and participatory research funders.",
    evidenceStatus: "Needs program brief, budget, and governance plan.",
    claimSafety: "Describe as a concept until funded or formally launched.",
  },
];

export const matchingRules = {
  strongFitThemes: [
    "ethical AI",
    "responsible AI",
    "AI alignment",
    "loneliness / social health",
    "belonging",
    "civic trust",
    "pluralism",
    "art/science collaboration",
    "open data",
    "digital commons",
    "public-interest technology",
    "community infrastructure",
    "human flourishing",
    "social cohesion",
  ],
  weakFitThemes: [
    "immediate commercial ROI",
    "purely traditional healthcare delivery",
    "top-down government control",
    "grants requiring mature clinical evidence",
    "grants requiring completed biometric datasets",
    "grants requiring official institutional partnerships that are not confirmed",
  ],
  scoring: [
    { label: "Fit score", guidance: "How directly the grant theme matches a Playa AI project angle." },
    { label: "Urgency score", guidance: "Deadline proximity and current opportunity timing." },
    { label: "Effort score", guidance: "How much missing evidence or application work is needed." },
    { label: "Strategic value score", guidance: "Funder importance, partnership potential, and credibility." },
    { label: "Readiness score", guidance: "Existing proof, documents, eligibility clarity, application workspace, and team capacity." },
  ],
  recommendations: [
    { rule: "apply_now" as RecommendationRule, guidance: "Strong fit, deadline soon, enough proof, eligibility clear." },
    { rule: "prepare_first" as RecommendationRule, guidance: "Strong fit but missing proof, budget, eligibility, or study design." },
    { rule: "monitor" as RecommendationRule, guidance: "Good funder but no active call or timing is wrong." },
    { rule: "skip" as RecommendationRule, guidance: "Weak fit, high risk, unsupported claims required, or not aligned." },
  ],
};

export const readinessRules = {
  requiredBeforeApplyNow: [
    "grant eligibility notes captured",
    "correct Playa AI project angle selected",
    "application workspace exists or is recommended",
    "at least 2-3 proof items linked to the project",
    "budget or budget range exists",
    "current team lead confirmed",
    "claims are approved or clearly flagged",
    "required documents identified",
    "deadline and submission process understood",
  ],
  standardApplicationPackage: [
    "01 - START HERE",
    "02 - ACTIVE APPLICATION",
    "03 - GRANT SOURCE MATERIALS",
    "04 - SHARED PLAYA AI SOURCE MATERIALS",
    "05 - BACKGROUND ONLY - DO NOT USE DIRECTLY",
    "06 - REVIEW AND APPROVAL",
  ],
};

export const proofItemsNeeded: ProofItemNeed[] = [
  { name: "Connect App MVP screenshots", status: "needed", relatedProjectAngle: "Tech for Human Flourish", whyItMatters: "Shows the prototype exists and gives reviewers concrete product evidence." },
  { name: "Connect App user feedback logs", status: "needed", relatedProjectAngle: "Tech for Human Flourish", whyItMatters: "Supports user testing and learning claims." },
  { name: "Approximate 80-user test summary", status: "needs_confirmation", relatedProjectAngle: "Tech for Human Flourish", whyItMatters: "Turns approximate usage into funder-safe evidence." },
  { name: "150+ group calls summary or transcript index", status: "needs_confirmation", relatedProjectAngle: "Foundation", whyItMatters: "Substantiates community activity and participatory learning." },
  { name: "Telegram/community activity snapshot", status: "needs_confirmation", relatedProjectAngle: "Foundation", whyItMatters: "Supports community engagement claims." },
  { name: "Fiscal sponsorship agreement with Mystic Arts Foundation", status: "needed", relatedProjectAngle: "Foundation", whyItMatters: "Clarifies eligibility and nonprofit channel." },
  { name: "Playa AI vision document", status: "needed", relatedProjectAngle: "Foundation", whyItMatters: "Gives agents approved strategic language." },
  { name: "Playa AI Accord / Guidelines", status: "needed", relatedProjectAngle: "Foundation", whyItMatters: "Strengthens governance and responsible AI proposals." },
  { name: "Project roadmaps", status: "needed", relatedProjectAngle: "All angles", whyItMatters: "Shows feasibility, milestones, and responsible staging." },
  { name: "Lisbon launch notes", status: "needs_confirmation", relatedProjectAngle: "Art / Science", whyItMatters: "Could support public engagement and launch activity." },
  { name: "Socratic dialogue videos from London/Lisbon", status: "needs_confirmation", relatedProjectAngle: "Democracy 2.0 / Art Science", whyItMatters: "Evidence for dialogue formats and community learning." },
  { name: "Burner Bot demo or launch proof", status: "needs_confirmation", relatedProjectAngle: "Art / Science", whyItMatters: "Prevents agents from overstating bot readiness." },
  { name: "Playa Bot Squad operating evidence", status: "needs_confirmation", relatedProjectAngle: "Foundation", whyItMatters: "Supports internal capacity and community AI operations." },
  { name: "Team/advisor bios", status: "needed", relatedProjectAngle: "All angles", whyItMatters: "Improves credibility and eligibility packages." },
  { name: "Budget templates", status: "needed", relatedProjectAngle: "All angles", whyItMatters: "Reduces application effort and improves readiness scoring." },
  { name: "Project one-pagers", status: "needed", relatedProjectAngle: "All angles", whyItMatters: "Helps agents match opportunities quickly and safely." },
];

export const riskyClaims = {
  doNotUseWithoutApproval: [
    "machine with soul",
    "Conscious Intelligence as the main grant frame",
    "mothering AI",
    "pure human data",
    "superintelligence born from burners",
    "planetary nervous system",
    "AI with a soul",
    "vibration",
    "rapture of the techies",
    "biometric/EEG/HRV claims unless tied to a confirmed study",
    "formal Burning Man partnership unless confirmed",
    "501(c)(3) status unless confirmed",
    "physical Oracle cube built/deployed",
    "Collective Awareness Dataset completed",
    "VIP board member claims unless confirmed",
    "official support from Burning Man Org unless confirmed",
  ],
  saferAlternatives: [
    "human-centered AI",
    "responsible relational AI",
    "public-benefit technology",
    "governed data commons",
    "consent-first research",
    "community-driven governance",
    "human connection infrastructure",
    "social health",
    "belonging",
    "digital commons",
    "noncommercial social connection infrastructure",
  ],
};

export const dailyInstructions = {
  scan: [
    "find new grants matching Playa AI themes",
    "check upcoming deadlines",
    "check grants with prepare_first status",
    "check applications missing proof items",
    "check projects with no proof items",
    "check funders with strong fit but missing warm leads",
    "generate a daily report",
    "suggest tasks, but do not create them unless approved",
    "never submit applications or send outreach without approval",
  ],
  reportFormat: [
    "Top grants to focus on today",
    "Deadlines in next 7 / 14 / 30 / 60 days",
    "Applications blocked by missing evidence",
    "Recommended project angle for each grant",
    "Missing facts/questions for Alex",
    "Suggested tasks",
    "Safety/risk flags",
  ],
};

export const operatingRules = {
  should: [
    "prioritize approved facts",
    "use background-only materials only for context",
    "flag unsupported claims",
    "separate built vs planned",
    "ask for human approval before writes",
    "use dry-run for write_safe tools by default",
    "cite source records when possible",
    "create clear next steps",
    "avoid speculative language in funder-facing output",
  ],
  never: [
    "submit applications",
    "send outreach",
    "invent partnerships",
    "invent metrics",
    "claim formal nonprofit status unless verified",
    "claim built technology that is only conceptual",
    "use spiritual/speculative language in grant drafts unless specifically approved",
    "mutate production data without human approval",
  ],
};
