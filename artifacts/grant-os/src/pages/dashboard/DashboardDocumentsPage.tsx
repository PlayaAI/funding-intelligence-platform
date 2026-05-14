import { useState } from "react";
import { documents, type DocumentType } from "@/data/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, ExternalLink, FileText, FolderOpen, Link2, FileArchive } from "lucide-react";

const TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
  "Google Doc": <FileText size={15} className="text-blue-500" />,
  "Google Drive Folder": <FolderOpen size={15} className="text-yellow-500" />,
  "PDF": <FileArchive size={15} className="text-red-500" />,
  "External Link": <Link2 size={15} className="text-slate-500" />,
  "Internal Note": <FileText size={15} className="text-slate-500" />,
};

const TYPE_COLORS: Record<DocumentType, string> = {
  "Google Doc": "bg-blue-50 text-blue-700 border-blue-200",
  "Google Drive Folder": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "PDF": "bg-red-50 text-red-700 border-red-200",
  "External Link": "bg-slate-100 text-slate-700 border-slate-200",
  "Internal Note": "bg-slate-100 text-slate-700 border-slate-200",
};

export default function DashboardDocumentsPage() {
  const [search, setSearch] = useState("");

  const filtered = documents.filter(
    (d) =>
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.relatedProjectName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.relatedGrantTitle ?? "").toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-500 text-sm mt-0.5">{documents.length} documents and links</p>
        </div>
        <Button
          size="sm"
          className="gap-2 text-xs"
          onClick={() => toast({ title: "Add document", description: "Document creation form coming in next phase." })}
        >
          <Plus size={14} />
          Add document
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((doc) => (
          <Card key={doc.id} className="border-slate-200 hover:border-primary/40 transition-colors">
            <CardContent className="pt-3.5 pb-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[doc.type]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800">{doc.title}</span>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={12} className="text-slate-400 hover:text-primary transition-colors" />
                        </a>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {doc.relatedProjectName && (
                        <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{doc.relatedProjectName}</span>
                      )}
                      {doc.relatedGrantTitle && (
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{doc.relatedGrantTitle}</span>
                      )}
                      {doc.tags.map((t) => (
                        <span key={t} className="text-[11px] text-slate-400">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[doc.type]}`}>
                    {doc.type}
                  </span>
                  <div className="flex items-center gap-2">
                    {doc.isPublic ? (
                      <span className="text-[11px] text-green-600 font-medium">Public</span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Private</span>
                    )}
                    <span className="text-[11px] text-slate-300">{doc.createdAt}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No documents match your search.
          </div>
        )}
      </div>
    </div>
  );
}
