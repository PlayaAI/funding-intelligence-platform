import {
  createAgentNote,
  listAgentNotes,
} from "../agentNotesService";
import {
  getApplicationById,
  listApplicationQuestions,
  listApplicationRequiredDocuments,
  listApplications,
  listApplicationsByGrant,
  createApplication,
} from "../applicationsService";
import { createAgentActivity } from "../agentActivityService";
import {
  getDocument,
  listDocuments,
  listGrantDocuments,
} from "../documentsService";
import { listAgentReports } from "../agentReportsService";
import { getFunderByIdOrLegacy, listFunders } from "../fundersService";
import { getGrantById, listGrants, updateGrant } from "../grantsService";
import { getMatch, listMatches } from "../matching/matchesService";
import {
  listAllPeerFundingRecords,
  listPeerFundingRecords,
  listPeerOrganizations,
  getPeerByIdOrLegacy,
  createPeerFundingRecord,
  createPeerOrganization,
} from "../peersService";
import { getProjectById, getProjectBySlug, listProjects } from "../projectsService";
import { listProofItems } from "../proofItemsService";
import {
  upsertGrantShortlistItem,
  type GrantShortlistItemRow,
} from "../grantShortlistService";
import {
  createTask,
  getTaskById,
  listTasks,
  listTasksByApplication,
  updateTask,
} from "../tasksService";
import { createSupabaseClientForAgent, supabase } from "../supabase";
import type { AgentKnowledgeItem, AgentKnowledgeUpdate } from "../agentKnowledgeService";
import type { AgentAuthContext } from "./authContext";
import type {
  AgentActivityLogRow,
  AgentNoteRow,
  AgentReportRow,
  ApplicationQuestionRow,
  ApplicationRequiredDocumentRow,
  ApplicationInsert,
  ApplicationRow,
  DocumentRow,
  FunderRow,
  GrantDbStatus,
  GrantMatchInsert,
  GrantMatchRow,
  GrantRow,
  Json,
  PeerFundingRecordRow,
  PeerOrganizationRow,
  ProjectRow,
  ProofItemRow,
  TaskDbStatus,
  TaskRow,
} from "../../types/database";
import type { GrantMatchWithRelations } from "../matching/matchesService";
import type { ToolAuditPayload } from "./types";

