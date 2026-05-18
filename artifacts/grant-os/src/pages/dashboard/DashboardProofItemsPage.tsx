import { useState } from "react";
import {
  useProofItems,
  useCreateProofItem,
  useUpdateProofItem,
  useArchiveProofItem,
  useDeleteProofItem,
  type ProofItemRow,
} from "@/hooks/useProofItems";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import ProofItemFormDialog, {
  PROOF_TYPE_LABELS,
  parseTagsString,
  type ProofItemFormValues,
} from "@/components/dashboard/ProofItemFormDialog";
import { toast } from "@/hooks/use-toast";
import { isSupabaseConfigured, getSupabaseConfigError } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProofItemDbType } from "@/types/database";
import {
  Plus,
  Search,
  Sparkles,
  Shield,
  Pencil,
  Archive,
  Trash2,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ProofItemDbType, string> = {
  workshop: "bg-violet-50 text-violet-700 border-violet-200",
  app_demo: "bg-blue-50 text-blue-700 border-blue-200",
  document: "bg-slate-100 text-slate-700 border-slate-200",
  metric: "bg-green-50 text-green-700 border-green-200",
  testimonial: "bg-amber-50 text-amber-700 border-amber-200",
  case_study: "bg-cyan-50 text-cyan-700 border-cyan-200",
  media: "bg-pink-50 text-pink-700 border-pink-200",
};

const ALL_TYPES: (ProofItemDbType | "All")[] = [
  "All",
  "workshop",
  "app_demo",
  "document",
  "metric",
  "testimonial",
  "case_study",
  "media",
];

const VISIBILITY_OPTIONS = ["All", "Public", "Private"] as const;

// ──────────────────────────────────────────────────────────────────────────────
// Config error banner (mirrors DashboardProjectsPage pattern)
// ──────────────────────────────────────────────────────────────────────────────

function ConfigError() {
  const configError = getSupabaseConfigError();

  if (configError === "missing_vars") {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-amber-800">Supabase environment variables missing</p>
          <p className="text-amber-700">
            Add <code className="font-mono text-xs bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>{" "}
            to your environment. See <strong>SUPABASE_SETUP.md</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (configError === "wrong_url_format") {
    return (
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
        <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="font-medium text-red-700">Wrong Supabase URL format</p>
          <p className="text-red-600 text-xs">
            <code className="font-mono bg-red-100 px-1 rounded">VITE_SUPABASE_URL</code> appears to be a
            dashboard URL, not a project API URL.
          </p>
          <div className="bg-white border border-red-200 rounded p-2 text-xs space-y-1">
            <p className="text-red-500 line-through">Wrong: <code>https://supabase.com/dashboard/project/…</code></p>
            <p className="text-green-700 font-medium">Correct: <code>https://xxxxxxxxxxxx.supabase.co</code></p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function categorizeError(err: unknown): { title: string; detail: string; steps: string[] } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return {
      title: "Network error — cannot reach Supabase",
      detail: msg,
      steps: [
        "Check VITE_SUPABASE_URL is https://xxxx.supabase.co (Settings → API → Project URL).",
        "Confirm your Supabase project is not paused.",
      ],
    };
  }

  if (lower.includes("relation") && lower.includes("does not exist")) {
    return {
      title: "proof_items table does not exist",
      detail: msg,
      steps: [
        "Run the migration: Supabase → SQL Editor → paste supabase/migrations/002_create_proof_items.sql → Run.",
      ],
    };
  }

  if (lower.includes("rls") || lower.includes("permission denied") || lower.includes("42501")) {
    return {
      title: "Row Level Security is blocking access",
      detail: msg,
      steps: [
        "Row level security requires a signed-in user.",
        "Sign in at /login and run migration 006_auth_roles_rls.sql.",
      ],
    };
  }

  return {
    title: "Failed to load proof items",
    detail: msg,
    steps: [
      "Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct.",
      "Confirm the proof_items table exists (run 002_create_proof_items.sql).",
    ],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export default function DashboardProofItemsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProofItemDbType | "All">("All");
  const [visibility, setVisibility] = useState<"All" | "Public" | "Private">("All");
  const [projectFilter, setProjectFilter] = useState("All");

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProofItemRow | null>(null);
  const [archiveItem, setArchiveItem] = useState<ProofItemRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<ProofItemRow | null>(null);

  const { data: proofItems = [], isLoading, isError, error } = useProofItems();
  const { data: projects = [] } = useProjects();

  const createProofItem = useCreateProofItem();
  const updateProofItem = useUpdateProofItem();
  const archiveProofItem = useArchiveProofItem();
  const deleteProofItem = useDeleteProofItem();
  const { canCreateTable, canUpdateTable, canDeleteRecords } = usePermissions();

  const configError = getSupabaseConfigError();

  // Build project name lookup for display
  const projectNameById = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  // Build project filter list from loaded proof items
  const projectIdsInItems = Array.from(
    new Set(proofItems.filter((p) => p.project_id).map((p) => p.project_id!))
  );
  const projectFilterOptions = ["All", ...projectIdsInItems];

  const filtered = proofItems.filter((item) => {
    const projectName = item.project_id ? (projectNameById[item.project_id] ?? "") : "";
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      projectName.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === "All" || item.type === typeFilter;
    const matchesProject =
      projectFilter === "All" || item.project_id === projectFilter;
    const matchesVisibility =
      visibility === "All"
        ? true
        : visibility === "Public"
        ? item.public_visibility
        : !item.public_visibility;
    return matchesSearch && matchesType && matchesProject && matchesVisibility;
  });

  // ── handlers ──────────────────────────────────────────────────────────────

  async function handleCreate(values: ProofItemFormValues) {
    try {
      await createProofItem.mutateAsync({
        title: values.title,
        type: values.type,
        project_id: values.project_id || null,
        description: values.description || null,
        date: values.date || null,
        tags: parseTagsString(values.tags ?? ""),
        grant_relevance: values.grant_relevance || null,
        media_url: values.media_url || null,
        document_url: values.document_url || null,
        public_visibility: values.public_visibility ?? true,
      });
      setCreateOpen(false);
      toast({ title: "Proof item created", description: `"${values.title}" has been added.` });
    } catch (err) {
      toast({
        title: "Failed to create proof item",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleEdit(values: ProofItemFormValues) {
    if (!editItem) return;
    try {
      await updateProofItem.mutateAsync({
        id: editItem.id,
        updates: {
          title: values.title,
          type: values.type,
          project_id: values.project_id || null,
          description: values.description || null,
          date: values.date || null,
          tags: parseTagsString(values.tags ?? ""),
          grant_relevance: values.grant_relevance || null,
          media_url: values.media_url || null,
          document_url: values.document_url || null,
          public_visibility: values.public_visibility ?? true,
        },
      });
      setEditItem(null);
      toast({ title: "Proof item updated", description: `"${values.title}" has been saved.` });
    } catch (err) {
      toast({
        title: "Failed to update proof item",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveItem) return;
    try {
      await archiveProofItem.mutateAsync(archiveItem.id);
      toast({ title: "Proof item archived", description: `"${archiveItem.title}" has been archived.` });
      setArchiveItem(null);
    } catch (err) {
      toast({
        title: "Failed to archive proof item",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteItem) return;
    try {
      await deleteProofItem.mutateAsync(deleteItem.id);
      toast({ title: "Proof item deleted", description: `"${deleteItem.title}" has been deleted.` });
      setDeleteItem(null);
    } catch (err) {
      toast({
        title: "Failed to delete proof item",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  // ── guard: config error ───────────────────────────────────────────────────

  if (configError) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Proof Library</h1>
        <ConfigError />
      </div>
    );
  }

  // ── guard: loading ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex items-center justify-center py-24 gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading proof items…
      </div>
    );
  }

  // ── guard: error ──────────────────────────────────────────────────────────

  if (isError) {
    const { title, detail, steps } = categorizeError(error);
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Proof Library</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="font-semibold text-red-700">{title}</p>
          </div>
          <p className="text-red-600 font-mono text-xs bg-red-100 rounded px-3 py-2 break-all">{detail}</p>
          <div className="space-y-1.5">
            <p className="text-red-700 font-medium text-xs uppercase tracking-wide">How to fix:</p>
            <ol className="list-decimal list-inside space-y-1 text-red-700 text-xs">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ── main render ───────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proof Library</h1>
          <p className="text-slate-500 text-sm mt-0.5">Evidence database for grant applications</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() =>
              toast({ title: "AI workflow coming soon", description: "AI will be connected in a later phase." })
            }
          >
            <Sparkles size={13} />
            Suggest for grant
          </Button>
          {canCreateTable("proof_items") && (
            <Button size="sm" className="gap-2 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              Add proof item
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search proof items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-60"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                typeFilter === t
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {t === "All" ? "All types" : PROOF_TYPE_LABELS[t as ProofItemDbType]}
            </button>
          ))}
        </div>

        {/* Project filter — real projects from Supabase */}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 h-8"
        >
          <option value="All">All projects</option>
          {projectFilterOptions
            .filter((id) => id !== "All")
            .map((id) => (
              <option key={id} value={id}>
                {projectNameById[id] ?? id}
              </option>
            ))}
        </select>

        <div className="flex gap-1">
          {VISIBILITY_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                visibility === v
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {proofItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-200 rounded-xl">
          <FileText size={32} className="text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium text-sm">No proof items yet</p>
          <p className="text-slate-400 text-xs mt-1 mb-4">
            Add your first proof item or run{" "}
            <code className="font-mono bg-slate-100 px-1 rounded">
              supabase/migrations/002_create_proof_items.sql
            </code>
            .
          </p>
          {canCreateTable("proof_items") && (
            <Button size="sm" className="gap-2 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              Add proof item
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const projectName = item.project_id ? projectNameById[item.project_id] : undefined;
            return (
              <Card
                key={item.id}
                className="border-slate-200 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Shield size={14} className="text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-800 leading-tight">{item.title}</div>
                        {projectName && (
                          <div className="text-xs text-primary mt-0.5">{projectName}</div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${TYPE_COLORS[item.type]}`}
                    >
                      {PROOF_TYPE_LABELS[item.type]}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>
                  )}

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.grant_relevance && (
                    <div className="mt-2 text-[11px] text-primary bg-primary/5 border border-primary/10 rounded px-2 py-1 leading-snug">
                      {item.grant_relevance}
                    </div>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{item.date ?? ""}</span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-medium mr-1 ${
                          item.public_visibility ? "text-green-600" : "text-slate-400"
                        }`}
                      >
                        {item.public_visibility ? "Public" : "Private"}
                      </span>
                      {canUpdateTable("proof_items") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditItem(item);
                          }}
                          title="Edit"
                        >
                          <Pencil size={11} />
                        </Button>
                      )}
                      {canUpdateTable("proof_items") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-amber-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchiveItem(item);
                          }}
                          title="Archive"
                        >
                          <Archive size={11} />
                        </Button>
                      )}
                      {canDeleteRecords && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteItem(item);
                          }}
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-16 text-slate-400 text-sm">
              No proof items match your filters.
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <ProofItemFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        title="Add proof item"
        submitLabel="Create proof item"
        loading={createProofItem.isPending}
      />

      {/* Edit dialog */}
      <ProofItemFormDialog
        open={Boolean(editItem)}
        onOpenChange={(open) => { if (!open) setEditItem(null); }}
        onSubmit={handleEdit}
        defaultValues={editItem ?? undefined}
        title="Edit proof item"
        submitLabel="Save changes"
        loading={updateProofItem.isPending}
      />

      {/* Archive confirm */}
      <AlertDialog open={Boolean(archiveItem)} onOpenChange={(open) => { if (!open) setArchiveItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{archiveItem?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This proof item will be hidden from the dashboard. You can restore it later by
              un-archiving it directly in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => { if (!open) setDeleteItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteItem?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the proof item and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
