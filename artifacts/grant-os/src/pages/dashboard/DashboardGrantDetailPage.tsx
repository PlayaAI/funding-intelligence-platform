import { useMemo, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useFunders } from "@/hooks/useFunders";
import { funderDetailPath } from "@/lib/funderMappers";
import {
  useMappedGrant,
  useUpdateGrant,
  useArchiveGrant,
  useDeleteGrant,
  useSetGrantTopThree,
} from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { useGenerateMatchesForGrant, useGrantMatchesForGrant } from "@/hooks/useGrantMatches";
import { matchJsonArray } from "@/lib/matching/matchesService";
import { useApplicationsByGrant } from "@/hooks/useApplications";
import { useTasksByGrant, useCreateTask } from "@/hooks/useTasks";
import GrantFormDialog, { type GrantFormValues } from "@/components/dashboard/GrantFormDialog";
import ApplicationFormDialog, { type ApplicationFormValues } from "@/components/dashboard/ApplicationFormDialog";
import TaskFormDialog, { type TaskFormValues } from "@/components/dashboard/TaskFormDialog";
import { grantFormValuesToInsert } from "@/lib/grantFormUtils";
import { useCreateApplication } from "@/hooks/useApplications";
import { documents } from "@/data/documents";
import type { ApplicationDbStatus, TaskDbStatus, TaskDbPriority } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import ScoreBar from "@/components/dashboard/ScoreBar";
import AgentNotesPanel from "@/components/dashboard/AgentNotesPanel";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Pencil,
  Archive,
  Trash2,
  Loader2,
  Download,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { exportGrantPackage } from "@/lib/exports/exportPackages";
