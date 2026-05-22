import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMappedFunders, useCreateFunder } from "@/hooks/useFunders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import FunderFormDialog, { type FunderFormValues } from "@/components/dashboard/FunderFormDialog";
import { funderFormValuesToInsert } from "@/lib/funderFormUtils";
import { funderDetailPath } from "@/lib/funderMappers";
import { toast } from "@/hooks/use-toast";
import { isSupabaseConfigured } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Search, Building2, Network, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

const REL_COLORS: Record<string, string> = {
  None: "bg-slate-100 text-slate-600 border-slate-200",
  Researching: "bg-blue-50 text-blue-700 border-blue-200",
  Contacted: "bg-violet-50 text-violet-700 border-violet-200",
  "In Conversation": "bg-amber-50 text-amber-700 border-amber-200",
  "Active Relationship": "bg-green-50 text-green-700 border-green-200",
};

function fmt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

function normalizeLocation(value: string | undefined): string {
  if (!value?.trim()) return "Unknown";
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  const last = parts.at(-1) ?? value.trim();
  return last.length <= 3 ? last.toUpperCase() : last;
}

function hasInviteOnlySignal(funder: { notes?: string; openApplications: boolean }): boolean {
  return !funder.openApplications && /invite|invitation only|by invitation/i.test(funder.notes ?? "");
}

function SortSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
      <option value="recent">Recently imported</option>
      <option value="name">Name A-Z</option>
      <option value="median">Median grant amount</option>
      <option value="linked">Linked grants count</option>
    </select>
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
      {children}
    </select>
  );
}

