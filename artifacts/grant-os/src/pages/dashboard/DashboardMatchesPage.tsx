import { useState } from "react";
import { Link } from "wouter";
import { projects } from "@/data/projects";
import { grants, PROJECT_COLORS } from "@/data/grants";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, ChevronRight } from "lucide-react";

export default function DashboardMatchesPage() {
  const [search, setSearch] = useState("");

  const filtered = projects.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Grant Matches</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Select a project to see matching grant opportunities and funders.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((p) => {
          const matchCount = grants.filter(
            (g) => g.relatedProjectSlug === p.slug && !["Archived", "Declined"].includes(g.status)
          ).length;
          const totalPotential = grants
            .filter((g) => g.relatedProjectSlug === p.slug)
            .reduce((sum, g) => sum + g.amountMax, 0);
          const fmtAmount = (n: number) =>
            n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

          return (
            <Link href={`/dashboard/matches/${p.slug}`} key={p.slug}>
              <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: PROJECT_COLORS[p.slug] ?? "#94a3b8" }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 group-hover:text-primary transition-colors">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{p.category}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                    <div className="text-center hidden sm:block">
                      <div className="text-lg font-bold text-slate-900">
                        {matchCount}
                      </div>
                      <div className="text-xs text-slate-400">matches</div>
                    </div>
                    <div className="text-center hidden md:block">
                      <div className="text-lg font-bold text-slate-900">
                        {fmtAmount(totalPotential)}
                      </div>
                      <div className="text-xs text-slate-400">potential</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">{matchCount}</div>
                      <div className="text-xs text-slate-400">tracked</div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 line-clamp-2">{p.grantRelevance}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
