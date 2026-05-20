import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, CheckCircle2, FileUp, History, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useBuildImportPreview, useExecuteImport, useImportRuns } from "@/hooks/useImports";
import { usePermissions } from "@/hooks/usePermissions";
import { useCreateProject, useProjects } from "@/hooks/useProjects";
import type {
  ExecuteImportResult,
  ImportPreview,
  ImportPreviewRow,
  ImportTargetProject,
  ImportType,
} from "@/lib/imports/importTypes";

const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  instrumentl_opportunities_csv: "Instrumentl Opportunities CSV",
  instrumentl_opportunities_json: "Instrumentl Opportunities JSON",
  instrumentl_funders_csv: "Instrumentl Funders CSV",
  instrumentl_funders_json: "Instrumentl Funders JSON",
};

const IMPORT_TYPES = Object.keys(IMPORT_TYPE_LABELS) as ImportType[];

function statusVariant(status: ImportPreviewRow["status"]) {
  if (status === "ready") return "default";
  if (status === "duplicate") return "secondary";
  return "destructive";
}

function statusLabel(status: ImportPreviewRow["status"]) {
  if (status === "ready") return "Ready";
  if (status === "duplicate") return "Duplicate";
  return "Error";
}

function isOpportunityImport(importType: ImportType) {
  return importType.startsWith("instrumentl_opportunities_");
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function suggestedProjectName(fileName: string) {
  const base = fileName.replace(/\.(csv|json)$/iu, "");
  const cleaned = base
    .replace(/^instrumentl-opportunities-/iu, "")
    .replace(/-?(all|full|next-\d+-months)$/iu, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return cleaned && !/^\d+$/u.test(cleaned) ? cleaned : "";
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}

function PreviewTable({
  preview,
  targetProject,
}: {
  preview: ImportPreview;
  targetProject: ImportTargetProject | null;
}) {
  const visibleRows = preview.rows.slice(0, 50);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Row</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{preview.entity === "grant" ? "Grant" : "Funder"}</TableHead>
              <TableHead>{preview.entity === "grant" ? "Funder" : "EIN / Location"}</TableHead>
              {preview.entity === "grant" && <TableHead>Target Project</TableHead>}
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.rowIndex}>
                <TableCell className="text-xs text-slate-500">{row.rowIndex}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                </TableCell>
                <TableCell className="font-medium text-slate-900">{row.displayName}</TableCell>
                <TableCell className="text-slate-600">{row.secondary ?? "-"}</TableCell>
                {preview.entity === "grant" && (
                  <TableCell className="text-slate-600">{targetProject?.name ?? "Select target project"}</TableCell>
                )}
                <TableCell className="text-xs text-slate-600">
                  {[row.duplicate?.reason, ...row.issues.map((issue) => issue.message)]
                    .filter(Boolean)
                    .join(" ")}
                </TableCell>
              </TableRow>
            ))}
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={preview.entity === "grant" ? 6 : 5} className="py-6 text-center text-sm text-slate-500">
                  No rows to preview.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {preview.rows.length > visibleRows.length && (
          <p className="mt-3 text-xs text-slate-500">
            Showing first {visibleRows.length} of {preview.rows.length} rows.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardImportsPage() {
  const { user } = useAuth();
  const { canWrite } = usePermissions();
  const [importType, setImportType] = useState<ImportType>("instrumentl_opportunities_csv");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ExecuteImportResult | null>(null);
  const [updateMissingFieldsOnly, setUpdateMissingFieldsOnly] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSummary, setNewProjectSummary] = useState("");

  const previewMutation = useBuildImportPreview();
  const executeMutation = useExecuteImport();
  const runsQuery = useImportRuns();
  const projectsQuery = useProjects();
  const createProject = useCreateProject();

  const requiresTargetProject = Boolean(preview && isOpportunityImport(preview.importType));
  const selectedProject = (projectsQuery.data ?? []).find((project) => project.id === selectedProjectId) ?? null;
  const targetProject: ImportTargetProject | null = selectedProject
    ? { id: selectedProject.id, slug: selectedProject.slug, name: selectedProject.name }
    : null;

  const canImportRows = useMemo(
    () => Boolean(canWrite && preview && preview.summary.readyRows > 0 && (!requiresTargetProject || targetProject)),
    [canWrite, preview, requiresTargetProject, targetProject]
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setResult(null);
    setParseError(null);
    if (!file) return;

    try {
      const text = await file.text();
      const nextPreview = await previewMutation.mutateAsync({
        importType,
        fileName: file.name,
        text,
      });
      setPreview(nextPreview);
      const suggestion = suggestedProjectName(file.name);
      if (isOpportunityImport(importType) && suggestion && !newProjectName) {
        setNewProjectName(suggestion);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse import file.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleCreateProject() {
    const name = newProjectName.trim();
    const slug = toSlug(name);
    if (!name || !slug) {
      setParseError("Enter a project name before creating a target project.");
      return;
    }

    setParseError(null);
    const project = await createProject.mutateAsync({
      name,
      slug,
      summary: newProjectSummary.trim() || null,
      category: null,
      stage: null,
      problem_statement: null,
      solution: null,
      target_audience: null,
      geography: null,
      technology: null,
      impact: null,
      grant_relevance: null,
      reusable_grant_language: null,
      public_visibility: false,
      featured: false,
      archived_at: null,
    });
    setSelectedProjectId(project.id);
  }

  async function handleImport() {
    if (!preview || !canWrite) return;
    const nextResult = await executeMutation.mutateAsync({
      preview,
      options: {
        updateMissingFieldsOnly,
        createdBy: user?.id ?? null,
        targetProject: requiresTargetProject ? targetProject : null,
      },
    });
    setResult(nextResult);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Imports</h1>
        <p className="text-sm text-slate-500">
          Import manually exported Instrumentl opportunities and funders with preview and deduplication.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp size={16} />
            Instrumentl Importer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canWrite && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your role can view import history, but only Admin and Grant Lead users can run imports.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Import type</Label>
              <Select
                value={importType}
                onValueChange={(value) => {
                  setImportType(value as ImportType);
                  setPreview(null);
                  setResult(null);
                  setParseError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {IMPORT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-file" className="text-xs font-medium">
                Upload file
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="import-file"
                  type="file"
                  accept={importType.endsWith("_csv") ? ".csv,text/csv" : ".json,application/json"}
                  disabled={!canWrite || previewMutation.isPending}
                  onChange={(event) => void handleFileChange(event)}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
                />
                {previewMutation.isPending && <Loader2 size={16} className="animate-spin text-slate-400" />}
              </div>
            </div>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <SummaryTile label="Total" value={preview.summary.totalRows} />
                <SummaryTile label="Ready" value={preview.summary.readyRows} />
                <SummaryTile label="Duplicates" value={preview.summary.duplicateRows} />
                <SummaryTile label="Errors" value={preview.summary.errorRows} />
                <SummaryTile label="Warnings" value={preview.summary.warningRows} />
              </div>

              {preview.summary.unknownColumns.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Unknown columns preserved in row preview metadata but not imported:{" "}
                  {preview.summary.unknownColumns.slice(0, 20).join(", ")}
                  {preview.summary.unknownColumns.length > 20 ? "..." : ""}
                </div>
              )}

              {requiresTargetProject && (
                <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Target Project</div>
                    <p className="text-xs text-slate-500">Opportunity imports create grants linked to one project.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Select existing project</Label>
                      <Select value={selectedProjectId || "none"} onValueChange={(value) => setSelectedProjectId(value === "none" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Choose a project</SelectItem>
                          {(projectsQuery.data ?? []).map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-project-name" className="text-xs font-medium">Create new project</Label>
                      <div className="flex gap-2">
                        <Input
                          id="new-project-name"
                          value={newProjectName}
                          onChange={(event) => setNewProjectName(event.target.value)}
                          placeholder="Project name"
                          disabled={!canWrite || createProject.isPending}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleCreateProject()}
                          disabled={!canWrite || createProject.isPending || !newProjectName.trim()}
                        >
                          {createProject.isPending ? <Loader2 size={14} className="animate-spin" /> : "Create"}
                        </Button>
                      </div>
                      <div className="text-[11px] text-slate-500">Slug: {toSlug(newProjectName) || "project-slug"}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-project-summary" className="text-xs font-medium">New project summary</Label>
                    <Textarea
                      id="new-project-summary"
                      value={newProjectSummary}
                      onChange={(event) => setNewProjectSummary(event.target.value)}
                      placeholder="Optional description for the new project"
                      disabled={!canWrite || createProject.isPending}
                    />
                  </div>
                  {!targetProject && (
                    <div className="text-xs font-medium text-amber-700">Select or create a target project before importing opportunities.</div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={updateMissingFieldsOnly}
                    onCheckedChange={(checked) => setUpdateMissingFieldsOnly(checked === true)}
                    disabled={!canWrite}
                  />
                  Update missing fields only for duplicates
                </label>
                <Button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={!canImportRows || executeMutation.isPending}
                  className="md:w-auto"
                >
                  {executeMutation.isPending ? (
                    <Loader2 size={15} className="mr-2 animate-spin" />
                  ) : (
                    <Upload size={15} className="mr-2" />
                  )}
                  Import ready rows
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {preview && <PreviewTable preview={preview} targetProject={targetProject} />}

      {result && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 size={16} />
              Import Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <SummaryTile label="Created" value={result.createdCount} />
              <SummaryTile label="Updated" value={result.updatedCount} />
              <SummaryTile label="Skipped" value={result.skippedCount} />
              <SummaryTile label="Errors" value={result.errorCount} />
            </div>
            {result.targetProject && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <span>Imported grants target {result.targetProject.name}.</span>
                <Link href={`/dashboard/grants?project=${result.targetProject.slug}`}>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs">View imported grants</Button>
                </Link>
                <Link href={`/dashboard/projects/${result.targetProject.slug}`}>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs">View project</Button>
                </Link>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {result.errors.slice(0, 5).map((error, index) => (
                  <div key={`${error.rowIndex ?? "run"}-${index}`}>
                    {error.rowIndex ? `Row ${error.rowIndex}: ` : ""}
                    {error.message}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History size={16} />
            Recent Import Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runsQuery.data ?? []).map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(run.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{IMPORT_TYPE_LABELS[run.import_type as ImportType] ?? run.import_type}</TableCell>
                  <TableCell className="text-slate-600">{run.file_name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{run.created_count}</TableCell>
                  <TableCell className="text-right">{run.updated_count}</TableCell>
                  <TableCell className="text-right">{run.skipped_count}</TableCell>
                  <TableCell className="text-right">{run.error_count}</TableCell>
                </TableRow>
              ))}
              {runsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-slate-500">
                    Loading import history...
                  </TableCell>
                </TableRow>
              )}
              {!runsQuery.isLoading && (runsQuery.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-slate-500">
                    No import runs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
