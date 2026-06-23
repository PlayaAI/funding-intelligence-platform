import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useApplications, useApplicationsByGrant, useCreateApplication } from "@/hooks/useApplications";
import { useCreateDocument, useGrantDocuments, useUploadDocumentFile } from "@/hooks/useDocuments";
import { useFunders } from "@/hooks/useFunders";
import { funderDetailPath } from "@/lib/funderMappers";
import {
  useArchiveGrant,
  useDeleteGrant,
  useMappedGrant,
  useSetGrantTopThree,
  useUpdateGrant,
} from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { useCreateTask, useTasks, useTasksByGrant } from "@/hooks/useTasks";
import { useAgentReports } from "@/hooks/useAgentReports";
import { useGenerateMatchesForGrant, useGrantMatchesForGrant } from "@/hooks/useGrantMatches";
import { matchJsonArray } from "@/lib/matching/matchesService";
import { DECISION_CLASSES, DECISION_LABELS, deadlineLanguage } from "@/lib/matching/matchPresentation";
import { getDocumentSignedUrl } from "@/lib/documentsService";
import { exportGrantPackage } from "@/lib/exports/exportPackages";
import GrantFormDialog, { type GrantFormValues } from "@/components/dashboard/GrantFormDialog";
import ApplicationFormDialog, { type ApplicationFormValues } from "@/components/dashboard/ApplicationFormDialog";
import DocumentFormDialog, { type DocumentFormValues } from "@/components/dashboard/DocumentFormDialog";
import { deriveGrantDataQualityFlags } from "@/lib/grantDataQuality";
import { GrantDataQualityCard } from "@/components/dashboard/GrantDataQualityBadges";
import TaskFormDialog, { type TaskFormValues } from "@/components/dashboard/TaskFormDialog";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import AgentNotesPanel from "@/components/dashboard/AgentNotesPanel";
import { MatchGeneratedByBadge } from "@/components/dashboard/AgentBadge";
import ScoreBar from "@/components/dashboard/ScoreBar";
import { grantFormValuesToInsert } from "@/lib/grantFormUtils";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateAgentActivity } from "@/hooks/useAgentActivity";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/hooks/use-toast";
import type { ApplicationDbStatus, GrantRow, TaskDbPriority, TaskDbStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Archive,
  ArrowLeft,
  Building2,
  CalendarClock,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";

function formatDate(value: string | null | undefined) {
  if (!value) return "No deadline";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function compactDate(value: string | null | undefined) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function fmtAmount(value: number | null | undefined) {
  if (!value) return null;
  return value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : `$${(value / 1000).toFixed(0)}K`;
}

function amountRange(min?: number | null, max?: number | null, display?: string | null) {
  if (display) return display;
  if (min && max) return min === max ? fmtAmount(min) : `${fmtAmount(min)}-${fmtAmount(max)}`;
  return fmtAmount(min) ?? fmtAmount(max) ?? "Amount not listed";
}

function textOrPlaceholder(value: string | null | undefined, fallback = "Not listed") {
  return value?.trim() || fallback;
}

function readableList(values: string[] | null | undefined) {
  return values?.length ? values.join(", ") : "Not listed";
}

function cleanNotes(notes: string | null | undefined) {
  if (!notes) return "";
  return notes
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(raw|import|metadata|source)\s*[:=-]\s*/i, "").trim())
    .filter((line) => line && !/^[{}\[\]",:0-9a-f-]+$/i.test(line))
    .slice(0, 8)
    .join("\n");
}

function sourceFields(grantRow: GrantRow) {
  return [
    ["Source URL", grantRow.source_url],
    ["Application URL", grantRow.application_url],
    ["Next deadline", grantRow.next_deadline],
    ["Import/source notes", grantRow.notes],
  ].filter(([, value]) => Boolean(value));
}

function OverviewCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const DEFAULT_APPLICATION_TASKS = [
  "Confirm eligibility",
  "Review grant guidelines and source documents",
  "Draft problem statement",
  "Draft project/program description",
  "Draft budget and budget narrative",
  "Gather proof items / evidence",
  "Collect partner/support materials",
  "Final review",
  "Submit application",
  "Record submitted status and confirmation",
];

function checklistDueDate(deadline: string | null | undefined, index: number) {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - Math.max(1, (DEFAULT_APPLICATION_TASKS.length - index) * 2));
  return date.toISOString().slice(0, 10);
}

function checklistPriority(deadline: string | null | undefined): TaskDbPriority {
  const days = daysUntil(deadline);
  if (days == null) return "Medium";
  if (days <= 14) return "Urgent";
  if (days <= 30) return "High";
  return "Medium";
}

export default function DashboardGrantDetailPage() {
  const [, params] = useRoute("/dashboard/grants/:id");
  const [, navigate] = useLocation();
  const grantId = params?.id;
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [createAppOpen, setCreateAppOpen] = useState(false);
  const [targetApplicationProjectId, setTargetApplicationProjectId] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addDocOpen, setAddDocOpen] = useState(false);

  const { grant, grantRow, isLoading, isError, error } = useMappedGrant(grantId);
  const { data: funderRows = [] } = useFunders();
  const { data: projectRows = [] } = useProjects();
  const { data: applications = [] } = useApplications();
  const { data: relatedApps = [] } = useApplicationsByGrant(grantRow?.id);
  const { data: grantTasks = [] } = useTasksByGrant(grantRow?.id);
  const { data: allTasks = [] } = useTasks();
  const { data: grantReports = [] } = useAgentReports({ relatedGrantId: grantRow?.id });
  const grantMatchesQuery = useGrantMatchesForGrant(grantRow?.id);

  const updateGrant = useUpdateGrant();
  const archiveGrant = useArchiveGrant();
  const deleteGrant = useDeleteGrant();
  const setTopThree = useSetGrantTopThree();
  const createApp = useCreateApplication();
  const createTask = useCreateTask();
  const createDoc = useCreateDocument();
  const uploadDoc = useUploadDocumentFile();
  const generateGrantMatches = useGenerateMatchesForGrant();
  const createActivity = useCreateAgentActivity();
  const { canWriteTable, canCreateTable, canDeleteRecords } = usePermissions();
  const { user } = useAuth();

  const funder = useMemo(() => {
    if (!grantRow && !grant) return null;
    const fid = grantRow?.funder_id ?? grant?.funderId;
    const name = (grantRow?.funder_name ?? grant?.funderName ?? "").toLowerCase();
    return funderRows.find((f) => f.id === fid || f.legacy_id === fid || f.name.toLowerCase() === name) ?? null;
  }, [funderRows, grant, grantRow]);

  const { data: relatedDocs = [], isLoading: docsLoading } = useGrantDocuments(
    grantRow
      ? {
          grantId: grantRow.id,
          funderId: funder?.id ?? grantRow.funder_id,
          title: grantRow.title,
          funderName: grantRow.funder_name,
          sourceUrl: grantRow.source_url,
          applicationUrl: grantRow.application_url,
        }
      : null
  );

  const projectById = useMemo(() => new Map(projectRows.map((p) => [p.id, p])), [projectRows]);
  const applicationById = useMemo(() => new Map(relatedApps.map((a) => [a.id, a])), [relatedApps]);
  const matchedProjectIds = useMemo(
    () => new Set((grantMatchesQuery.data ?? []).map((match) => match.project_id)),
    [grantMatchesQuery.data]
  );
  const relatedProjectIds = useMemo(() => {
    const ids = new Set<string>();
    if (grantRow?.related_project_id) ids.add(grantRow.related_project_id);
    relatedApps.forEach((app) => app.project_id && ids.add(app.project_id));
    matchedProjectIds.forEach((id) => ids.add(id));
    return ids;
  }, [grantRow?.related_project_id, matchedProjectIds, relatedApps]);
  const relatedTasks = useMemo(() => {
    const appIds = new Set(relatedApps.map((app) => app.id));
    const byId = new Map(grantTasks.map((task) => [task.id, task]));
    allTasks.forEach((task) => {
      if (
        task.related_grant_id === grantRow?.id ||
        (task.related_application_id && appIds.has(task.related_application_id)) ||
        (task.related_project_id && relatedProjectIds.has(task.related_project_id))
      ) {
        byId.set(task.id, task);
      }
    });
    return [...byId.values()].filter((task) => task.status !== "Archived").slice(0, 20);
  }, [allTasks, grantRow?.id, grantTasks, relatedApps, relatedProjectIds]);

  // Sort matches: apply_now / prepare_next first, then by match_score desc
  const DECISION_ORDER: Record<string, number> = {
    apply_now: 0,
    prepare_next: 1,
    monitor: 2,
    track_next_cycle: 3,
    needs_review: 4,
    skip: 5,
  };

  const { agentMatches, systemMatches } = useMemo(() => {
    const all = grantMatchesQuery.data ?? [];
    const agents = all.filter((m) => m.generated_by !== "rules_engine");
    const systems = all.filter((m) => m.generated_by === "rules_engine");

    agents.sort((a, b) => {
      const timeA = new Date(a.generated_at).getTime();
      const timeB = new Date(b.generated_at).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.match_score - a.match_score;
    });

    systems.sort((a, b) => {
      const orderA = DECISION_ORDER[a.decision_label] ?? 99;
      const orderB = DECISION_ORDER[b.decision_label] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.match_score - a.match_score;
    });

    return { agentMatches: agents, systemMatches: systems };
  }, [grantMatchesQuery.data]);

  if (!isSupabaseConfigured) {
    return <div className="p-8 text-center text-amber-700 text-sm">Configure Supabase to view grant details.</div>;
  }
  if (isLoading) {
    return <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" />Loading grant...</div>;
  }
  if (isError) {
    return <div className="p-8 text-center text-red-600 text-sm">Could not load grant: {error instanceof Error ? error.message : String(error)}</div>;
  }
  if (!grant || !grantRow) {
    return <div className="p-8 text-center text-slate-500"><p>Grant not found.</p><Link href="/dashboard/grants"><Button variant="ghost" className="mt-4 gap-2"><ArrowLeft size={14} />Back to Grants</Button></Link></div>;
  }

  const bestMatch = (grantMatchesQuery.data ?? [])[0];
  const days = daysUntil(grantRow.deadline);
  const amount = amountRange(grantRow.amount_min, grantRow.amount_max, grantRow.amount_display);
  const displayNotes = cleanNotes(grantRow.notes);
  const sourceRows = sourceFields(grantRow);
  const preferredProjectId = grantRow.related_project_id ?? bestMatch?.project_id ?? relatedApps.find((app) => app.project_id)?.project_id ?? null;
  const activeApplicationProjectId = targetApplicationProjectId ?? preferredProjectId;
  const preferredProject = activeApplicationProjectId ? projectById.get(activeApplicationProjectId) : null;
  const applicationInitialValues: Partial<ApplicationFormValues> = {
    title: `${grantRow.title} — ${preferredProject?.name ?? "Project"} Application`,
    status: "Not Started",
    grant_id: grantRow.id,
    project_id: activeApplicationProjectId ?? "",
    portal_url: grantRow.application_url ?? "",
    notes: grantRow.funder_name ? `Application workspace for ${grantRow.funder_name}.` : "",
  };

  const createDefaultChecklist = async (applicationId: string, projectId: string | null | undefined) => {
    const priority = checklistPriority(grantRow.deadline);
    for (const [index, title] of DEFAULT_APPLICATION_TASKS.entries()) {
      await createTask.mutateAsync({
        title,
        description: null,
        owner_name: null,
        status: "Not Started",
        priority,
        due_date: checklistDueDate(grantRow.deadline, index),
        related_grant_id: grantRow.id,
        related_project_id: projectId || preferredProjectId,
        related_application_id: applicationId,
        notes: "Default application checklist item.",
      });
    }
  };

  const openOrStartApplication = (projectId?: string | null) => {
    const candidateProjectId = projectId ?? preferredProjectId;
    const existing = relatedApps.find((app) => (app.project_id ?? null) === (candidateProjectId ?? null)) ?? (candidateProjectId == null && relatedApps.length === 1 ? relatedApps[0] : null);
    if (existing) {
      navigate(`/dashboard/applications/${existing.id}`);
      return;
    }
    setTargetApplicationProjectId(candidateProjectId ?? null);
    setCreateAppOpen(true);
  };

  const handleExportGrant = async () => {
    try {
      await exportGrantPackage(grantRow.id, grantRow.title);
      await createActivity.mutateAsync({
        actor_source: "human",
        action_type: "export_created",
        title: `Exported grant package: ${grantRow.title}`,
        related_grant_id: grantRow.id,
        related_project_id: grantRow.related_project_id ?? null,
        created_by: user?.id ?? null,
      });
      toast({ title: "Grant package exported", description: "JSON download created." });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleCreateApp = async (values: ApplicationFormValues) => {
    try {
      const selectedProjectId = values.project_id || preferredProjectId || null;
      const existing = relatedApps.find((app) => (app.project_id ?? null) === selectedProjectId);
      if (existing) {
        toast({ title: "Application already exists", description: "Opening the existing workspace instead." });
        setCreateAppOpen(false);
        navigate(`/dashboard/applications/${existing.id}`);
        return;
      }
      const created = await createApp.mutateAsync({
        title: values.title,
        status: (values.status as ApplicationDbStatus) ?? "Not Started",
        owner_name: values.owner_name || null,
        grant_id: grantRow.id,
        project_id: selectedProjectId,
        google_doc_url: values.google_doc_url || null,
        drive_folder_url: values.drive_folder_url || null,
        portal_url: values.portal_url || grantRow.application_url || null,
        notes: values.notes || null,
      });
      await createDefaultChecklist(created.id, selectedProjectId);
      toast({ title: "Application created", description: values.title });
      setCreateAppOpen(false);
      setTargetApplicationProjectId(null);
      navigate(`/dashboard/applications/${created.id}`);
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
        related_grant_id: grantRow.id,
        related_project_id: values.related_project_id || preferredProjectId,
        related_application_id: values.related_application_id || null,
        notes: values.notes || null,
      });
      toast({ title: "Task created", description: values.title });
      setAddTaskOpen(false);
    } catch (e) {
      toast({ title: "Failed to create task", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleCreateDocument = async (values: DocumentFormValues) => {
    try {
      const metadata = {
        title: values.title,
        document_type: values.document_type,
        source_url: values.source_url,
        related_project_id: values.related_project_id || preferredProjectId,
        related_grant_id: grantRow.id,
        related_funder_id: values.related_funder_id || funder?.id || grantRow.funder_id,
        related_application_id: values.related_application_id,
        metadata: values.metadata,
        uploaded_by: user?.id ?? null,
      };
      if (values.file) await uploadDoc.mutateAsync({ file: values.file, metadata });
      else await createDoc.mutateAsync({ ...metadata, extraction_status: "not_started" });
      toast({ title: "Document saved", description: values.title });
      setAddDocOpen(false);
    } catch (e) {
      toast({ title: "Failed to save document", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleEdit = async (values: GrantFormValues) => {
    await updateGrant.mutateAsync({ id: grantRow.id, updates: grantFormValuesToInsert(values, projectRows) });
    toast({ title: "Grant updated", description: values.title });
    setEditOpen(false);
  };

  const copyUrl = async (value: string | null | undefined) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast({ title: "Source URL copied" });
  };

  const openDoc = async (doc: (typeof relatedDocs)[number]) => {
    try {
      const url = await getDocumentSignedUrl(doc);
      if (!url) throw new Error("No source URL or uploaded file is available.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Could not open document", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    await archiveGrant.mutateAsync(grantRow.id);
    toast({ title: "Grant archived", description: grantRow.title });
    navigate("/dashboard/grants");
  };

  const handleDelete = async () => {
    await deleteGrant.mutateAsync(grantRow.id);
    toast({ title: "Grant deleted", description: grantRow.title });
    navigate("/dashboard/grants");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/grants">
          <Button variant="ghost" size="sm" className="gap-2 text-xs h-8"><ArrowLeft size={14} />Back to Grants</Button>
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportGrant}><Download size={12} />Export JSON</Button>
          {canCreateTable("applications") && <Button size="sm" className="gap-1.5 text-xs" onClick={() => openOrStartApplication()}><Plus size={12} />Start Application</Button>}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {grantRow.is_top_three && <Star size={15} className="text-amber-400 fill-amber-400" />}
            <h1 className="text-2xl font-bold text-slate-900">{grantRow.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Building2 size={13} />{textOrPlaceholder(grantRow.funder_name)}</span>
            <span className="flex items-center gap-1.5"><CalendarClock size={13} />{formatDate(grantRow.deadline)}</span>
            <span className="font-medium text-slate-700">{amount}</span>
            {preferredProject && <span className="flex items-center gap-1.5"><FolderOpen size={13} />{preferredProject.name}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <GrantStatusBadge status={grantRow.status} />
            {bestMatch && <Badge variant="outline" className={`text-xs ${DECISION_CLASSES[bestMatch.decision_label] ?? DECISION_CLASSES.needs_review}`}>{DECISION_LABELS[bestMatch.decision_label] ?? "Needs Review"} · {bestMatch.match_score}</Badge>}
            {grantRow.source_url && <a href={grantRow.source_url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"><ExternalLink size={12} />Source</Button></a>}
            {grantRow.application_url && <a href={grantRow.application_url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"><ExternalLink size={12} />Portal</Button></a>}
          </div>
        </div>
        <div className="flex flex-wrap justify-start gap-2 md:justify-end">
          {canWriteTable("grants") && <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}><Pencil size={12} />Edit</Button>}
          {canWriteTable("grants") && <Button size="sm" variant={grantRow.is_top_three ? "default" : "outline"} className="gap-1.5 text-xs" disabled={setTopThree.isPending} onClick={() => setTopThree.mutate({ id: grantRow.id, isTopThree: !grantRow.is_top_three })}>{grantRow.is_top_three ? <StarOff size={12} /> : <Star size={12} />}{grantRow.is_top_three ? "Remove Top 3" : "Top 3"}</Button>}
          {canWriteTable("grants") && <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setConfirmArchive(true)}><Archive size={12} />Archive</Button>}
          {canDeleteRecords && <Button size="sm" variant="outline" className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmDelete(true)}><Trash2 size={12} />Delete</Button>}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <OverviewCard label="Deadline" value={formatDate(grantRow.deadline)} hint={days == null ? "No date listed" : days < 0 ? `${Math.abs(days)} days past` : days === 0 ? "Due today" : `${days} days left`} />
        <OverviewCard label="Amount Range" value={amount} />
        <OverviewCard label="Funder" value={funder ? <Link href={funderDetailPath(funder)} className="text-primary hover:underline">{funder.name}</Link> : textOrPlaceholder(grantRow.funder_name)} />
        <OverviewCard label="Project" value={preferredProject ? <Link href={`/dashboard/projects/${preferredProject.slug}`} className="text-primary hover:underline">{preferredProject.name}</Link> : "No project linked"} />
        <OverviewCard label="Match" value={bestMatch ? `${bestMatch.match_score} · ${DECISION_LABELS[bestMatch.decision_label] ?? "Needs Review"}` : "No match yet"} />
        <OverviewCard label="Eligibility" value={grantRow.eligibility ? "Available" : "Not listed"} />
        <OverviewCard label="Documents" value={docsLoading ? "Loading..." : relatedDocs.length} />
        <OverviewCard label="Applications" value={relatedApps.length ? `${relatedApps.length} linked` : "Not started"} />
        <OverviewCard label="Tasks" value={relatedTasks.length} />
        <OverviewCard label="Readiness" value={grantRow.application_readiness ?? grantRow.proof_readiness ?? "Not scored"} />
      </section>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Documents ({relatedDocs.length})</TabsTrigger>
          <TabsTrigger value="matches" className="text-xs">Project Matches</TabsTrigger>
          <TabsTrigger value="applications" className="text-xs">Applications</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Agent Notes</TabsTrigger>
          <TabsTrigger value="source" className="text-xs">Source Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border-slate-200 lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
              <CardContent className="space-y-5 text-sm text-slate-700">
                <section><h2 className="text-sm font-semibold text-slate-900">About this opportunity</h2><p className="mt-1 whitespace-pre-wrap">{displayNotes || textOrPlaceholder(grantRow.notes, "No narrative summary is stored yet.")}</p></section>
                <section><h2 className="text-sm font-semibold text-slate-900">Eligibility</h2><p className="mt-1 whitespace-pre-wrap">{textOrPlaceholder(grantRow.eligibility)}</p></section>
                <section><h2 className="text-sm font-semibold text-slate-900">Funding use / focus areas</h2><p className="mt-1">{readableList(grantRow.focus_areas)}</p></section>
                <section><h2 className="text-sm font-semibold text-slate-900">Requirements</h2><p className="mt-1">{readableList(grantRow.required_documents)}</p></section>
                <section><h2 className="text-sm font-semibold text-slate-900">Important notes</h2><p className="mt-1 whitespace-pre-wrap">{grantRow.geography ? `Geography: ${grantRow.geography}` : "No additional notes listed."}</p></section>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Related Funder</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {funder ? (
                  <>
                    <div><div className="font-semibold text-slate-900">{funder.name}</div><div className="text-xs text-slate-500">{funder.openness_to_new_grantees ?? "Funder profile"}</div></div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-slate-500">Location</span><div className="font-medium text-slate-800">{textOrPlaceholder(funder.location, "-")}</div></div>
                      <div><span className="text-slate-500">EIN</span><div className="font-medium text-slate-800">{textOrPlaceholder(funder.ein, "-")}</div></div>
                      <div><span className="text-slate-500">Median grant</span><div className="font-medium text-slate-800">{fmtAmount(funder.median_grant_amount) ?? "-"}</div></div>
                      <div><span className="text-slate-500">Invite-only</span><div className="font-medium text-slate-800">{funder.open_applications ? "No" : "Possible"}</div></div>
                    </div>
                    {funder.website && <a href={funder.website} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline break-all">{funder.website}</a>}
                    <Link href={funderDetailPath(funder)}><Button size="sm" variant="outline" className="w-full gap-2 text-xs">Open Funder</Button></Link>
                  </>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">No funder profile is linked yet.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Scores</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <ScoreBar label="Fit Score" value={grant.fitScore} />
              <ScoreBar label="Priority Score" value={grant.priorityScore} />
              <ScoreBar label="Urgency Score" value={grant.urgencyScore} />
              <ScoreBar label="Ease" value={100 - grant.difficultyScore} />
            </CardContent>
          </Card>

          <GrantDataQualityCard
            flags={deriveGrantDataQualityFlags(grantRow, {
              documentCount: relatedDocs.length,
              applicationCount: relatedApps.length,
              hasOnlySystemMatches:
                grantMatchesQuery.data &&
                grantMatchesQuery.data.length > 0 &&
                grantMatchesQuery.data.every((m) => m.generated_by === "rules_engine"),
            })}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm font-semibold text-slate-800">Documents / Source Files</div><p className="text-xs text-slate-500">Direct grant documents plus funder/source-linked files that appear to belong to this opportunity.</p></div>
            <div className="flex gap-2">
              {canCreateTable("documents") && <Button size="sm" className="gap-2 text-xs" onClick={() => setAddDocOpen(true)}><Plus size={12} />Add Document</Button>}
              <Link href={`/dashboard/documents?grant=${grantRow.id}`}><Button size="sm" variant="outline" className="gap-2 text-xs">Link Existing Document</Button></Link>
            </div>
          </div>
          {docsLoading && <div className="py-8 text-center text-sm text-slate-400">Loading documents...</div>}
          {!docsLoading && relatedDocs.map((doc) => (
            <Card key={doc.id} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex items-start gap-3">
                    <FileText size={16} className="mt-0.5 text-slate-400" />
                    <div className="min-w-0">
                      <Link href={`/dashboard/documents/${doc.id}`}><div className="font-medium text-sm text-primary hover:underline">{doc.title}</div></Link>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <Badge variant="secondary" className="text-[11px]">{doc.document_type.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline" className="text-[11px]">{doc.extraction_status.replace(/_/g, " ")}</Badge>
                        {doc.related_project_id && <span>Project: {projectById.get(doc.related_project_id)?.name ?? "Linked project"}</span>}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 break-all">{doc.file_name ?? doc.source_url ?? "No file/source URL"}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Link href={`/dashboard/documents/${doc.id}`}><Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">Open Document</Button></Link>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openDoc(doc)}><ExternalLink size={12} />Open Source</Button>
                    {doc.source_url && <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => copyUrl(doc.source_url)}><Clipboard size={12} />Copy URL</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!docsLoading && relatedDocs.length === 0 && <Card className="border-slate-200"><CardContent className="py-10 text-center text-sm text-slate-500">No documents are linked to this grant yet. Add guidelines, application instructions, or source files.</CardContent></Card>}
        </TabsContent>

        <TabsContent value="matches" className="mt-4 space-y-5">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <div>
              <div className="text-sm font-semibold text-slate-800">Project Matches</div>
              <p className="text-xs text-slate-500">Projects ranked by fit, readiness, and urgency. Agent-generated matches show in blue.</p>
            </div>
            {canWriteTable("grant_matches") && (
              <div className="flex flex-col items-start gap-1 md:items-end">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2 text-xs"
                  disabled={generateGrantMatches.isPending}
                  onClick={async () => {
                    const rows = await generateGrantMatches.mutateAsync(grantRow.id);
                    toast({ title: "Project matches generated", description: `${rows.length} matches updated.` });
                  }}
                >
                  {generateGrantMatches.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Generate
                </Button>
                <span className="text-[10px] text-slate-400">System matches are experimental. Prefer agent-generated matches.</span>
              </div>
            )}
          </div>

          {grantMatchesQuery.isLoading && (
            <div className="py-8 text-center text-sm text-slate-400">Loading project matches...</div>
          )}

          {!grantMatchesQuery.isLoading && (
            <div className="space-y-6">
              {/* Agent Matches Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Agent-generated matches</h3>
                {agentMatches.length > 0 ? (
                  agentMatches.slice(0, 10).map((match) => {
                    const fitReasons = matchJsonArray(match.fit_reasons).slice(0, 3);
                    const risks = matchJsonArray(match.risks).slice(0, 2);
                    const missing = matchJsonArray(match.missing_items).slice(0, 3);
                    const actions = matchJsonArray(match.recommended_actions);
                    const deadline = deadlineLanguage(match.grant?.deadline);
                    const rawDetails = {
                      id: match.id,
                      match_score: match.match_score,
                      match_tier: match.match_tier,
                      readiness_score: match.readiness_score,
                      urgency_score: match.urgency_score,
                      evidence_score: match.evidence_score,
                      deadline_status: match.deadline_status,
                      generated_by: match.generated_by,
                      generated_at: match.generated_at,
                      status: match.status,
                      score_breakdown: match.score_breakdown,
                      data_quality_flags: match.data_quality_flags,
                    };
                    return (
                      <Card key={match.id} className="border-slate-200 shadow-sm border-blue-100">
                        <CardContent className="p-4 space-y-3">
                          {/* Header: project name + badges */}
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              {match.project?.slug ? (
                                <Link href={`/dashboard/projects/${match.project.slug}`}>
                                  <div className="font-semibold text-primary hover:underline">{match.project.name}</div>
                                </Link>
                              ) : (
                                <div className="font-semibold text-slate-800">Unknown project</div>
                              )}
                              <div className="text-xs text-slate-500 mt-0.5">
                                Readiness {match.readiness_score} · Urgency {match.urgency_score} · {deadline.label}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 flex-shrink-0 md:justify-end">
                              <Badge
                                variant="outline"
                                className={`text-xs ${DECISION_CLASSES[match.decision_label] ?? DECISION_CLASSES.needs_review}`}
                              >
                                {DECISION_LABELS[match.decision_label] ?? "Needs Review"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Score {match.match_score}
                              </Badge>
                              <MatchGeneratedByBadge generatedBy={match.generated_by} />
                            </div>
                          </div>

                          {/* Fit reasons / risks / missing items */}
                          {(fitReasons.length > 0 || risks.length > 0 || missing.length > 0) && (
                            <div className="grid gap-3 text-xs md:grid-cols-3">
                              {fitReasons.length > 0 && (
                                <div>
                                  <div className="font-medium text-slate-600 mb-1">Why it fits</div>
                                  <ul className="space-y-0.5 text-slate-600">
                                    {fitReasons.map((r) => <li key={r}>• {r}</li>)}
                                  </ul>
                                </div>
                              )}
                              {risks.length > 0 && (
                                <div>
                                  <div className="font-medium text-red-600 mb-1">Risks</div>
                                  <ul className="space-y-0.5 text-red-700">
                                    {risks.map((r) => <li key={r}>• {r}</li>)}
                                  </ul>
                                </div>
                              )}
                              {missing.length > 0 && (
                                <div>
                                  <div className="font-medium text-amber-700 mb-1">Missing info</div>
                                  <ul className="space-y-0.5 text-amber-700">
                                    {missing.map((m) => <li key={m}>• {m}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Recommended next step */}
                          {actions.length > 0 && (
                            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                              <span className="font-medium">Next step:</span> {actions[0]}
                            </div>
                          )}

                          {/* Footer: timestamp + actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-slate-400">
                              Generated {new Date(match.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {match.reviewed_at && ` · Reviewed ${new Date(match.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {match.project?.slug && (
                                <Link href={`/dashboard/projects/${match.project.slug}`}>
                                  <Button size="sm" variant="outline" className="h-7 text-xs">Open Project</Button>
                                </Link>
                              )}
                              {canCreateTable("applications") && (
                                <Button size="sm" className="h-7 text-xs" onClick={() => openOrStartApplication(match.project_id)}>
                                  Create Application
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Collapsible raw details */}
                          <details className="rounded border border-slate-200 bg-slate-50">
                            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-500">
                              View full match details
                            </summary>
                            <pre className="px-3 pb-3 pt-1 text-[11px] text-slate-600 overflow-auto max-h-40 whitespace-pre-wrap">
                              {JSON.stringify(rawDetails, null, 2)}
                            </pre>
                          </details>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="border-slate-200 bg-slate-50">
                    <CardContent className="py-8 text-center text-sm text-slate-600">
                      No agent-generated match has been saved for this grant yet. Ask Hermes to review this grant and save a match.
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* System Matches Section */}
              {systemMatches.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">System-generated matches</h3>
                  {systemMatches.slice(0, 10).map((match) => {
                    const fitReasons = matchJsonArray(match.fit_reasons).slice(0, 3);
                    const risks = matchJsonArray(match.risks).slice(0, 2);
                    const missing = matchJsonArray(match.missing_items).slice(0, 3);
                    const actions = matchJsonArray(match.recommended_actions);
                    const deadline = deadlineLanguage(match.grant?.deadline);
                    const rawDetails = {
                      id: match.id,
                      match_score: match.match_score,
                      match_tier: match.match_tier,
                      readiness_score: match.readiness_score,
                      urgency_score: match.urgency_score,
                      evidence_score: match.evidence_score,
                      deadline_status: match.deadline_status,
                      generated_by: match.generated_by,
                      generated_at: match.generated_at,
                      status: match.status,
                      score_breakdown: match.score_breakdown,
                      data_quality_flags: match.data_quality_flags,
                    };
                    return (
                      <Card key={match.id} className="border-slate-200">
                        <CardContent className="p-4 space-y-3">
                          {/* Header: project name + badges */}
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              {match.project?.slug ? (
                                <Link href={`/dashboard/projects/${match.project.slug}`}>
                                  <div className="font-semibold text-primary hover:underline">{match.project.name}</div>
                                </Link>
                              ) : (
                                <div className="font-semibold text-slate-800">Unknown project</div>
                              )}
                              <div className="text-xs text-slate-500 mt-0.5">
                                Readiness {match.readiness_score} · Urgency {match.urgency_score} · {deadline.label}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 flex-shrink-0 md:justify-end">
                              <Badge
                                variant="outline"
                                className={`text-xs ${DECISION_CLASSES[match.decision_label] ?? DECISION_CLASSES.needs_review}`}
                              >
                                {DECISION_LABELS[match.decision_label] ?? "Needs Review"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Score {match.match_score}
                              </Badge>
                              <MatchGeneratedByBadge generatedBy={match.generated_by} />
                            </div>
                          </div>

                          {/* Fit reasons / risks / missing items */}
                          {(fitReasons.length > 0 || risks.length > 0 || missing.length > 0) && (
                            <div className="grid gap-3 text-xs md:grid-cols-3">
                              {fitReasons.length > 0 && (
                                <div>
                                  <div className="font-medium text-slate-600 mb-1">Why it fits</div>
                                  <ul className="space-y-0.5 text-slate-600">
                                    {fitReasons.map((r) => <li key={r}>• {r}</li>)}
                                  </ul>
                                </div>
                              )}
                              {risks.length > 0 && (
                                <div>
                                  <div className="font-medium text-red-600 mb-1">Risks</div>
                                  <ul className="space-y-0.5 text-red-700">
                                    {risks.map((r) => <li key={r}>• {r}</li>)}
                                  </ul>
                                </div>
                              )}
                              {missing.length > 0 && (
                                <div>
                                  <div className="font-medium text-amber-700 mb-1">Missing info</div>
                                  <ul className="space-y-0.5 text-amber-700">
                                    {missing.map((m) => <li key={m}>• {m}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Recommended next step */}
                          {actions.length > 0 && (
                            <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                              <span className="font-medium">Next step:</span> {actions[0]}
                            </div>
                          )}

                          {/* Footer: timestamp + actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-slate-400">
                              Generated {new Date(match.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {match.reviewed_at && ` · Reviewed ${new Date(match.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {match.project?.slug && (
                                <Link href={`/dashboard/projects/${match.project.slug}`}>
                                  <Button size="sm" variant="outline" className="h-7 text-xs">Open Project</Button>
                                </Link>
                              )}
                              {canCreateTable("applications") && (
                                <Button size="sm" className="h-7 text-xs" onClick={() => openOrStartApplication(match.project_id)}>
                                  Create Application
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Collapsible raw details */}
                          <details className="rounded border border-slate-200 bg-slate-50">
                            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-500">
                              Raw match details
                            </summary>
                            <pre className="px-3 pb-3 pt-1 text-[11px] text-slate-600 overflow-auto max-h-40 whitespace-pre-wrap">
                              {JSON.stringify(rawDetails, null, 2)}
                            </pre>
                          </details>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications" className="mt-4 space-y-3">
          {relatedApps.map((app) => {
            const openTasks = relatedTasks.filter((task) => task.related_application_id === app.id && task.status !== "Complete").length;
            const project = app.project_id ? projectById.get(app.project_id) : null;
            return (
              <Card key={app.id} className="border-slate-200">
                <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div><Link href={`/dashboard/applications/${app.id}`}><div className="font-medium text-primary hover:underline">{app.title}</div></Link><div className="text-xs text-slate-500 mt-1">{project?.name ?? "No project"} · {openTasks} open tasks · Updated {compactDate(app.updated_at)}</div></div>
                  <div className="flex items-center gap-2"><Badge variant="secondary">{app.status}</Badge><Link href={`/dashboard/applications/${app.id}`}><Button size="sm" variant="outline" className="text-xs">Open Application</Button></Link></div>
                </CardContent>
              </Card>
            );
          })}
          {relatedApps.length === 0 && <Card className="border-slate-200"><CardContent className="py-10 text-center"><p className="text-sm text-slate-500 mb-4">No application workspace exists for this grant yet.</p>{canCreateTable("applications") && <Button size="sm" className="gap-2 text-xs" onClick={() => openOrStartApplication()}><Plus size={12} />Start Application</Button>}</CardContent></Card>}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-2">
          {relatedTasks.map((task) => (
            <Card key={task.id} className="border-slate-200">
              <CardContent className="p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div><div className="font-medium text-sm text-slate-800">{task.title}</div><div className="text-xs text-slate-500 mt-0.5">{task.related_application_id ? applicationById.get(task.related_application_id)?.title ?? "Linked application" : task.related_project_id ? projectById.get(task.related_project_id)?.name ?? "Linked project" : "Grant task"} · {compactDate(task.due_date)}</div></div>
                <div className="flex items-center gap-2"><Badge variant={task.priority === "High" || task.priority === "Urgent" ? "destructive" : "secondary"} className="text-xs">{task.priority}</Badge><Badge variant="outline" className="text-xs">{task.status}</Badge></div>
              </CardContent>
            </Card>
          ))}
          {relatedTasks.length === 0 && <Card className="border-slate-200"><CardContent className="py-10 text-center text-sm text-slate-500">No tasks linked to this grant, its applications, or related projects.</CardContent></Card>}
          {canWriteTable("tasks") && <Button size="sm" variant="outline" className="gap-2 text-xs mt-3" onClick={() => setAddTaskOpen(true)}><Plus size={12} />Add Task</Button>}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <AgentNotesPanel relatedGrantId={grantRow.id} relatedProjectId={preferredProjectId ?? undefined} />
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Agent Reports</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {grantReports.map((report) => <div key={report.id} className="rounded-md border border-slate-200 p-3"><div className="text-sm font-medium text-slate-800">{report.title}</div><div className="text-xs text-slate-500 mt-1">{report.report_type.replace(/_/g, " ")} · {compactDate(report.created_at)}</div></div>)}
              {grantReports.length === 0 && <div className="py-6 text-center text-sm text-slate-500">No agent reports linked to this grant.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="source" className="mt-4">
          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Source Metadata</summary>
            <div className="mt-4 space-y-3 text-sm">
              {sourceRows.map(([label, value]) => (
                <div key={label}><div className="text-xs text-slate-500">{label}</div><div className="break-all whitespace-pre-wrap text-slate-800">{value}</div></div>
              ))}
              {sourceRows.length === 0 && <div className="text-sm text-slate-500">No source metadata is stored for this grant.</div>}
            </div>
          </details>
        </TabsContent>
      </Tabs>

      <GrantFormDialog open={editOpen} onOpenChange={setEditOpen} onSubmit={handleEdit} defaultValues={grantRow} title="Edit grant" submitLabel="Save changes" loading={updateGrant.isPending} />
      <ApplicationFormDialog open={createAppOpen} onOpenChange={(open) => { setCreateAppOpen(open); if (!open) setTargetApplicationProjectId(null); }} onSubmit={handleCreateApp} title="New application for this grant" submitLabel="Create application" loading={createApp.isPending || createTask.isPending} lockedGrantId={grantRow.id} initialValues={applicationInitialValues} />
      <TaskFormDialog open={addTaskOpen} onOpenChange={setAddTaskOpen} onSubmit={handleCreateTask} title="Add task for this grant" submitLabel="Create task" loading={createTask.isPending} lockedGrantId={grantRow.id} lockedProjectId={preferredProjectId ?? undefined} />
      <DocumentFormDialog open={addDocOpen} onOpenChange={setAddDocOpen} onSubmit={handleCreateDocument} loading={createDoc.isPending || uploadDoc.isPending} projects={projectRows} grants={[grantRow]} funders={funder ? [funder] : funderRows} applications={relatedApps.length ? relatedApps : applications} />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archive this grant?</AlertDialogTitle><AlertDialogDescription>&quot;{grantRow.title}&quot; will be archived and hidden from the main grants list.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Permanently delete this grant?</AlertDialogTitle><AlertDialogDescription>&quot;{grantRow.title}&quot; will be removed from the database. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
