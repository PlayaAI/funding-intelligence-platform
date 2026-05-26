import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Clipboard, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useDocument, useDocumentSignedUrl, useExtractDocumentText } from "@/hooks/useDocuments";
import { useProjects } from "@/hooks/useProjects";
import { useGrants } from "@/hooks/useGrants";
import { useFunders } from "@/hooks/useFunders";
import { useApplications } from "@/hooks/useApplications";
import { downloadDocumentJson } from "@/lib/documentsService";
import { funderDetailPath } from "@/lib/funderMappers";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  pending: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  unsupported: "bg-slate-100 text-slate-500",
};

function displayUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 34 ? `${parsed.pathname.slice(0, 34)}…` : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url.length > 72 ? `${url.slice(0, 72)}…` : url;
  }
}

export default function DashboardDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading, isError, error } = useDocument(id);
  const { data: signedUrl } = useDocumentSignedUrl(doc);
  const { data: projects = [] } = useProjects();
  const { data: grants = [] } = useGrants();
  const { data: funders = [] } = useFunders();
  const { data: applications = [] } = useApplications();
  const extract = useExtractDocumentText();

  const links = useMemo(() => {
    if (!doc) return [];
    const project = doc.related_project_id ? projects.find((p) => p.id === doc.related_project_id) : null;
    const grant = doc.related_grant_id ? grants.find((g) => g.id === doc.related_grant_id) : null;
    const application = doc.related_application_id ? applications.find((a) => a.id === doc.related_application_id) : null;
    const funder = doc.related_funder_id ? funders.find((f) => f.id === doc.related_funder_id) : null;
    return [
      project ? { label: "Project", value: project.name, href: `/dashboard/projects/${project.slug}` } : null,
      grant ? { label: "Grant", value: grant.title, href: `/dashboard/grants/${grant.id}` } : null,
      application ? { label: "Application", value: application.title, href: `/dashboard/applications/${application.id}` } : null,
      funder ? { label: "Funder", value: funder.name, href: funderDetailPath(funder) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; href: string }>;
  }, [applications, doc, funders, grants, projects]);

  if (isLoading) return <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" />Loading document...</div>;
  if (isError || !doc) return <div className="p-8 text-center text-red-600 text-sm">Could not load document: {isError && error instanceof Error ? error.message : "Not found"}</div>;

  const copyText = async () => {
    await navigator.clipboard.writeText(doc.extracted_text ?? "");
    toast({ title: "Extracted text copied" });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <Link href="/dashboard/documents"><Button variant="ghost" size="sm" className="gap-2 text-xs h-8"><ArrowLeft size={14} />Documents</Button></Link>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText size={18} />{doc.title}</h1><div className="flex flex-wrap gap-2 mt-2"><Badge variant="secondary">{doc.document_type.replace(/_/g, " ")}</Badge><Badge variant="outline" className={STATUS_COLORS[doc.extraction_status]}>{doc.extraction_status.replace(/_/g, " ")}</Badge></div></div>
        <div className="flex flex-wrap gap-2 justify-end"><Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => downloadDocumentJson(doc)}><Download size={13} />Export JSON</Button>{signedUrl && <a href={signedUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-2 text-xs"><ExternalLink size={13} />Open</Button></a>}<Button size="sm" className="gap-2 text-xs" onClick={() => extract.mutate(doc.id)} disabled={extract.isPending}><Download size={13} />Extract text</Button></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm">Metadata</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div><span className="text-slate-500 text-xs">File name</span><div className="break-all">{doc.file_name ?? "-"}</div></div><div><span className="text-slate-500 text-xs">Source URL</span><div className="min-w-0">{doc.source_url ? <a href={doc.source_url} target="_blank" rel="noopener noreferrer" title={doc.source_url} className="inline-block max-w-full truncate text-primary hover:underline">{displayUrl(doc.source_url)}</a> : "-"}</div></div><div><span className="text-slate-500 text-xs">MIME type</span><div>{doc.mime_type ?? "-"}</div></div><div><span className="text-slate-500 text-xs">File size</span><div>{doc.file_size_bytes ? `${Math.round(doc.file_size_bytes / 1024)} KB` : "-"}</div></div><div><span className="text-slate-500 text-xs">Created</span><div>{new Date(doc.created_at).toLocaleString()}</div></div></CardContent></Card>
        <Card className="border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm">Linked Records</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{links.length === 0 && <div className="text-slate-400">No linked records.</div>}{links.map((link) => <div key={link.label}><span className="text-slate-500 text-xs">{link.label}</span><div><Link href={link.href} className="text-primary hover:underline">{link.value}</Link></div></div>)}{doc.extraction_error && <div className="rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700">{doc.extraction_error}</div>}</CardContent></Card>
      </div>

      <Card className="border-slate-200"><CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm">Extracted Text</CardTitle>{doc.extracted_text && <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={copyText}><Clipboard size={13} />Copy</Button>}</CardHeader><CardContent>{doc.extracted_text ? <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">{doc.extracted_text}</pre> : <div className="py-10 text-center text-sm text-slate-400">No extracted text yet.</div>}</CardContent></Card>
    </div>
  );
}
