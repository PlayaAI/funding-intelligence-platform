import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentReportType, AgentSource, Json } from "@/types/database";

export type AgentReportFormValues = {
  source: AgentSource;
  report_type: AgentReportType;
  title: string;
  content: string;
  related_project_id: string | null;
  related_grant_id: string | null;
  related_application_id: string | null;
  structured_data: Json | null;
};

const SOURCES: AgentSource[] = ["human", "openclaw", "codex", "import", "external_agent"];
const REPORT_TYPES: AgentReportType[] = ["weekly_readiness", "grant_readiness", "application_review", "funder_summary", "import_review", "general"];

export default function AgentReportFormDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AgentReportFormValues) => Promise<void> | void;
  loading?: boolean;
}) {
  const [source, setSource] = useState<AgentSource>("human");
  const [reportType, setReportType] = useState<AgentReportType>("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [grantId, setGrantId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSource("human");
    setReportType("general");
    setTitle("");
    setContent("");
    setProjectId("");
    setGrantId("");
    setApplicationId("");
    setJsonText("");
    setJsonError(null);
  }, [open]);

  const submit = async () => {
    setJsonError(null);
    let structured: Json | null = null;
    if (jsonText.trim()) {
      try { structured = JSON.parse(jsonText) as Json; } catch { setJsonError("Structured JSON is not valid."); return; }
    }
    await onSubmit({
      source,
      report_type: reportType,
      title: title.trim(),
      content: content.trim(),
      related_project_id: projectId.trim() || null,
      related_grant_id: grantId.trim() || null,
      related_application_id: applicationId.trim() || null,
      structured_data: structured,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Agent Report</DialogTitle>
          <DialogDescription>Paste a readiness report or review generated externally.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Source</Label><Select value={source} onValueChange={(v) => setSource(v as AgentSource)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Report type</Label><Select value={reportType} onValueChange={(v) => setReportType(v as AgentReportType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REPORT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Project ID</Label><Input value={projectId} onChange={(e) => setProjectId(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Grant ID</Label><Input value={grantId} onChange={(e) => setGrantId(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Application ID</Label><Input value={applicationId} onChange={(e) => setApplicationId(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Structured JSON</Label><Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={4} className="font-mono text-xs" />{jsonError && <p className="text-xs text-red-600">{jsonError}</p>}</div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={loading || !title.trim() || !content.trim()}>{loading ? "Saving..." : "Save report"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
