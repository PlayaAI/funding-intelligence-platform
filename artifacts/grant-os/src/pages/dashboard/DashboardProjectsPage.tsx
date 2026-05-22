import { useState } from "react";
import { Link } from "wouter";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useMappedGrants } from "@/hooks/useGrants";
import { PROJECT_COLORS } from "@/data/grants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, FileText, AlertCircle, Loader2 } from "lucide-react";
import ProjectFormDialog, { type ProjectFormValues } from "@/components/dashboard/ProjectFormDialog";
import { isSupabaseConfigured, getSupabaseConfigError } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-50 text-green-700 border-green-200",
  Live: "bg-blue-50 text-blue-700 border-blue-200",
  Prototype: "bg-violet-50 text-violet-700 border-violet-200",
  Published: "bg-amber-50 text-amber-700 border-amber-200",
  "Demo Complete": "bg-slate-100 text-slate-700 border-slate-200",
  "Early Prototype": "bg-pink-50 text-pink-700 border-pink-200",
};

function ConfigError() {
  const configError = getSupabaseConfigError();

  if (configError === "missing_vars") {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-amber-800">Supabase environment variables missing</p>
          <p className="text-amber-700">
            Add <code className="font-mono text-xs bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to Replit Secrets.
            See <strong>SUPABASE_SETUP.md</strong> for instructions.
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
          <p className="text-red-600">
            <code className="font-mono text-xs bg-red-100 px-1 rounded">VITE_SUPABASE_URL</code> appears to be a
            Supabase dashboard URL, not a project API URL.
          </p>
          <div className="bg-white border border-red-200 rounded p-3 space-y-1 text-xs">
            <p className="text-red-500 line-through">
              Wrong: <code>https://supabase.com/dashboard/project/…</code>
            </p>
            <p className="text-green-700 font-medium">
              Correct: <code>https://xxxxxxxxxxxx.supabase.co</code>
            </p>
          </div>
          <p className="text-red-600 text-xs">
            Find the correct URL in your Supabase project:{" "}
            <strong>Settings → API → Project URL</strong>.
            Then update the <code className="font-mono bg-red-100 px-1 rounded">VITE_SUPABASE_URL</code> secret
            in Replit and restart the app.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function categorizeError(err: unknown): { title: string; detail: string; steps: string[] } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("fetch")) {
    return {
      title: "Network error — cannot reach Supabase",
      detail: msg,
      steps: [
        "Check that VITE_SUPABASE_URL is the project API URL (https://xxxx.supabase.co), not the dashboard URL.",
        "Find the correct URL in your Supabase project: Settings → API → Project URL.",
        "Update the secret in Replit Secrets and restart the workflow.",
        "Also confirm your Supabase project is not paused (free tier projects pause after inactivity).",
      ],
    };
  }

  if (lower.includes("relation") && lower.includes("does not exist")) {
    return {
      title: "Projects table does not exist",
      detail: msg,
      steps: [
        "Run the SQL migration in your Supabase project.",
        "Go to: Supabase → SQL Editor → paste contents of supabase/migrations/001_create_projects.sql → Run.",
      ],
    };
  }

  if (lower.includes("rls") || lower.includes("row-level") || lower.includes("permission denied") || lower.includes("42501")) {
    return {
      title: "Row Level Security is blocking access",
      detail: msg,
      steps: [
        "Row level security requires a signed-in user.",
        "Sign in at /login and ensure migration 006_auth_roles_rls.sql has been applied.",
        "Confirm your user has a row in the profiles table.",
      ],
    };
  }

  if (lower.includes("invalid api key") || lower.includes("jwt") || lower.includes("apikey")) {
    return {
      title: "Invalid API key",
      detail: msg,
      steps: [
        "Check that VITE_SUPABASE_ANON_KEY is the anon/public key (not the service_role key).",
        "Find it in: Supabase → Settings → API → Project API keys → anon public.",
        "Update the secret in Replit and restart the workflow.",
      ],
    };
  }

  return {
    title: "Failed to load projects",
    detail: msg,
    steps: [
      "Check that VITE_SUPABASE_URL is https://xxxx.supabase.co (Settings → API → Project URL).",
      "Check that VITE_SUPABASE_ANON_KEY is the anon public key.",
      "Confirm the projects table exists (run supabase/migrations/001_create_projects.sql).",
      "Confirm your Supabase project is active (not paused).",
    ],
  };
}

export default function DashboardProjectsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: projects = [], isLoading, isError, error } = useProjects();
  const { grants } = useMappedGrants();
  const createProject = useCreateProject();
  const { canWriteTable } = usePermissions();

  const configError = getSupabaseConfigError();

  const allStatuses = ["All", ...Array.from(new Set(projects.map((p) => p.stage ?? "Unknown")))];

  const filtered = projects.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || (p.stage ?? "Unknown") === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleCreate(values: ProjectFormValues) {
    try {
      await createProject.mutateAsync({
        name: values.name,
        slug: values.slug,
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
      });
      setDialogOpen(false);
      toast({ title: "Project created", description: `${values.name} has been added.` });
    } catch (err) {
      toast({
        title: "Failed to create project",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  // Config errors take priority and explain the root cause
  if (configError) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
        </div>
        <ConfigError />
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <ConfigError />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center py-24 gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading projects…
      </div>
    );
  }

  if (isError) {
    const { title, detail, steps } = categorizeError(error);
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
        </div>
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-sm mt-0.5">{projects.length} project profiles</p>
        </div>
        {canWriteTable("projects") && (
          <Button size="sm" className="gap-2 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus size={14} />
            Add project
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-52"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {allStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {s === "All" ? "All statuses" : s}
            </button>
          ))}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-200 rounded-xl">
          <FileText size={32} className="text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium text-sm">No projects yet</p>
          <p className="text-slate-400 text-xs mt-1 mb-4">
            Add your first project or run the seed migration in{" "}
            <code className="font-mono bg-slate-100 px-1 rounded">supabase/migrations/001_create_projects.sql</code>.
          </p>
          {canWriteTable("projects") && (
            <Button size="sm" className="gap-2 text-xs" onClick={() => setDialogOpen(true)}>
              <Plus size={14} />
              Add project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const relatedGrants = grants.filter((g) => g.relatedProjectSlug === p.slug);
            const color = PROJECT_COLORS[p.slug] ?? "#94a3b8";
            const stage = p.stage ?? "Unknown";
            return (
              <Link href={`/dashboard/projects/${p.slug}`} key={p.id}>
                <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                        style={{ backgroundColor: color }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.category ?? "—"}</div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[stage] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {stage}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2 flex-1">{p.summary ?? ""}</p>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <FileText size={12} />
                      {relatedGrants.length} grants
                    </span>
                    {p.public_visibility ? (
                      <span className="ml-auto text-[11px] text-green-600 font-medium">Public</span>
                    ) : (
                      <span className="ml-auto text-[11px] text-slate-400 font-medium">Private</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-16 text-slate-400 text-sm">
              No projects match your filters.
            </div>
          )}
        </div>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
        title="Add project"
        submitLabel="Create project"
        loading={createProject.isPending}
      />
    </div>
  );
}