export type GrantOsRepository = {
  listGrants(): Promise<GrantRow[]>;
  getGrant(id: string): Promise<GrantRow | null>;
  updateGrantStatus(id: string, status: GrantDbStatus): Promise<GrantRow>;
  listFunders(): Promise<FunderRow[]>;
  getFunder(id: string): Promise<FunderRow | null>;
  listDocuments(filters?: {
    relatedGrantId?: string;
    relatedApplicationId?: string;
    relatedProjectId?: string;
    relatedFunderId?: string;
    includeArchived?: boolean;
  }): Promise<DocumentRow[]>;
  getDocument(id: string): Promise<DocumentRow | null>;
  listGrantDocuments(grant: GrantRow, funder: FunderRow | null): Promise<DocumentRow[]>;
  listProjects(): Promise<ProjectRow[]>;
  getProject(idOrSlug: string): Promise<ProjectRow | null>;
  listProofItems(projectId?: string): Promise<ProofItemRow[]>;
  listApplications(): Promise<ApplicationRow[]>;
  getApplication(id: string): Promise<ApplicationRow | null>;
  listApplicationsByGrant(grantId: string): Promise<ApplicationRow[]>;
  listApplicationQuestions(applicationId: string): Promise<ApplicationQuestionRow[]>;
  listApplicationRequiredDocuments(applicationId: string): Promise<ApplicationRequiredDocumentRow[]>;
  createApplication(input: Omit<ApplicationInsert, "id" | "created_at" | "updated_at">): Promise<ApplicationRow>;
  listTasks(opts?: { includeSoftArchived?: boolean; relatedIds?: string[] }): Promise<TaskRow[]>;
  getTask(id: string): Promise<TaskRow | null>;
  listTasksByApplication(applicationId: string): Promise<TaskRow[]>;
  createTask(input: Omit<TaskRow, "id" | "created_at" | "updated_at">): Promise<TaskRow>;
  updateTaskStatus(id: string, status: TaskDbStatus): Promise<TaskRow>;
  listPeers(): Promise<PeerOrganizationRow[]>;
  getPeer(id: string): Promise<PeerOrganizationRow | null>;
  listPeerFundingRecords(peerOrganizationId: string): Promise<PeerFundingRecordRow[]>;
  listAllPeerFundingRecords(): Promise<PeerFundingRecordRow[]>;
  createPeerOrganization(input: Omit<PeerOrganizationRow, "id" | "created_at" | "updated_at">): Promise<PeerOrganizationRow>;
  createPeerFundingRecord(input: Omit<PeerFundingRecordRow, "id" | "created_at" | "updated_at">): Promise<PeerFundingRecordRow>;
  createApplicationNote(input: {
    applicationId: string;
    title: string;
    content: string;
    createdBy?: string | null;
  }): Promise<AgentNoteRow>;
  listAgentNotes(filters?: {
    relatedGrantId?: string;
    relatedFunderId?: string;
    relatedApplicationId?: string;
    relatedProjectId?: string;
  }): Promise<AgentNoteRow[]>;
  listAgentReports(filters?: {
    relatedGrantId?: string;
    relatedApplicationId?: string;
    relatedProjectId?: string;
  }): Promise<AgentReportRow[]>;
  listGrantMatches(filters?: { grantId?: string; projectId?: string }): Promise<GrantMatchWithRelations[]>;
  getGrantMatch(id: string): Promise<GrantMatchWithRelations | null>;
  upsertGrantMatch(input: GrantMatchInsert): Promise<GrantMatchWithRelations>;
  saveGrantToShortlist(input: {
    grant_id: string;
    project_id?: string | null;
    status?: "New" | "Watching" | "Shortlisted" | "Apply" | "Skip" | "Archived" | "Not relevant";
    priority?: "Low" | "Medium" | "High" | "Urgent";
    owner_name?: string | null;
    notes?: string | null;
    next_action?: string | null;
    due_date?: string | null;
  }): Promise<GrantShortlistItemRow>;
  recordAudit(payload: ToolAuditPayload): Promise<AgentActivityLogRow | null>;
  listAgentKnowledgeItems(filters?: {
    knowledge_type?: string;
    category?: string;
    priority?: string;
    confidence_status?: string;
    include_archived?: boolean;
  }): Promise<AgentKnowledgeItem[]>;
  getAgentKnowledgeItem(id: string): Promise<AgentKnowledgeItem | null>;
  listAgentKnowledgeProposals(filters?: {
    status?: string;
    proposal_type?: string;
    risk_level?: string;
    source_type?: string;
  }): Promise<AgentKnowledgeUpdate[]>;
  proposeAgentKnowledgeUpdate(proposal: {
    proposal_type: string;
    target_item_id?: string;
    title: string;
    category: string;
    proposed_content: string;
    rationale?: string;
    risk_level?: string;
    source_type?: string;
    source_excerpt?: string;
    conflict_summary?: string;
  }): Promise<AgentKnowledgeUpdate>;
};

export type CreateLiveGrantOsRepositoryOptions = {
  authContext?: AgentAuthContext;
};

