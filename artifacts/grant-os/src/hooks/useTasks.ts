import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTasks,
  getTaskById,
  listTasksByGrant,
  listTasksByProject,
  listTasksByApplication,
  createTask,
  updateTask,
  archiveTask,
  deleteTask,
  type TaskRow,
  type TaskInsert,
  type TaskUpdate,
  type ListTasksOptions,
} from "@/lib/tasksService";

export type { TaskRow, TaskInsert, TaskUpdate, ListTasksOptions };

export const TASKS_QUERY_KEY = ["tasks"] as const;

export function useTasks(opts?: ListTasksOptions) {
  return useQuery({
    queryKey: opts?.includeSoftArchived
      ? [...TASKS_QUERY_KEY, "includeSoftArchived"]
      : TASKS_QUERY_KEY,
    queryFn: () => listTasks(opts),
    staleTime: 1000 * 60,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, id],
    queryFn: () => getTaskById(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });
}

export function useTasksByGrant(grantId: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, "byGrant", grantId],
    queryFn: () => listTasksByGrant(grantId!),
    enabled: Boolean(grantId),
    staleTime: 1000 * 60,
  });
}

export function useTasksByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, "byProject", projectId],
    queryFn: () => listTasksByProject(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 60,
  });
}

export function useTasksByApplication(applicationId: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, "byApplication", applicationId],
    queryFn: () => listTasksByApplication(applicationId!),
    enabled: Boolean(applicationId),
    staleTime: 1000 * 60,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<TaskInsert, "id" | "created_at" | "updated_at">) => createTask(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Omit<TaskUpdate, "id" | "created_at"> }) =>
      updateTask(id, updates),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...TASKS_QUERY_KEY, id] });
    },
  });
}

export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}
