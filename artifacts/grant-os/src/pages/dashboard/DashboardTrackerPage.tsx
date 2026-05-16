import { useMemo, useState } from "react";
import { Link } from "wouter";
import { type GrantStatus, PROJECT_COLORS } from "@/data/grants";
import { useMappedGrants, useCreateGrant } from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import GrantFormDialog, { type GrantFormValues } from "@/components/dashboard/GrantFormDialog";
import { grantFormValuesToInsert } from "@/lib/grantFormUtils";
import { toast } from "@/hooks/use-toast";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Plus, Search, Download, Trophy, Clock, AlertCircle, XCircle, Star, Loader2 } from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function fmt(min: number, max: number) {
  const f = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
  return `${f(min)}–${f(max)}`;
}

type Tab = "All" | "Researching" | "Applications";

export default function DashboardTrackerPage() {
  const [tab, setTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("2026");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { grants, isLoading, isError, error } = useMappedGrants();
  const { data: projectRows = [] } = useProjects();
  const createGrant = useCreateGrant();

  const awarded = grants.filter((g) => g.status === "Awarded");
  const submitted = grants.filter((g) => g.status === "Submitted");
  const declined = grants.filter((g) => g.status === "Declined");
  const active = grants.filter((g) => !["Awarded", "Declined", "Archived"].includes(g.status));

  const filtered = useMemo(() => grants.filter((g) => {
    const matchesSearch =
      !search ||
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.funderName.toLowerCase().includes(search.toLowerCase()) ||
      (g.relatedProjectName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      tab === "All" ||
      (tab === "Researching" && g.status === "Researching") ||
      (tab === "Applications" && ["Applying", "Submitted", "Awarded", "Declined"].includes(g.status));
    const matchesYear = g.deadline
      ? new Date(g.deadline).getFullYear().toString() === year
      : true;
    return matchesSearch && matchesTab && matchesYear;
  }), [grants, search, tab, year]);

  const handleCreate = async (values: GrantFormValues) => {
    try {
      await createGrant.mutateAsync(grantFormValuesToInsert(values, projectRows));
      toast({ title: "Grant created", description: values.title });
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: "Failed to create grant",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      throw e;
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl">
        Configure Supabase to use the grant tracker.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center py-24 gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading grants…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-sm text-red-700">
        Could not load grants: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Grant Tracker</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track every opportunity from discovery to decision.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() =>
            toast({ title: "Export CSV", description: "CSV export will be connected in a later phase." })
          }>
            <Download size={13} />
            Export CSV
          </Button>
          <Button size="sm" className="gap-2 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus size={14} />
            Add new
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <Star size={13} className="text-slate-500" />
            </div>
            <span className="text-xs text-slate-500 font-medium">Goal</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{active.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">active grants</div>
        </div>
        <div className="bg-white border border-green-200 bg-green-50/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
              <Trophy size={13} className="text-green-600" />
            </div>
            <span className="text-xs text-green-700 font-medium">Awarded</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{awarded.length}</div>
          <div className="text-xs text-green-500 mt-0.5">this year</div>
        </div>
        <div className="bg-white border border-amber-200 bg-amber-50/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock size={13} className="text-amber-600" />
            </div>
            <span className="text-xs text-amber-700 font-medium">Submitted</span>
          </div>
          <div className="text-2xl font-bold text-amber-700">{submitted.length}</div>
          <div className="text-xs text-amber-500 mt-0.5">awaiting decision</div>
        </div>
        <div className="bg-white border border-red-200 bg-red-50/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle size={13} className="text-red-500" />
            </div>
            <span className="text-xs text-red-600 font-medium">Declined</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{declined.length}</div>
          <div className="text-xs text-red-400 mt-0.5">this year</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 border-b border-slate-200">
          {(["All", "Researching", "Applications"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 h-8"
          >
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search grants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-48"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Owner</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Project</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Deadline</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Amount</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Next Task</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden 2xl:table-cell">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((g) => {
              const days = daysUntil(g.deadline);
              return (
                <tr key={g.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="py-3 px-4">
                    <Link href={`/dashboard/grants/${g.id}`}>
                      <div className="flex items-center gap-2 cursor-pointer">
                        {g.isTop3 && <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                        <span className="font-medium text-slate-800 group-hover:text-primary transition-colors line-clamp-1 text-sm">
                          {g.title}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 pl-0">{g.funderName}</div>
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500 hidden md:table-cell">{g.assignedOwner}</td>
                  <td className="py-3 px-3 hidden lg:table-cell">
                    {g.relatedProjectName && g.relatedProjectSlug && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PROJECT_COLORS[g.relatedProjectSlug] ?? "#94a3b8" }}
                        />
                        <span className="text-xs text-slate-600 truncate max-w-[100px]">{g.relatedProjectName}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 hidden lg:table-cell">
                    <div className="text-xs text-slate-700">{formatDate(g.deadline)}</div>
                    {!["Awarded", "Declined", "Archived"].includes(g.status) && days > 0 && (
                      <div className={`text-[11px] font-medium ${days <= 14 ? "text-red-500" : days <= 30 ? "text-amber-500" : "text-slate-400"}`}>
                        {days}d
                      </div>
                    )}
                    {!["Awarded", "Declined", "Archived"].includes(g.status) && days <= 0 && (
                      <div className="text-[11px] font-semibold text-red-600 flex items-center gap-0.5">
                        <AlertCircle size={10} />Overdue
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <GrantStatusBadge status={g.status} />
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500 hidden xl:table-cell whitespace-nowrap">
                    {fmt(g.amountMin, g.amountMax)}
                  </td>
                  <td className="py-3 px-3 hidden xl:table-cell">
                    {g.nextTask && (
                      <span className="text-xs text-slate-500 line-clamp-1 max-w-[160px]">{g.nextTask}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 hidden 2xl:table-cell">
                    {g.notes && (
                      <span className="text-xs text-slate-400 line-clamp-1 max-w-[180px]">{g.notes}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                  No grants match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <GrantFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
        title="Add grant"
        submitLabel="Create grant"
        loading={createGrant.isPending}
      />
    </div>
  );
}