export function createLiveGrantOsRepository(
  options: CreateLiveGrantOsRepositoryOptions = {}
): GrantOsRepository {
  const agentSupabase = options.authContext
    ? createSupabaseClientForAgent(options.authContext)
    : undefined;

  async function hydrateGrantMatch(match: GrantMatchRow): Promise<GrantMatchWithRelations> {
    const [project, grant, funder] = await Promise.all([
      getProjectById(match.project_id, agentSupabase),
      getGrantById(match.grant_id, agentSupabase),
      match.funder_id ? getFunderByIdOrLegacy(match.funder_id) : Promise.resolve(null),
    ]);

    const safeProject = project ? { ...project } : null;
    if (safeProject) {
      delete (safeProject as any).mission_statement;
      delete (safeProject as any).impact_metrics;
    }

    const safeGrant = grant ? { ...grant } : null;
    if (safeGrant) {
      delete (safeGrant as any).description;
      delete (safeGrant as any).eligibility;
    }

    const safeFunder = funder ? { ...funder } : null;
    if (safeFunder) {
      delete (safeFunder as any).description;
      delete (safeFunder as any).key_people;
    }

    return {
      ...match,
      project: safeProject,
      grant: safeGrant,
      funder: safeFunder,
    };
  }

  async function requireAgentSupabase() {
    if (!agentSupabase) {
      throw new Error("Authenticated agent Supabase context is required for grant match persistence.");
    }
    return agentSupabase as any;
  }

  return {
    listGrants: () => listGrants(undefined, agentSupabase),
    getGrant: (id) => getGrantById(id, agentSupabase),
    updateGrantStatus: (id, status) => updateGrant(id, { status }, agentSupabase),
    listFunders: () => listFunders(agentSupabase),
    getFunder: (id) => getFunderByIdOrLegacy(id, agentSupabase),
    listDocuments: (filters) => listDocuments(filters, agentSupabase),
    getDocument: (id) => getDocument(id, agentSupabase),
    listGrantDocuments: (grant, funder) =>
      listGrantDocuments({
        grantId: grant.id,
        funderId: funder?.id ?? grant.funder_id,
        title: grant.title,
        funderName: grant.funder_name,
        sourceUrl: grant.source_url,
        applicationUrl: grant.application_url,
      }, agentSupabase),
    listProjects: () => listProjects(agentSupabase),
    async getProject(idOrSlug) {
      const bySlug = await getProjectBySlug(idOrSlug, agentSupabase);
      if (bySlug) return bySlug;
      return await getProjectById(idOrSlug, agentSupabase);
    },
    listProofItems: (projectId) => listProofItems(projectId, agentSupabase),
    listApplications: () => listApplications(undefined, agentSupabase),
    getApplication: (id) => getApplicationById(id, agentSupabase),
    listApplicationsByGrant: (grantId) => listApplicationsByGrant(grantId, agentSupabase),
    listApplicationQuestions: (applicationId) => listApplicationQuestions(applicationId, agentSupabase),
    listApplicationRequiredDocuments: (applicationId) => listApplicationRequiredDocuments(applicationId, agentSupabase),
    createApplication: (input) => createApplication(input, agentSupabase),
    listTasks: (opts) => listTasks(opts, agentSupabase),
    getTask: (id) => getTaskById(id, agentSupabase),
    listTasksByApplication: (applicationId) => listTasksByApplication(applicationId, agentSupabase),
    createTask: (input) => createTask(input, agentSupabase),
    async updateTaskStatus(id, status) {
      return updateTask(id, { status }, agentSupabase);
    },
    listPeers: () => listPeerOrganizations(undefined, agentSupabase),
    getPeer: (id) => getPeerByIdOrLegacy(id, agentSupabase),
    listPeerFundingRecords: (peerOrganizationId) => listPeerFundingRecords(peerOrganizationId, agentSupabase),
    listAllPeerFundingRecords: () => listAllPeerFundingRecords(agentSupabase),
    createPeerOrganization: (input) => createPeerOrganization(input, agentSupabase),
    createPeerFundingRecord: (input) => createPeerFundingRecord(input, agentSupabase),
    createApplicationNote: ({ applicationId, title, content, createdBy }) =>
      createAgentNote({
        note_type: "general",
        title,
        content,
        related_application_id: applicationId,
        created_by: createdBy ?? null,
        source: "external_agent",
      }, agentSupabase),
    listAgentNotes: (filters) => listAgentNotes(filters, agentSupabase),
    async listAgentReports(filters) {
      return await listAgentReports(filters, agentSupabase);
    },
    async listGrantMatches(filters) {
      const matches = await listMatches({ status: "all" }, agentSupabase);
      return matches.filter((match) => {
        if (filters?.grantId && match.grant_id !== filters.grantId) return false;
        if (filters?.projectId && match.project_id !== filters.projectId) return false;
        return true;
      });
    },
    async getGrantMatch(id) {
      if (agentSupabase) {
        const db = await requireAgentSupabase();
        const result = await db.from("grant_matches").select("*").eq("id", id).maybeSingle();
        if (result.error) throw new Error(result.error.message);
        if (!result.data) return null;
        return hydrateGrantMatch(result.data as GrantMatchRow);
      }
      const match = await getMatch(id);
      return match ? hydrateGrantMatch(match) : null;
    },
    async upsertGrantMatch(input) {
      const db = await requireAgentSupabase();
      const result = await db.from("grant_matches").upsert(input, { onConflict: "project_id,grant_id" }).select("*").single();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error("No grant match row returned from upsert.");
      return hydrateGrantMatch(result.data as GrantMatchRow);
    },
    saveGrantToShortlist: (input) => upsertGrantShortlistItem(input, agentSupabase),
    async recordAudit(payload) {
      try {
        return await createAgentActivity({
          actor_source: payload.actor_type === "agent" ? "external_agent" : "human",
          action_type: payload.permission_level === "read"
            ? payload.tool_name.startsWith("export_")
              ? "export_created"
              : "data_reviewed"
            : payload.tool_name.includes("task")
              ? "task_created"
              : payload.tool_name.includes("status")
                ? "status_updated"
                : "manual_entry",
          title: `[agent-tool] ${payload.tool_name}`,
          description: payload.status === "failed" ? payload.error_message ?? null : `Tool ${payload.tool_name} ${payload.status}`,
          status: payload.status === "approval_required" ? "pending" : payload.status,
          metadata: payload as unknown as Json,
          created_by: payload.actor_id ?? null,
        }, agentSupabase);
      } catch {
        return null;
      }
    },
    async listAgentKnowledgeItems(filters) {
      const db = agentSupabase ?? supabase;
      let q = db.from("agent_knowledge_items").select("*");
      if (filters?.knowledge_type) q = q.eq("knowledge_type", filters.knowledge_type);
      if (filters?.category) q = q.eq("category", filters.category);
      if (filters?.priority) q = q.eq("priority", filters.priority);
      if (filters?.confidence_status) q = q.eq("confidence_status", filters.confidence_status);
      if (!filters?.include_archived) q = q.neq("status", "archived");
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data as AgentKnowledgeItem[];
    },
    async getAgentKnowledgeItem(id) {
      const db = agentSupabase ?? supabase;
      const { data, error } = await db.from("agent_knowledge_items").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data as AgentKnowledgeItem | null;
    },
    async listAgentKnowledgeProposals(filters) {
      const db = agentSupabase ?? supabase;
      let q = db.from("agent_knowledge_updates").select("*");
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.proposal_type) q = q.eq("proposal_type", filters.proposal_type);
      if (filters?.risk_level) q = q.eq("risk_level", filters.risk_level);
      if (filters?.source_type) q = q.eq("source_type", filters.source_type);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data as AgentKnowledgeUpdate[];
    },
    async proposeAgentKnowledgeUpdate(proposal) {
      const db = await requireAgentSupabase();
      const payload = {
        proposal_type: proposal.proposal_type,
        target_item_id: proposal.target_item_id ?? null,
        title: proposal.title,
        category: proposal.category,
        proposed_content: proposal.proposed_content,
        rationale: proposal.rationale ?? null,
        risk_level: proposal.risk_level ?? "medium",
        status: "pending_review",
        source_type: proposal.source_type ?? "agent_observation",
        source_excerpt: proposal.source_excerpt ?? null,
        conflict_summary: proposal.conflict_summary ?? null,
      };
      const { data, error } = await db.from("agent_knowledge_updates").insert([payload]).select().single();
      if (error) throw new Error(error.message);
      return data as AgentKnowledgeUpdate;
    },
  };
}
