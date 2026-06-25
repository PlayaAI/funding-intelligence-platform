import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import { makeToolError } from "./safety";

export function createTaskTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_tasks",
      description: "List tasks with optional relation/status filters.",
      permissionLevel: "read",
      inputSchema: z.object({
        relatedGrantId: z.string().optional(),
        relatedApplicationId: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Tasks reveal internal ownership and execution state."],
      relatedTables: ["tasks"],
      touchesRealDb: true,
      async execute({ relatedGrantId, relatedApplicationId, status, limit }) {
        const DEFAULT_LIMIT = 25;
        const cap = Math.min(limit ?? DEFAULT_LIMIT, 100);
        let tasks = await repository.listTasks();
        if (relatedGrantId) tasks = tasks.filter((task) => task.related_grant_id === relatedGrantId);
        if (relatedApplicationId) tasks = tasks.filter((task) => task.related_application_id === relatedApplicationId);
        if (status) tasks = tasks.filter((task) => task.status === status);
        return { items: tasks.slice(0, cap), total: tasks.length, limit: cap };
      },
    },
    {
      name: "get_task",
      description: "Get a task by id.",
      permissionLevel: "read",
      inputSchema: z.object({ taskId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Task detail may expose internal notes or blockers."],
      relatedTables: ["tasks"],
      touchesRealDb: true,
      async execute({ taskId }) {
        const task = await repository.getTask(taskId);
        if (!task) throw makeToolError("task_not_found", `Task ${taskId} was not found.`);
        return { task };
      },
    },
  ];
}
