import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useApplications, useCreateApplication } from "@/hooks/useApplications";
import { useGrants } from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useDocuments } from "@/hooks/useDocuments";
import ApplicationFormDialog, { type ApplicationFormValues } from "@/components/dashboard/ApplicationFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Plus, FileArchive, LayoutList, LayoutGrid, Loader2, AlertCircle, Search } from "lucide-react";
import type { ApplicationDbStatus } from "@/types/database";
import { usePermissions } from "@/hooks/usePermissions";

const APP_STATUSES: ApplicationDbStatus[] = [
  "Not Started", "Drafting", "Internal Review", "Ready to Submit",
  "Submitted", "Awarded", "Declined",
];

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-slate-100 text-slate-700 border-slate-200",
  Drafting: "bg-blue-50 text-blue-700 border-blue-200",
  "Internal Review": "bg-amber-50 text-amber-700 border-amber-200",
  "Ready to Submit": "bg-teal-50 text-teal-700 border-teal-200",
  Submitted: "bg-violet-50 text-violet-700 border-violet-200",
  Awarded: "bg-green-50 text-green-700 border-green-200",
  Declined: "bg-red-50 text-red-700 border-red-200",
  Archived: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function DashboardApplicationsPage() {
  const [view, setView] = useState<"table" | "board">("table");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"due_date" | "updated_at" | "status">("due_date");

  const { data: applications = [], isLoading, isError, error } = useApplications();
  const { data: grants = [] } = useGrants();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: documents = [] } = useDocuments();
  const createApp = useCreateApplication();
  const { canCreateTable } = usePermissions();

  const grantMap = useMemo(() => new Map(grants.map((g) => [g.id, g])), [grants]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const statusOrder = useMemo(() => new Map(APP_STATUSES.map((status, index) => [status, index])), []);
  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return [...applications]
      .filter((app) => {
        const grant = app.grant_id ? grantMap.get(app.grant_id) : null;
        const project = app.project_id ? projectMap.get(app.project_id) : null;
        if (statusFilter !== "all" && app.status !== statusFilter) return false;
        if (projectFilter !== "all" && app.project_id !== projectFilter) return false;
        if (deadlineFilter !== "all") {
          if (!grant?.deadline) return false;
          const due = new Date(grant.deadline);
          const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
          if (deadlineFilter === "overdue" && days >= 0) return false;
          if (deadlineFilter === "30" && (days < 0 || days > 30)) return false;
          if (deadlineFilter === "90" && (days < 0 || days > 90)) return false;
        }
        if (!q) return true;
        return [app.title, app.status, grant?.title, grant?.funder_name, project?.name, app.owner_name]
          .some((value) => (value ?? "").toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (sortBy === "updated_at") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        if (sortBy === "status") return (statusOrder.get(a.status) ?? 99) - (statusOrder.get(b.status) ?? 99);
        const aGrant = a.grant_id ? grantMap.get(a.grant_id) : null;
        const bGrant = b.grant_id ? grantMap.get(b.grant_id) : null;
        if (!aGrant?.deadline && !bGrant?.deadline) return 0;
        if (!aGrant?.deadline) return 1;
        if (!bGrant?.deadline) return -1;
        return new Date(aGrant.deadline).getTime() - new Date(bGrant.deadline).getTime();
      });
  }, [applications, deadlineFilter, grantMap, projectFilter, projectMap, search, sortBy, statusFilter, statusOrder]);

  const handleCreate = async (values: ApplicationFormValues) => {
    try {
      await createApp.mutateAsync({
        title: values.title,
        status: (values.status as ApplicationDbStatus) ?? "Drafting",
        owner_name: values.owner_name || null,
        grant_id: values.grant_id || null,
        project_id: values.project_id || null,
        google_doc_url: values.google_doc_url || null,
        drive_folder_url: values.drive_folder_url || null,
        portal_url: values.portal_url || null,
        notes: values.notes || null,
      });
      toast({ title: "Application created", description: values.title });
      setCreateOpen(false);
    } catch (e) {
      toast({ title: "Failed to create application", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading applications…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">Failed to load applications</p>
            <p className="text-red-600 mt-0.5">{error instanceof Error ? error.message : String(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Applications</h1>
          <p className="text-slate-500 text-sm mt-0.5">{applications.length} application workspaces</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5">
            <button onClick={() => setView("table")} className={`p-1.5 rounded text-slate-500 transition-colors ${view === "table" ? "bg-slate-100 text-slate-800" : "hover:bg-slate-50"}`}>
              <LayoutList size={14} />
            </button>
            <button onClick={() => setView("board")} className={`p-1.5 rounded text-slate-500 transition-colors ${view === "board" ? "bg-slate-100 text-slate-800" : "hover:bg-slate-50"}`}>
              <LayoutGrid size={14} />
            </button>
          </div>
          {canCreateTable("applications") && (
            <Button size="sm" className="gap-2 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New application
            </Button>
          )}
        </div>
      </div>

      {applications.length === 0 && (
        <Card className="border-dashed border-slate-200"><CardContent className="py-16 text-center"><FileArchive size={26} className="mx-auto mb-3 text-slate-300" /><h2 className="text-sm font-semibold text-slate-800">No active applications yet</h2><p className="mt-1 text-sm text-slate-500">Start from a grant to create an application workspace, or create one manually when needed.</p><div className="mt-4 flex justify-center gap-2">{canCreateTable("applications") && <Button size="sm" className="gap-2 text-xs" onClick={() => setCreateOpen(true)}><Plus size={14} />New application</Button>}<Link href="/dashboard/grants"><Button size="sm" variant="outline" className="text-xs">Browse grants</Button></Link></div></CardContent></Card>
      )}

      {applications.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="relative min-w-56 flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search applications..." className="h-8 pl-8 text-xs" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="all">All statuses</option>
            {APP_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="all">All projects</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select value={deadlineFilter} onChange={(e) => setDeadlineFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="all">All deadlines</option>
            <option value="overdue">Overdue</option>
            <option value="30">Next 30 days</option>
            <option value="90">Next 90 days</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="due_date">Sort by due date</option>
            <option value="updated_at">Sort by updated date</option>
            <option value="status">Sort by status</option>
          </select>
        </div>
      )}

      {view === "table" ? (
        <div className="space-y-3">
          {applications.length > 0 && filteredApplications.length === 0 && <div className="py-12 text-center text-sm text-slate-400">No applications match the current filters.</div>}
          {filteredApplications.map((a) => {
            const grant = a.grant_id ? grantMap.get(a.grant_id) : null;
            const project = a.project_id ? projectMap.get(a.project_id) : null;
            const openTasks = tasks.filter((task) => task.related_application_id === a.id && task.status !== "Complete").length;
            const docCount = documents.filter((doc) => doc.related_application_id === a.id || doc.related_grant_id === a.grant_id || doc.related_project_id === a.project_id).length;
            return (
              <Link href={`/dashboard/applications/${a.id}`} key={a.id}>
                <Card className="border-slate-200 hover:border-primary/40 cursor-pointer transition-all hover:shadow-sm">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileArchive size={16} className="text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-sm line-clamp-1">{a.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {grant?.title ?? "No grant"} · {grant?.funder_name ?? "No funder"} · {project?.name ?? "No project"}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {openTasks} open tasks · {docCount} documents
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[a.status] ?? ""}`}>
                          {a.status}
                        </span>
                        {grant?.deadline && (
                          <div className="text-xs text-slate-500">
                            {a.status === "Submitted" && a.submitted_at
                              ? `Submitted ${new Date(a.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                              : `Due ${new Date(grant.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                          </div>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs">Open Workspace</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {APP_STATUSES.map((col) => {
              const colApps = filteredApplications.filter((a) => a.status === col);
              return (
                <div key={col} className="w-60 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[col]}`}>{col}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">{colApps.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colApps.map((a) => {
                      const project = a.project_id ? projectMap.get(a.project_id) : null;
                      return (
                        <Link href={`/dashboard/applications/${a.id}`} key={a.id}>
                          <div className="bg-white border border-slate-200 rounded-lg p-3 hover:border-primary/40 cursor-pointer transition-colors">
                            <div className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug mb-1">{a.title}</div>
                            <div className="text-[11px] text-slate-400">{project?.name ?? "—"}</div>
                          </div>
                        </Link>
                      );
                    })}
                    {colApps.length === 0 && (
                      <div className="text-xs text-slate-300 text-center py-6 border-2 border-dashed border-slate-100 rounded-lg">None</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ApplicationFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        title="New application"
        submitLabel="Create application"
        loading={createApp.isPending}
      />
    </div>
  );
}
