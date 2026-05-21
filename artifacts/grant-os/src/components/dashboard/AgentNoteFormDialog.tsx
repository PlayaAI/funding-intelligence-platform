import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentNoteType, AgentSource, Json } from "@/types/database";

export type AgentNoteFormValues = {
  source: AgentSource;
  note_type: AgentNoteType;
  title: string;
  content: string;
  structured_data: Json | null;
};

const SOURCES: AgentSource[] = ["human", "openclaw", "codex", "import", "external_agent"];
const NOTE_TYPES: AgentNoteType[] = ["summary", "fit_analysis", "risk", "next_steps", "scraped_data", "readiness_report", "recommendation", "general"];

export default function AgentNoteFormDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AgentNoteFormValues) => Promise<void> | void;
  loading?: boolean;
}) {
  const [source, setSource] = useState<AgentSource>("human");
  const [noteType, setNoteType] = useState<AgentNoteType>("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSource("human");
    setNoteType("general");
    setTitle("");
    setContent("");
    setJsonText("");
    setJsonError(null);
  }, [open]);

  const submit = async () => {
    setJsonError(null);
    let structured: Json | null = null;
    if (jsonText.trim()) {
      try {
        structured = JSON.parse(jsonText) as Json;
      } catch {
        setJsonError("Structured JSON is not valid.");
        return;
      }
    }
    await onSubmit({ source, note_type: noteType, title: title.trim(), content: content.trim(), structured_data: structured });
  };

  const disabled = loading || !title.trim() || !content.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Agent Note</DialogTitle>
          <DialogDescription>Store notes or analysis generated externally by OpenClaw, Codex, imports, or a human.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as AgentSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={noteType} onValueChange={(v) => setNoteType(v as AgentNoteType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NOTE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Content</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Structured JSON</Label>
            <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={4} placeholder='{"score": 82}' className="font-mono text-xs" />
            {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={disabled}>{loading ? "Saving..." : "Save note"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
