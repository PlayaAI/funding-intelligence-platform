import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentDbType, Json } from "@/types/database";
import type { ProjectRow } from "@/hooks/useProjects";
import type { GrantRow } from "@/hooks/useGrants";
import type { FunderRow } from "@/hooks/useFunders";
import type { ApplicationRow } from "@/hooks/useApplications";

export const DOCUMENT_TYPES: DocumentDbType[] = ["grant_guidelines", "application_form", "budget_template", "letter_of_support", "proof_document", "funder_document", "report", "general"];

export type DocumentFormValues = {
  title: string;
  document_type: DocumentDbType;
  source_url: string | null;
  related_project_id: string | null;
  related_grant_id: string | null;
  related_funder_id: string | null;
  related_application_id: string | null;
  metadata: Json | null;
  file: File | null;
};

const NONE = "__none__";

export default function DocumentFormDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
  projects,
  grants,
  funders,
  applications,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DocumentFormValues) => Promise<void> | void;
  loading?: boolean;
  projects: ProjectRow[];
  grants: GrantRow[];
  funders: FunderRow[];
  applications: ApplicationRow[];
}) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<DocumentDbType>("general");
  const [sourceUrl, setSourceUrl] = useState("");
  const [projectId, setProjectId] = useState(NONE);
  const [grantId, setGrantId] = useState(NONE);
  const [funderId, setFunderId] = useState(NONE);
  const [applicationId, setApplicationId] = useState(NONE);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDocumentType("general");
    setSourceUrl("");
    setProjectId(NONE);
    setGrantId(NONE);
    setFunderId(NONE);
    setApplicationId(NONE);
    setFile(null);
  }, [open]);

  const submit = async () => {
    await onSubmit({
      title: title.trim(),
      document_type: documentType,
      source_url: sourceUrl.trim() || null,
      related_project_id: projectId === NONE ? null : projectId,
      related_grant_id: grantId === NONE ? null : grantId,
      related_funder_id: funderId === NONE ? null : funderId,
      related_application_id: applicationId === NONE ? null : applicationId,
      metadata: null,
      file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
          <DialogDescription>Upload a file to the private bucket or add an external source URL.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Type</Label><Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentDbType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DOCUMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Upload file</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">External source URL</Label><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Project</Label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>No project</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Grant</Label><Select value={grantId} onValueChange={setGrantId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>No grant</SelectItem>{grants.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Funder</Label><Select value={funderId} onValueChange={setFunderId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>No funder</SelectItem>{funders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Application</Label><Select value={applicationId} onValueChange={setApplicationId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>No application</SelectItem>{applications.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={loading || !title.trim() || (!file && !sourceUrl.trim())}>{loading ? "Saving..." : "Save document"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
