import { useMemo, useState } from "react";
import { Bot, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCreateAgentNote } from "@/hooks/useAgentNotes";
import { useCreateAgentReport } from "@/hooks/useAgentReports";
import { useCreateAgentActivity } from "@/hooks/useAgentActivity";
import { useCreateTask } from "@/hooks/useTasks";
import type { AgentNoteType, AgentReportType, AgentSource, Json, TaskDbPriority } from "@/types/database";

type ParsedPayload =
  | { type: "agent_note"; source?: AgentSource; note_type: AgentNoteType; title: string; content: string; related_grant_id?: string; related_project_id?: string; related_application_id?: string; structured_data?: Json }
  | { type: "agent_report"; source?: AgentSource; report_type: AgentReportType; title: string; content: string; related_grant_id?: string; related_project_id?: string; related_application_id?: string; structured_data?: Json }
  | { type: "document_note"; source?: AgentSource; document_id: string; title: string; content: string; structured_data?: Json }
  | { type: "task_suggestions"; source?: AgentSource; related_grant_id?: string; related_project_id?: string; related_application_id?: string; tasks: Array<{ title: string; description?: string; priority?: TaskDbPriority; due_date?: string }> };

const EXAMPLE = `{
  "type": "agent_note",
  "source": "openclaw",
  "note_type": "fit_analysis",
  "title": "MIT Solve Fit Analysis",
  "content": "This grant is a strong fit because...",
  "related_grant_id": "uuid",
  "related_project_id": "uuid",
  "structured_data": {}
}`;

function validatePayload(value: unknown): ParsedPayload {
  if (!value || typeof value !== "object") throw new Error("Payload must be an object.");
  const obj = value as Record<string, any>;
  if (obj.type === "agent_note") {
    if (!obj.title || !obj.content || !obj.note_type) throw new Error("agent_note requires title, content, and note_type.");
    return obj as ParsedPayload;
  }
  if (obj.type === "agent_report") {
    if (!obj.title || !obj.content || !obj.report_type) throw new Error("agent_report requires title, content, and report_type.");
    return obj as ParsedPayload;
  }
  if (obj.type === "document_note") {
    if (!obj.document_id || !obj.title || !obj.content) throw new Error("document_note requires document_id, title, and content.");
    return obj as ParsedPayload;
  }
  if (obj.type === "task_suggestions") {
    if (!Array.isArray(obj.tasks)) throw new Error("task_suggestions requires a tasks array.");
    if (obj.tasks.some((t: any) => !t?.title)) throw new Error("Every suggested task needs a title.");
    return obj as ParsedPayload;
  }
  throw new Error("Supported types are agent_note, agent_report, document_note, and task_suggestions.");
}

