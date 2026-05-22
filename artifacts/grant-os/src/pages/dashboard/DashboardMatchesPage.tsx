import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, BookmarkPlus, CheckCircle2, EyeOff, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import {
  useGenerateMatchesForAllProjects,
  useGrantMatches,
  useHideMatch,
  useMarkReviewed,
  useSaveMatch,
} from "@/hooks/useGrantMatches";
import { matchJsonArray, type GrantMatchWithRelations } from "@/lib/matching/matchesService";
import { isSupabaseConfigured } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TIER_LABELS: Record<string, string> = {
  best: "Best",
  strong: "Strong",
  good: "Good",
  maybe: "Maybe",
  weak: "Weak",
  needs_review: "Needs Review",
};

const TIER_CLASSES: Record<string, string> = {
  best: "bg-emerald-50 text-emerald-700 border-emerald-200",
  strong: "bg-green-50 text-green-700 border-green-200",
  good: "bg-blue-50 text-blue-700 border-blue-200",
  maybe: "bg-amber-50 text-amber-700 border-amber-200",
  weak: "bg-slate-100 text-slate-600 border-slate-200",
  needs_review: "bg-violet-50 text-violet-700 border-violet-200",
};

function formatDate(value?: string | null) {
  if (!value) return "No deadline";
  if (/rolling|ongoing/i.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function amountLabel(match: GrantMatchWithRelations) {
  const display = match.grant?.amount_display;
  if (display) return display;
  const min = match.grant?.amount_min;
  const max = match.grant?.amount_max;
  const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
  if (min && max) return `${fmt(min)}-${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  return "Amount TBD";
}

function recommendedNextAction(match: GrantMatchWithRelations) {
  const actions = matchJsonArray(match.recommended_actions);
  if (actions[0]) return actions[0];
  if (match.urgency_score >= 85 && match.readiness_score >= 65) return "Apply now.";
  if (match.readiness_score < 50) return "Needs proof before applying.";
  return "Review eligibility and decide go/no-go.";
}

function MatchCard({ match, compact = false }: { match: GrantMatchWithRelations; compact?: boolean }) {
  const save = useSaveMatch();
  const hide = useHideMatch();
  const review = useMarkReviewed();
  const { canContribute } = usePermissions();
  const { user } = useAuth();
  const reasons = matchJsonArray(match.fit_reasons).slice(0, 3);
  const risks = matchJsonArray(match.risks);
  const days = daysUntil(match.grant?.deadline);

  return (
    <Card className="border-slate-200">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/dashboard/grants/${match.grant_id}`}>
              <div className="font-semibold text-sm text-slate-900 hover:text-primary line-clamp-2">{match.grant?.title ?? "Unknown grant"}</div>
            </Link>
            <div className="text-xs text-slate-500 mt-0.5">
              {match.grant?.funder_name ?? match.funder?.name ?? "Unknown funder"} · {match.project?.name ?? "Unknown project"}
            </div>
          </div>
          <Badge variant="outline" className={`text-xs ${TIER_CLASSES[match.match_tier] ?? TIER_CLASSES.needs_review}`}>
            {TIER_LABELS[match.match_tier] ?? match.match_tier}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div><div className="text-slate-400">Match</div><div className="font-semibold text-slate-800">{match.match_score}</div></div>
          <div><div className="text-slate-400">Readiness</div><div className="font-semibold text-slate-800">{match.readiness_score}</div></div>
          <div><div className="text-slate-400">Urgency</div><div className="font-semibold text-slate-800">{match.urgency_score}</div></div>
          <div><div className="text-slate-400">Deadline</div><div className="font-semibold text-slate-800">{formatDate(match.grant?.deadline)}</div></div>
          <div><div className="text-slate-400">Amount</div><div className="font-semibold text-slate-800">{amountLabel(match)}</div></div>
        </div>

        {days !== null && days >= 0 && days <= 30 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Ending in {days} day{days === 1 ? "" : "s"}: {recommendedNextAction(match)}
          </div>
        )}

        {!compact && reasons.length > 0 && (
          <div className="space-y-1">
            {reasons.map((reason) => <div key={reason} className="text-xs text-slate-600">• {reason}</div>)}
          </div>
        )}
        {!compact && risks[0] && <div className="text-xs text-red-600">Risk: {risks[0]}</div>}

        <div className="flex flex-wrap gap-2 pt-1">
          {canContribute && (
            <>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={save.isPending} onClick={async () => { await save.mutateAsync(match.id); toast({ title: "Match saved" }); }}>
                <BookmarkPlus size={12} /> Save
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={hide.isPending} onClick={async () => { await hide.mutateAsync({ id: match.id, reason: "Hidden from matching dashboard" }); toast({ title: "Match hidden" }); }}>
                <EyeOff size={12} /> Hide
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={review.isPending} onClick={async () => { await review.mutateAsync({ id: match.id, userId: user?.id }); toast({ title: "Match reviewed" }); }}>
                <CheckCircle2 size={12} /> Review
              </Button>
            </>
          )}
          <Link href={`/dashboard/grants/${match.grant_id}`}><Button size="sm" variant="ghost" className="h-7 text-xs">Open Grant</Button></Link>
          {match.project?.slug && <Link href={`/dashboard/projects/${match.project.slug}`}><Button size="sm" variant="ghost" className="h-7 text-xs">Open Project</Button></Link>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardMatchesPage() {
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState("all");
  const matchesQuery = useGrantMatches({ search, projectId: projectId === "all" ? undefined : projectId, tier, status: status as any });
  const { data: projects = [] } = useProjects();
  const generateAll = useGenerateMatchesForAllProjects();
  const { canWrite } = usePermissions();

  const matches = matchesQuery.data ?? [];
  const topMatches = matches.filter((m) => ["best", "strong", "good"].includes(m.match_tier)).slice(0, 8);
  const endingSoon = useMemo(() => matches
    .filter((m) => {
      const days = daysUntil(m.grant?.deadline);
      return days !== null && days >= 0 && days <= 60;
    })
    .sort((a, b) => (daysUntil(a.grant?.deadline) ?? 999) - (daysUntil(b.grant?.deadline) ?? 999))
    .slice(0, 8), [matches]);
  const needsReview = matches.filter((m) => m.match_tier === "needs_review" || m.risks || m.readiness_score < 45).slice(0, 8);
  const saved = matches.filter((m) => m.status === "saved").slice(0, 8);

  if (!isSupabaseConfigured) {
    return <div className="p-6 max-w-4xl mx-auto text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl">Configure Supabase to view grant matches.</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Grant Matches</h1>
          <p className="text-slate-500 text-sm mt-0.5">Deterministic project-opportunity fit, readiness, urgency, and next actions.</p>
        </div>
        {canWrite && (
          <Button size="sm" className="gap-2 text-xs" disabled={generateAll.isPending} onClick={async () => { const rows = await generateAll.mutateAsync(); toast({ title: "Matches generated", description: `${rows.length} project-grant matches updated.` }); }}>
            {generateAll.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate Matches
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search grants, funders, projects..." className="pl-8 h-9 text-sm" />
        </div>
        <Select value={projectId} onValueChange={setProjectId}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Project" /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
        <Select value={tier} onValueChange={setTier}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tier" /></SelectTrigger><SelectContent><SelectItem value="all">All tiers</SelectItem>{Object.entries(TIER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="saved">Saved</SelectItem><SelectItem value="hidden">Hidden</SelectItem><SelectItem value="dismissed">Dismissed</SelectItem><SelectItem value="applied">Applied</SelectItem></SelectContent></Select>
      </div>

      {matchesQuery.isLoading && <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" />Loading matches...</div>}
      {matchesQuery.isError && <div className="text-sm text-red-700 flex gap-2"><AlertCircle size={16} />Could not load matches: {matchesQuery.error instanceof Error ? matchesQuery.error.message : "Unknown error"}</div>}

      {!matchesQuery.isLoading && matches.length === 0 && (
        <Card className="border-slate-200"><CardContent className="py-12 text-center text-sm text-slate-500">No generated matches yet. Admin or Grant Lead users can generate matches from existing projects and grants.</CardContent></Card>
      )}

      {matches.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="space-y-3">
            <CardHeader className="p-0"><CardTitle className="text-sm">Top Matches</CardTitle></CardHeader>
            {topMatches.map((m) => <MatchCard key={m.id} match={m} />)}
          </section>
          <section className="space-y-3">
            <CardHeader className="p-0"><CardTitle className="text-sm">Ending Soon</CardTitle></CardHeader>
            {endingSoon.map((m) => <MatchCard key={m.id} match={m} compact />)}
            {endingSoon.length === 0 && <div className="text-sm text-slate-400 py-8">No active matches ending in the next 60 days.</div>}
          </section>
          <section className="space-y-3">
            <CardHeader className="p-0"><CardTitle className="text-sm">Needs Review</CardTitle></CardHeader>
            {needsReview.map((m) => <MatchCard key={m.id} match={m} compact />)}
          </section>
          <section className="space-y-3">
            <CardHeader className="p-0"><CardTitle className="text-sm">Saved Matches</CardTitle></CardHeader>
            {saved.map((m) => <MatchCard key={m.id} match={m} compact />)}
            {saved.length === 0 && <div className="text-sm text-slate-400 py-8">No saved matches yet.</div>}
          </section>
        </div>
      )}

      <div className="text-xs text-slate-400 flex items-center gap-1.5"><RefreshCw size={12} />Refresh preserves saved, hidden, dismissed, and reviewed state.</div>
    </div>
  );
}
