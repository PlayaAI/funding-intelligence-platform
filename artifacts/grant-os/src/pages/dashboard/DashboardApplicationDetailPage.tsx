import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useApplication, useUpdateApplication, useArchiveApplication, useDeleteApplication,
  useApplicationQuestions, useCreateApplicationQuestion, useUpdateApplicationQuestion, useDeleteApplicationQuestion,
  useApplicationRequiredDocuments, useCreateApplicationRequiredDocument, useUpdateApplicationRequiredDocument, useDeleteApplicationRequiredDocument,
} from "@/hooks/useApplications";
import { useTasksByApplication, useCreateTask } from "@/hooks/useTasks";
import { useGrant } from "@/hooks/useGrants";
import ApplicationFormDialog, { type ApplicationFormValues } from "@/components/dashboard/ApplicationFormDialog";
import ApplicationQuestionFormDialog, { type ApplicationQuestionFormValues } from "@/components/dashboard/ApplicationQuestionFormDialog";
import ApplicationRequiredDocumentFormDialog, { type ApplicationRequiredDocumentFormValues } from "@/components/dashboard/ApplicationRequiredDocumentFormDialog";
import TaskFormDialog, { type TaskFormValues } from "@/components/dashboard/TaskFormDialog";
import AgentNotesPanel from "@/components/dashboard/AgentNotesPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { exportApplicationPackage } from "@/lib/exports/exportPackages";
import { useCreateAgentActivity } from "@/hooks/useAgentActivity";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, Edit, Archive, Trash2, Plus, FileText, CheckSquare, ClipboardList,
  Loader2, AlertCircle, ExternalLink, ChevronsRight, Sparkles, Download,
} from "lucide-react";
import type { ApplicationDbStatus, ApplicationQuestionDbStatus, ApplicationRequiredDocumentDbStatus, TaskDbStatus, TaskDbPriority } from "@/types/database";

const TABS = ["Questions", "Required Docs", "Tasks", "Agent Notes", "Proof Package"] as const;
type Tab = (typeof TABS)[number];

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

const Q_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  "Needs Review": "bg-amber-50 text-amber-700",
  Approved: "bg-blue-50 text-blue-700",
  Final: "bg-green-50 text-green-700",
};

const DOC_STATUS_COLORS: Record<string, string> = {
  Needed: "bg-red-50 text-red-600",
  "In Progress": "bg-amber-50 text-amber-700",
  Complete: "bg-green-50 text-green-700",
  "Not Applicable": "bg-slate-100 text-slate-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: "bg-red-400", High: "bg-red-400", Medium: "bg-amber-400", Low: "bg-slate-300",
};

