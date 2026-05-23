import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Archive, Download, ExternalLink, Eye, FileArchive, FileText, Link2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useProjects } from "@/hooks/useProjects";
import { useGrants } from "@/hooks/useGrants";
import { useFunders } from "@/hooks/useFunders";
import { useApplications } from "@/hooks/useApplications";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useArchiveDocument, useDeleteDocument, useDocuments, useExtractDocumentText, useUploadDocumentFile, useCreateDocument } from "@/hooks/useDocuments";
import { getDocumentSignedUrl } from "@/lib/documentsService";
import DocumentFormDialog, { DOCUMENT_TYPES, type DocumentFormValues } from "@/components/dashboard/DocumentFormDialog";
import type { DocumentRow } from "@/types/database";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  pending: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  unsupported: "bg-slate-100 text-slate-500",
};

function typeIcon(doc: DocumentRow) {
  if (doc.source_url) return <Link2 size={15} className="text-slate-500" />;
  if (doc.mime_type === "application/pdf" || doc.file_name?.toLowerCase().endsWith(".pdf")) return <FileArchive size={15} className="text-red-500" />;
  return <FileText size={15} className="text-blue-500" />;
}

export default function DashboardDocumentsPage() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [grantFilter, setGrantFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const { canCreateTable, canDeleteRecords, canUpdateTable } = usePermissions();
  const { data: projects = [] } = useProjects();
  const { data: grants = [] } = useGrants();
  const { data: funders = [] } = useFunders();
  const { data: applications = [] } = useApplications();
  const { data: docs = [], isLoading, isError, error } = useDocuments({ search, relatedProjectId: projectFilter, relatedGrantId: grantFilter, documentType: typeFilter });
  const createDoc = useCreateDocument();
  const uploadDoc = useUploadDocumentFile();
  const extractDoc = useExtractDocumentText();
  const archiveDoc = useArchiveDocument();
  const deleteDoc = useDeleteDocument();

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const grantById = useMemo(() => new Map(grants.map((g) => [g.id, g])), [grants]);
  const funderById = useMemo(() => new Map(funders.map((f) => [f.id, f])), [funders]);
  const appById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);

  const linkedRecords = (doc: DocumentRow) => {
    const rows = [];
    const grant = doc.related_grant_id ? grantById.get(doc.related_grant_id) : null;
    const project = doc.related_project_id ? projectById.get(doc.related_project_id) : null;
    const funder = doc.related_funder_id ? funderById.get(doc.related_funder_id) : null;
    const app = doc.related_application_id ? appById.get(doc.related_application_id) : null;
    if (grant) rows.push(<Link key="grant" href={`/dashboard/grants/${grant.id}`}><span className="text-primary hover:underline">Grant: {grant.title}</span></Link>);
    if (project) rows.push(<Link key="project" href={`/dashboard/projects/${project.slug}`}><span className="text-primary hover:underline">Project: {project.name}</span></Link>);
    if (funder) rows.push(<Link key="funder" href={`/dashboard/funders/${funder.legacy_id ?? funder.id}`}><span className="text-primary hover:underline">Funder: {funder.name}</span></Link>);
    if (app) rows.push(<Link key="app" href={`/dashboard/applications/${app.id}`}><span className="text-primary hover:underline">Application: {app.title}</span></Link>);
    return rows.length ? rows : [<span key="none" className="text-slate-400">Unlinked</span>];
  };

  const handleCreate = async (values: DocumentFormValues) => {
    try {
      const metadata = {
        title: values.title,
        document_type: values.document_type,
        source_url: values.source_url,
        related_project_id: values.related_project_id,
        related_grant_id: values.related_grant_id,
        related_funder_id: values.related_funder_id,
        related_application_id: values.related_application_id,
        metadata: values.metadata,
        uploaded_by: user?.id ?? null,
      };
      if (values.file) await uploadDoc.mutateAsync({ file: values.file, metadata });
      else await createDoc.mutateAsync({ ...metadata, extraction_status: "not_started" });
      toast({ title: "Document saved", description: values.title });
      setDialogOpen(false);
    } catch (e) {
      toast({ title: "Failed to save document", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const openDoc = async (doc: DocumentRow) => {
    try {
      const url = await getDocumentSignedUrl(doc);
      if (!url) throw new Error("No file or source URL available.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Could not open document", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Documents</h1><p className="text-sm text-slate-500 mt-0.5">{docs.length} document records with storage metadata and extraction status.</p></div>
        {canCreateTable("documents") && <Button size="sm" className="gap-2 text-xs" onClick={() => setDialogOpen(true)}><Plus size={14} />Add Document</Button>}
      </div>

      <Card className="border-slate-200 shadow-sm"><CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" /></div>
          <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
          <Select value={grantFilter} onValueChange={setGrantFilter}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All grants</SelectItem>{grants.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent></Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
        </div>

        {isLoading && <div className="flex justify-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" />Loading documents...</div>}
        {isError && <div className="text-sm text-red-600">Could not load documents: {error instanceof Error ? error.message : String(error)}</div>}
        {!isLoading && !isError && <Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Linked object</TableHead><TableHead>File / source</TableHead><TableHead>Extraction</TableHead><TableHead>Date added</TableHead><TableHead className="w-44">Actions</TableHead></TableRow></TableHeader><TableBody>
          {docs.map((doc) => <TableRow key={doc.id}><TableCell><div className="flex items-center gap-2"><span className="h-8 w-8 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center">{typeIcon(doc)}</span><div><Link href={`/dashboard/documents/${doc.id}`}><div className="font-medium text-slate-900 hover:text-primary cursor-pointer">{doc.title}</div></Link><div className="text-xs text-slate-500">{doc.document_type.replace(/_/g, " ")}</div></div></div></TableCell><TableCell className="text-slate-600 text-sm"><div className="flex flex-col gap-1">{linkedRecords(doc)}</div></TableCell><TableCell className="text-slate-600 text-sm">{doc.file_name ?? doc.source_url ?? "-"}</TableCell><TableCell><Badge variant="outline" className={`text-[11px] ${STATUS_COLORS[doc.extraction_status]}`}>{doc.extraction_status.replace(/_/g, " ")}</Badge></TableCell><TableCell className="text-slate-600 text-sm">{new Date(doc.created_at).toLocaleDateString()}</TableCell><TableCell><div className="flex items-center gap-1"><Link href={`/dashboard/documents/${doc.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><Eye size={14} /></Button></Link><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDoc(doc)}><ExternalLink size={14} /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => extractDoc.mutate(doc.id)} disabled={extractDoc.isPending}><Download size={14} /></Button>{canUpdateTable("documents") && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => archiveDoc.mutate(doc.id)}><Archive size={14} /></Button>}{canDeleteRecords && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteDoc.mutate(doc.id)}><Trash2 size={14} /></Button>}</div></TableCell></TableRow>)}
          {docs.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">No documents match your filters.</TableCell></TableRow>}
        </TableBody></Table>}
      </CardContent></Card>
      <DocumentFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreate} loading={createDoc.isPending || uploadDoc.isPending} projects={projects} grants={grants} funders={funders} applications={applications} />
    </div>
  );
}
