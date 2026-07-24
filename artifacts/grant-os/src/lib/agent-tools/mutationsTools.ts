import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ApprovalRequiredResult, ToolDefinition } from "./types";
import { buildChecklistTemplate } from "./builders";
import { buildDryRunPlan } from "./dryRun";
import { makeToolError } from "./safety";
import { applicationStatusSchema, grantStatusSchema, taskPrioritySchema, taskStatusSchema } from "./types";

function approval(
  tool_name: string,
  reason: string,
  risks: string[],
  affected_records: Array<{ table: string; id: string }>,
  proposed_mutation: Record<string, unknown>,
): ApprovalRequiredResult {
  return {
    requires_approval: true,
    proposed_action: {
      tool_name,
      reason,
      risks,
      affected_records,
      proposed_mutation,
      rollback_plan: "No automatic rollback implemented. Review payload and execute manually after approval.",
    },
  };
}

export function createMutationTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "create_application_from_grant",
      description: "Create an internal application workspace from an existing grant and project.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ grantId: z.string().min(1), projectId: z.string().min(1), dryRun: z.boolean().default(true), title: z.string().optional(), ownerName: z.string().optional() }),
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Creates new internal application records."],
      relatedTables: ["grants", "projects", "applications"],
      touchesRealDb: true,
      async execute({ grantId, projectId, dryRun, title, ownerName }) {
        const [grant, project, applications] = await Promise.all([
          repository.getGrant(grantId),
          repository.getProject(projectId),
          repository.listApplications(),
        ]);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        if (!project) throw makeToolError("project_not_found", `Project ${projectId} was not found.`);
        const duplicate = applications.find((application) => application.grant_id === grant.id && application.project_id === project.id);
        const plannedMutation = {
          table: "applications",
          action: duplicate ? "reuse_existing" : "create",
          values: {
            grant_id: grant.id,
            project_id: project.id,
            title: title ?? `${project.name} — ${grant.title}`,
            status: "Not Started" as const,
            owner_name: ownerName ?? null,
            google_doc_url: null,
            drive_folder_url: null,
            portal_url: null,
            submitted_at: null,
            result: null,
            notes: `Created from grant ${grant.title} via agent tool.`,
            archived_at: null,
          },
        };
        if (dryRun) return {
          ...buildDryRunPlan(plannedMutation, ["applications"], { created: false }),
          affectedRecordIds: [],
          duplicate: duplicate ? { code: "duplicate_record", existingApplicationId: duplicate.id } : null,
          applicationPath: duplicate ? `/dashboard/applications/${duplicate.id}` : null,
          warnings: duplicate ? ["An application already exists for this grant/project pair."] : [],
        };
        if (duplicate) return {
          dryRun: false,
          mutationPerformed: false,
          created: false,
          affectedRecordIds: [duplicate.id],
          application: duplicate,
          duplicate: { code: "duplicate_record", existingApplicationId: duplicate.id },
          applicationPath: `/dashboard/applications/${duplicate.id}`,
          warnings: ["No new application was created."],
        };
        const application = await repository.createApplication(plannedMutation.values);
        return {
          dryRun: false,
          mutationPerformed: true,
          created: true,
          affectedRecordIds: [application.id],
          appliedMutation: { ...plannedMutation, created_id: application.id },
          application,
          applicationId: application.id,
          applicationPath: `/dashboard/applications/${application.id}`,
          before: null,
          after: { id: application.id, grant_id: application.grant_id, project_id: application.project_id, status: application.status },
          warnings: [],
        };
      },
    },
    {
      name: "generate_application_checklist",
      description: "Create a standard internal checklist for an application workspace.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ applicationId: z.string().min(1), dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "task_created",
      risks: ["Creates internal tasks tied to an application."],
      relatedTables: ["applications", "tasks", "grants", "projects"],
      touchesRealDb: true,
      async execute({ applicationId, dryRun }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${applicationId} was not found.`);
        const [grant, project, existingTasks] = await Promise.all([
          application.grant_id ? repository.getGrant(application.grant_id) : Promise.resolve(null),
          application.project_id ? repository.getProject(application.project_id) : Promise.resolve(null),
          repository.listTasksByApplication(application.id),
        ]);
        if (!grant) throw makeToolError("grant_not_found", `Application ${applicationId} has no linked grant.`);
        const template = buildChecklistTemplate(grant, project);
        const existingTitles = new Set(existingTasks.map((task) => task.title.trim().toLowerCase()));
        const missing = template.filter((item) => !existingTitles.has(item.title.trim().toLowerCase()));
        const skipped = template
          .filter((item) => existingTitles.has(item.title.trim().toLowerCase()))
          .map((item) => ({ title: item.title, reason: "duplicate_task" }));
        if (dryRun) {
          return {
            ...buildDryRunPlan(
            { action: "create_many", table: "tasks", count: missing.length, items: missing.map((item) => ({ ...item, due_date: grant.deadline ?? grant.next_deadline, related_application_id: application.id, related_grant_id: grant.id, related_project_id: application.project_id })) },
            ["tasks"],
            { createdTasks: missing }
            ),
            affectedRecordIds: [],
            skipped,
            warnings: [],
          };
        }
        const createdTasks = [];
        for (const item of missing) {
          createdTasks.push(await repository.createTask({
            title: item.title,
            description: item.description,
            owner_name: application.owner_name,
            status: "Not Started",
            priority: item.priority,
            due_date: grant.deadline ?? grant.next_deadline,
            related_project_id: application.project_id,
            related_grant_id: application.grant_id,
            related_application_id: application.id,
            related_proof_item_id: null,
            notes: "Generated by Grant OS agent-tools checklist generator.",
            archived_at: null,
          }));
        }
        return {
          dryRun: false,
          mutationPerformed: createdTasks.length > 0,
          affectedRecordIds: createdTasks.map((task) => task.id),
          appliedMutation: { table: "tasks", action: "create_many", created_ids: createdTasks.map((task) => task.id) },
          createdTasks: createdTasks.length ? createdTasks : existingTasks.filter((task) => template.some((item) => item.title === task.title)),
          newlyCreatedTasks: createdTasks,
          skipped,
          before: { taskCount: existingTasks.length },
          after: { taskCount: existingTasks.length + createdTasks.length },
          warnings: [],
        };
      },
    },
    {
      name: "create_task",
      description: "Create a new internal task.",
      permissionLevel: "write_safe",
      inputSchema: z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        ownerName: z.string().optional(),
        status: taskStatusSchema.default("Not Started"),
        priority: taskPrioritySchema.default("Medium"),
        dueDate: z.string().date().optional(),
        relatedProjectId: z.string().optional(),
        relatedGrantId: z.string().optional(),
        relatedApplicationId: z.string().optional(),
        notes: z.string().optional(),
        dryRun: z.boolean().default(true),
      }),
      dryRunSupported: true,
      auditAction: "task_created",
      risks: ["Creates operational tasks that humans may act on."],
      relatedTables: ["tasks"],
      touchesRealDb: true,
      async execute(input) {
        const [grant, application, project, existingTasks] = await Promise.all([
          input.relatedGrantId ? repository.getGrant(input.relatedGrantId) : Promise.resolve(null),
          input.relatedApplicationId ? repository.getApplication(input.relatedApplicationId) : Promise.resolve(null),
          input.relatedProjectId ? repository.getProject(input.relatedProjectId) : Promise.resolve(null),
          repository.listTasks(),
        ]);
        if (input.relatedGrantId && !grant) throw makeToolError("record_not_found", `Grant ${input.relatedGrantId} was not found.`);
        if (input.relatedApplicationId && !application) throw makeToolError("record_not_found", `Application ${input.relatedApplicationId} was not found.`);
        if (input.relatedProjectId && !project) throw makeToolError("record_not_found", `Project ${input.relatedProjectId} was not found.`);
        const duplicate = existingTasks.find((task) =>
          task.title.trim().toLowerCase() === input.title.trim().toLowerCase() &&
          task.related_application_id === (input.relatedApplicationId ?? null) &&
          task.related_grant_id === (input.relatedGrantId ?? null)
        );
        if (duplicate) throw makeToolError("duplicate_record", `Task already exists as ${duplicate.id}.`);
        const plannedMutation = {
          table: "tasks",
          action: "create",
          values: {
            title: input.title,
            description: input.description ?? null,
            owner_name: input.ownerName ?? null,
            status: input.status,
            priority: input.priority,
            due_date: input.dueDate ?? null,
            related_project_id: input.relatedProjectId ?? null,
            related_grant_id: input.relatedGrantId ?? null,
            related_application_id: input.relatedApplicationId ?? null,
            related_proof_item_id: null,
            notes: input.notes ?? null,
            archived_at: null,
          },
        };
        if (input.dryRun) return { ...buildDryRunPlan(plannedMutation, ["tasks"]), affectedRecordIds: [], warnings: [] };
        const task = await repository.createTask(plannedMutation.values);
        return {
          dryRun: false,
          mutationPerformed: true,
          affectedRecordIds: [task.id],
          appliedMutation: { ...plannedMutation, created_id: task.id },
          task,
          before: null,
          after: { id: task.id, title: task.title, status: task.status, due_date: task.due_date },
          warnings: [],
        };
      },
    },
    {
      name: "update_task_status",
      description: "Update a task status safely.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ taskId: z.string().min(1), status: taskStatusSchema, dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Task status changes can affect downstream human workflows."],
      relatedTables: ["tasks"],
      touchesRealDb: true,
      async execute({ taskId, status, dryRun }) {
        const task = await repository.getTask(taskId);
        if (!task) throw makeToolError("task_not_found", `Task ${taskId} was not found.`);
        const previousStatus = task.status;
        const plannedMutation = { table: "tasks", action: "update", id: taskId, values: { status } };
        if (dryRun) return { ...buildDryRunPlan(plannedMutation, ["tasks"], { previousStatus }), affectedRecordIds: [], warnings: [] };
        const updated = await repository.updateTaskStatus(taskId, status);
        return {
          dryRun: false,
          mutationPerformed: updated.status !== previousStatus,
          affectedRecordIds: [taskId],
          appliedMutation: plannedMutation,
          task: updated,
          before: { id: taskId, status: previousStatus },
          after: { id: taskId, status: updated.status },
          warnings: updated.status === previousStatus ? ["Task already had the requested status."] : [],
        };
      },
    },
    {
      name: "add_application_note",
      description: "Add a non-destructive application note for human review.",
      permissionLevel: "write_safe",
      inputSchema: z.object({
        applicationId: z.string().min(1),
        title: z.string().min(1).max(120),
        content: z.string().min(1).max(5000),
        dryRun: z.boolean().default(true),
      }),
      dryRunSupported: true,
      auditAction: "note_created",
      risks: ["Notes become part of internal decision context."],
      relatedTables: ["applications", "agent_notes"],
      touchesRealDb: true,
      async execute({ applicationId, title, content, dryRun }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${applicationId} was not found.`);
        const plannedMutation = { table: "agent_notes", action: "create", values: { applicationId, title, content } };
        if (dryRun) return buildDryRunPlan(plannedMutation, ["agent_notes"]);
        const note = await repository.createApplicationNote({ applicationId, title, content });
        return {
          dryRun: false,
          mutationPerformed: true,
          affectedRecordIds: [note.id],
          appliedMutation: { ...plannedMutation, created_id: note.id },
          note,
          before: null,
          after: { id: note.id, application_id: note.related_application_id, title: note.title },
          warnings: [],
        };
      },
    },
    {
      name: "add_peer_organization",
      description: "Create a new peer organization record.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ name: z.string().min(1), website: z.string().optional(), description: z.string().optional(), sourceUrl: z.string().optional(), dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Creates new peer intelligence records that humans may rely on."],
      relatedTables: ["peer_organizations"],
      touchesRealDb: true,
      async execute({ name, website, description, sourceUrl, dryRun }) {
        const plannedMutation = {
          table: "peer_organizations",
          action: "create",
          values: {
            legacy_id: null,
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || null,
            website: website ?? null,
            ein: null,
            location: null,
            address: null,
            description: description ?? null,
            assets: null,
            annual_revenue: null,
            focus_areas: [],
            relevance: null,
            relevance_to_playa: null,
            similarity_score: null,
            confidence: "draft",
            known_funders: [],
            source_url: sourceUrl ?? null,
            source_metadata: {},
            import_source: "agent_tools_manual",
            last_researched_at: null,
            key_people: null,
            saved_opportunities: null,
            notes: null,
            archived_at: null,
          },
        };
        if (dryRun) return buildDryRunPlan(plannedMutation, ["peer_organizations"]);
        return { dryRun: false, peer: await repository.createPeerOrganization(plannedMutation.values) };
      },
    },
    {
      name: "add_peer_funding_record",
      description: "Add a peer funding record from a verified source.",
      permissionLevel: "write_safe",
      inputSchema: z.object({
        peerOrganizationId: z.string().min(1),
        funderId: z.string().optional(),
        funderName: z.string().optional(),
        amount: z.number().optional(),
        awardYear: z.number().int().optional(),
        purpose: z.string().optional(),
        sourceUrl: z.string().optional(),
        dryRun: z.boolean().default(true),
      }),
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Creates competitive intelligence records that require source accuracy."],
      relatedTables: ["peer_funding_records", "peer_organizations", "funders"],
      touchesRealDb: true,
      async execute(input) {
        const peer = await repository.getPeer(input.peerOrganizationId);
        if (!peer) throw makeToolError("peer_not_found", `Peer ${input.peerOrganizationId} was not found.`);
        const plannedMutation = {
          table: "peer_funding_records",
          action: "create",
          values: {
            peer_organization_id: peer.id,
            funder_id: input.funderId ?? null,
            funder_name: input.funderName ?? null,
            year: input.awardYear ?? null,
            amount: input.amount ?? null,
            amount_min: null,
            amount_max: null,
            amount_exact: input.amount ?? null,
            award_year: input.awardYear ?? null,
            purpose: input.purpose ?? null,
            program_area: null,
            source_url: input.sourceUrl ?? null,
            source_metadata: {},
            confidence: "draft",
            notes: null,
            archived_at: null,
          },
        };
        if (input.dryRun) return buildDryRunPlan(plannedMutation, ["peer_funding_records"]);
        return { dryRun: false, record: await repository.createPeerFundingRecord(plannedMutation.values) };
      },
    },
    {
      name: "mark_grant_status",
      description: "Update a grant status in a controlled way.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ grantId: z.string().min(1), status: grantStatusSchema, dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Grant status changes affect pipeline reporting and prioritization."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute({ grantId, status, dryRun }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        const before = {
          id: grantId,
          status: grant.status,
          archived_at: grant.archived_at,
          is_top_three: grant.is_top_three,
        };
        const values = status === "Archived"
          ? { status, archived_at: new Date().toISOString(), is_top_three: false }
          : { status };
        const plannedMutation = { table: "grants", action: status === "Archived" ? "soft_archive" : "update", id: grantId, values };
        if (dryRun) return buildDryRunPlan(plannedMutation, ["grants"], { previousStatus: before.status, before });
        const updated = status === "Archived"
          ? await repository.updateGrant(grantId, values)
          : await repository.updateGrantStatus(grantId, status);
        return {
          dryRun: false,
          mutationPerformed: updated.status !== before.status || (status === "Archived" && (before.archived_at === null || before.is_top_three)),
          affectedRecordIds: [grantId],
          appliedMutation: plannedMutation,
          grant: updated,
          before,
          after: { id: grantId, status: updated.status, archived_at: updated.archived_at, is_top_three: updated.is_top_three },
          warnings: updated.status === before.status && status !== "Archived" ? ["Grant already had the requested status."] : [],
        };
      },
    },
    {
      name: "archive_grant",
      description: "Soft-archive a grant and remove it from Top 3 without deleting it.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ grantId: z.string().min(1), reason: z.string().min(3), dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Archived grants disappear from active triage views."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute({ grantId, reason, dryRun }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found or is already archived.`);
        const values = { status: "Archived" as const, archived_at: new Date().toISOString(), is_top_three: false, notes: [grant.notes, `Archive reason: ${reason}`].filter(Boolean).join("\n") };
        const plannedMutation = { table: "grants", action: "soft_archive", id: grantId, values };
        if (dryRun) return buildDryRunPlan(plannedMutation, ["grants"], { before: { status: grant.status, is_top_three: grant.is_top_three, archived_at: grant.archived_at } });
        const updated = await repository.updateGrant(grantId, values);
        return { dryRun: false, mutationPerformed: true, affectedRecordIds: [grantId], appliedMutation: plannedMutation, before: { status: grant.status, is_top_three: grant.is_top_three }, after: { status: updated.status, is_top_three: updated.is_top_three, archived_at: updated.archived_at } };
      },
    },
    {
      name: "set_top_three_grant",
      description: "Set an active, unexpired grant as Top 3.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ grantId: z.string().min(1), dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Top 3 placement changes operator priorities."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute({ grantId, dryRun }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        const deadline = grant.deadline ?? grant.next_deadline;
        if (deadline && new Date(`${deadline}T23:59:59Z`).getTime() < Date.now()) throw makeToolError("grant_expired", "Expired grants cannot be added to Top 3.");
        if (["Archived", "Rejected", "Not Eligible"].includes(grant.status)) throw makeToolError("grant_inactive", `A grant with status ${grant.status} cannot be added to Top 3.`);
        const previousValue = grant.is_top_three;
        const plannedMutation = { table: "grants", action: "update", id: grantId, values: { is_top_three: true } };
        if (dryRun) return buildDryRunPlan(plannedMutation, ["grants"], { previousValue });
        const updated = await repository.updateGrant(grantId, { is_top_three: true });
        return {
          dryRun: false,
          mutationPerformed: !previousValue,
          affectedRecordIds: [grantId],
          appliedMutation: plannedMutation,
          grant: updated,
          before: { id: grantId, is_top_three: previousValue },
          after: { id: grantId, is_top_three: updated.is_top_three },
          warnings: previousValue ? ["Grant was already in Top 3."] : [],
        };
      },
    },
    {
      name: "remove_top_three_grant",
      description: "Remove a grant from Top 3 without archiving it.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ grantId: z.string().min(1), dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Top 3 placement changes operator priorities."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute({ grantId, dryRun }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        const previousValue = grant.is_top_three;
        const plannedMutation = { table: "grants", action: "update", id: grantId, values: { is_top_three: false } };
        if (dryRun) return buildDryRunPlan(plannedMutation, ["grants"], { previousValue });
        const updated = await repository.updateGrant(grantId, { is_top_three: false });
        return {
          dryRun: false,
          mutationPerformed: previousValue,
          affectedRecordIds: [grantId],
          appliedMutation: plannedMutation,
          grant: updated,
          before: { id: grantId, is_top_three: previousValue },
          after: { id: grantId, is_top_three: updated.is_top_three },
          warnings: previousValue ? [] : ["Grant was not in Top 3."],
        };
      },
    },
    {
      name: "update_application_status",
      description: "Update an internal application status.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ applicationId: z.string().min(1), status: applicationStatusSchema, dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Application status changes affect the operating pipeline."],
      relatedTables: ["applications"],
      touchesRealDb: true,
      async execute({ applicationId, status, dryRun }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${applicationId} was not found.`);
        const previousStatus = application.status;
        const plannedMutation = { table: "applications", action: "update", id: applicationId, values: { status } };
        if (dryRun) return buildDryRunPlan(plannedMutation, ["applications"], { previousStatus });
        const updated = await repository.updateApplication(applicationId, { status });
        return {
          dryRun: false,
          mutationPerformed: updated.status !== previousStatus,
          affectedRecordIds: [applicationId],
          appliedMutation: plannedMutation,
          application: updated,
          before: { id: applicationId, status: previousStatus },
          after: { id: applicationId, status: updated.status },
          warnings: updated.status === previousStatus ? ["Application already had the requested status."] : [],
        };
      },
    },
    {
      name: "update_task_due_date",
      description: "Update or clear a task due date.",
      permissionLevel: "write_safe",
      inputSchema: z.object({ taskId: z.string().min(1), dueDate: z.string().date().nullable(), dryRun: z.boolean().default(true) }),
      dryRunSupported: true,
      auditAction: "status_updated",
      risks: ["Due dates affect deadline planning."],
      relatedTables: ["tasks"],
      touchesRealDb: true,
      async execute({ taskId, dueDate, dryRun }) {
        const task = await repository.getTask(taskId);
        if (!task) throw makeToolError("task_not_found", `Task ${taskId} was not found.`);
        const previousDueDate = task.due_date;
        const plannedMutation = { table: "tasks", action: "update", id: taskId, values: { due_date: dueDate } };
        if (dryRun) return { ...buildDryRunPlan(plannedMutation, ["tasks"], { previousDueDate }), affectedRecordIds: [], warnings: [] };
        const updated = await repository.updateTask(taskId, { due_date: dueDate });
        return {
          dryRun: false,
          mutationPerformed: updated.due_date !== previousDueDate,
          affectedRecordIds: [taskId],
          appliedMutation: plannedMutation,
          task: updated,
          before: { id: taskId, due_date: previousDueDate },
          after: { id: taskId, due_date: updated.due_date },
          warnings: updated.due_date === previousDueDate ? ["Task already had the requested due date."] : [],
        };
      },
    },
    {
      name: "save_grant_to_shortlist",
      description: "Save a grant to the shortlist tracker without destructive changes.",
      permissionLevel: "write_safe",
      inputSchema: z.object({
        grantId: z.string().min(1),
        projectId: z.string().optional(),
        status: z.enum(["New", "Watching", "Shortlisted", "Apply", "Skip", "Archived", "Not relevant"]).default("Shortlisted"),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
        ownerName: z.string().optional(),
        notes: z.string().optional(),
        nextAction: z.string().optional(),
        dueDate: z.string().optional(),
        dryRun: z.boolean().default(true),
      }),
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Shortlist changes influence prioritization and downstream work."],
      relatedTables: ["grant_shortlist_items", "grants", "projects"],
      touchesRealDb: true,
      async execute(input) {
        const grant = await repository.getGrant(input.grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${input.grantId} was not found.`);
        if (input.projectId) {
          const project = await repository.getProject(input.projectId);
          if (!project) throw makeToolError("project_not_found", `Project ${input.projectId} was not found.`);
        }
        const plannedMutation = {
          table: "grant_shortlist_items",
          action: "upsert",
          values: {
            grant_id: input.grantId,
            project_id: input.projectId ?? null,
            status: input.status,
            priority: input.priority,
            owner_name: input.ownerName ?? null,
            notes: input.notes ?? null,
            next_action: input.nextAction ?? null,
            due_date: input.dueDate ?? null,
          },
        };
        if (input.dryRun) return buildDryRunPlan(plannedMutation, ["grant_shortlist_items"]);
        return { dryRun: false, shortlistItem: await repository.saveGrantToShortlist(plannedMutation.values) };
      },
    },
    {
      name: "archive_record",
      description: "Approval gate for archive actions.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ recordType: z.string().min(1), recordId: z.string().min(1), reason: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["Archiving records affects operational visibility and can hide data from workflows."],
      relatedTables: ["grants", "applications", "tasks", "documents", "projects", "peer_organizations"],
      touchesRealDb: false,
      async execute({ recordType, recordId, reason }) {
        return approval(
          "archive_record",
          reason,
          ["Archiving records affects operational visibility and can hide data from workflows."],
          [{ table: recordType, id: recordId }],
          { action: "archive", recordType, recordId },
        );
      },
    },
    {
      name: "delete_record",
      description: "Approval gate for delete actions.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ recordType: z.string().min(1), recordId: z.string().min(1), reason: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["Deletion is destructive and not implemented."],
      relatedTables: ["*"],
      touchesRealDb: false,
      async execute({ recordType, recordId, reason }) {
        return approval(
          "delete_record",
          reason,
          ["Deletion is destructive and not implemented."],
          [{ table: recordType, id: recordId }],
          { action: "delete", recordType, recordId },
        );
      },
    },
    {
      name: "bulk_update_records",
      description: "Approval gate for bulk updates.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ table: z.string().min(1), filters: z.record(z.unknown()), updates: z.record(z.unknown()), reason: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["Bulk updates can create wide unintended changes."],
      relatedTables: ["*"],
      touchesRealDb: false,
      async execute({ table, filters, updates, reason }) {
        return approval(
          "bulk_update_records",
          reason,
          ["Bulk updates can create wide unintended changes."],
          [{ table, id: "bulk" }],
          { action: "bulk_update", table, filters, updates },
        );
      },
    },
    {
      name: "send_outreach",
      description: "Approval gate for outreach actions.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ channel: z.string().min(1), target: z.string().min(1), message: z.string().min(1), reason: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["External communications can misrepresent the organization and create obligations."],
      relatedTables: ["funders", "peer_organizations"],
      touchesRealDb: false,
      async execute({ channel, target, message, reason }) {
        return approval(
          "send_outreach",
          reason,
          ["External communications can misrepresent the organization and create obligations."],
          [],
          { action: "send_outreach", channel, target, message },
        );
      },
    },
    {
      name: "submit_application_externally",
      description: "Approval gate for external submission.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ applicationId: z.string().min(1), reason: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["External submission creates real-world consequences and is intentionally disabled."],
      relatedTables: ["applications", "grants"],
      touchesRealDb: false,
      async execute({ applicationId, reason }) {
        return approval(
          "submit_application_externally",
          reason,
          ["External submission creates real-world consequences and is intentionally disabled."],
          [{ table: "applications", id: applicationId }],
          { action: "submit_application_externally", applicationId },
        );
      },
    },
    {
      name: "run_import_job",
      description: "Approval gate for imports.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ source: z.string().min(1), reason: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["Imports can add noisy or malformed data at scale."],
      relatedTables: ["grants", "funders", "documents"],
      touchesRealDb: false,
      async execute({ source, reason }) {
        return approval(
          "run_import_job",
          reason,
          ["Imports can add noisy or malformed data at scale."],
          [],
          { action: "run_import_job", source },
        );
      },
    },
    {
      name: "run_scraping_job",
      description: "Approval gate for scraping jobs.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ source: z.string().min(1), reason: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["Scraping can violate terms, overload sites, or ingest bad data."],
      relatedTables: ["grants", "funders", "documents"],
      touchesRealDb: false,
      async execute({ source, reason }) {
        return approval(
          "run_scraping_job",
          reason,
          ["Scraping can violate terms, overload sites, or ingest bad data."],
          [],
          { action: "run_scraping_job", source },
        );
      },
    },
    {
      name: "mutate_public_website_content",
      description: "Approval gate for changes to public website content.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ target: z.string().min(1), change: z.record(z.unknown()), reason: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["Public-site mutations can expose inaccurate or unreviewed content."],
      relatedTables: ["projects", "proof_items", "documents"],
      touchesRealDb: false,
      async execute({ target, change, reason }) {
        return approval(
          "mutate_public_website_content",
          reason,
          ["Public-site mutations can expose inaccurate or unreviewed content."],
          [{ table: target, id: "public-content" }],
          { action: "mutate_public_website_content", target, change },
        );
      },
    },
    {
      name: "change_access_policies",
      description: "Approval gate for RLS/policy changes.",
      permissionLevel: "approval_required",
      inputSchema: z.object({ target: z.string().min(1), reason: z.string().min(1), proposedChange: z.record(z.unknown()) }),
      dryRunSupported: false,
      auditAction: "manual_entry",
      risks: ["RLS/policy changes can expose data or weaken security."],
      relatedTables: ["policies", "rls"],
      touchesRealDb: false,
      async execute({ target, reason, proposedChange }) {
        return approval(
          "change_access_policies",
          reason,
          ["RLS/policy changes can expose data or weaken security."],
          [{ table: target, id: "policy-change" }],
          { action: "change_access_policies", target, proposedChange },
        );
      },
    },
  ];
}
