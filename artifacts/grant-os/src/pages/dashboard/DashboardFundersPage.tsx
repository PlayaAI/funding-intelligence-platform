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
import { Plus, Search, Building2, Network, Loader2, AlertCircle } from "lucide-react";

const REL_COLORS: Record<string, string> = {
  None: "bg-slate-100 text-slate-600 border-slate-200",
  Researching: "bg-blue-50 text-blue-700 border-blue-200",
  Contacted: "bg-violet-50 text-violet-700 border-violet-200",
  "In Conversation": "bg-amber-50 text-amber-700 border-amber-200",
  "Active Relationship": "bg-green-50 text-green-700 border-green-200",
};

function fmt(n: number) {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

export default function DashboardFundersPage() {
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { funders, isLoading, isError, error } = useMappedFunders();
  const createFunder = useCreateFunder();
  const { canWriteTable } = usePermissions();

  const allAreas = useMemo(
    () => Array.from(new Set(funders.flatMap((f) => f.givingCategories))).sort(),
    [funders]
  );

  const filtered = useMemo(
    () =>
      funders.filter((f) => {
        const matchesSearch =
          !search ||
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.givingCategories.some((c) => c.toLowerCase().includes(search.toLowerCase()));
        const matchesArea = areaFilter === "All" || f.givingCategories.includes(areaFilter);
        return matchesSearch && matchesArea;
      }),
    [funders, search, areaFilter]
  );

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
          <p className="text-slate-500 text-sm mt-0.5">{funders.length} funders tracked</p>
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
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-52"
          />
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <button
            type="button"
            onClick={() => setAreaFilter("All")}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              areaFilter === "All"
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            All areas
          </button>
          {allAreas.map((area) => (
            <button
              type="button"
              key={area}
              onClick={() => setAreaFilter(area === areaFilter ? "All" : area)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                areaFilter === area
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((f) => (
          <Link href={funderDetailPath(f)} key={f.id}>
            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-800 leading-tight">{f.name}</div>
                      <div className="text-xs text-slate-400">{f.location}</div>
                  </div>
                </div>
                {f.openApplications && (
                  <Badge className="text-[10px] bg-green-50 text-green-700 border border-green-200 font-medium px-1.5 py-0">
                    Open
                  </Badge>
                )}
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap gap-1">
                  {f.givingCategories.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className={`text-[11px] px-1.5 py-0.5 rounded ${
                        c === areaFilter ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c}
                    </span>
                  ))}
                  {f.givingCategories.length > 3 && (
                    <span className="text-[11px] text-slate-400">+{f.givingCategories.length - 3}</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">
                    Median grant:{" "}
                    <span className="font-medium text-slate-700">{fmt(f.medianGrantAmount)}</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <Network size={11} />
                    {f.peerConnections} peers
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${REL_COLORS[f.relationshipStatus]}`}
                >
                  {f.relationshipStatus}
                </span>
                <span className="text-xs text-slate-400">
                  {f.relatedGrantIds.length} grant{f.relatedGrantIds.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-400 text-sm">
            No funders match your filters.
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
