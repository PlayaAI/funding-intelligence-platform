import type { GrantOsRepository } from "./repository";
import type { ToolAuditPayload } from "./types";
import type { AgentKnowledgeItem, AgentKnowledgeUpdate } from "../agentKnowledgeService";
import type { GrantMatchWithRelations } from "../matching/matchesService";
import type {
  AgentActivityLogRow,
  AgentNoteRow,
  AgentReportRow,
  ApplicationInsert,
  ApplicationQuestionRow,
  ApplicationRequiredDocumentRow,
  ApplicationRow,
  DocumentRow,
  FunderRow,
  GrantDbStatus,
  GrantRow,
  PeerFundingRecordRow,
  PeerOrganizationRow,
  ProjectRow,
  ProofItemRow,
  TaskDbStatus,
  TaskRow,
} from "../../types/database";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string, n: number) {
  return `${prefix}-${n}`;
}

type SeedState = {
  grants: GrantRow[];
  funders: FunderRow[];
  documents: DocumentRow[];
  projects: ProjectRow[];
  proofItems: ProofItemRow[];
  applications: ApplicationRow[];
  applicationQuestions: ApplicationQuestionRow[];
  applicationRequiredDocuments: ApplicationRequiredDocumentRow[];
  tasks: TaskRow[];
  peers: PeerOrganizationRow[];
  peerFundingRecords: PeerFundingRecordRow[];
  agentNotes: AgentNoteRow[];
  agentReports: AgentReportRow[];
  grantMatches: GrantMatchWithRelations[];
  shortlistItems: Array<Record<string, unknown>>;
  audits: ToolAuditPayload[];
  agentKnowledgeItems: AgentKnowledgeItem[];
  agentKnowledgeUpdates: AgentKnowledgeUpdate[];
};

