import { useState } from "react";
import { useRoute, Link } from "wouter";
import { grants } from "@/data/grants";
import { funders } from "@/data/funders";
import { applications } from "@/data/applications";
import { tasks } from "@/data/tasks";
import { documents } from "@/data/documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import ScoreBar from "@/components/dashboard/ScoreBar";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Star,
  Sparkles,
  ExternalLink,
  CalendarClock,
  Building2,
  FolderOpen,
  Plus,
  FileText,
  Eye,
  EyeOff,
  StarOff,
} from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function fmt(n: number) {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

type WatchStatus = "Apply" | "Watch" | "Ignore" | null;

export default function DashboardGrantDetailPage() {
  const [, params] = useRoute("/dashboard/grants/:id");
  const [watchStatus, setWatchStatus] = useState<WatchStatus>(null);
  const [isTop3, setIsTop3] = useState<boolean | null>(null);
  const grant = grants.find((g) => g.id === params?.id);

  const handleAI = (action: string) =>
    toast({ title: action, description: "AI workflow will be connected in a later phase." });

  if (!grant) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Grant not found.</p>
        <Link href="/dashboard/grants">
          <Button variant="ghost" className="mt-4 gap-2"><ArrowLeft size={14} />Back to tracker</Button>
        </Link>
      </div>
    );
  }

  const funder = funders.find((f) => f.id === grant.funderId);
  const relatedApps = applications.filter((a) => a.grantId === grant.id);
  const relatedTasks = tasks.filter((t) => t.relatedGrantId === grant.id);
  const relatedDocs = documents.filter((d) => d.relatedGrantId === grant.id);
  const days = daysUntil(grant.deadline);
  const top3 = isTop3 !== null ? isTop3 : grant.isTop3;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/grants">
          <Button variant="ghost" size="sm" className="gap-2 text-xs h-8">
            <ArrowLeft size={14} />
            Grants
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {top3 && <Star size={15} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
            <h1 className="text-xl font-bold text-slate-900">{grant.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Building2 size={13} />
              {grant.funderName}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarClock size={13} />
              {formatDate(grant.deadline)}
              {!["Awarded", "Declined", "Archived", "Submitted"].includes(grant.status) && days > 0 && (
                <span className={`font-semibold text-xs ml-1 ${days <= 14 ? "text-red-500" : days <= 30 ? "text-amber-500" : "text-slate-400"}`}>
                  ({days} days)
                </span>
              )}
            </span>
            {grant.relatedProjectName && (
              <span className="flex items-center gap-1.5">
                <FolderOpen size={13} />
                {grant.relatedProjectName}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <GrantStatusBadge status={grant.status} />
          <div className="text-sm font-medium text-slate-700">{fmt(grant.amountMin)}–{fmt(grant.amountMax)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleAI("Analyze Fit")}>
          <Sparkles size={12} />
          Analyze Fit
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleAI("Summarize Grant")}>
          <Sparkles size={12} />
          Summarize
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleAI("Suggest Proof")}>
          <Sparkles size={12} />
          Suggest Proof
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() =>
          toast({ title: "Create application", description: "Application workspace creation coming in next phase." })
        }>
          <Plus size={12} />
          Create Application
        </Button>
        <Button
          size="sm"
          variant={top3 ? "default" : "outline"}
          className="gap-1.5 text-xs"
          onClick={() => {
            setIsTop3(!top3);
            toast({ title: top3 ? "Removed from Top 3" : "Added to Top 3", description: top3 ? "Grant removed from Top 3 Focus." : "Grant added to Top 3 Focus." });
          }}
        >
          {top3 ? <StarOff size={12} /> : <Star size={12} />}
          {top3 ? "Remove from Top 3" : "Add to Top 3"}
        </Button>
        {grant.applicationUrl && (
          <a href={grant.applicationUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <ExternalLink size={12} />
              Portal
            </Button>
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["Apply", "Watch", "Ignore"] as WatchStatus[]).map((s) => (
          <button
            key={s!}
            onClick={() => {
              setWatchStatus(s);
              toast({ title: `Marked: ${s}`, description: `Grant marked as "${s}".` });
            }}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              watchStatus === s
                ? s === "Apply" ? "bg-violet-600 text-white border-violet-600"
                  : s === "Watch" ? "bg-amber-500 text-white border-amber-500"
                  : "bg-slate-500 text-white border-slate-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {s === "Apply" && <span className="mr-1">Apply</span>}
            {s === "Watch" && (
              <span className="flex items-center gap-1"><Eye size={11} />Watch</span>
            )}
            {s === "Ignore" && (
              <span className="flex items-center gap-1"><EyeOff size={11} />Ignore</span>
            )}
          </button>
        ))}
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
          <TabsTrigger value="fit" className="text-xs">Fit Analysis</TabsTrigger>
          <TabsTrigger value="requirements" className="text-xs">Requirements</TabsTrigger>
          <TabsTrigger value="workspace" className="text-xs">Workspace ({relatedApps.length})</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">Tasks ({relatedTasks.length})</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Documents ({relatedDocs.length})</TabsTrigger>
          <TabsTrigger value="ai-notes" className="text-xs">AI Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Grant Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><span className="text-slate-500 text-xs">Funder</span><div className="font-medium text-slate-800 mt-0.5">{grant.funderName}</div></div>
                <div><span className="text-slate-500 text-xs">Amount Range</span><div className="font-medium text-slate-800 mt-0.5">{fmt(grant.amountMin)} – {fmt(grant.amountMax)}</div></div>
                <div><span className="text-slate-500 text-xs">Deadline</span><div className="font-medium text-slate-800 mt-0.5">{formatDate(grant.deadline)}</div></div>
                <div><span className="text-slate-500 text-xs">Geography</span><div className="font-medium text-slate-800 mt-0.5">{grant.geography}</div></div>
                <div><span className="text-slate-500 text-xs">Assigned Owner</span><div className="font-medium text-slate-800 mt-0.5">{grant.assignedOwner}</div></div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Focus Areas</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {grant.focusAreas.map((a) => (
                    <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                  ))}
                </div>
                {funder && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-xs text-slate-500 mb-2">Funder relationship</div>
                    <Badge variant="outline" className="text-xs">{funder.relationshipStatus}</Badge>
                    {funder.notes && <p className="text-xs text-slate-500 mt-2">{funder.notes}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {grant.notes && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="pt-4">
                <div className="text-xs font-semibold text-amber-800 mb-1">Internal Notes</div>
                <p className="text-sm text-amber-900">{grant.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Eligibility</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">{grant.eligibility}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fit" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Scores</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ScoreBar label="Fit Score" value={grant.fitScore} />
                <ScoreBar label="Priority Score" value={grant.priorityScore} />
                <ScoreBar label="Urgency Score" value={grant.urgencyScore} />
                <ScoreBar label="Ease (inverse difficulty)" value={100 - grant.difficultyScore} />
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-3"><CardTitle className="text-sm">AI Fit Analysis</CardTitle></CardHeader>
              <CardContent>
                <div className="text-sm text-slate-500 mb-4">No AI analysis run yet.</div>
                <Button size="sm" className="gap-2 text-xs w-full" onClick={() => handleAI("Analyze Fit")}>
                  <Sparkles size={12} />
                  Run Fit Analysis
                </Button>
                <p className="text-[11px] text-slate-400 mt-2 text-center">AI workflow will be connected in a later phase.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              <div className="text-sm text-slate-700 mb-3">{grant.eligibility}</div>
              <div className="text-xs text-slate-400">Detailed requirements not yet extracted. Use AI to extract from the grant page.</div>
              <Button size="sm" variant="outline" className="gap-2 text-xs mt-4" onClick={() => handleAI("Extract Requirements")}>
                <Sparkles size={12} />
                Extract Requirements
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="mt-4">
          {relatedApps.length > 0 ? (
            <div className="space-y-3">
              {relatedApps.map((a) => (
                <Link href={`/dashboard/applications/${a.id}`} key={a.id}>
                  <Card className="border-slate-200 hover:border-primary/40 cursor-pointer transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-800">{a.grantTitle}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{a.projectName} · {a.owner}</div>
                        </div>
                        <Badge variant="secondary">{a.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-slate-200">
              <CardContent className="pt-6 pb-6 text-center">
                <p className="text-sm text-slate-500 mb-4">No application workspace yet. Create one to start drafting.</p>
                <Button size="sm" className="gap-2 text-xs" onClick={() =>
                  toast({ title: "Create application", description: "Application workspace creation coming in next phase." })
                }>
                  <Plus size={12} />
                  Create Application Workspace
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {relatedTasks.length > 0 ? (
            <div className="space-y-2">
              {relatedTasks.map((t) => (
                <Card key={t.id} className="border-slate-200">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-slate-800">{t.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {t.owner} · Due {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={t.priority === "High" ? "destructive" : "secondary"} className="text-xs">{t.priority}</Badge>
                        <Badge variant="outline" className="text-xs">{t.status}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-slate-200">
              <CardContent className="pt-6 pb-6 text-center text-sm text-slate-400">
                No tasks linked to this grant.
              </CardContent>
            </Card>
          )}
          <Button size="sm" variant="outline" className="gap-2 text-xs mt-3" onClick={() =>
            toast({ title: "Add task", description: "Task creation form coming in next phase." })
          }>
            <Plus size={12} />
            Add task
          </Button>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-3">
          {relatedDocs.map((doc) => (
            <Card key={doc.id} className="border-slate-200">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-800 truncate">{doc.title}</div>
                      {doc.description && <div className="text-xs text-slate-400 mt-0.5 truncate">{doc.description}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">{doc.type}</Badge>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={13} className="text-slate-400 hover:text-primary" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {relatedDocs.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No documents linked to this grant.</div>
          )}
          <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() =>
            toast({ title: "Add document", description: "Document creation coming in next phase." })
          }>
            <Plus size={12} />
            Add document
          </Button>
        </TabsContent>

        <TabsContent value="ai-notes" className="mt-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles size={13} className="text-primary" />
                AI Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500">No AI notes generated yet.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleAI("Summarize Grant")}>
                  <Sparkles size={12} />
                  Summarize Grant
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleAI("Analyze Fit")}>
                  <Sparkles size={12} />
                  Analyze Fit
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleAI("Extract Requirements")}>
                  <Sparkles size={12} />
                  Extract Requirements
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">AI workflow will be connected in a later phase.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