export default function DashboardApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("Questions");
  const [editOpen, setEditOpen] = useState(false);
  const [addQOpen, setAddQOpen] = useState(false);
  const [editQ, setEditQ] = useState<string | null>(null);
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: app, isLoading, isError, error } = useApplication(id);
  const { data: grant } = useGrant(app?.grant_id ?? undefined);

  const { data: questions = [] } = useApplicationQuestions(app?.id);
  const { data: requiredDocs = [] } = useApplicationRequiredDocuments(app?.id);
  const { data: linkedTasks = [] } = useTasksByApplication(app?.id);

  const updateApp = useUpdateApplication();
  const archiveApp = useArchiveApplication();
  const deleteApp = useDeleteApplication();
  const createQ = useCreateApplicationQuestion();
  const updateQ = useUpdateApplicationQuestion();
  const deleteQ = useDeleteApplicationQuestion();
  const createDoc = useCreateApplicationRequiredDocument();
  const updateDoc = useUpdateApplicationRequiredDocument();
  const deleteDoc = useDeleteApplicationRequiredDocument();
  const createTask = useCreateTask();
  const { canUpdateTable, canCreateTable, canDeleteRecords, canWrite } = usePermissions();
  const { user } = useAuth();
  const createActivity = useCreateAgentActivity();

  const handleAI = () => { toast({ title: "AI coming soon", description: "AI workflow will be connected in a later phase." }); };

  const handleExportApplication = async () => {
    try {
      await exportApplicationPackage(app!.id, app!.title);
      await createActivity.mutateAsync({ actor_source: "human", action_type: "export_created", title: `Exported application package: ${app!.title}`, related_application_id: app!.id, related_project_id: app!.project_id ?? null, related_grant_id: app!.grant_id ?? null, created_by: user?.id ?? null });
      toast({ title: "Application package exported", description: "JSON download created." });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading application…</div>;
  }
  if (isError || !app) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">{isError ? "Failed to load application" : "Application not found"}</p>
            {isError && <p className="text-red-600 mt-0.5">{error instanceof Error ? error.message : String(error)}</p>}
          </div>
        </div>
      </div>
    );
  }

  const handleEditApp = async (values: ApplicationFormValues) => {
    try {
      await updateApp.mutateAsync({
        id: app.id,
        updates: {
          title: values.title,
          status: (values.status as ApplicationDbStatus),
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
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    try {
      await archiveApp.mutateAsync(app.id);
      toast({ title: "Application archived" });
      navigate("/dashboard/applications");
    } catch (e) {
      toast({ title: "Archive failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteApp.mutateAsync(app.id);
      toast({ title: "Application deleted" });
      navigate("/dashboard/applications");
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleCreateQuestion = async (values: ApplicationQuestionFormValues) => {
    try {
      await createQ.mutateAsync({
        application_id: app.id,
        question: values.question,
        word_limit: values.word_limit ?? null,
        owner_name: values.owner_name || null,
        status: (values.status as ApplicationQuestionDbStatus),
        sort_order: values.sort_order,
      });
      toast({ title: "Question added" });
      setAddQOpen(false);
    } catch (e) {
      toast({ title: "Failed to add question", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const handleUpdateQuestion = async (questionId: string, values: ApplicationQuestionFormValues) => {
    try {
      await updateQ.mutateAsync({
        id: questionId, applicationId: app.id,
        updates: {
          question: values.question,
          word_limit: values.word_limit ?? null,
          owner_name: values.owner_name || null,
          status: (values.status as ApplicationQuestionDbStatus),
          sort_order: values.sort_order,
        },
      });
      toast({ title: "Question updated" });
      setEditQ(null);
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handlePromoteAnswer = async (questionId: string, draftAnswer: string) => {
    try {
      await updateQ.mutateAsync({
        id: questionId, applicationId: app.id,
        updates: { final_answer: draftAnswer, status: "Final" as ApplicationQuestionDbStatus },
      });
      toast({ title: "Draft promoted to final answer" });
    } catch (e) {
      toast({ title: "Promote failed", variant: "destructive" });
    }
  };

  const handleCreateDoc = async (values: ApplicationRequiredDocumentFormValues) => {
    try {
      await createDoc.mutateAsync({
        application_id: app.id,
        title: values.title,
        description: values.description || null,
        status: (values.status as ApplicationRequiredDocumentDbStatus),
        url: values.url || null,
        sort_order: values.sort_order,
      });
      toast({ title: "Document added" });
      setAddDocOpen(false);
    } catch (e) {
      toast({ title: "Failed to add document", variant: "destructive" });
    }
  };

  const handleUpdateDoc = async (docId: string, values: ApplicationRequiredDocumentFormValues) => {
    try {
      await updateDoc.mutateAsync({
        id: docId, applicationId: app.id,
        updates: {
          title: values.title,
          description: values.description || null,
          status: (values.status as ApplicationRequiredDocumentDbStatus),
          url: values.url || null,
          sort_order: values.sort_order,
        },
      });
      toast({ title: "Document updated" });
      setEditDoc(null);
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleCreateTask = async (values: TaskFormValues) => {
    try {
      await createTask.mutateAsync({
        title: values.title,
        description: values.description || null,
        owner_name: values.owner_name || null,
        status: (values.status as TaskDbStatus),
        priority: (values.priority as TaskDbPriority),
        due_date: values.due_date || null,
        related_grant_id: values.related_grant_id || null,
        related_project_id: values.related_project_id || null,
        related_application_id: app.id,
        notes: values.notes || null,
      });
      toast({ title: "Task created" });
      setAddTaskOpen(false);
    } catch (e) {
      toast({ title: "Failed to create task", variant: "destructive" });
    }
  };

  const completedQs = questions.filter((q) => ["Approved", "Final"].includes(q.status)).length;
  const completedDocs = requiredDocs.filter((d) => d.status === "Complete").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button onClick={() => navigate("/dashboard/applications")} className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft size={12} /> Applications
          </button>
          <h1 className="text-xl font-bold text-slate-900 truncate">{app.title}</h1>
          <div className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[app.status] ?? ""}`}>{app.status}</span>
            {grant && <span>{grant.title}</span>}
            {app.owner_name && <span>· {app.owner_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportApplication}>
            <Download size={12} /> Export JSON
          </Button>
          {canUpdateTable("applications") && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
              <Edit size={12} /> Edit
            </Button>
          )}
          {canWrite && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setConfirmArchive(true)}>
              <Archive size={12} /> Archive
            </Button>
          )}
          {canDeleteRecords && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-red-600 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={12} /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Links row */}
      <div className="flex items-center gap-3 flex-wrap">
        {app.google_doc_url && (
          <a href={app.google_doc_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <ExternalLink size={11} /> Google Doc
          </a>
        )}
        {app.drive_folder_url && (
          <a href={app.drive_folder_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <ExternalLink size={11} /> Drive Folder
          </a>
        )}
        {app.portal_url && (
          <a href={app.portal_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <ExternalLink size={11} /> Application Portal
          </a>
        )}
      </div>

      {/* Notes */}
      {app.notes && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">{app.notes}</div>
      )}

      {/* Progress summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-lg font-bold text-slate-800">{completedQs}/{questions.length}</div>
            <div className="text-xs text-slate-500">Questions complete</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-lg font-bold text-slate-800">{completedDocs}/{requiredDocs.length}</div>
            <div className="text-xs text-slate-500">Docs complete</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-lg font-bold text-slate-800">{linkedTasks.filter((t) => t.status === "Complete").length}/{linkedTasks.length}</div>
            <div className="text-xs text-slate-500">Tasks complete</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Questions tab */}
      {tab === "Questions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><FileText size={14} /> Application Questions</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={handleAI}><Sparkles size={12} /> AI draft</Button>
              {canCreateTable("application_questions") && (
                <Button size="sm" className="gap-1.5 text-xs h-7" onClick={() => setAddQOpen(true)}><Plus size={12} /> Add question</Button>
              )}
            </div>
          </div>
          {questions.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No questions yet.</div>}
          {questions.map((q, i) => (
            <Card key={q.id} className="border-slate-200">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">Q{i + 1}. {q.question}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{q.word_limit ? `${q.word_limit} words` : "No word limit"} · {q.owner_name ?? "Unassigned"}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${Q_STATUS_COLORS[q.status] ?? ""}`}>{q.status}</span>
                    {canUpdateTable("application_questions") && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditQ(q.id)}><Edit size={11} /></Button>
                    )}
                    {canDeleteRecords && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-500" onClick={async () => {
                        try { await deleteQ.mutateAsync({ id: q.id, applicationId: app.id }); toast({ title: "Question deleted" }); } catch { toast({ title: "Delete failed", variant: "destructive" }); }
                      }}><Trash2 size={11} /></Button>
                    )}
                  </div>
                </div>
                {q.draft_answer && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-slate-500 mb-1">Draft answer</div>
                    <div className="text-xs text-slate-700 whitespace-pre-wrap">{q.draft_answer}</div>
                    {q.status !== "Final" && !q.final_answer && (
                      <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs h-6" onClick={() => handlePromoteAnswer(q.id, q.draft_answer!)}>
                        <ChevronsRight size={11} /> Promote to final
                      </Button>
                    )}
                  </div>
                )}
                {q.final_answer && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs font-medium text-green-700 mb-1">Final answer</div>
                    <div className="text-xs text-green-800 whitespace-pre-wrap">{q.final_answer}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Required Docs tab */}
      {tab === "Required Docs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><ClipboardList size={14} /> Required Documents Checklist</h2>
            {canCreateTable("application_required_documents") && (
              <Button size="sm" className="gap-1.5 text-xs h-7" onClick={() => setAddDocOpen(true)}><Plus size={12} /> Add document</Button>
            )}
          </div>
          {requiredDocs.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No required documents yet.</div>}
          {requiredDocs.map((d) => (
            <div key={d.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-white">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800">{d.title}</div>
                {d.description && <div className="text-xs text-slate-500 mt-0.5">{d.description}</div>}
                {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 flex items-center gap-1 mt-1"><ExternalLink size={10} /> View</a>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${DOC_STATUS_COLORS[d.status] ?? ""}`}>{d.status}</span>
                {canUpdateTable("application_required_documents") && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditDoc(d.id)}><Edit size={11} /></Button>
                )}
                {canDeleteRecords && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-500" onClick={async () => {
                    try { await deleteDoc.mutateAsync({ id: d.id, applicationId: app.id }); toast({ title: "Document deleted" }); } catch { toast({ title: "Delete failed", variant: "destructive" }); }
                  }}><Trash2 size={11} /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tasks tab */}
      {tab === "Tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><CheckSquare size={14} /> Linked Tasks</h2>
            {canCreateTable("tasks") && (
              <Button size="sm" className="gap-1.5 text-xs h-7" onClick={() => setAddTaskOpen(true)}><Plus size={12} /> Add task</Button>
            )}
          </div>
          {linkedTasks.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No linked tasks yet.</div>}
          {linkedTasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_COLORS[t.priority] ?? "bg-slate-300"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800">{t.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"} · {t.status}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "Complete" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{t.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "Agent Notes" && (
        <AgentNotesPanel relatedApplicationId={app.id} relatedGrantId={app.grant_id ?? undefined} relatedProjectId={app.project_id ?? undefined} />
      )}

      {/* Proof Package tab — placeholder */}
      {tab === "Proof Package" && (
        <div className="text-center py-16 text-slate-400 text-sm">
          <div className="text-base mb-1">📦</div>
          Proof Package linking will be available in a future phase.
        </div>
      )}

      {/* Dialogs */}
      <ApplicationFormDialog
        open={editOpen} onOpenChange={setEditOpen} onSubmit={handleEditApp}
        defaultValues={app} title="Edit application" submitLabel="Save changes" loading={updateApp.isPending}
      />

      <ApplicationQuestionFormDialog
        open={addQOpen} onOpenChange={setAddQOpen} onSubmit={handleCreateQuestion}
        title="Add question" submitLabel="Add" loading={createQ.isPending}
      />

      {editQ && (() => {
        const q = questions.find((q) => q.id === editQ);
        return q ? (
          <ApplicationQuestionFormDialog
            open onOpenChange={(o) => { if (!o) setEditQ(null); }}
            onSubmit={(v) => handleUpdateQuestion(q.id, v)}
            defaultValues={q} title="Edit question" submitLabel="Save" loading={updateQ.isPending}
          />
        ) : null;
      })()}

      <ApplicationRequiredDocumentFormDialog
        open={addDocOpen} onOpenChange={setAddDocOpen} onSubmit={handleCreateDoc}
        title="Add required document" submitLabel="Add" loading={createDoc.isPending}
      />

      {editDoc && (() => {
        const d = requiredDocs.find((d) => d.id === editDoc);
        return d ? (
          <ApplicationRequiredDocumentFormDialog
            open onOpenChange={(o) => { if (!o) setEditDoc(null); }}
            onSubmit={(v) => handleUpdateDoc(d.id, v)}
            defaultValues={d} title="Edit document" submitLabel="Save" loading={updateDoc.isPending}
          />
        ) : null;
      })()}

      <TaskFormDialog
        open={addTaskOpen} onOpenChange={setAddTaskOpen} onSubmit={handleCreateTask}
        title="Add task" submitLabel="Create task" loading={createTask.isPending}
        lockedApplicationId={app.id} lockedGrantId={app.grant_id ?? undefined}
      />

      {/* Archive confirmation */}
      {confirmArchive && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setConfirmArchive(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800">Archive this application?</h3>
            <p className="text-xs text-slate-500">The application will be hidden from lists but can be restored later.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmArchive(false)}>Cancel</Button>
              <Button size="sm" onClick={handleArchive} disabled={archiveApp.isPending}>{archiveApp.isPending ? "Archiving…" : "Archive"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-red-700">Permanently delete this application?</h3>
            <p className="text-xs text-slate-500">This will also delete all questions, required documents, and linked tasks. This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteApp.isPending}>{deleteApp.isPending ? "Deleting…" : "Delete permanently"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