export default function DashboardAgentImportPage() {
  const [text, setText] = useState(EXAMPLE);
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const { user } = useAuth();
  const { canCreateTable, canWrite } = usePermissions();
  const createNote = useCreateAgentNote();
  const createReport = useCreateAgentReport();
  const createTask = useCreateTask();
  const createActivity = useCreateAgentActivity();

  const canImportNotes = canCreateTable("agent_notes");
  const canImportReports = canCreateTable("agent_reports");
  const canImportTasks = canWrite;

  const previewLabel = useMemo(() => {
    if (!parsed) return "No payload validated";
    if (parsed.type === "task_suggestions") return `${parsed.tasks.length} task suggestion${parsed.tasks.length === 1 ? "" : "s"}`;
    return parsed.title;
  }, [parsed]);

  const validate = () => {
    setError(null);
    try {
      const next = validatePayload(JSON.parse(text));
      setParsed(next);
      setSelectedTasks(next.type === "task_suggestions" ? next.tasks.map((_, i) => i) : []);
    } catch (e) {
      setParsed(null);
      setSelectedTasks([]);
      setError(e instanceof Error ? e.message : "Invalid JSON.");
    }
  };

  const confirm = async () => {
    if (!parsed) return;
    try {
      if (parsed.type === "agent_note") {
        if (!canImportNotes) throw new Error("Your role cannot import agent notes.");
        await createNote.mutateAsync({
          source: parsed.source ?? "external_agent",
          note_type: parsed.note_type,
          title: parsed.title,
          content: parsed.content,
          structured_data: parsed.structured_data ?? null,
          related_project_id: parsed.related_project_id ?? null,
          related_grant_id: parsed.related_grant_id ?? null,
          related_application_id: parsed.related_application_id ?? null,
          created_by: user?.id ?? null,
        });
        await createActivity.mutateAsync({ actor_source: parsed.source ?? "external_agent", action_type: "import_completed", title: `Imported note: ${parsed.title}`, related_project_id: parsed.related_project_id ?? null, related_grant_id: parsed.related_grant_id ?? null, related_application_id: parsed.related_application_id ?? null, created_by: user?.id ?? null });
      }
      if (parsed.type === "agent_report") {
        if (!canImportReports) throw new Error("Your role cannot import agent reports.");
        await createReport.mutateAsync({
          source: parsed.source ?? "external_agent",
          report_type: parsed.report_type,
          title: parsed.title,
          content: parsed.content,
          structured_data: parsed.structured_data ?? null,
          related_project_id: parsed.related_project_id ?? null,
          related_grant_id: parsed.related_grant_id ?? null,
          related_application_id: parsed.related_application_id ?? null,
          created_by: user?.id ?? null,
        });
        await createActivity.mutateAsync({ actor_source: parsed.source ?? "external_agent", action_type: "import_completed", title: `Imported report: ${parsed.title}`, related_project_id: parsed.related_project_id ?? null, related_grant_id: parsed.related_grant_id ?? null, related_application_id: parsed.related_application_id ?? null, created_by: user?.id ?? null });
      }
      if (parsed.type === "document_note") {
        if (!canImportNotes) throw new Error("Your role cannot import document notes.");
        const structured = {
          ...(parsed.structured_data && typeof parsed.structured_data === "object" && !Array.isArray(parsed.structured_data) ? parsed.structured_data : {}),
          document_id: parsed.document_id,
        } as Json;
        await createNote.mutateAsync({
          source: parsed.source ?? "external_agent",
          note_type: "general",
          title: parsed.title,
          content: parsed.content,
          structured_data: structured,
          created_by: user?.id ?? null,
        });
        await createActivity.mutateAsync({ actor_source: parsed.source ?? "external_agent", action_type: "import_completed", title: `Imported document note: ${parsed.title}`, metadata: { document_id: parsed.document_id }, created_by: user?.id ?? null });
      }
      if (parsed.type === "task_suggestions") {
        if (!canImportTasks) throw new Error("Only Admin and Grant Lead can bulk-create suggested tasks.");
        const tasks = parsed.tasks.filter((_, i) => selectedTasks.includes(i));
        for (const task of tasks) {
          await createTask.mutateAsync({
            title: task.title,
            description: task.description ?? null,
            priority: task.priority ?? "Medium",
            status: "Not Started",
            due_date: task.due_date ?? null,
            related_project_id: parsed.related_project_id ?? null,
            related_grant_id: parsed.related_grant_id ?? null,
            related_application_id: parsed.related_application_id ?? null,
            notes: `Imported from ${parsed.source ?? "external_agent"}`,
          });
        }
        await createActivity.mutateAsync({ actor_source: parsed.source ?? "external_agent", action_type: "task_created", title: `Imported ${tasks.length} suggested task${tasks.length === 1 ? "" : "s"}`, related_project_id: parsed.related_project_id ?? null, related_grant_id: parsed.related_grant_id ?? null, related_application_id: parsed.related_application_id ?? null, metadata: { selected_count: tasks.length }, created_by: user?.id ?? null });
      }
      toast({ title: "Agent output imported", description: previewLabel });
      setParsed(null);
    } catch (e) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const busy = createNote.isPending || createReport.isPending || createTask.isPending || createActivity.isPending;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Bot size={18} />Agent Import</h1><p className="text-sm text-slate-500 mt-0.5">Paste safe JSON from OpenClaw, Codex, or another external agent.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200"><CardHeader><CardTitle className="text-sm">Paste JSON</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={18} className="font-mono text-xs" />{error && <p className="text-sm text-red-600">{error}</p>}<div className="flex gap-2"><Button size="sm" onClick={validate}>Validate JSON</Button><Button size="sm" variant="outline" onClick={() => { setText(EXAMPLE); setParsed(null); setError(null); }}>Reset example</Button></div></CardContent></Card>
        <Card className="border-slate-200"><CardHeader><CardTitle className="text-sm">Preview</CardTitle></CardHeader><CardContent className="space-y-3">
          {!parsed && <div className="py-10 text-center text-sm text-slate-400">Validate a payload to preview the import.</div>}
          {parsed && <><div className="flex items-center gap-2"><Badge>{parsed.type}</Badge><span className="text-sm font-medium text-slate-800">{previewLabel}</span></div>{"content" in parsed && <p className="text-sm text-slate-600 whitespace-pre-wrap">{parsed.content}</p>}{parsed.type === "task_suggestions" && <div className="space-y-2">{parsed.tasks.map((task, i) => <label key={i} className="flex items-start gap-2 rounded border border-slate-200 p-2"><Checkbox checked={selectedTasks.includes(i)} onCheckedChange={(checked) => setSelectedTasks((prev) => checked ? [...prev, i] : prev.filter((n) => n !== i))} /><span className="text-sm"><span className="font-medium text-slate-800">{task.title}</span>{task.description && <span className="block text-slate-500">{task.description}</span>}</span></label>)}</div>}<Button size="sm" className="gap-2" onClick={confirm} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}Confirm import</Button></>}
        </CardContent></Card>
      </div>
    </div>
  );
}