function seed(): SeedState {
  return {
    grants: [
      {
        id: "grant-1", title: "MIT Solve Challenge", funder_id: "funder-1", funder_name: "MIT Solve", related_project_id: "project-1", related_project_slug: "playa-ai-art-science", deadline: "2026-08-01", next_deadline: null, amount_min: 10000, amount_max: 75000, amount_display: "$10K-$75K", focus_areas: ["AI", "Democracy"], geography: "Global", eligibility: null, application_url: "https://example.org/mit-apply", source_url: "https://example.org/mit-source", required_documents: ["Budget", "Narrative"], application_questions: null, status: "Researching", priority: null, fit_score: null, priority_score: null, difficulty_score: null, proof_readiness: null, application_readiness: null, is_top_three: false, notes: null, archived_at: null, created_at: now(), updated_at: now(),
      },
      {
        id: "grant-2", title: "Open Philanthropy AI Governance RFP", funder_id: "funder-2", funder_name: "Open Philanthropy", related_project_id: null, related_project_slug: null, deadline: null, next_deadline: null, amount_min: 200000, amount_max: 2000000, amount_display: "$200K-$2M", focus_areas: ["AI Governance"], geography: "US", eligibility: null, application_url: "https://example.org/op-apply", source_url: "https://example.org/op-source", required_documents: [], application_questions: null, status: "Planned", priority: null, fit_score: null, priority_score: null, difficulty_score: null, proof_readiness: null, application_readiness: null, is_top_three: false, notes: null, archived_at: null, created_at: now(), updated_at: now(),
      },
      {
        id: "grant-archived", title: "Archived Grant", funder_id: null, funder_name: null, related_project_id: null, related_project_slug: null, deadline: null, next_deadline: null, amount_min: null, amount_max: null, amount_display: null, focus_areas: [], geography: null, eligibility: null, application_url: null, source_url: null, required_documents: [], application_questions: null, status: "Archived", priority: null, fit_score: null, priority_score: null, difficulty_score: null, proof_readiness: null, application_readiness: null, is_top_three: false, notes: null, archived_at: now(), created_at: now(), updated_at: now(),
      },
    ],
    funders: [
      { id: "funder-1", legacy_id: null, name: "MIT Solve", slug: "mit-solve", website: "https://solve.mit.edu", ein: null, location: "US", address: null, phone: null, contact_info: null, key_people: null, assets: null, annual_giving: null, median_grant_amount: null, giving_areas: ["AI"], openness_to_new_grantees: null, relationship_status: null, past_grantees: [], open_applications: true, notes: null, archived_at: null, created_at: now(), updated_at: now() },
      { id: "funder-2", legacy_id: null, name: "Open Philanthropy", slug: "open-philanthropy", website: "https://openphilanthropy.org", ein: null, location: "US", address: null, phone: null, contact_info: null, key_people: null, assets: null, annual_giving: null, median_grant_amount: null, giving_areas: ["AI Governance"], openness_to_new_grantees: null, relationship_status: null, past_grantees: [], open_applications: true, notes: null, archived_at: null, created_at: now(), updated_at: now() },
    ],
    documents: [
      { id: "doc-1", title: "MIT Solve Guidelines", document_type: "grant_guidelines", file_name: null, file_path: null, file_url: null, source_url: "https://example.org/mit-guidelines", mime_type: null, file_size_bytes: null, extracted_text: null, extraction_status: "not_started", extraction_error: null, metadata: null, related_project_id: null, related_grant_id: "grant-1", related_funder_id: "funder-1", related_application_id: null, uploaded_by: null, archived_at: null, created_at: now(), updated_at: now() },
      { id: "doc-2", title: "Application Draft", document_type: "application_form", file_name: null, file_path: null, file_url: null, source_url: "https://example.org/app-draft", mime_type: null, file_size_bytes: null, extracted_text: null, extraction_status: "not_started", extraction_error: null, metadata: null, related_project_id: null, related_grant_id: null, related_funder_id: null, related_application_id: "app-1", uploaded_by: null, archived_at: null, created_at: now(), updated_at: now() },
    ],
    projects: [
      { id: "project-1", organization_id: null, name: "Playa AI Art / Science", slug: "playa-ai-art-science", summary: null, problem_statement: null, solution: null, target_audience: null, geography: null, stage: null, technology: null, impact: null, reusable_grant_language: null, category: null, grant_relevance: null, featured: false, public_visibility: true, archived_at: null, created_at: now(), updated_at: now() },
      { id: "project-2", organization_id: null, name: "Playa AI Democracy", slug: "playa-ai-democracy", summary: null, problem_statement: null, solution: null, target_audience: null, geography: null, stage: null, technology: null, impact: null, reusable_grant_language: null, category: null, grant_relevance: null, featured: false, public_visibility: true, archived_at: null, created_at: now(), updated_at: now() },
    ],
    proofItems: [
      { id: "proof-1", project_id: "project-1", title: "Launch Metrics", type: "metric", description: null, date: null, media_url: null, document_url: null, metrics: null, tags: [], grant_relevance: null, public_visibility: true, archived_at: null, created_at: now(), updated_at: now() },
    ],
    applications: [
      { id: "app-1", grant_id: "grant-1", project_id: "project-1", title: "Playa AI — MIT Solve", status: "Drafting", owner_name: "Alex", google_doc_url: null, drive_folder_url: null, portal_url: null, submitted_at: null, result: null, notes: null, archived_at: null, created_at: now(), updated_at: now() },
    ],
    applicationQuestions: [
      { id: "question-1", application_id: "app-1", question: "What problem do you solve?", word_limit: 250, draft_answer: null, final_answer: null, owner_name: null, status: "Draft", sort_order: 1, created_at: now(), updated_at: now() },
    ],
    applicationRequiredDocuments: [
      { id: "required-doc-1", application_id: "app-1", title: "Budget", description: null, status: "Needed", url: null, sort_order: 1, created_at: now(), updated_at: now() },
    ],
    tasks: [
      { id: "task-1", title: "Draft narrative", description: null, owner_name: "Alex", status: "In Progress", priority: "High", due_date: "2026-07-20", related_project_id: "project-1", related_grant_id: "grant-1", related_application_id: "app-1", related_proof_item_id: null, notes: null, archived_at: null, created_at: now(), updated_at: now() },
    ],
    peers: [
      { id: "peer-1", legacy_id: null, name: "Demo Peer", slug: "demo-peer", website: "https://peer.example", ein: null, location: null, address: null, description: null, assets: null, annual_revenue: null, focus_areas: [], relevance: null, relevance_to_playa: null, similarity_score: null, confidence: "high", known_funders: [], source_url: null, source_metadata: {}, import_source: null, last_researched_at: null, key_people: null, saved_opportunities: null, notes: null, archived_at: null, created_at: now(), updated_at: now() },
    ],
    peerFundingRecords: [
      { id: "peer-funding-1", peer_organization_id: "peer-1", funder_id: "funder-1", funder_name: "MIT Solve", year: 2025, amount: 25000, amount_min: null, amount_max: null, amount_exact: 25000, award_year: 2025, purpose: null, program_area: null, source_url: "https://peer.example/funding", source_metadata: {}, confidence: "high", notes: null, archived_at: null, created_at: now(), updated_at: now() },
    ],
    agentNotes: [],
    agentReports: [],
    grantMatches: [{
      id: "match-1",
      project_id: "project-1",
      grant_id: "grant-1",
      funder_id: "funder-1",
      match_score: 91,
      match_tier: "strong",
      decision_label: "apply_now",
      readiness_score: 74,
      urgency_score: 60,
      evidence_score: 80,
      deadline_status: "active",
      score_breakdown: {},
      data_quality_flags: [],
      fit_reasons: ["Strong alignment"],
      risks: ["Need more documentation"],
      missing_items: [],
      recommended_actions: ["Review and shortlist"],
      status: "saved",
      hidden_at: null,
      saved_at: now(),
      dismissed_reason: null,
      generated_by: "simulation",
      generated_at: now(),
      reviewed_by: null,
      reviewed_at: null,
      created_at: now(),
      updated_at: now(),
    }],
    shortlistItems: [],
    audits: [],
    agentKnowledgeItems: [
      {
        id: "item-1", title: "Test Rule", category: "Test", content: "Always test", knowledge_type: "always_rule", priority: "high", confidence_status: "approved", status: "active", applies_to: null, example: null, source_label: null, source_notes: null, source_url: null, created_by: null, updated_by: null, created_at: now(), updated_at: now(),
      }
    ],
    agentKnowledgeUpdates: [],
  };
}

