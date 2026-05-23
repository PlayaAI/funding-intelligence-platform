import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useProject, useUpdateProject, useArchiveProject, useDeleteProject } from "@/hooks/useProjects";
import { useProofItems, useCreateProofItem } from "@/hooks/useProofItems";
import { PROJECT_COLORS } from "@/data/grants";
import { useMappedGrants } from "@/hooks/useGrants";
import { useApplicationsByProject } from "@/hooks/useApplications";
import { useGenerateMatchesForProject, useGrantMatchesForProject, useHideMatch, useSaveMatch } from "@/hooks/useGrantMatches";
import { matchJsonArray } from "@/lib/matching/matchesService";
import { DECISION_CLASSES, DECISION_LABELS, deadlineLanguage } from "@/lib/matching/matchPresentation";
import { useTasksByProject } from "@/hooks/useTasks";
import { useDocuments } from "@/hooks/useDocuments";
import ProofItemFormDialog, { PROOF_TYPE_LABELS, parseTagsString, type ProofItemFormValues } from "@/components/dashboard/ProofItemFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import ProjectFormDialog, { type ProjectFormValues } from "@/components/dashboard/ProjectFormDialog";
import AgentNotesPanel from "@/components/dashboard/AgentNotesPanel";
import { toast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { exportProjectPackage } from "@/lib/exports/exportPackages";
import { useCreateAgentActivity } from "@/hooks/useAgentActivity";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, Sparkles, ExternalLink, Plus, FileText, Download,
  Loader2, AlertCircle, Archive, Trash2, Pencil,
} from "lucide-react";

const PROOF_TYPE_COLORS: Record<string, string> = {
  workshop: "bg-violet-50 text-violet-700 border-violet-200",
  app_demo: "bg-blue-50 text-blue-700 border-blue-200",
  document: "bg-slate-100 text-slate-700 border-slate-200",
  metric: "bg-green-50 text-green-700 border-green-200",
  testimonial: "bg-amber-50 text-amber-700 border-amber-200",
  case_study: "bg-cyan-50 text-cyan-700 border-cyan-200",
  media: "bg-pink-50 text-pink-700 border-pink-200",
};
const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-50 text-green-700 border-green-200",
  Live: "bg-blue-50 text-blue-700 border-blue-200",
  Prototype: "bg-violet-50 text-violet-700 border-violet-200",
  Published: "bg-amber-50 text-amber-700 border-amber-200",
  "Demo Complete": "bg-slate-100 text-slate-700 border-slate-200",
  "Early Prototype": "bg-pink-50 text-pink-700 border-pink-200",
};