import { usePermissions } from "@/hooks/usePermissions";
import { useCreateAgentActivity } from "@/hooks/useAgentActivity";
import { useAuth } from "@/contexts/AuthContext";

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
  const [, navigate] = useLocation();
  const [watchStatus, setWatchStatus] = useState<WatchStatus>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createAppOpen, setCreateAppOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const grantId = params?.id;
  const { grant, grantRow, isLoading, isError, error } = useMappedGrant(grantId);
  // Fix #5: lightweight funder lookup — don't load all grants+projects+peer records
  const { data: funderRows = [] } = useFunders();
  const { data: projectRows = [] } = useProjects();
  const updateGrant = useUpdateGrant();
  const archiveGrant = useArchiveGrant();
  const deleteGrant = useDeleteGrant();
  const setTopThree = useSetGrantTopThree();
  const { data: relatedApps = [] } = useApplicationsByGrant(grantRow?.id);
  const { data: relatedTasks = [] } = useTasksByGrant(grantRow?.id);
  const createApp = useCreateApplication();
  const createTask = useCreateTask();
  const { canWriteTable, canCreateTable, canDeleteRecords } = usePermissions();
  const { user } = useAuth();
  const createActivity = useCreateAgentActivity();
  const grantMatchesQuery = useGrantMatchesForGrant(grantRow?.id);
  const generateGrantMatches = useGenerateMatchesForGrant();

  const funder = useMemo(() => {
    if (!grant) return null;
    const fid = grant.funderId;
    const nameLower = grant.funderName.toLowerCase();
    const matchedRow = funderRows.find(
      (f) => f.id === fid || f.legacy_id === fid || f.name.toLowerCase() === nameLower
    );
    if (!matchedRow) return null;
    return {
      id: matchedRow.id,
      legacyId: matchedRow.legacy_id ?? undefined,
      name: matchedRow.name,
      relationshipStatus: (matchedRow.relationship_status as string) ?? "None",
      notes: matchedRow.notes ?? undefined,
    };
  }, [grant, funderRows]);

  const handleAI = (action: string) =>
    toast({ title: action, description: "AI workflow will be connected in a later phase." });

  const handleExportGrant = async () => {
    try {
      await exportGrantPackage(grantRow!.id, grantRow!.title);
      await createActivity.mutateAsync({ actor_source: "human", action_type: "export_created", title: `Exported grant package: ${grantRow!.title}`, related_grant_id: grantRow!.id, related_project_id: grantRow!.related_project_id ?? null, created_by: user?.id ?? null });
      toast({ title: "Grant package exported", description: "JSON download created." });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="p-8 text-center text-amber-700 text-sm">Configure Supabase to view grant details.</div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading grant…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-600 text-sm">
        Could not load grant: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (!grant || !grantRow) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Grant not found.</p>
        <Link href="/dashboard/grants">
          <Button variant="ghost" className="mt-4 gap-2">
            <ArrowLeft size={14} />
            Back to grants
          </Button>
        </Link>
      </div>
    );
  }

  const relatedDocs = documents.filter(
    (d) => {
      const legacyId = (grant as any).legacyId;
      return d.relatedGrantId === grant.id || (legacyId != null && d.relatedGrantId === legacyId);
    }
  );
  const days = daysUntil(grant.deadline);
  const top3 = grant.isTop3;

  const handleCreateApp = async (values: ApplicationFormValues) => {
    try {
      await createApp.mutateAsync({
        title: values.title,
        status: (values.status as ApplicationDbStatus) ?? "Drafting",
        owner_name: values.owner_name || null,
        grant_id: grant.id,
        project_id: values.project_id || null,
        google_doc_url: values.google_doc_url || null,
        drive_folder_url: values.drive_folder_url || null,
        portal_url: values.portal_url || null,
        notes: values.notes || null,
      });
      toast({ title: "Application created", description: values.title });
      setCreateAppOpen(false);
    } catch (e) {
      toast({ title: "Failed to create application", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleCreateTask = async (values: TaskFormValues) => {
    try {
      await createTask.mutateAsync({
        title: values.title,
        description: values.description || null,
        owner_name: values.owner_name || null,
        status: (values.status as TaskDbStatus) ?? "Not Started",
        priority: (values.priority as TaskDbPriority) ?? "Medium",
        due_date: values.due_date || null,
        related_grant_id: grant.id,
        related_project_id: values.related_project_id || null,
        related_application_id: values.related_application_id || null,
        notes: values.notes || null,
      });
      toast({ title: "Task created", description: values.title });
      setAddTaskOpen(false);
    } catch (e) {
      toast({ title: "Failed to create task", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleEdit = async (values: GrantFormValues) => {
    try {
      await updateGrant.mutateAsync({
        id: grant.id,
        updates: grantFormValuesToInsert(values, projectRows),
      });
      toast({ title: "Grant updated", description: values.title });
      setEditOpen(false);
    } catch (e) {
      toast({
        title: "Failed to update grant",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      throw e;
    }
  };

  const handleArchive = async () => {
    try {
      await archiveGrant.mutateAsync(grant.id);
      toast({ title: "Grant archived", description: grant.title });
      setConfirmArchive(false);
      navigate("/dashboard/grants");
    } catch (e) {
      toast({
        title: "Failed to archive grant",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGrant.mutateAsync(grant.id);
      toast({ title: "Grant deleted", description: grant.title });
      setConfirmDelete(false);
      navigate("/dashboard/grants");
    } catch (e) {
      toast({
        title: "Failed to delete grant",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

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
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportGrant}>
          <Download size={12} />
          Export JSON
        </Button>
        {canCreateTable("applications") && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setCreateAppOpen(true)}>
            <Plus size={12} />
            Create Application
          </Button>
        )}
        {canWriteTable("grants") && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setEditOpen(true)}
          >
            <Pencil size={12} />
            Edit
          </Button>
        )}
        {canWriteTable("grants") && (
        <Button
          size="sm"
          variant={top3 ? "default" : "outline"}
          className="gap-1.5 text-xs"
          disabled={setTopThree.isPending}
          onClick={async () => {
            try {
              await setTopThree.mutateAsync({ id: grant.id, isTopThree: !top3 });
              toast({
                title: top3 ? "Removed from Top 3" : "Added to Top 3",
                description: top3
                  ? "Grant removed from Top 3 Focus."
                  : "Grant added to Top 3 Focus.",
              });
            } catch (e) {
              toast({
                title: "Failed to update Top 3",
                description: e instanceof Error ? e.message : "Unknown error",
                variant: "destructive",
              });
            }
          }}
        >
          {top3 ? <StarOff size={12} /> : <Star size={12} />}
          {top3 ? "Remove from Top 3" : "Add to Top 3"}
        </Button>
        )}
        {canWriteTable("grants") && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setConfirmArchive(true)}
        >
          <Archive size={12} />
          Archive
        </Button>
        )}
        {canDeleteRecords && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={12} />
          Delete
        </Button>
        )}
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
          <TabsTrigger value="project-matches" className="text-xs">Project Matches</TabsTrigger>
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
                <div>
                  <span className="text-slate-500 text-xs">Funder</span>
                  {funder ? (
                    <Link href={funderDetailPath(funder)}>
                      <div className="font-medium text-primary mt-0.5 hover:underline">{grant.funderName}</div>
                    </Link>
                  ) : (
                    <div className="font-medium text-slate-800 mt-0.5">{grant.funderName}</div>
                  )}
                </div>
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

        <TabsContent value="project-matches" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">Project Matches</div>
              <p className="text-xs text-slate-500 mt-0.5">Projects ranked against this grant by deterministic fit and readiness.</p>
            </div>
            {canWriteTable("grant_matches") && (
              <Button size="sm" className="gap-2 text-xs" disabled={generateGrantMatches.isPending} onClick={async () => {
                const rows = await generateGrantMatches.mutateAsync(grant.id);
                toast({ title: "Project matches generated", description: ` matches updated.` });
              }}>
                {generateGrantMatches.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Generate
              </Button>
            )}
          </div>
          {grantMatchesQuery.isLoading && <div className="py-8 text-center text-sm text-slate-400">Loading project matches...</div>}
          {(grantMatchesQuery.data ?? []).slice(0, 10).map((match) => {
            const reasons = matchJsonArray(match.fit_reasons).slice(0, 2);
            const risks = matchJsonArray(match.risks);
            return (
              <Card key={match.id} className="border-slate-200">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {match.project?.slug ? <Link href={`/dashboard/projects/`}><div className="font-medium text-sm text-primary hover:underline">{match.project.name}</div></Link> : <div className="font-medium text-sm text-slate-800">Unknown project</div>}
                      <div className="text-xs text-slate-500 mt-0.5">Score {match.match_score} · Readiness {match.readiness_score} · Urgency {match.urgency_score} · {match.match_tier.replace("_", " ")}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">{match.status}</Badge>
                  </div>
                  <div className="mt-3 space-y-1">
                    {reasons.map((reason) => <div key={reason} className="text-xs text-slate-600">• {reason}</div>)}
                    {risks[0] && <div className="text-xs text-red-600">Risk: {risks[0]}</div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!grantMatchesQuery.isLoading && (grantMatchesQuery.data ?? []).length === 0 && <Card className="border-slate-200"><CardContent className="py-10 text-center text-sm text-slate-500">No project matches generated for this grant yet.</CardContent></Card>}
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
                          <div className="font-medium text-slate-800">{a.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{a.owner_name ?? "Unassigned"}</div>
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
                {canCreateTable("applications") && (
                <Button size="sm" className="gap-2 text-xs" onClick={() => setCreateAppOpen(true)}>
                  <Plus size={12} />
                  Create Application Workspace
                </Button>
                )}
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
                          {t.owner_name ?? "Unassigned"} · {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={t.priority === "High" || t.priority === "Urgent" ? "destructive" : "secondary"} className="text-xs">{t.priority}</Badge>
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
          {canWriteTable("tasks") && (
          <Button size="sm" variant="outline" className="gap-2 text-xs mt-3" onClick={() => setAddTaskOpen(true)}>
            <Plus size={12} />
            Add task
          </Button>
          )}
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
          <AgentNotesPanel relatedGrantId={grant.id} relatedProjectId={grantRow.related_project_id ?? undefined} />
        </TabsContent>
      </Tabs>

      <GrantFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        defaultValues={grantRow}
        title="Edit grant"
        submitLabel="Save changes"
        loading={updateGrant.isPending}
      />

      <ApplicationFormDialog
        open={createAppOpen}
        onOpenChange={setCreateAppOpen}
        onSubmit={handleCreateApp}
        title="New application for this grant"
        submitLabel="Create application"
        loading={createApp.isPending}
        lockedGrantId={grant.id}
      />

      <TaskFormDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        onSubmit={handleCreateTask}
        title="Add task for this grant"
        submitLabel="Create task"
        loading={createTask.isPending}
        lockedGrantId={grant.id}
      />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this grant?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{grant.title}&quot; will be archived and hidden from the main grants list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this grant?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{grant.title}&quot; will be removed from the database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
