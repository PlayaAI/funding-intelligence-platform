import { useState } from "react";
import { proofItems, proofTypeLabels, type ProofItemType } from "@/data/proofItems";
import { projects } from "@/data/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Sparkles, Shield } from "lucide-react";

const TYPE_COLORS: Record<ProofItemType, string> = {
  workshop: "bg-violet-50 text-violet-700 border-violet-200",
  app_demo: "bg-blue-50 text-blue-700 border-blue-200",
  document: "bg-slate-100 text-slate-700 border-slate-200",
  metric: "bg-green-50 text-green-700 border-green-200",
  testimonial: "bg-amber-50 text-amber-700 border-amber-200",
};

const ALL_TYPES: (ProofItemType | "All")[] = [
  "All", "workshop", "app_demo", "document", "metric", "testimonial",
];

const VISIBILITY_OPTIONS = ["All", "Public", "Private"] as const;

export default function DashboardProofItemsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProofItemType | "All">("All");
  const [visibility, setVisibility] = useState<"All" | "Public" | "Private">("All");
  const [projectFilter, setProjectFilter] = useState("All");

  const allProjects = ["All", ...Array.from(new Set(proofItems.filter((p) => p.projectName).map((p) => p.projectName!)))];

  const filtered = proofItems.filter((p) => {
    const matchesSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.projectName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === "All" || p.type === typeFilter;
    const matchesProject = projectFilter === "All" || (p.projectName ?? "") === projectFilter;
    const isPublic = p.isPublic ?? true;
    const matchesVisibility =
      visibility === "All" ? true :
      visibility === "Public" ? isPublic :
      !isPublic;
    return matchesSearch && matchesType && matchesProject && matchesVisibility;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proof Library</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Evidence database for grant applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() =>
              toast({ title: "AI workflow coming soon", description: "AI workflow will be connected in a later phase." })
            }
          >
            <Sparkles size={13} />
            Suggest for grant
          </Button>
          <Button
            size="sm"
            className="gap-2 text-xs"
            onClick={() =>
              toast({ title: "Add proof item", description: "Proof item creation form coming in next phase." })
            }
          >
            <Plus size={14} />
            Add proof item
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search proof items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-60"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                typeFilter === t
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {t === "All" ? "All types" : proofTypeLabels[t as ProofItemType]}
            </button>
          ))}
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 h-8"
        >
          {allProjects.map((p) => <option key={p} value={p}>{p === "All" ? "All projects" : p}</option>)}
        </select>
        <div className="flex gap-1">
          {VISIBILITY_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                visibility === v
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <Card
            key={item.id}
            className="border-slate-200 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Shield size={14} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-800 leading-tight">{item.title}</div>
                    {item.projectName && (
                      <div className="text-xs text-primary mt-0.5">{item.projectName}</div>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${TYPE_COLORS[item.type]}`}
                >
                  {proofTypeLabels[item.type]}
                </span>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>

              <div className="flex flex-wrap gap-1 mt-2.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {item.grantRelevance && (
                <div className="mt-2 text-[11px] text-primary bg-primary/5 border border-primary/10 rounded px-2 py-1 leading-snug">
                  {item.grantRelevance}
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">{item.date ?? ""}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${(item.isPublic ?? true) ? "text-green-600" : "text-slate-400"}`}>
                    {(item.isPublic ?? true) ? "Public" : "Private"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2 text-slate-500 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast({
                        title: "Suggest for grant",
                        description: "AI workflow will be connected in a later phase.",
                      });
                    }}
                  >
                    <Sparkles size={11} className="mr-1" />
                    Suggest
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-16 text-slate-400 text-sm">
            No proof items match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