export default function DashboardProjectDetailPage() {
  const [, params] = useRoute("/dashboard/projects/:slug");
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);

  const { data: project, isLoading, isError, error } = useProject(params?.slug);
  const updateProject = useUpdateProject();
  const archiveProject = useArchiveProject();
  const deleteProject = useDeleteProject();
  const { data: relatedProof = [], isLoading: proofLoading } = useProofItems(
    project?.id,
    { requireProjectId: true }
  );
  const { grants: allGrants } = useMappedGrants();
  const { data: relatedApps = [] } = useApplicationsByProject(project?.id);
  const { data: relatedTasks = [] } = useTasksByProject(project?.id);
  const { data: relatedDocs = [] } = useDocuments({ relatedProjectId: project?.id ?? "all" });
  const createProofItem = useCreateProofItem();
  const { canWriteTable, canCreateTable, canDeleteRecords, canContribute } = usePermissions();
  const { user } = useAuth();
  const createActivity = useCreateAgentActivity();
  const projectMatchesQuery = useGrantMatchesForProject(project?.id);
  const generateProjectMatches = useGenerateMatchesForProject();
  const saveMatch = useSaveMatch();
  const hideMatch = useHideMatch();

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading project…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">Failed to load project</p>
            <p className="text-red-600 mt-0.5">{error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        </div>
        <Link href="/dashboard/projects">
          <Button variant="ghost" className="mt-4 gap-2 text-xs"><ArrowLeft size={14} />Back to projects</Button>
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-sm">Project not found.</p>
        <Link href="/dashboard/projects">
          <Button variant="ghost" className="mt-4 gap-2 text-xs"><ArrowLeft size={14} />Back to projects</Button>
        </Link>
      </div>
    );
  }

  const relatedGrants = allGrants.filter((g) => g.relatedProjectSlug === project.slug);
  const color = PROJECT_COLORS[project.slug] ?? "#94a3b8";
  const stage = project.stage ?? "Unknown";

  async function handleAddProofItem(values: ProofItemFormValues) {
    try {
      await createProofItem.mutateAsync({
        title: values.title,
        type: values.type,
        project_id: project!.id,
        description: values.description || null,
        date: values.date || null,
        tags: parseTagsString(values.tags ?? ""),
        grant_relevance: values.grant_relevance || null,
        media_url: values.media_url || null,
        document_url: values.document_url || null,
        public_visibility: values.public_visibility ?? true,
      });
      setProofDialogOpen(false);
      toast({ title: "Proof item added", description: `"${values.title}" linked to ${project!.name}.` });
    } catch (err) {
      toast({
        title: "Failed to add proof item",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  const handleAI = (a: string) =>
    toast({ title: a, description: "AI workflow will be connected in a later phase." });

  async function handleExportProject() {
    try {
      await exportProjectPackage(project!.id, project!.slug || project!.name);
      await createActivity.mutateAsync({ actor_source: "human", action_type: "export_created", title: `Exported project package: ${project!.name}`, related_project_id: project!.id, created_by: user?.id ?? null });
      toast({ title: "Project package exported", description: "JSON download created." });
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  }

  async function handleEdit(values: ProjectFormValues) {
    try {
      await updateProject.mutateAsync({
        slug: project!.slug,
        updates: {
          name: values.name,
          category: values.category ?? null,
          stage: values.stage ?? null,
          summary: values.summary ?? null,
          problem_statement: values.problem_statement ?? null,
          solution: values.solution ?? null,
          target_audience: values.target_audience ?? null,
          geography: values.geography ?? null,
          technology: values.technology ?? null,
          impact: values.impact ?? null,
          grant_relevance: values.grant_relevance ?? null,
          reusable_grant_language: values.reusable_grant_language ?? null,
          public_visibility: values.public_visibility ?? false,
          featured: values.featured ?? false,
        },
      });
      setEditOpen(false);
      toast({ title: "Project updated", description: `${values.name} has been saved.` });
    } catch (err) {
      toast({
        title: "Failed to update project",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleArchive() {
    try {
      await archiveProject.mutateAsync(project!.slug);
      toast({ title: "Project archived", description: `${project!.name} has been archived.` });
      navigate("/dashboard/projects");
    } catch (err) {
      toast({
        title: "Failed to archive project",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleDelete() {
    try {
      await deleteProject.mutateAsync(project!.id);
      toast({ title: "Project deleted", description: `${project!.name} has been permanently deleted.` });
      navigate("/dashboard/projects");
    } catch (err) {
      toast({
        title: "Failed to delete project",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <Link href="/dashboard/projects">
        <Button variant="ghost" size="sm" className="gap-2 text-xs h-8">
          <ArrowLeft size={14} />
          Projects
        </Button>
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {project.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
            <div className="text-sm text-slate-500 mt-0.5">{project.category ?? "—"}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLORS[stage] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {stage}
          </span>
          {project.public_visibility ? (
            <span className="text-xs text-green-600 font-medium">Public</span>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Private</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleAI("Generate AI Summary")}>
          <Sparkles size={12} />
          Generate Summary
        </Button>
        <Link href={`/projects/${project.slug}`}>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <ExternalLink size={12} />
            Public page
          </Button>
        </Link>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportProject}>
          <Download size={12} />
          Export JSON
        </Button>
        {canWriteTable("projects") && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
            <Pencil size={12} />
            Edit
          </Button>
        )}
        {canWriteTable("projects") && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive size={12} />
            Archive
          </Button>
        )}
        {canDeleteRecords && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={12} />
            Delete
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="tracker" className="text-xs">Tracker ({relatedGrants.length})</TabsTrigger>
          <TabsTrigger value="matches" className="text-xs">Matches</TabsTrigger>
          <TabsTrigger value="proof" className="text-xs">Proof ({proofLoading ? "…" : relatedProof.length})</TabsTrigger>
          <TabsTrigger value="applications" className="text-xs">Applications ({relatedApps.length})</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">Tasks ({relatedTasks.length})</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Documents ({relatedDocs.length})</TabsTrigger>
          <TabsTrigger value="agent-notes" className="text-xs">Agent Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {project.summary && (
            <Card className="border-slate-200">
              <CardContent className="pt-4">
                <p className="text-sm text-slate-700">{project.summary}</p>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.problem_statement && (
              <Card className="border-slate-200">
                <CardHeader className="pb-1"><CardTitle className="text-sm">Problem</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-600">{project.problem_statement}</p></CardContent>
              </Card>
            )}
            {project.solution && (
              <Card className="border-slate-200">
                <CardHeader className="pb-1"><CardTitle className="text-sm">Solution</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-600">{project.solution}</p></CardContent>
              </Card>
            )}
            {project.target_audience && (
              <Card className="border-slate-200">
                <CardHeader className="pb-1"><CardTitle className="text-sm">Target Audience</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-600">{project.target_audience}</p></CardContent>
              </Card>
            )}
            {project.geography && (
              <Card className="border-slate-200">
                <CardHeader className="pb-1"><CardTitle className="text-sm">Geography</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-600">{project.geography}</p></CardContent>
              </Card>
            )}
            {project.technology && (
              <Card className="border-slate-200">
                <CardHeader className="pb-1"><CardTitle className="text-sm">Technology</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-600">{project.technology}</p></CardContent>
              </Card>
            )}
            {project.impact && (
              <Card className="border-slate-200">
                <CardHeader className="pb-1"><CardTitle className="text-sm">Impact</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-600">{project.impact}</p></CardContent>
              </Card>
            )}
          </div>
          {project.grant_relevance && (
            <Card className="border-slate-200">
              <CardHeader className="pb-1"><CardTitle className="text-sm">Grant Relevance</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600">{project.grant_relevance}</p></CardContent>
            </Card>
          )}
          {project.reusable_grant_language && (
            <Card className="border-slate-200">
              <CardHeader className="pb-1"><CardTitle className="text-sm">Reusable Grant Language</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-600 whitespace-pre-wrap">{project.reusable_grant_language}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tracker" className="mt-4 space-y-3">
          {relatedGrants.map((g) => (
            <Link href={`/dashboard/grants/${g.id}`} key={g.id}>
              <Card className="border-slate-200 hover:border-primary/40 cursor-pointer transition-colors">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-slate-800">{g.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{g.funderName} · {new Date(g.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <GrantStatusBadge status={g.status} />
                      <span className="text-xs text-slate-400">Fit: {g.fitScore}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {relatedGrants.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No grants linked to this project.</div>
          )}
        </TabsContent>

        <TabsContent value="matches" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">Project Matches</div>
              <p className="text-xs text-slate-500 mt-0.5">Top deterministic grant matches, readiness gaps, and recommended next actions.</p>
            </div>
            {canWriteTable("grant_matches") && (
              <Button size="sm" className="gap-2 text-xs" disabled={generateProjectMatches.isPending} onClick={async () => {
                const rows = await generateProjectMatches.mutateAsync(project.id);
                toast({ title: "Project matches generated", description: ` matches updated.` });
              }}>
                {generateProjectMatches.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Generate/Refresh
              </Button>
            )}
          </div>
          {projectMatchesQuery.isLoading && <div className="py-8 text-center text-sm text-slate-400">Loading matches...</div>}
          {(projectMatchesQuery.data ?? []).filter((m) => m.status !== "hidden" && m.status !== "dismissed").slice(0, 8).map((match) => {
            const reasons = matchJsonArray(match.fit_reasons).slice(0, 3);
            const risks = matchJsonArray(match.risks);
            const actions = matchJsonArray(match.recommended_actions);
            const deadline = deadlineLanguage(match.grant?.deadline);
            return (
              <Card key={match.id} className="border-slate-200">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/dashboard/grants/${match.grant_id}`}><div className="font-medium text-sm text-slate-900 hover:text-primary">{match.grant?.title ?? "Unknown grant"}</div></Link>
                      <div className="text-xs text-slate-500 mt-0.5">{match.grant?.funder_name ?? "Unknown funder"} · Score {match.match_score} · Readiness {match.readiness_score} · {deadline.label}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={`text-xs ${DECISION_CLASSES[match.decision_label] ?? DECISION_CLASSES.needs_review}`}>
                        {DECISION_LABELS[match.decision_label] ?? "Needs Review"}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">{match.match_tier.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  {reasons.map((reason) => <div key={reason} className="text-xs text-slate-600">• {reason}</div>)}
                  {risks[0] && <div className="text-xs text-red-600">Risk: {risks[0]}</div>}
                  {actions[0] && <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">Next: {actions[0]}</div>}
                  {canContribute && <div className="flex gap-2"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => { await saveMatch.mutateAsync(match.id); toast({ title: "Match saved" }); }}>Save</Button><Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => { await hideMatch.mutateAsync({ id: match.id, reason: "Hidden from project detail" }); toast({ title: "Match hidden" }); }}>Hide</Button></div>}
                </CardContent>
              </Card>
            );
          })}
          {!projectMatchesQuery.isLoading && (projectMatchesQuery.data ?? []).length === 0 && (
            <Card className="border-slate-200"><CardContent className="py-10 text-center text-sm text-slate-500">No generated matches for this project yet.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="proof" className="mt-4 space-y-3">
          {proofLoading ? (
            <div className="flex items-center gap-2 py-8 text-slate-400 text-sm justify-center">
              <Loader2 size={14} className="animate-spin" />
              Loading proof items…
            </div>
          ) : (
            <>
              {relatedProof.map((item) => (
                <Card key={item.id} className="border-slate-200">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-800">{item.title}</div>
                        {item.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                        )}
                        {item.date && <div className="text-xs text-slate-400 mt-1">{item.date}</div>}
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.tags.map((t) => (
                              <span key={t} className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${PROOF_TYPE_COLORS[item.type] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {PROOF_TYPE_LABELS[item.type] ?? item.type}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {relatedProof.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">No proof items linked to this project.</div>
              )}
            </>
          )}
          {canCreateTable("proof_items") && (
            <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => setProofDialogOpen(true)}>
              <Plus size={12} />
              Add proof item
            </Button>
          )}
        </TabsContent>

        <TabsContent value="applications" className="mt-4 space-y-3">
          {relatedApps.map((a) => (
            <Link href={`/dashboard/applications/${a.id}`} key={a.id}>
              <Card className="border-slate-200 hover:border-primary/40 cursor-pointer transition-colors">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-slate-800">{a.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{a.owner_name ?? "Unassigned"}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{a.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {relatedApps.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No applications for this project.</div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-2">
          {relatedTasks.map((t) => (
            <Card key={t.id} className="border-slate-200">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-slate-800">{t.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{t.owner_name ?? "Unassigned"} · {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.priority === "High" || t.priority === "Urgent" ? "destructive" : "secondary"} className="text-xs">{t.priority}</Badge>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {relatedTasks.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No tasks linked.</div>
          )}
          <Button size="sm" variant="outline" className="gap-2 text-xs mt-2" onClick={() =>
            toast({ title: "Add task", description: "Task creation from project detail coming soon." })
          }>
            <Plus size={12} />
            Add task
          </Button>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-3">
          {relatedDocs.map((doc) => (
            <Card key={doc.id} className="border-slate-200">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-800 truncate">{doc.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">{doc.file_name ?? doc.source_url ?? "No source URL"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">{doc.document_type.replace(/_/g, " ")}</Badge>
                    {(doc.source_url || doc.file_url) && (
                      <a href={doc.source_url ?? doc.file_url ?? "#"} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={13} className="text-slate-400 hover:text-primary" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {relatedDocs.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No documents linked.</div>
          )}
          <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() =>
            toast({ title: "Add document", description: "Document creation coming in a later phase." })
          }>
            <Plus size={12} />
            Add document
          </Button>
        </TabsContent>

        <TabsContent value="agent-notes" className="mt-4">
          <AgentNotesPanel relatedProjectId={project.id} />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        defaultValues={project}
        title="Edit project"
        submitLabel="Save changes"
        loading={updateProject.isPending}
      />

      <ProofItemFormDialog
        open={proofDialogOpen}
        onOpenChange={setProofDialogOpen}
        onSubmit={handleAddProofItem}
        lockedProjectId={project.id}
        title="Add proof item"
        submitLabel="Add proof item"
        loading={createProofItem.isPending}
      />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This project will be hidden from the dashboard. You can restore it later by un-archiving it directly in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and cannot be undone. All associated proof items, tasks, and grants will lose their project link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
