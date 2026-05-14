import { useState } from "react";
import { Link } from "wouter";
import { grants, type GrantStatus, PROJECT_COLORS } from "@/data/grants";
import { projects } from "@/data/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Star, LayoutList, LayoutGrid, Sparkles, ArrowUpDown } from "lucide-react";

const STATUSES: GrantStatus[] = [
  "Planned", "Researching", "Applying", "Submitted", "Awarded", "Declined", "Archived",
];

const AMOUNT_OPTIONS = [
  { label: "Any amount", min: 0, max: Infinity },
  { label: "Under $25K", min: 0, max: 25000 },
  { label: "$25K–$100K", min: 25000, max: 100000 },
  { label: "$100K–$500K", min: 100000, max: 500000 },
  { label: "Over $500K", min: 500000, max: Infinity },
];

const DEADLINE_OPTIONS = [
  { label: "Any deadline", days: Infinity },
  { label: "Next 30 days", days: 30 },
  { label: "Next 60 days", days: 60 },
  { label: "Next 90 days", days: 90 },
  { label: "Past deadline", days: -1 },
];

type SortField = "deadline" | "amount" | "fit" | "title";
type SortDir = "asc" | "desc";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function formatAmount(min: number, max: number) {
  const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
  return `${fmt(min)}–${fmt(max)}`;
}

export default function DashboardGrantsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GrantStatus | "All">("All");
  const [amountFilter, setAmountFilter] = useState(0);
  const [deadlineFilter, setDeadlineFilter] = useState(0);
  const [projectFilter, setProjectFilter] = useState("All");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [sortField, setSortField] = useState<SortField>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const amountOpt = AMOUNT_OPTIONS[amountFilter];
  const deadlineOpt = DEADLINE_OPTIONS[deadlineFilter];

  const handleNew = () => toast({ title: "Add grant", description: "Grant creation form coming in next phase." });
  const handleAI = () => toast({ title: "AI workflow coming soon", description: "AI workflow will be connected in a later phase." });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = grants
    .filter((g) => {
      const matchesSearch =
        !search ||
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.funderName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || g.status === statusFilter;
      const matchesAmount = g.amountMax >= amountOpt.min && g.amountMin <= amountOpt.max;
      const days = daysUntil(g.deadline);
      const matchesDeadline =
        deadlineOpt.days === Infinity ? true :
        deadlineOpt.days === -1 ? days < 0 :
        days >= 0 && days <= deadlineOpt.days;
      const matchesProject = projectFilter === "All" || (g.relatedProjectSlug ?? "") === projectFilter;
      return matchesSearch && matchesStatus && matchesAmount && matchesDeadline && matchesProject;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "deadline") cmp = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      else if (sortField === "amount") cmp = a.amountMax - b.amountMax;
      else if (sortField === "fit") cmp = a.fitScore - b.fitScore;
      else cmp = a.title.localeCompare(b.title);
      return sortDir === "asc" ? cmp : -cmp;
    });

  function SortTh({ field, label }: { field: SortField; label: string }) {
    return (
      <th
        onClick={() => handleSort(field)}
        className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <ArrowUpDown size={11} className={sortField === field ? "text-primary" : "text-slate-300"} />
        </span>
      </th>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Grants</h1>
          <p className="text-slate-500 text-sm mt-0.5">{grants.length} opportunities tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleAI}>
            <Sparkles size={13} />
            Recommend Top 3
          </Button>
          <Button size="sm" className="gap-2 text-xs" onClick={handleNew}>
            <Plus size={14} />
            Add grant
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search grants or funders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-52"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as GrantStatus | "All")}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 h-8"
        >
          <option value="All">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 h-8"
        >
          <option value="All">All projects</option>
          {projects.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
        <select
          value={deadlineFilter}
          onChange={(e) => setDeadlineFilter(Number(e.target.value))}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 h-8"
        >
          {DEADLINE_OPTIONS.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
        </select>
        <select
          value={amountFilter}
          onChange={(e) => setAmountFilter(Number(e.target.value))}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 h-8"
        >
          {AMOUNT_OPTIONS.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1 border border-slate-200 rounded-lg p-0.5">
          <button
            onClick={() => setView("table")}
            className={`p-1.5 rounded ${view === "table" ? "bg-slate-100" : "hover:bg-slate-50"}`}
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`p-1.5 rounded ${view === "kanban" ? "bg-slate-100" : "hover:bg-slate-50"}`}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {view === "table" ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <SortTh field="title" label="Grant" />
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Funder</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Project</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <SortTh field="amount" label="Amount" />
                <SortTh field="deadline" label="Deadline" />
                <SortTh field="fit" label="Fit" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((g) => {
                const days = daysUntil(g.deadline);
                return (
                  <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/dashboard/grants/${g.id}`}>
                        <div className="flex items-center gap-2 cursor-pointer">
                          {g.isTop3 && <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                          <span className="font-medium text-slate-800 hover:text-primary transition-colors line-clamp-1">{g.title}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 hidden md:table-cell">{g.funderName}</td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {g.relatedProjectSlug && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PROJECT_COLORS[g.relatedProjectSlug] ?? "#94a3b8" }} />
                          <span className="text-xs text-slate-600 truncate max-w-[90px]">{g.relatedProjectName}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4"><GrantStatusBadge status={g.status} /></td>
                    <td className="py-3 px-4 text-slate-600 text-xs hidden lg:table-cell whitespace-nowrap">{formatAmount(g.amountMin, g.amountMax)}</td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="text-xs text-slate-700">{formatDate(g.deadline)}</div>
                      {!["Awarded", "Declined", "Archived", "Submitted"].includes(g.status) && days > 0 && (
                        <div className={`text-[11px] font-medium ${days <= 14 ? "text-red-500" : days <= 30 ? "text-amber-500" : "text-slate-400"}`}>
                          {days}d left
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden xl:table-cell">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${g.fitScore >= 80 ? "bg-green-400" : g.fitScore >= 60 ? "bg-amber-400" : "bg-red-300"}`}
                            style={{ width: `${g.fitScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{g.fitScore}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No grants match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {(["Planned", "Researching", "Applying", "Submitted", "Awarded", "Declined"] as GrantStatus[]).map((col) => {
              const colGrants = filtered.filter((g) => g.status === col);
              return (
                <div key={col} className="w-60 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{col}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">{colGrants.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colGrants.map((g) => (
                      <Link href={`/dashboard/grants/${g.id}`} key={g.id}>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 hover:border-primary/40 cursor-pointer transition-colors">
                          <div className="text-xs font-medium text-slate-800 line-clamp-2 mb-1.5">{g.title}</div>
                          <div className="text-xs text-slate-400">{g.funderName}</div>
                          {g.relatedProjectSlug && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROJECT_COLORS[g.relatedProjectSlug] ?? "#94a3b8" }} />
                              <span className="text-[11px] text-slate-400">{g.relatedProjectName}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-slate-400">{formatDate(g.deadline)}</span>
                            <span className="text-[11px] font-medium text-slate-500">Fit: {g.fitScore}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {colGrants.length === 0 && (
                      <div className="text-xs text-slate-300 text-center py-6 border-2 border-dashed border-slate-100 rounded-lg">
                        None
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
