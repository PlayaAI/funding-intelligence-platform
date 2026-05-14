import { useState } from "react";
import { tasks, type TaskStatus, type TaskPriority } from "@/data/tasks";
import { grants } from "@/data/grants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, CheckCircle2, Circle, Clock, AlertCircle, ArrowUpDown } from "lucide-react";

const STATUS_COLORS: Record<TaskStatus, string> = {
  "Not Started": "bg-slate-100 text-slate-600 border-slate-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Waiting: "bg-amber-50 text-amber-700 border-amber-200",
  "Needs Review": "bg-violet-50 text-violet-700 border-violet-200",
  Complete: "bg-green-50 text-green-700 border-green-200",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

const ALL_STATUSES: (TaskStatus | "All")[] = ["All", "Not Started", "In Progress", "Waiting", "Needs Review", "Complete"];
const ALL_OWNERS = ["All", ...Array.from(new Set(tasks.map((t) => t.owner)))];
const GRANT_OPTIONS = ["All", ...Array.from(new Set(tasks.filter((t) => t.relatedGrantTitle).map((t) => t.relatedGrantTitle!)))];

const DUE_DATE_OPTIONS = [
  { label: "Any due date", days: Infinity },
  { label: "Overdue", days: -1 },
  { label: "Due today", days: 0 },
  { label: "Next 7 days", days: 7 },
  { label: "Next 30 days", days: 30 },
];

type SortField = "dueDate" | "priority";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<TaskPriority, number> = { High: 0, Medium: 1, Low: 2 };

export default function DashboardTasksPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "All">("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [grantFilter, setGrantFilter] = useState("All");
  const [dueDateFilter, setDueDateFilter] = useState(0);
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const dueDateOpt = DUE_DATE_OPTIONS[dueDateFilter];

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = tasks
    .filter((t) => {
      const matchesSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.relatedGrantTitle ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (t.relatedProjectName ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "All" || t.priority === priorityFilter;
      const matchesOwner = ownerFilter === "All" || t.owner === ownerFilter;
      const matchesGrant = grantFilter === "All" || (t.relatedGrantTitle ?? "") === grantFilter;
      const days = daysUntil(t.dueDate);
      const matchesDue =
        dueDateOpt.days === Infinity ? true :
        dueDateOpt.days === -1 ? days < 0 :
        dueDateOpt.days === 0 ? days === 0 :
        days >= 0 && days <= dueDateOpt.days;
      return matchesSearch && matchesStatus && matchesPriority && matchesOwner && matchesGrant && matchesDue;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "dueDate") cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      else cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      return sortDir === "asc" ? cmp : -cmp;
    });

  const incomplete = filtered.filter((t) => t.status !== "Complete");
  const complete = filtered.filter((t) => t.status === "Complete");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {tasks.filter((t) => t.status !== "Complete").length} open · {tasks.filter((t) => t.status === "Complete").length} complete
          </p>
        </div>
        <Button size="sm" className="gap-2 text-xs" onClick={() =>
          toast({ title: "Add task", description: "Task creation form coming in next phase." })
        }>
          <Plus size={14} />
          Add task
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-48"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "All")}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 h-8"
        >
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "All")}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 h-8"
        >
          {(["All", "High", "Medium", "Low"] as const).map((p) => <option key={p} value={p}>{p === "All" ? "All priorities" : p}</option>)}
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 h-8"
        >
          {ALL_OWNERS.map((o) => <option key={o} value={o}>{o === "All" ? "All owners" : o}</option>)}
        </select>
        <select
          value={grantFilter}
          onChange={(e) => setGrantFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 h-8"
        >
          {GRANT_OPTIONS.map((g) => <option key={g} value={g}>{g === "All" ? "All grants" : g}</option>)}
        </select>
        <select
          value={dueDateFilter}
          onChange={(e) => setDueDateFilter(Number(e.target.value))}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 h-8"
        >
          {DUE_DATE_OPTIONS.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => handleSort("dueDate")}
            className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
              sortField === "dueDate" ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            <ArrowUpDown size={11} />
            Due date
          </button>
          <button
            onClick={() => handleSort("priority")}
            className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
              sortField === "priority" ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            <ArrowUpDown size={11} />
            Priority
          </button>
        </div>
      </div>

      {incomplete.length > 0 && (
        <div className="space-y-2">
          {incomplete.map((t) => {
            const days = daysUntil(t.dueDate);
            const isOverdue = days < 0;
            return (
              <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-3.5 flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <Circle size={16} className="text-slate-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-slate-800">{t.title}</div>
                  {t.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-400">{t.owner}</span>
                    {t.relatedGrantTitle && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t.relatedGrantTitle}</span>
                    )}
                    {t.relatedProjectName && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{t.relatedProjectName}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                    t.priority === "High" ? "bg-red-50 text-red-600" :
                    t.priority === "Medium" ? "bg-amber-50 text-amber-600" :
                    "bg-slate-100 text-slate-500"
                  }`}>{t.priority}</span>
                  <div className={`text-[11px] font-medium flex items-center gap-1 ${isOverdue ? "text-red-500" : days <= 3 ? "text-amber-500" : "text-slate-400"}`}>
                    {isOverdue && <AlertCircle size={10} />}
                    <Clock size={10} />
                    {isOverdue ? "Overdue" : formatDate(t.dueDate)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {complete.length > 0 && (statusFilter === "All" || statusFilter === "Complete") && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-green-500" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Completed</span>
            <span className="text-xs text-slate-400">({complete.length})</span>
          </div>
          <div className="space-y-2">
            {complete.map((t) => (
              <div key={t.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center gap-3 opacity-70">
                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                <span className="text-sm text-slate-600 line-through">{t.title}</span>
                <span className="ml-auto text-xs text-slate-400">{t.owner}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">No tasks match your filters.</div>
      )}
    </div>
  );
}
