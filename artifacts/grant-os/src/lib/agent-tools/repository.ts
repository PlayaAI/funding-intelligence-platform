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
import { listMatches } from "../matching/matchesService";
import {
  listAllPeerFundingRecords,
  listPeerFundingRecords,
  listPeerOrganizations,
  getPeerByIdOrLegacy,
  createPeerFundingRecord,
  createPeerOrganization,
} from "../peersService";
import { getProjectBySlug, listProjects } from "../projectsService";
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
import { createSupabaseClientForAgent } from "../supabase";
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
  listTasks(): Promise<TaskRow[]>;
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

  return {
    listGrants: () => listGrants(undefined, agentSupabase),
    getGrant: (id) => getGrantById(id, agentSupabase),
    updateGrantStatus: (id, status) => updateGrant(id, { status }),
    listFunders: () => listFunders(),
    getFunder: (id) => getFunderByIdOrLegacy(id),
    listDocuments: (filters) => listDocuments(filters),
    getDocument: (id) => getDocument(id),
    listGrantDocuments: (grant, funder) =>
      listGrantDocuments({
        grantId: grant.id,
        funderId: funder?.id ?? grant.funder_id,
        title: grant.title,
        funderName: grant.funder_name,
        sourceUrl: grant.source_url,
        applicationUrl: grant.application_url,
      }),
    listProjects: () => listProjects(),
    async getProject(idOrSlug) {
      const bySlug = await getProjectBySlug(idOrSlug);
      if (bySlug) return bySlug;
      const projects = await listProjects();
      return projects.find((project) => project.id === idOrSlug) ?? null;
    },
    listProofItems: (projectId) => listProofItems(projectId),
    listApplications: () => listApplications(),
    getApplication: (id) => getApplicationById(id),
    listApplicationsByGrant: (grantId) => listApplicationsByGrant(grantId),
    listApplicationQuestions: (applicationId) => listApplicationQuestions(applicationId),
    listApplicationRequiredDocuments: (applicationId) => listApplicationRequiredDocuments(applicationId),
    createApplication: (input) => createApplication(input),
    listTasks: () => listTasks(),
    getTask: (id) => getTaskById(id),
    listTasksByApplication: (applicationId) => listTasksByApplication(applicationId),
    createTask: (input) => createTask(input),
    async updateTaskStatus(id, status) {
      return updateTask(id, { status });
    },
    listPeers: () => listPeerOrganizations(),
    getPeer: (id) => getPeerByIdOrLegacy(id),
    listPeerFundingRecords: (peerOrganizationId) => listPeerFundingRecords(peerOrganizationId),
    listAllPeerFundingRecords: () => listAllPeerFundingRecords(),
    createPeerOrganization: (input) => createPeerOrganization(input),
    createPeerFundingRecord: (input) => createPeerFundingRecord(input),
    createApplicationNote: ({ applicationId, title, content, createdBy }) =>
      createAgentNote({
        note_type: "general",
        title,
        content,
        related_application_id: applicationId,
        created_by: createdBy ?? null,
        source: "external_agent",
      }),
    listAgentNotes: (filters) => listAgentNotes(filters),
    async listAgentReports(filters) {
      return await listAgentReports(filters);
    },
    async listGrantMatches(filters) {
      const matches = await listMatches({ status: "all" });
      return matches.filter((match) => {
        if (filters?.grantId && match.grant_id !== filters.grantId) return false;
        if (filters?.projectId && match.project_id !== filters.projectId) return false;
        return true;
      });
    },
    saveGrantToShortlist: (input) => upsertGrantShortlistItem(input),
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
        });
      } catch {
        return null;
      }
    },
  };
}
