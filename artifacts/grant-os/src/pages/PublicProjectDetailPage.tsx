import { Link, useRoute } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import PageHeader from "@/components/public/PageHeader";
import ProofItemCard from "@/components/public/ProofItemCard";
import { usePublicProject } from "@/hooks/usePublicProjects";
import { usePublicProofItems } from "@/hooks/usePublicProofItems";
import { publicProofToCard } from "@/lib/public/publicDataService";
import { projects as fallbackProjects } from "@/data/projects";
import { proofItems as fallbackProofItems } from "@/data/proofItems";

export default function PublicProjectDetailPage() {
  const [, params] = useRoute("/projects/:slug");
  const slug = params?.slug;
  const { data: project, isLoading, isError, error } = usePublicProject(slug);
  const { data: proof = [] } = usePublicProofItems(project?.id, { requireProjectId: true });
  const fallbackProject = isError ? fallbackProjects.find((item) => item.slug === slug) : null;
  const displayProject = project
    ? {
        name: project.name,
        category: project.category ?? "Project",
        summary: project.summary ?? "Public project details are being documented.",
        problem: project.problem_statement,
        solution: project.solution,
        impact: project.impact,
        stage: project.stage ?? "Active",
        grantRelevance: project.grant_relevance,
      }
    : fallbackProject
      ? {
          name: fallbackProject.name,
          category: fallbackProject.category,
          summary: fallbackProject.summary,
          problem: fallbackProject.problem ?? null,
          solution: null,
          impact: null,
          stage: fallbackProject.status,
          grantRelevance: fallbackProject.grantRelevance,
        }
      : null;
  const proofItems = project
    ? proof.map(publicProofToCard)
    : fallbackProofItems.filter((item) => item.isPublic && item.projectSlug === slug);

  if (isLoading) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-sm text-muted-foreground">Loading project...</div>;
  }

  if (!displayProject) {
    return (
      <div>
        <PageHeader label="Project" title="Project unavailable" subtitle={isError && error instanceof Error ? error.message : "This public project is not published."} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/projects" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
            <ArrowLeft className="w-4 h-4" />
            All projects
          </Link>
        </div>
      </div>
      <PageHeader
        label={displayProject.category}
        title={displayProject.name}
        subtitle={displayProject.summary ?? "Public project details are being documented."}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
        {isError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Public project data is temporarily unavailable. Showing curated public project details.
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-7">
            {displayProject.problem && <section><h2 className="text-xl font-bold text-foreground mb-3">Problem</h2><p className="text-muted-foreground leading-relaxed">{displayProject.problem}</p></section>}
            {project?.solution && <section><h2 className="text-xl font-bold text-foreground mb-3">Solution</h2><p className="text-muted-foreground leading-relaxed">{project.solution}</p></section>}
            {project?.impact && <section><h2 className="text-xl font-bold text-foreground mb-3">Impact</h2><p className="text-muted-foreground leading-relaxed">{project.impact}</p></section>}
          </div>
          <aside className="bg-card border border-border rounded-xl p-6 h-fit">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">Public record</p>
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Stage</span><div className="font-semibold text-foreground">{displayProject.stage}</div></div>
              <div><span className="text-muted-foreground">Proof items</span><div className="font-semibold text-foreground">{proofItems.length}</div></div>
              {displayProject.grantRelevance && <div><span className="text-muted-foreground">Funding relevance</span><div className="text-foreground">{displayProject.grantRelevance}</div></div>}
            </div>
          </aside>
        </div>

        <section>
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-foreground">Public proof</h2>
            <Link href="/proof" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              All proof <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          {proofItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proofItems.map((item) => <ProofItemCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No public proof items are linked to this project yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
