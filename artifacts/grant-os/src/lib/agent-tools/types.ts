import { z } from "zod";
import type {
  AgentActivityActionType,
  AgentNoteRow,
  AgentReportRow,
  AgentSource,
  ApplicationDbStatus,
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
  TaskDbPriority,
  TaskDbStatus,
  TaskRow,
} from "../../types/database";
import type { GrantMatchWithRelations } from "../matching/matchesService";

export type PermissionLevel = "read" | "write_safe" | "approval_required";

export type ToolActor = {
  type: "human" | "agent" | "system";
  id?: string | null;
  source?: AgentSource;
};

export type ToolAuditPayload = {
  tool_name: string;
  permission_level: PermissionLevel;
  input: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  dry_run: boolean;
  status: "completed" | "failed" | "approval_required";
  error_message?: string | null;
  actor_type: ToolActor["type"];
  actor_id?: string | null;
  created_at: string;
};

export type ApprovalActionPayload = {
  tool_name: string;
  reason: string;
  risks: string[];
  affected_records: Array<{ table: string; id: string }>;
  proposed_mutation: Record<string, unknown>;
  rollback_plan: string;
};

export type ApprovalRequiredResult = {
  requires_approval: true;
  proposed_action: ApprovalActionPayload;
};

export type ToolError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ToolSuccess<T> = {
  ok: true;
  tool: string;
  permissionLevel: PermissionLevel;
  data: T;
  audit: ToolAuditPayload;
};

export type ToolFailure = {
  ok: false;
  tool: string;
  permissionLevel: PermissionLevel;
  error: ToolError;
  audit: ToolAuditPayload;
};

export type ToolExecutionResult<T> = ToolSuccess<T> | ToolFailure;

export type ToolExecutionContext = {
  actor: ToolActor;
};

export type GrantExportPacket = {
  exported_at: string;
  generated_at: string;
  package_type: "grant";
  app: "Grant OS";
  records: {
    grant: GrantRow;
    funder: FunderRow | null;
    related_projects: ProjectRow[];
    applications: ApplicationRow[];
    tasks: TaskRow[];
    proof_items: ProofItemRow[];
    documents: DocumentRow[];
    agent_notes: AgentNoteRow[];
    agent_reports: AgentReportRow[];
    grant_matches: GrantMatchWithRelations[];
  };
};

export type ApplicationExportPacket = {
  exported_at: string;
  generated_at: string;
  package_type: "application";
  app: "Grant OS";
  records: {
    application: ApplicationRow;
    grant: GrantRow | null;
    funder: FunderRow | null;
    project: ProjectRow | null;
    questions: ApplicationQuestionRow[];
    required_documents: ApplicationRequiredDocumentRow[];
    tasks: TaskRow[];
    documents: DocumentRow[];
    proof_items: ProofItemRow[];
    agent_notes: AgentNoteRow[];
    agent_reports: AgentReportRow[];
    grant_match: GrantMatchWithRelations | null;
  };
};

export type PeerExportPacket = {
  exported_at: string;
  generated_at: string;
  package_type: "peer";
  app: "Grant OS";
  records: {
    peer_organization: PeerOrganizationRow | Record<string, unknown>;
    funding_records: PeerFundingRecordRow[] | Record<string, unknown>[];
    linked_funders: FunderRow[] | Record<string, unknown>[];
    source_metadata: Record<string, unknown>;
  };
};

export type DashboardSummary = {
  grants: { total: number; byStatus: Record<string, number> };
  applications: { total: number; byStatus: Record<string, number> };
  tasks: { total: number; byStatus: Record<string, number>; overdue: number };
  projects: { total: number };
  documents: { total: number };
  peers: { total: number; fundingRecords: number };
};

export type DeadlineGrantStub = {
  id: string;
  title: string;
  status: string | null;
  deadline: string | null;
  days_remaining: number | null;
};

export type DeadlineReport = {
  generatedAt: string;
  windows: Record<"within_30_days" | "within_14_days" | "within_7_days" | "within_3_days", DeadlineGrantStub[]>;
  rolling: DeadlineGrantStub[];
  unknown: DeadlineGrantStub[];
};

export type ApplicationWorkloadReport = {
  generatedAt: string;
  applications: Array<{
    applicationId: string;
    title: string | null;
    status: string | null;
    taskCount: number;
    openTaskCount: number;
    documentCount: number;
    questionCount: number;
    requiredDocumentCount: number;
  }>;
};

export type DataQualityStub = {
  id: string;
  title: string | null;
  issue: string;
};

export type DataQualityReport = {
  generatedAt: string;
  grantsMissingDeadlines: DataQualityStub[];
  grantsMissingUrls: DataQualityStub[];
  applicationsWithoutProject: DataQualityStub[];
  tasksWithoutOwner: DataQualityStub[];
  documentsWithoutSource: DataQualityStub[];
};

export type DryRunPlan<T extends Record<string, unknown> = Record<string, unknown>> = {
  dryRun: true;
  mutationPerformed: false;
  wouldTouchRealDb: boolean;
  targetPersistenceTables: string[];
  relatedTables: string[];
  plannedMutation: T;
};

export type ChecklistTemplateItem = {
  title: string;
  description: string;
  priority: TaskDbPriority;
};

export const grantStatusSchema = z.enum([
  "Planned",
  "Researching",
  "Applying",
  "Submitted",
  "Awarded",
  "Declined",
  "Archived",
] satisfies [GrantDbStatus, ...GrantDbStatus[]]);

export const taskStatusSchema = z.enum([
  "Not Started",
  "In Progress",
  "Waiting",
  "Needs Review",
  "Complete",
  "Archived",
] satisfies [TaskDbStatus, ...TaskDbStatus[]]);

export const taskPrioritySchema = z.enum([
  "Low",
  "Medium",
  "High",
  "Urgent",
] satisfies [TaskDbPriority, ...TaskDbPriority[]]);

export const applicationStatusSchema = z.enum([
  "Not Started",
  "Drafting",
  "Internal Review",
  "Ready to Submit",
  "Submitted",
  "Awarded",
  "Declined",
  "Archived",
] satisfies [ApplicationDbStatus, ...ApplicationDbStatus[]]);

export type ToolDefinition<I, O> = {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
  inputSchema: z.ZodType<I>;
  outputSchema?: z.ZodType<O>;
  dryRunSupported: boolean;
  auditAction: AgentActivityActionType;
  risks: string[];
  relatedTables: string[];
  touchesRealDb: boolean;
  execute: (input: I, context: ToolExecutionContext) => Promise<O | ApprovalRequiredResult>;
};

export type ToolMetadata = Omit<ToolDefinition<unknown, unknown>, "inputSchema" | "outputSchema" | "execute"> & {
  inputSchema: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
};
