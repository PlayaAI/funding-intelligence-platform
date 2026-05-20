import { useMemo, useState } from "react";
import { documents, type DocumentType } from "@/data/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useProjects } from "@/hooks/useProjects";
import { ExternalLink, FileArchive, FileText, FolderOpen, Link2, Plus, Search } from "lucide-react";

const TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
  "Google Doc": <FileText size={15} className="text-blue-500" />,
  "Google Drive Folder": <FolderOpen size={15} className="text-yellow-500" />,
  PDF: <FileArchive size={15} className="text-red-500" />,
  "External Link": <Link2 size={15} className="text-slate-500" />,
  "Internal Note": <FileText size={15} className="text-slate-500" />,
};

export default function DashboardDocumentsPage() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const { data: projects = [] } = useProjects();

  const filtered = useMemo(
    () =>
      documents.filter((doc) => {
        const matchesSearch =
          !search ||
          doc.title.toLowerCase().includes(search.toLowerCase()) ||
          (doc.relatedProjectName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (doc.relatedGrantTitle ?? "").toLowerCase().includes(search.toLowerCase()) ||
          doc.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
        const matchesProject = projectFilter === "all" || doc.relatedProjectSlug === projectFilter;
        return matchesSearch && matchesProject;
      }),
    [projectFilter, search]
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">{documents.length} documents, folders, and source links.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 text-xs"
          onClick={() => toast({ title: "Add Document", description: "File upload and storage are planned for a later phase." })}
        >
          <Plus size={14} />
          Add Document
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-80">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-8 md:w-52 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.slug}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document title</TableHead>
                <TableHead>File / source</TableHead>
                <TableHead>Opportunity</TableHead>
                <TableHead>Date added</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center">{TYPE_ICONS[doc.type]}</span>
                      <div>
                        <div className="font-medium text-slate-900">{doc.title}</div>
                        <div className="text-xs text-slate-500">{doc.relatedProjectName ?? "No project"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{doc.type}</TableCell>
                  <TableCell className="text-slate-600">{doc.relatedGrantTitle ?? "-"}</TableCell>
                  <TableCell className="text-slate-600">{doc.createdAt}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink size={14} /></Button>
                        </a>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled><ExternalLink size={14} /></Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toast({ title: "Document actions", description: "Edit and upload workflows are planned." })}>More</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">No documents match your filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
