import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useTasks, useCreateTask, useUpdateTask, useArchiveTask, useDeleteTask } from "@/hooks/useTasks";
import { useGrants } from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { useApplications } from "@/hooks/useApplications";
import TaskFormDialog, { type TaskFormValues } from "@/components/dashboard/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Plus, Loader2, AlertCircle, CheckSquare, Archive, Trash2 } from "lucide-react";
import type { TaskDbStatus, TaskDbPriority } from "@/types/database";
import { usePermissions } from "@/hooks/usePermissions";

const ALL_STATUSES: TaskDbStatus[] = ["Not Started", "In Progress", "Waiting", "Needs Review", "Complete"];
const ALL_PRIORITIES: TaskDbPriority[] = ["Urgent", "High", "Medium", "Low"];

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-slate-100 text-slate-600",
  "In Progress": "bg-blue-50 text-blue-700",
  Waiting: "bg-amber-50 text-amber-700",
  "Needs Review": "bg-violet-50 text-violet-700",
  Complete: "bg-green-50 text-green-700",
  Archived: "bg-gray-100 text-gray-500",
};

const PRIORITY_DOTS: Record<string, string> = {
  Urgent: "bg-red-500", High: "bg-red-400", Medium: "bg-amber-400", Low: "bg-slate-300",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function DashboardTasksPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterApplication, setFilterApplication] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"due_date" | "priority" | "status">("due_date");

  const { data: allTasks = [], isLoading, isError, error } = useTasks();
  const { data: grants = [] } = useGrants();
  const { data: projects = [] } = useProjects();
  const { data: applications = [] } = useApplications();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const deleteTask = useDeleteTask();
  const { canCreateTable, canUpdateTable } = usePermissions();

  const grantMap = useMemo(() => new Map(grants.map((g) => [g.id, g])), [grants]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const applicationMap = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);

  const priorityOrder: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
  const statusOrder: Record<string, number> = { "Not Started": 0, "In Progress": 1, Waiting: 2, "Needs Review": 3, Complete: 4 };

  const filtered = useMemo(() => {
    let list = allTasks;
    if (filterStatus !== "all") list = list.filter((t) => t.status === filterStatus);
    if (filterPriority !== "all") list = list.filter((t) => t.priority === filterPriority);
    if (filterApplication !== "all") list = list.filter((t) => t.related_application_id === filterApplication);
    if (filterProject !== "all") list = list.filter((t) => t.related_project_id === filterProject);

    return [...list].sort((a, b) => {
      if (sortBy === "due_date") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (sortBy === "priority") return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    });
  }, [allTasks, filterStatus, filterPriority, filterApplication, filterProject, sortBy]);

  const handleCreate = async (values: TaskFormValues) => {
    try {
      await createTask.mutateAsync({
        title: values.title,
        description: values.description || null,
        owner_name: values.owner_name || null,
        status: (values.status as TaskDbStatus) ?? "Not Started",
        priority: (values.priority as TaskDbPriority) ?? "Medium",
        due_date: values.due_date || null,
        related_grant_id: values.related_grant_id || null,
        related_project_id: values.related_project_id || null,
        related_application_id: values.related_application_id || null,
        notes: values.notes || null,
      });
      toast({ title: "Task created", description: values.title });
      setCreateOpen(false);
    } catch (e) {
      toast({ title: "Failed to create task", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleEdit = async (values: TaskFormValues) => {
    if (!editId) return;
    try {
      await updateTask.mutateAsync({
        id: editId,
        updates: {
          title: values.title,
          description: values.description || null,
          owner_name: values.owner_name || null,
          status: (values.status as TaskDbStatus),
          priority: (values.priority as TaskDbPriority),
          due_date: values.due_date || null,
          related_grant_id: values.related_grant_id || null,
          related_project_id: values.related_project_id || null,
          related_application_id: values.related_application_id || null,
          notes: values.notes || null,
        },
      });
      toast({ title: "Task updated" });
      setEditId(null);
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading tasks…</div>;
  }

  if (isError) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">Failed to load tasks</p>
            <p className="text-red-600 mt-0.5">{error instanceof Error ? error.message : String(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  const editingTask = editId ? allTasks.find((t) => t.id === editId) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 text-sm mt-0.5">{allTasks.length} tasks · {allTasks.filter((t) => t.status !== "Complete").length} open</p>
        </div>
        {canCreateTable("tasks") && (
          <Button size="sm" className="gap-2 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Add task
          </Button>
        )}
      </div>

      {allTasks.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="all">All statuses</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="all">All priorities</option>
            {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterApplication} onChange={(e) => setFilterApplication(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="all">All applications</option>
            {applications.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="due_date">Sort by due date</option>
            <option value="priority">Sort by priority</option>
            <option value="status">Sort by status</option>
          </select>
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center text-sm text-slate-500">
          <CheckSquare size={26} className="mx-auto mb-3 text-slate-300" />
          <div className="font-medium text-slate-700">{allTasks.length === 0 ? "No active tasks yet" : "No tasks match the current filters"}</div>
          <p className="mt-1">{allTasks.length === 0 ? "Tasks are created from applications or added manually." : "Adjust the status, priority, application, or project filters."}</p>
          {allTasks.length === 0 && canCreateTable("tasks") && <Button size="sm" className="mt-4 gap-2 text-xs" onClick={() => setCreateOpen(true)}><Plus size={14} />Add task</Button>}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((t) => {
          const grant = t.related_grant_id ? grantMap.get(t.related_grant_id) : null;
          const project = t.related_project_id ? projectMap.get(t.related_project_id) : null;
          const application = t.related_application_id ? applicationMap.get(t.related_application_id) : null;
          const days = t.due_date ? daysUntil(t.due_date) : null;

          return (
            <Card key={t.id} className={`border-slate-200 transition-all ${canUpdateTable("tasks") ? "hover:border-primary/40 hover:shadow-sm cursor-pointer" : ""}`} onClick={() => canUpdateTable("tasks") && setEditId(t.id)}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${PRIORITY_DOTS[t.priority] ?? "bg-slate-300"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium leading-snug ${t.status === "Complete" ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          {t.owner_name && <span>{t.owner_name}</span>}
                          {application && <Link href={`/dashboard/applications/${application.id}`} className="text-primary hover:underline">· Application: {application.title}</Link>}
                          {grant && <Link href={`/dashboard/grants/${grant.id}`} className="text-primary hover:underline">· Grant: {grant.title}</Link>}
                          {project && <Link href={`/dashboard/projects/${project.slug}`} className="text-primary hover:underline">· Project: {project.name}</Link>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {t.due_date && (
                          <div className={`text-xs font-medium ${days !== null && days <= 3 ? "text-red-600" : days !== null && days <= 7 ? "text-amber-600" : "text-slate-500"}`}>
                            {formatDate(t.due_date)}
                          </div>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] ?? ""}`}>{t.status}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-slate-400 hover:text-amber-600" onClick={async (e) => {
                          e.stopPropagation();
                          try { await archiveTask.mutateAsync(t.id); toast({ title: "Task archived" }); } catch { toast({ title: "Archive failed", variant: "destructive" }); }
                        }}><Archive size={12} /></Button>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-slate-400 hover:text-red-600" onClick={async (e) => {
                          e.stopPropagation();
                          try { await deleteTask.mutateAsync(t.id); toast({ title: "Task deleted" }); } catch { toast({ title: "Delete failed", variant: "destructive" }); }
                        }}><Trash2 size={12} /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TaskFormDialog
        open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate}
        title="New task" submitLabel="Create task" loading={createTask.isPending}
      />

      {editingTask && (
        <TaskFormDialog
          open onOpenChange={(o) => { if (!o) setEditId(null); }} onSubmit={handleEdit}
          defaultValues={editingTask} title="Edit task" submitLabel="Save" loading={updateTask.isPending}
        />
      )}
    </div>
  );
}
