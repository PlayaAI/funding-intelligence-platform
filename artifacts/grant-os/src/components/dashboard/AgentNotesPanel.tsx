import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAgentNotes, useCreateAgentNote } from "@/hooks/useAgentNotes";
import { useCreateAgentActivity } from "@/hooks/useAgentActivity";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import AgentNoteFormDialog, { type AgentNoteFormValues } from "@/components/dashboard/AgentNoteFormDialog";
import { AgentSourceBadge, AgentTypeBadge } from "@/components/dashboard/AgentBadge";

type Related = {
  relatedProjectId?: string;
  relatedGrantId?: string;
  relatedFunderId?: string;
  relatedApplicationId?: string;
};

export default function AgentNotesPanel({ title = "Agent Notes", ...related }: Related & { title?: string }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { canCreateTable } = usePermissions();
  const canCreate = canCreateTable("agent_notes");
  const { data: notes = [], isLoading } = useAgentNotes(related);
  const createNote = useCreateAgentNote();
  const createActivity = useCreateAgentActivity();

  const handleSubmit = async (values: AgentNoteFormValues) => {
    try {
      await createNote.mutateAsync({
        ...values,
        created_by: user?.id ?? null,
        related_project_id: related.relatedProjectId ?? null,
        related_grant_id: related.relatedGrantId ?? null,
        related_funder_id: related.relatedFunderId ?? null,
        related_application_id: related.relatedApplicationId ?? null,
      });
      await createActivity.mutateAsync({
        actor_source: values.source,
        action_type: "note_created",
        title: `Note created: ${values.title}`,
        description: values.content.slice(0, 180),
        related_project_id: related.relatedProjectId ?? null,
        related_grant_id: related.relatedGrantId ?? null,
        related_application_id: related.relatedApplicationId ?? null,
        created_by: user?.id ?? null,
      });
      toast({ title: "Agent note saved", description: values.title });
      setOpen(false);
    } catch (e) {
      toast({ title: "Failed to save agent note", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">{title}</CardTitle>
        {canCreate && <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setOpen(true)}><Plus size={12} />Add Agent Note</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" />Loading notes...</div>}
        {!isLoading && notes.length === 0 && <div className="py-6 text-center text-sm text-slate-400">No agent notes yet.</div>}
        {notes.map((note) => (
          <div key={note.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm text-slate-800">{note.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{new Date(note.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0"><AgentSourceBadge source={note.source} /><AgentTypeBadge type={note.note_type} /></div>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap mt-2">{note.content}</p>
            {note.structured_data && <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(note.structured_data, null, 2)}</pre>}
          </div>
        ))}
      </CardContent>
      <AgentNoteFormDialog open={open} onOpenChange={setOpen} onSubmit={handleSubmit} loading={createNote.isPending} />
    </Card>
  );
}