export default function DashboardFundersPage() {
  const [search, setSearch] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [inviteFilter, setInviteFilter] = useState("All");
  const [websiteFilter, setWebsiteFilter] = useState("All");
  const [einFilter, setEinFilter] = useState("All");
  const [availableFilter, setAvailableFilter] = useState("All");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { funders, isLoading, isError, error } = useMappedFunders();
  const createFunder = useCreateFunder();
  const { canWriteTable } = usePermissions();

  const locations = useMemo(
    () => Array.from(new Set(funders.map((f) => normalizeLocation(f.location)).filter((value) => value !== "Unknown"))).sort(),
    [funders]
  );

  const relationships = useMemo(
    () => Array.from(new Set(funders.map((f) => f.relationshipStatus || "None"))).sort(),
    [funders]
  );

  const filtered = useMemo(
    () => {
      const q = search.trim().toLowerCase();
      return funders.filter((f) => {
        const matchesSearch =
          !q ||
          f.name.toLowerCase().includes(q) ||
          (f.location ?? "").toLowerCase().includes(q) ||
          (f.ein ?? "").toLowerCase().includes(q) ||
          (f.website ?? "").toLowerCase().includes(q);
        const matchesRelationship = relationshipFilter === "All" || f.relationshipStatus === relationshipFilter;
        const matchesLocation = locationFilter === "All" || normalizeLocation(f.location) === locationFilter;
        const inviteOnly = hasInviteOnlySignal(f);
        const matchesInvite =
          inviteFilter === "All" ||
          (inviteFilter === "invite_only" && inviteOnly) ||
          (inviteFilter === "open" && !inviteOnly);
        const matchesWebsite =
          websiteFilter === "All" ||
          (websiteFilter === "has" && Boolean(f.website)) ||
          (websiteFilter === "missing" && !f.website);
        const matchesEin =
          einFilter === "All" ||
          (einFilter === "has" && Boolean(f.ein)) ||
          (einFilter === "missing" && !f.ein);
        const matchesAvailable =
          availableFilter === "All" ||
          (availableFilter === "has" && (f.openApplications || f.relatedGrantIds.length > 0)) ||
          (availableFilter === "none" && !f.openApplications && f.relatedGrantIds.length === 0);
        return matchesSearch && matchesRelationship && matchesLocation && matchesInvite && matchesWebsite && matchesEin && matchesAvailable;
      }).sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "median") return b.medianGrantAmount - a.medianGrantAmount;
        if (sort === "linked") return b.relatedGrantIds.length - a.relatedGrantIds.length;
        return 0;
      });
    },
    [funders, search, relationshipFilter, locationFilter, inviteFilter, websiteFilter, einFilter, availableFilter, sort]
  );

  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetFilters() {
    setSearch("");
    setRelationshipFilter("All");
    setLocationFilter("All");
    setInviteFilter("All");
    setWebsiteFilter("All");
    setEinFilter("All");
    setAvailableFilter("All");
    setSort("recent");
    setPage(1);
  }

  const handleCreate = async (values: FunderFormValues) => {
    try {
      await createFunder.mutateAsync(funderFormValuesToInsert(values));
      toast({ title: "Funder created", description: values.name });
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: "Failed to create funder",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      throw e;
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            Configure Supabase to load funders.
          </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center py-24 gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading funders…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Funder Intelligence</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Could not load funders</p>
            <p className="text-xs mt-1 font-mono">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Funder Intelligence</h1>
          <p className="text-slate-500 text-sm mt-0.5">{funders.length} funders tracked · {filtered.length} shown by current filters</p>
        </div>
        {canWriteTable("funders") && (
          <Button size="sm" className="gap-2 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus size={14} />
            Add funder
          </Button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search funders..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-sm w-52"
          />
        </div>
        <FilterSelect value={relationshipFilter} onChange={(value) => { setRelationshipFilter(value); setPage(1); }}>
          <option value="All">All relationship types</option>
          {relationships.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}
        </FilterSelect>
        <FilterSelect value={locationFilter} onChange={(value) => { setLocationFilter(value); setPage(1); }}>
          <option value="All">All locations</option>
          {locations.slice(0, 80).map((location) => <option key={location} value={location}>{location}</option>)}
        </FilterSelect>
        <FilterSelect value={inviteFilter} onChange={(value) => { setInviteFilter(value); setPage(1); }}>
          <option value="All">All invite statuses</option>
          <option value="invite_only">Invite-only</option>
          <option value="open">Open/not invite-only</option>
        </FilterSelect>
        <FilterSelect value={websiteFilter} onChange={(value) => { setWebsiteFilter(value); setPage(1); }}>
          <option value="All">All websites</option>
          <option value="has">Has website</option>
          <option value="missing">Missing website</option>
        </FilterSelect>
        <FilterSelect value={einFilter} onChange={(value) => { setEinFilter(value); setPage(1); }}>
          <option value="All">All EINs</option>
          <option value="has">Has EIN</option>
          <option value="missing">Missing EIN</option>
        </FilterSelect>
        <FilterSelect value={availableFilter} onChange={(value) => { setAvailableFilter(value); setPage(1); }}>
          <option value="All">All availability</option>
          <option value="has">Has available grants</option>
          <option value="none">No available grants</option>
        </FilterSelect>
        <SortSelect value={sort} onChange={(value) => { setSort(value); setPage(1); }} />
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="py-2.5 px-3 font-medium">Funder</th>
                <th className="py-2.5 px-3 font-medium">Type</th>
                <th className="py-2.5 px-3 font-medium">Location</th>
                <th className="py-2.5 px-3 font-medium">EIN</th>
                <th className="py-2.5 px-3 font-medium">Website</th>
                <th className="py-2.5 px-3 font-medium">Invite-only</th>
                <th className="py-2.5 px-3 font-medium">Available grants</th>
                <th className="py-2.5 px-3 font-medium">Median grant</th>
                <th className="py-2.5 px-3 font-medium">Linked grants</th>
                <th className="py-2.5 px-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((f) => {
                const inviteOnly = hasInviteOnlySignal(f);
                return (
                  <tr key={f.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 px-3 min-w-64">
                      <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-slate-500" />
                  </div>
                  <div>
                          <Link href={funderDetailPath(f)} className="font-semibold text-sm text-slate-800 leading-tight line-clamp-1 hover:text-primary">
                            {f.name}
                          </Link>
                          <div className="text-xs text-slate-400 line-clamp-1">{f.website ?? "No website"}</div>
                  </div>
                </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${REL_COLORS[f.relationshipStatus] ?? REL_COLORS.None}`}>
                        {f.relationshipStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{f.location || "—"}</td>
                    <td className="py-2.5 px-3 text-slate-600">{f.ein ?? "—"}</td>
                    <td className="py-2.5 px-3 text-slate-600">{f.website ? "Yes" : "—"}</td>
                    <td className="py-2.5 px-3">
                      {inviteOnly ? (
                        <Badge className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-medium px-1.5 py-0">Invite-only</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {f.openApplications ? (
                        <Badge className="text-[10px] bg-green-50 text-green-700 border border-green-200 font-medium px-1.5 py-0">Open</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmt(f.medianGrantAmount)}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Network size={11} />
                        {f.relatedGrantIds.length}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link href={funderDetailPath(f)} className="text-xs text-primary font-medium">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No funders match your filters.
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-t border-slate-200 text-xs text-slate-500">
            <div>
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={13} />
                Previous
              </Button>
              <span>Page {currentPage} of {pageCount}</span>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={currentPage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                Next
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        )}
      </div>

      <FunderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
        title="Add funder"
        submitLabel="Create funder"
        loading={createFunder.isPending}
      />
    </div>
  );
}
