import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  useApplication,
  useApplicationQuestions,
  useApplicationRequiredDocuments,
  useArchiveApplication,
  useCreateApplicationQuestion,
  useCreateApplicationRequiredDocument,
  useDeleteApplication,
  useUpdateApplication,
  useUpdateApplicationQuestion,
  useUpdateApplicationRequiredDocument,
} from "@/hooks/useApplications";
import { useCreateTask, useTasksByApplication, useUpdateTask, useArchiveTask, useDeleteTask } from "@/hooks/useTasks";
import { useGrant } from "@/hooks/useGrants";
import { useFunders } from "@/hooks/useFunders";
import { useProjects } from "@/hooks/useProjects";
import { useDocuments } from "@/hooks/useDocuments";
import { useProofItems } from "@/hooks/useProofItems";
import { useAgentNotes } from "@/hooks/useAgentNotes";
import { useAgentReports } from "@/hooks/useAgentReports";
import { useGrantMatchesForGrant } from "@/hooks/useGrantMatches";
import ApplicationFormDialog, { type ApplicationFormValues } from "@/components/dashboard/ApplicationFormDialog";
import ApplicationQuestionFormDialog, { type ApplicationQuestionFormValues } from "@/components/dashboard/ApplicationQuestionFormDialog";
import ApplicationRequiredDocumentFormDialog, { type ApplicationRequiredDocumentFormValues } from "@/components/dashboard/ApplicationRequiredDocumentFormDialog";
import TaskFormDialog, { type TaskFormValues } from "@/components/dashboard/TaskFormDialog";
import AgentNotesPanel from "@/components/dashboard/AgentNotesPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { exportApplicationPackage } from "@/lib/exports/exportPackages";
import { getDocumentSignedUrl } from "@/lib/documentsService";
import { useCreateAgentActivity } from "@/hooks/useAgentActivity";
import { useAuth } from "@/contexts/AuthContext";
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckSquare,
  Download,
  Edit,
  ExternalLink,
  FileArchive,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  ApplicationDbStatus,
  ApplicationQuestionDbStatus,
  ApplicationRequiredDocumentDbStatus,
  TaskDbPriority,
  TaskDbStatus,
} from "@/types/database";

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

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-slate-100 text-slate-700 border-slate-200",
  Drafting: "bg-blue-50 text-blue-700 border-blue-200",
  "Internal Review": "bg-amber-50 text-amber-700 border-amber-200",
  "Ready to Submit": "bg-teal-50 text-teal-700 border-teal-200",
  Submitted: "bg-violet-50 text-violet-700 border-violet-200",
  Awarded: "bg-green-50 text-green-700 border-green-200",
  Declined: "bg-red-50 text-red-700 border-red-200",
  Archived: "bg-gray-100 text-gray-500 border-gray-200",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "No deadline";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function amountRange(min?: number | null, max?: number | null, display?: string | null) {
  if (display) return display;
  const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
  if (min && max) return min === max ? fmt(min) : `${fmt(min)}-${fmt(max)}`;
  return min ? fmt(min) : max ? fmt(max) : "Amount not listed";
}

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

function OverviewCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="text-[11px] font-medium uppercase text-slate-500">{label}</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function DashboardApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [addQOpen, setAddQOpen] = useState(false);
  const [editQ, setEditQ] = useState<string | null>(null);
  const [addReqDocOpen, setAddReqDocOpen] = useState(false);
  const [editReqDoc, setEditReqDoc] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: app, isLoading, isError, error } = useApplication(id);
  const { data: grant } = useGrant(app?.grant_id ?? undefined);
  const { data: funders = [] } = useFunders();
  const { data: projects = [] } = useProjects();
  const { data: questions = [] } = useApplicationQuestions(app?.id);
  const { data: requiredDocs = [] } = useApplicationRequiredDocuments(app?.id);
  const { data: linkedTasks = [] } = useTasksByApplication(app?.id);
  const { data: appDocs = [] } = useDocuments(app?.id ? { relatedApplicationId: app.id } : { relatedApplicationId: "__none__" });
  const { data: grantDocs = [] } = useDocuments(grant?.id ? { relatedGrantId: grant.id } : { relatedGrantId: "__none__" });
  const { data: projectDocs = [] } = useDocuments(app?.project_id ? { relatedProjectId: app.project_id } : { relatedProjectId: "__none__" });
  const { data: proofItems = [] } = useProofItems(app?.project_id ?? undefined, { requireProjectId: true });
  const { data: agentNotes = [] } = useAgentNotes({ relatedApplicationId: app?.id });
  const { data: agentReports = [] } = useAgentReports({ relatedApplicationId: app?.id });
  const grantMatches = useGrantMatchesForGrant(grant?.id);

  const updateApp = useUpdateApplication();
  const archiveApp = useArchiveApplication();
  const deleteApp = useDeleteApplication();
  const createQ = useCreateApplicationQuestion();
  const updateQ = useUpdateApplicationQuestion();
  const createReqDoc = useCreateApplicationRequiredDocument();
  const updateReqDoc = useUpdateApplicationRequiredDocument();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const deleteTask = useDeleteTask();
  const { canUpdateTable, canCreateTable, canDeleteRecords, canWrite } = usePermissions();
  const { user } = useAuth();
  const createActivity = useCreateAgentActivity();

  const project = app?.project_id ? projects.find((p) => p.id === app.project_id) : null;
  const funder = grant?.funder_id
    ? funders.find((f) => f.id === grant.funder_id)
    : grant?.funder_name
      ? funders.find((f) => f.name.toLowerCase() === grant.funder_name?.toLowerCase())
      : null;
  const grantMatch = (grantMatches.data ?? []).find((match) => match.project_id === app?.project_id) ?? null;
  const documents = useMemo(() => {
    const byId = new Map([...appDocs, ...grantDocs, ...projectDocs].map((doc) => [doc.id, doc]));
    return [...byId.values()];
  }, [appDocs, grantDocs, projectDocs]);
  const openTasks = linkedTasks.filter((task) => task.status !== "Complete").length;
  const deadline = grant?.deadline ?? null;
  const days = daysUntil(deadline);

  const createDefaultChecklist = async () => {
    if (!app) return;
    if (linkedTasks.length > 0) {
      toast({ title: "Checklist already exists", description: "This application already has linked tasks." });
      return;
    }
    const priority = checklistPriority(deadline);
    for (const [index, title] of DEFAULT_APPLICATION_TASKS.entries()) {
      await createTask.mutateAsync({
        title,
        description: null,
        owner_name: null,
        status: "Not Started",
        priority,
        due_date: checklistDueDate(deadline, index),
        related_grant_id: app.grant_id,
        related_project_id: app.project_id,
        related_application_id: app.id,
        notes: "Default application checklist item.",
      });
    }
    toast({ title: "Checklist created", description: "Default application tasks were added." });
  };

  const handleExportApplication = async () => {
    if (!app) return;
    try {
      await exportApplicationPackage(app.id, app.title);
      await createActivity.mutateAsync({
        actor_source: "human",
        action_type: "export_created",
        title: `Exported application package: ${app.title}`,
        related_application_id: app.id,
        related_project_id: app.project_id ?? null,
        related_grant_id: app.grant_id ?? null,
        created_by: user?.id ?? null,
      });
      toast({ title: "Application packet exported", description: "JSON download created." });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" />Loading application...</div>;
  if (isError || !app) return <div className="p-8 text-center text-red-600 text-sm">{isError ? error instanceof Error ? error.message : String(error) : "Application not found."}</div>;

  const handleEditApp = async (values: ApplicationFormValues) => {
    await updateApp.mutateAsync({
      id: app.id,
      updates: {
        title: values.title,
        status: values.status as ApplicationDbStatus,
        owner_name: values.owner_name || null,
        grant_id: values.grant_id || null,
        project_id: values.project_id || null,
        google_doc_url: values.google_doc_url || null,
        drive_folder_url: values.drive_folder_url || null,
        portal_url: values.portal_url || null,
        notes: values.notes || null,
      },
    });
    toast({ title: "Application updated" });
    setEditOpen(false);
  };

  const handleCreateTask = async (values: TaskFormValues) => {
    await createTask.mutateAsync({
      title: values.title,
      description: values.description || null,
      owner_name: values.owner_name || null,
      status: values.status as TaskDbStatus,
      priority: values.priority as TaskDbPriority,
      due_date: values.due_date || null,
      related_grant_id: values.related_grant_id || app.grant_id,
      related_project_id: values.related_project_id || app.project_id,
      related_application_id: app.id,
      notes: values.notes || null,
    });
    toast({ title: "Task created" });
    setAddTaskOpen(false);
  };

  const handleUpdateTask = async (values: TaskFormValues) => {
    if (!editTask) return;
    await updateTask.mutateAsync({
      id: editTask,
      updates: {
        title: values.title,
        description: values.description || null,
        owner_name: values.owner_name || null,
        status: values.status as TaskDbStatus,
        priority: values.priority as TaskDbPriority,
        due_date: values.due_date || null,
        related_grant_id: values.related_grant_id || app.grant_id,
        related_project_id: values.related_project_id || app.project_id,
        related_application_id: app.id,
        notes: values.notes || null,
      },
    });
    toast({ title: "Task updated" });
    setEditTask(null);
  };

  const handleCreateQuestion = async (values: ApplicationQuestionFormValues) => {
    await createQ.mutateAsync({ application_id: app.id, question: values.question, word_limit: values.word_limit ?? null, owner_name: values.owner_name || null, status: values.status as ApplicationQuestionDbStatus, sort_order: values.sort_order });
    toast({ title: "Question added" });
    setAddQOpen(false);
  };

  const handleCreateReqDoc = async (values: ApplicationRequiredDocumentFormValues) => {
    await createReqDoc.mutateAsync({ application_id: app.id, title: values.title, description: values.description || null, status: values.status as ApplicationRequiredDocumentDbStatus, url: values.url || null, sort_order: values.sort_order });
    toast({ title: "Required document added" });
    setAddReqDocOpen(false);
  };

  const openDoc = async (doc: (typeof documents)[number]) => {
    const url = await getDocumentSignedUrl(doc);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast({ title: "No source available", variant: "destructive" });
  };

  const editingTask = editTask ? linkedTasks.find((task) => task.id === editTask) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/applications"><Button variant="ghost" size="sm" className="gap-2 text-xs"><ArrowLeft size={14} />Back to Applications</Button></Link>
        <div className="flex flex-wrap justify-end gap-2">
          {grant && <Link href={`/dashboard/grants/${grant.id}`}><Button size="sm" variant="outline" className="gap-1.5 text-xs">Open Grant</Button></Link>}
          {funder && <Link href={`/dashboard/funders/${funder.id}`}><Button size="sm" variant="outline" className="gap-1.5 text-xs">Open Funder</Button></Link>}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportApplication}><Download size={12} />Export Application Packet</Button>
          {canUpdateTable("applications") && <Button size="sm" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}><Edit size={12} />Edit Application</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileArchive size={18} className="text-slate-400" />
              <h1 className="text-2xl font-bold text-slate-900">{app.title}</h1>
              <Badge variant="outline" className={STATUS_COLORS[app.status] ?? ""}>{app.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><FileText size={13} />{grant?.title ?? "No grant linked"}</span>
              <span className="flex items-center gap-1.5"><Building2 size={13} />{grant?.funder_name ?? funder?.name ?? "No funder linked"}</span>
              <span className="flex items-center gap-1.5"><FolderOpen size={13} />{project?.name ?? "No project linked"}</span>
              <span className="flex items-center gap-1.5"><CalendarClock size={13} />{formatDate(deadline)}</span>
              <span className="font-medium text-slate-700">{amountRange(grant?.amount_min, grant?.amount_max, grant?.amount_display)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {app.portal_url && <a href={app.portal_url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><ExternalLink size={12} />Portal</Button></a>}
            {app.google_doc_url && <a href={app.google_doc_url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><ExternalLink size={12} />Draft</Button></a>}
            {canWrite && <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setConfirmArchive(true)}><Archive size={12} />Archive</Button>}
            {canDeleteRecords && <Button size="sm" variant="outline" className="gap-1.5 text-xs text-red-600 border-red-200" onClick={() => setConfirmDelete(true)}><Trash2 size={12} />Delete</Button>}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <OverviewCard label="Status" value={app.status} />
        <OverviewCard label="Deadline" value={formatDate(deadline)} hint={days == null ? "No date listed" : days < 0 ? `${Math.abs(days)} days past` : `${days} days left`} />
        <OverviewCard label="Project" value={project?.name ?? "Not linked"} />
        <OverviewCard label="Grant" value={grant?.title ?? "Not linked"} />
        <OverviewCard label="Funder" value={grant?.funder_name ?? funder?.name ?? "Not linked"} />
        <OverviewCard label="Open Tasks" value={openTasks} />
        <OverviewCard label="Documents" value={documents.length} />
        <OverviewCard label="Notes/Reports" value={agentNotes.length + agentReports.length} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Application Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>{app.notes || "No internal strategy notes yet."}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 text-xs">
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Owner</span><div className="font-medium text-slate-800">{app.owner_name ?? "Unassigned"}</div></div>
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Submitted</span><div className="font-medium text-slate-800">{formatDate(app.submitted_at)}</div></div>
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Result</span><div className="font-medium text-slate-800">{app.result ?? "Pending"}</div></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Grant / Opportunity Context</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><div className="font-semibold text-slate-900">{grant?.title ?? "No grant linked"}</div><div className="text-xs text-slate-500">{grant?.funder_name ?? "No funder"}</div></div>
            <div className="text-xs text-slate-600">{grant?.eligibility ?? "Eligibility details are not stored yet."}</div>
            {grantMatch && <Badge variant="outline" className="text-xs">Match score {grantMatch.match_score}</Badge>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm flex items-center gap-2"><CheckSquare size={14} />Checklist / Tasks</CardTitle>
            <div className="flex gap-2">
              {linkedTasks.length === 0 && canCreateTable("tasks") && <Button size="sm" variant="outline" className="text-xs" onClick={createDefaultChecklist}>Generate default application checklist</Button>}
              {canCreateTable("tasks") && <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddTaskOpen(true)}><Plus size={12} />Add Task</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {linkedTasks.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No checklist tasks yet. Generate a default application checklist.</div>}
          {linkedTasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
              <div><div className="text-sm font-medium text-slate-800">{task.title}</div><div className="text-xs text-slate-500">{formatDate(task.due_date)} · {task.priority}</div></div>
              <div className="flex flex-wrap gap-2">
                <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" value={task.status} onChange={(e) => updateTask.mutate({ id: task.id, updates: { status: e.target.value as TaskDbStatus } })}>
                  {["Not Started", "In Progress", "Waiting", "Needs Review", "Complete"].map((status) => <option key={status}>{status}</option>)}
                </select>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditTask(task.id)}>Edit</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => archiveTask.mutate(task.id)}>Archive</Button>
                {canDeleteRecords && <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600" onClick={() => deleteTask.mutate(task.id)}>Delete</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Attached Documents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {documents.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No documents attached yet. Add guidelines, budget templates, or source files.</div>}
            {documents.slice(0, 12).map((doc) => (
              <div key={doc.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0"><Link href={`/dashboard/documents/${doc.id}`} className="text-sm font-medium text-primary hover:underline">{doc.title}</Link><div className="mt-1 text-xs text-slate-500">{doc.document_type.replace(/_/g, " ")} · {doc.extraction_status.replace(/_/g, " ")}</div></div>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDoc(doc)}>Open</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Proof Items</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {proofItems.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No proof items linked yet. Add evidence from the Proof Library.</div>}
            {proofItems.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3"><div className="font-medium text-sm text-slate-800">{item.title}</div><Badge variant={item.public_visibility ? "secondary" : "outline"} className="text-xs">{item.public_visibility ? "Public" : "Private"}</Badge></div>
                <div className="mt-1 text-xs text-slate-500">{item.type.replace(/_/g, " ")} · {item.tags.join(", ") || "No tags"}</div>
                <p className="mt-2 text-xs text-slate-600">{item.grant_relevance || "No application-specific relevance note yet."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Required Documents Checklist</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-end">{canCreateTable("application_required_documents") && <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddReqDocOpen(true)}><Plus size={12} />Add Required Doc</Button>}</div>
            {requiredDocs.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No required document checklist items yet.</div>}
            {requiredDocs.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><div className="text-sm font-medium text-slate-800">{doc.title}</div><div className="text-xs text-slate-500">{doc.status}</div></div><Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditReqDoc(doc.id)}>Edit</Button></div>)}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Application Questions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-end">{canCreateTable("application_questions") && <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddQOpen(true)}><Plus size={12} />Add Question</Button>}</div>
            {questions.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No application questions yet.</div>}
            {questions.map((q, index) => <div key={q.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div className="text-sm font-medium text-slate-800">Q{index + 1}. {q.question}</div><Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditQ(q.id)}>Edit</Button></div><div className="mt-1 text-xs text-slate-500">{q.status} · {q.word_limit ? `${q.word_limit} words` : "No word limit"}</div></div>)}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Notes / Internal Strategy</CardTitle></CardHeader>
        <CardContent>
          <AgentNotesPanel relatedApplicationId={app.id} relatedGrantId={app.grant_id ?? undefined} relatedProjectId={app.project_id ?? undefined} />
          {agentNotes.length === 0 && <div className="mt-4 text-center text-sm text-slate-500">No internal strategy notes yet.</div>}
        </CardContent>
      </Card>

      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Source Metadata / Export</summary>
        <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><div className="text-xs text-slate-500">Application ID</div><div className="font-mono text-xs text-slate-700">{app.id}</div></div>
          <div><div className="text-xs text-slate-500">Grant ID</div><div className="font-mono text-xs text-slate-700">{app.grant_id ?? "None"}</div></div>
          <div><div className="text-xs text-slate-500">Project ID</div><div className="font-mono text-xs text-slate-700">{app.project_id ?? "None"}</div></div>
          <div><div className="text-xs text-slate-500">Updated</div><div className="text-xs text-slate-700">{formatDate(app.updated_at)}</div></div>
        </div>
      </details>

      <ApplicationFormDialog open={editOpen} onOpenChange={setEditOpen} onSubmit={handleEditApp} defaultValues={app} title="Edit application" submitLabel="Save changes" loading={updateApp.isPending} />
      <ApplicationQuestionFormDialog open={addQOpen} onOpenChange={setAddQOpen} onSubmit={handleCreateQuestion} title="Add question" submitLabel="Add" loading={createQ.isPending} />
      {editQ && (() => {
        const q = questions.find((item) => item.id === editQ);
        return q ? <ApplicationQuestionFormDialog open onOpenChange={(open) => { if (!open) setEditQ(null); }} onSubmit={async (values) => { await updateQ.mutateAsync({ id: q.id, applicationId: app.id, updates: { question: values.question, word_limit: values.word_limit ?? null, owner_name: values.owner_name || null, status: values.status as ApplicationQuestionDbStatus, sort_order: values.sort_order } }); setEditQ(null); }} defaultValues={q} title="Edit question" submitLabel="Save" loading={updateQ.isPending} /> : null;
      })()}
      <ApplicationRequiredDocumentFormDialog open={addReqDocOpen} onOpenChange={setAddReqDocOpen} onSubmit={handleCreateReqDoc} title="Add required document" submitLabel="Add" loading={createReqDoc.isPending} />
      {editReqDoc && (() => {
        const doc = requiredDocs.find((item) => item.id === editReqDoc);
        return doc ? <ApplicationRequiredDocumentFormDialog open onOpenChange={(open) => { if (!open) setEditReqDoc(null); }} onSubmit={async (values) => { await updateReqDoc.mutateAsync({ id: doc.id, applicationId: app.id, updates: { title: values.title, description: values.description || null, status: values.status as ApplicationRequiredDocumentDbStatus, url: values.url || null, sort_order: values.sort_order } }); setEditReqDoc(null); }} defaultValues={doc} title="Edit required document" submitLabel="Save" loading={updateReqDoc.isPending} /> : null;
      })()}
      <TaskFormDialog open={addTaskOpen} onOpenChange={setAddTaskOpen} onSubmit={handleCreateTask} title="Add task" submitLabel="Create task" loading={createTask.isPending} lockedApplicationId={app.id} lockedGrantId={app.grant_id ?? undefined} lockedProjectId={app.project_id ?? undefined} />
      {editingTask && <TaskFormDialog open onOpenChange={(open) => { if (!open) setEditTask(null); }} onSubmit={handleUpdateTask} defaultValues={editingTask} title="Edit task" submitLabel="Save" loading={updateTask.isPending} lockedApplicationId={app.id} />}

      {confirmArchive && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmArchive(false)}><div className="max-w-sm rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}><h3 className="text-sm font-semibold text-slate-900">Archive this application?</h3><p className="mt-2 text-xs text-slate-500">It will be hidden from active application lists.</p><div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setConfirmArchive(false)}>Cancel</Button><Button size="sm" onClick={async () => { await archiveApp.mutateAsync(app.id); navigate("/dashboard/applications"); }}>Archive</Button></div></div></div>}
      {confirmDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(false)}><div className="max-w-sm rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}><h3 className="text-sm font-semibold text-red-700">Delete this application?</h3><p className="mt-2 text-xs text-slate-500">This permanently deletes the workspace and linked child records.</p><div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button size="sm" variant="destructive" onClick={async () => { await deleteApp.mutateAsync(app.id); navigate("/dashboard/applications"); }}>Delete</Button></div></div></div>}
    </div>
  );
}