export function createInMemoryGrantOsRepository(overrides?: Partial<SeedState>, replaceCollections?: Array<keyof SeedState>) {
  const state = seed();
  if (overrides) {
    const toReplace = new Set(replaceCollections ?? []);
    if (overrides.grants) { if (toReplace.has("grants")) state.grants = [...overrides.grants]; else state.grants.push(...overrides.grants); }
    if (overrides.projects) { if (toReplace.has("projects")) state.projects = [...overrides.projects]; else state.projects.push(...overrides.projects); }
    if (overrides.grantMatches) { if (toReplace.has("grantMatches")) state.grantMatches = [...overrides.grantMatches]; else state.grantMatches.push(...overrides.grantMatches); }
    if (overrides.proofItems) { if (toReplace.has("proofItems")) state.proofItems = [...overrides.proofItems]; else state.proofItems.push(...overrides.proofItems); }
  }
  let idCounter = 20;

  const repository: GrantOsRepository & { snapshot(): SeedState; auditTrail(): ToolAuditPayload[] } = {
    async listGrants() { return state.grants.filter((grant) => !grant.archived_at); },
    async getGrant(id) { return state.grants.find((grant) => grant.id === id && !grant.archived_at) ?? null; },
    async updateGrantStatus(id, status: GrantDbStatus) { const grant = state.grants.find((item) => item.id === id); if (!grant) throw new Error("grant not found"); grant.status = status; grant.updated_at = now(); return grant; },
    async updateGrant(id, updates) { const grant = state.grants.find((item) => item.id === id); if (!grant) throw new Error("grant not found"); Object.assign(grant, updates, { updated_at: now() }); return grant; },
    async listFunders() { return state.funders.filter((funder) => !funder.archived_at); },
    async getFunder(id) { return state.funders.find((funder) => funder.id === id || funder.legacy_id === id) ?? null; },
    async listDocuments(filters) { return state.documents.filter((doc) => !doc.archived_at).filter((doc) => !filters?.relatedGrantId || doc.related_grant_id === filters.relatedGrantId).filter((doc) => !filters?.relatedApplicationId || doc.related_application_id === filters.relatedApplicationId).filter((doc) => !filters?.relatedProjectId || doc.related_project_id === filters.relatedProjectId).filter((doc) => !filters?.relatedFunderId || doc.related_funder_id === filters.relatedFunderId); },
    async getDocument(id) { return state.documents.find((doc) => doc.id === id && !doc.archived_at) ?? null; },
    async listGrantDocuments(grant, funder) { return state.documents.filter((doc) => !doc.archived_at && (doc.related_grant_id === grant.id || (funder?.id ? doc.related_funder_id === funder.id : false))); },
    async listProjects() { return state.projects.filter((project) => !project.archived_at); },
    async getProject(idOrSlug) { return state.projects.find((project) => !project.archived_at && (project.id === idOrSlug || project.slug === idOrSlug)) ?? null; },
    async listProofItems(projectId) { return state.proofItems.filter((item) => !item.archived_at && (!projectId || item.project_id === projectId)); },
    async listApplications() { return state.applications.filter((application) => !application.archived_at); },
    async getApplication(id) { return state.applications.find((application) => application.id === id && !application.archived_at) ?? null; },
    async listApplicationsByGrant(grantId) { return state.applications.filter((application) => !application.archived_at && application.grant_id === grantId); },
    async listApplicationQuestions(applicationId) { return state.applicationQuestions.filter((question) => question.application_id === applicationId); },
    async listApplicationRequiredDocuments(applicationId) { return state.applicationRequiredDocuments.filter((doc) => doc.application_id === applicationId); },
    async createApplication(input) {
      const normalized = input as Omit<ApplicationInsert, "id" | "created_at" | "updated_at">;
      const row: ApplicationRow = {
        id: makeId("app", ++idCounter),
        grant_id: normalized.grant_id ?? null,
        project_id: normalized.project_id ?? null,
        title: normalized.title,
        status: normalized.status ?? "Not Started",
        owner_name: normalized.owner_name ?? null,
        google_doc_url: normalized.google_doc_url ?? null,
        drive_folder_url: normalized.drive_folder_url ?? null,
        portal_url: normalized.portal_url ?? null,
        submitted_at: normalized.submitted_at ?? null,
        result: normalized.result ?? null,
        notes: normalized.notes ?? null,
        archived_at: normalized.archived_at ?? null,
        created_at: now(),
        updated_at: now(),
      };
      state.applications.push(row);
      return row;
    },
    async updateApplication(id, updates) { const application = state.applications.find((item) => item.id === id); if (!application) throw new Error("application not found"); Object.assign(application, updates, { updated_at: now() }); return application; },
    async listTasks() { return state.tasks.filter((task) => !task.archived_at); },
    async getTask(id) { return state.tasks.find((task) => task.id === id && !task.archived_at) ?? null; },
    async listTasksByApplication(applicationId) { return state.tasks.filter((task) => !task.archived_at && task.related_application_id === applicationId); },
    async createTask(input) { const row: TaskRow = { ...input, id: makeId("task", ++idCounter), created_at: now(), updated_at: now() }; state.tasks.push(row); return row; },
    async updateTaskStatus(id, status: TaskDbStatus) { const task = state.tasks.find((item) => item.id === id); if (!task) throw new Error("task not found"); task.status = status; task.updated_at = now(); return task; },
    async updateTask(id, updates) { const task = state.tasks.find((item) => item.id === id); if (!task) throw new Error("task not found"); Object.assign(task, updates, { updated_at: now() }); return task; },
    async listPeers() { return state.peers.filter((peer) => !peer.archived_at); },
    async getPeer(id) { return state.peers.find((peer) => peer.id === id || peer.legacy_id === id) ?? null; },
    async listPeerFundingRecords(peerOrganizationId) { return state.peerFundingRecords.filter((record) => !record.archived_at && record.peer_organization_id === peerOrganizationId); },
    async listAllPeerFundingRecords() { return state.peerFundingRecords.filter((record) => !record.archived_at); },
    async createPeerOrganization(input) { const row: PeerOrganizationRow = { ...input, id: makeId("peer", ++idCounter), created_at: now(), updated_at: now() }; state.peers.push(row); return row; },
    async createPeerFundingRecord(input) { const row: PeerFundingRecordRow = { ...input, id: makeId("peer-funding", ++idCounter), created_at: now(), updated_at: now() }; state.peerFundingRecords.push(row); return row; },
    async createApplicationNote({ applicationId, title, content, createdBy }) { const note: AgentNoteRow = { id: makeId("note", ++idCounter), source: "external_agent", note_type: "general", title, content, structured_data: null, related_project_id: null, related_grant_id: null, related_funder_id: null, related_application_id: applicationId, related_task_id: null, created_by: createdBy ?? null, archived_at: null, created_at: now(), updated_at: now() }; state.agentNotes.push(note); return note; },
    async listAgentNotes(filters) { return state.agentNotes.filter((note) => !filters?.relatedGrantId || note.related_grant_id === filters.relatedGrantId).filter((note) => !filters?.relatedFunderId || note.related_funder_id === filters.relatedFunderId).filter((note) => !filters?.relatedApplicationId || note.related_application_id === filters.relatedApplicationId).filter((note) => !filters?.relatedProjectId || note.related_project_id === filters.relatedProjectId); },
    async listAgentReports(filters) { return state.agentReports.filter((report) => !filters?.relatedGrantId || report.related_grant_id === filters.relatedGrantId).filter((report) => !filters?.relatedApplicationId || report.related_application_id === filters.relatedApplicationId).filter((report) => !filters?.relatedProjectId || report.related_project_id === filters.relatedProjectId); },
    async listGrantMatches(filters) { return state.grantMatches.filter((match) => !filters?.grantId || match.grant_id === filters.grantId).filter((match) => !filters?.projectId || match.project_id === filters.projectId); },
    async getGrantMatch(id) {
      const match = state.grantMatches.find((match) => match.id === id);
      if (!match) return null;
      const copy = { ...match } as any;
      
      const projectRow = state.projects.find(p => p.id === copy.project_id) ?? null;
      if (projectRow) {
        copy.project = { ...projectRow };
        delete (copy.project as any).mission_statement;
        delete (copy.project as any).impact_metrics;
      } else {
        copy.project = null;
      }

      const grantRow = state.grants.find(g => g.id === copy.grant_id) ?? null;
      if (grantRow) {
        copy.grant = { ...grantRow };
        delete (copy.grant as any).description;
        delete (copy.grant as any).eligibility;
      } else {
        copy.grant = null;
      }

      const funderRow = copy.funder_id ? state.funders.find(f => f.id === copy.funder_id) ?? null : null;
      if (funderRow) {
        copy.funder = { ...funderRow };
        delete (copy.funder as any).description;
        delete (copy.funder as any).key_people;
      } else {
        copy.funder = null;
      }

      return copy as GrantMatchWithRelations;
    },
    async upsertGrantMatch(input) {
      const existingIndex = state.grantMatches.findIndex((match) => match.project_id === input.project_id && match.grant_id === input.grant_id);
      const timestamp = now();
      const base = existingIndex >= 0 ? state.grantMatches[existingIndex] : undefined;
      const row: GrantMatchWithRelations = {
        id: base?.id ?? makeId("match", ++idCounter),
        project_id: input.project_id,
        grant_id: input.grant_id,
        funder_id: input.funder_id ?? null,
        match_score: input.match_score ?? 0,
        match_tier: input.match_tier ?? "needs_review",
        decision_label: input.decision_label ?? "needs_review",
        readiness_score: input.readiness_score ?? 0,
        urgency_score: input.urgency_score ?? 0,
        evidence_score: input.evidence_score ?? 0,
        deadline_status: input.deadline_status ?? "unknown",
        score_breakdown: input.score_breakdown ?? {},
        data_quality_flags: input.data_quality_flags ?? [],
        fit_reasons: input.fit_reasons ?? [],
        risks: input.risks ?? [],
        missing_items: input.missing_items ?? [],
        recommended_actions: input.recommended_actions ?? [],
        status: input.status ?? "saved",
        hidden_at: input.hidden_at ?? null,
        saved_at: input.saved_at ?? timestamp,
        dismissed_reason: input.dismissed_reason ?? null,
        generated_by: input.generated_by ?? "agent_generated",
        generated_at: input.generated_at ?? timestamp,
        reviewed_by: input.reviewed_by ?? null,
        reviewed_at: input.reviewed_at ?? null,
        created_at: base?.created_at ?? timestamp,
        updated_at: input.updated_at ?? timestamp,
        project: state.projects.find((project) => project.id === input.project_id) ?? null,
        grant: state.grants.find((grant) => grant.id === input.grant_id) ?? null,
        funder: input.funder_id ? state.funders.find((funder) => funder.id === input.funder_id) ?? null : null,
      };
      if (existingIndex >= 0) state.grantMatches[existingIndex] = row;
      else state.grantMatches.push(row);
      return row;
    },
    async saveGrantToShortlist(input) { const row = { id: makeId("shortlist", ++idCounter), ...input }; state.shortlistItems.push(row); return row as any; },
    async recordAudit(payload) { state.audits.push(payload); return { id: makeId("audit", ++idCounter), actor_source: "external_agent", action_type: "manual_entry", title: payload.tool_name, description: null, status: payload.status === "approval_required" ? "pending" : payload.status, related_project_id: null, related_grant_id: null, related_application_id: null, metadata: payload as any, created_by: payload.actor_id ?? null, created_at: payload.created_at } satisfies AgentActivityLogRow; },

    async listAgentKnowledgeItems(filters) {
      return state.agentKnowledgeItems.filter(i => {
        if (filters?.knowledge_type && i.knowledge_type !== filters.knowledge_type) return false;
        if (filters?.category && i.category !== filters.category) return false;
        if (filters?.priority && i.priority !== filters.priority) return false;
        if (filters?.confidence_status && i.confidence_status !== filters.confidence_status) return false;
        if (!filters?.include_archived && i.status === "archived") return false;
        return true;
      });
    },
    async getAgentKnowledgeItem(id) {
      return state.agentKnowledgeItems.find(i => i.id === id) ?? null;
    },
    async listAgentKnowledgeProposals(filters) {
      return state.agentKnowledgeUpdates.filter(p => {
        if (filters?.status && p.status !== filters.status) return false;
        if (filters?.proposal_type && p.proposal_type !== filters.proposal_type) return false;
        if (filters?.risk_level && p.risk_level !== filters.risk_level) return false;
        if (filters?.source_type && p.source_type !== filters.source_type) return false;
        return true;
      });
    },
    async proposeAgentKnowledgeUpdate(proposal) {
      const row: AgentKnowledgeUpdate = {
        id: makeId("proposal", ++idCounter),
        proposal_type: proposal.proposal_type as any,
        target_item_id: proposal.target_item_id ?? null,
        title: proposal.title,
        category: proposal.category,
        proposed_content: proposal.proposed_content,
        rationale: proposal.rationale ?? null,
        risk_level: (proposal.risk_level ?? "medium") as any,
        status: "pending_review",
        source_type: (proposal.source_type ?? "agent_observation") as any,
        source_excerpt: proposal.source_excerpt ?? null,
        conflict_summary: proposal.conflict_summary ?? null,
        reviewer_notes: null,
        created_by: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: now(),
        updated_at: now(),
      };
      state.agentKnowledgeUpdates.push(row);
      return row;
    },

    snapshot() { return JSON.parse(JSON.stringify(state)) as SeedState; },
    auditTrail() { return [...state.audits]; },
  };
  return repository;
}
