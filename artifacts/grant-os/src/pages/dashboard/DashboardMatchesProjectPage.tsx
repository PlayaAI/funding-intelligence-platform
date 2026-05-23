import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { PROJECT_COLORS } from "@/data/grants";
import { useProject } from "@/hooks/useProjects";
import { useMappedGrants } from "@/hooks/useGrants";
import { useFunders } from "@/hooks/useFunders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import ScoreBar from "@/components/dashboard/ScoreBar";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles, Star, ExternalLink, EyeOff, BookmarkPlus, Loader2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmt(min: number, max: number) {
  const f = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
  return `${f(min)}–${f(max)}`;
}

type MatchTab = "Opportunity Matches" | "Funder Matches" | "Hidden";

export default function DashboardMatchesProjectPage() {
  const [, params] = useRoute("/dashboard/matches/:projectId");
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [matchTab, setMatchTab] = useState<MatchTab>("Opportunity Matches");

  const slug = params?.projectId;
  const { data: project, isLoading: projectLoading } = useProject(slug);
  const { grants, isLoading: grantsLoading, isError } = useMappedGrants();
  const { data: funderRows = [] } = useFunders();

  const projectGrants = useMemo(
    () => grants.filter((g) => g.relatedProjectSlug === slug),
    [grants, slug]
  );
  const archivedGrants = projectGrants.filter((g) => g.status === "Archived");
  const activeGrants = projectGrants.filter((g) => g.status !== "Archived");

  const displayGrants = matchTab === "Hidden" ? archivedGrants : activeGrants;

  const selectedGrant =
    projectGrants.find((g) => g.id === selectedGrantId) ?? displayGrants[0];
  const selectedFunder = funderRows.find((f) => f.id === selectedGrant?.funderId || f.legacy_id === selectedGrant?.funderId || f.name === selectedGrant?.funderName);

  if (!isSupabaseConfigured) {
    return (
      <div className="p-8 text-center text-amber-700 text-sm">
        Configure Supabase to view grant matches.
      </div>
    );
  }

  if (projectLoading || grantsLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading matches…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-600 text-sm">Could not load grants.</div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Project not found.</p>
        <Link href="/dashboard/matches">
          <Button variant="ghost" className="mt-4 gap-2"><ArrowLeft size={14} />Back to matches</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-4">
        <Link href="/dashboard/matches">
          <Button variant="ghost" size="sm" className="gap-2 text-xs h-8">
            <ArrowLeft size={14} />
            Matches
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: PROJECT_COLORS[project.slug] ?? "#94a3b8" }}
          >
            {project.name.charAt(0)}
          </div>
          <div>
            <span className="font-semibold text-slate-800 text-sm">{project.name}</span>
            <span className="text-slate-400 text-sm ml-2">— Grant Matches</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="flex gap-px">
              {(["Opportunity Matches", "Funder Matches", "Hidden"] as MatchTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setMatchTab(t)}
                  className={`flex-1 text-[11px] py-1.5 font-medium rounded transition-colors ${
                    matchTab === t ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t === "Opportunity Matches" ? "Opportunities" : t === "Funder Matches" ? "Funders" : "Hidden"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {matchTab === "Funder Matches" ? (
              funderRows.slice(0, 5).map((f) => (
                <div key={f.id} className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <div className="font-medium text-sm text-slate-800">{f.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{f.location}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-500">
                      Median: {f.median_grant_amount ? `$${(f.median_grant_amount / 1000).toFixed(0)}K` : "Unknown"}
                    </span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${
                      f.open_applications ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {f.open_applications ? "Open" : "By invite"}
                    </span>
                  </div>
                </div>
              ))
            ) : displayGrants.length > 0 ? (
              displayGrants.map((g) => {
                const selected = g.id === (selectedGrant?.id);
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGrantId(g.id)}
                    className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors ${
                      selected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-sm text-slate-800 line-clamp-2 leading-snug">{g.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{g.funderName}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-slate-500">{fmt(g.amountMin, g.amountMax)}</span>
                      <span className="text-xs text-slate-400">{formatDate(g.deadline)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                No {matchTab.toLowerCase()} for this project.
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-5">
          {selectedGrant ? (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedGrant.title}</h2>
                    <div className="text-sm text-slate-500 mt-0.5">{selectedGrant.funderName}</div>
                  </div>
                  <GrantStatusBadge status={selectedGrant.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <div className="text-xs text-slate-400">Amount</div>
                    <div className="font-medium text-slate-800">{fmt(selectedGrant.amountMin, selectedGrant.amountMax)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Deadline</div>
                    <div className="font-medium text-slate-800">{formatDate(selectedGrant.deadline)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Geography</div>
                    <div className="font-medium text-slate-800">{selectedGrant.geography}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Owner</div>
                    <div className="font-medium text-slate-800">{selectedGrant.assignedOwner}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {selectedGrant.focusAreas.map((a) => (
                    <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                  ))}
                </div>
                <div className="space-y-2 mb-4">
                  <ScoreBar label="Fit Score" value={selectedGrant.fitScore} />
                  <ScoreBar label="Priority" value={selectedGrant.priorityScore} />
                </div>
                {selectedGrant.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
                    {selectedGrant.notes}
                  </div>
                )}
              </div>

              {selectedFunder && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-800 mb-2">Funder: {selectedFunder.name}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div><span className="text-slate-400">Location: </span>{selectedFunder.location}</div>
                    <div><span className="text-slate-400">Median grant: </span>{selectedFunder.median_grant_amount ? `$${(selectedFunder.median_grant_amount / 1000).toFixed(0)}K` : "Unknown"}</div>
                    <div><span className="text-slate-400">Applications: </span>{selectedFunder.open_applications ? "Open" : "By invitation"}</div>
                    <div><span className="text-slate-400">Relationship: </span>{selectedFunder.relationship_status ?? "Unknown"}</div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-800 mb-3">AI Notes</div>
                <div className="text-xs text-slate-400 mb-3">No AI analysis yet.</div>
                <Button size="sm" className="gap-1.5 text-xs w-full" onClick={() =>
                  toast({ title: "Analyze Fit", description: "AI workflow will be connected in a later phase." })
                }>
                  <Sparkles size={12} />
                  Analyze Fit
                </Button>
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={() =>
                  toast({ title: "Saved", description: "Grant saved to tracker." })
                }>
                  <BookmarkPlus size={12} />
                  Save to Tracker
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() =>
                  toast({ title: "Hidden", description: "Grant hidden from matches view." })
                }>
                  <EyeOff size={12} />
                  Hide
                </Button>
                {selectedGrant.applicationUrl && (
                  <a href={selectedGrant.applicationUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <ExternalLink size={12} />
                      Portal
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Select a grant to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
