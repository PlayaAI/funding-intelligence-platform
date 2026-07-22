import { useState } from "react";
import ProjectCard from "@/components/public/ProjectCard";
import PageHeader from "@/components/public/PageHeader";
import { usePublicProjects } from "@/hooks/usePublicProjects";
import { usePublicProofItems } from "@/hooks/usePublicProofItems";
import { publicProjectToCard } from "@/lib/public/publicDataService";

export default function ProjectsPage() {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const { data: publicProjects = [], isLoading, isError } = usePublicProjects();
  const { data: publicProof = [] } = usePublicProofItems();
  const proofCountByProject = new Map<string, number>();
  publicProof.forEach((item) => {
    if (item.project_id) proofCountByProject.set(item.project_id, (proofCountByProject.get(item.project_id) ?? 0) + 1);
  });
  const sourceProjects = publicProjects.map((project) => publicProjectToCard(project, proofCountByProject.get(project.id) ?? 0));
  const allCategories = ["All", ...Array.from(new Set(sourceProjects.map((p) => p.category)))];
  const allStatuses = ["All", ...Array.from(new Set(sourceProjects.map((p) => p.status)))];

  const filtered = sourceProjects.filter((p) => {
    const matchCat = categoryFilter === "All" || p.category === categoryFilter;
    const matchStatus = statusFilter === "All" || p.status === statusFilter;
    return matchCat && matchStatus;
  });

  return (
    <div>
      <PageHeader
        label="Projects"
        title="What we've built"
        subtitle="Tools, apps, experiments, and community resources built and tested by the Playa AI community."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isError && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Public project data is temporarily unavailable. No fallback portfolio claims are being shown.
          </div>
        )}
        {isLoading && (
          <div className="mb-5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Loading public projects...
          </div>
        )}
        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-5 mb-8" data-testid="project-filters">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2.5">Category</p>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      categoryFilter === cat
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                    data-testid={`filter-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2.5">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {allStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      statusFilter === status
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
            <p className="text-sm font-medium">No projects match the current filters.</p>
            <button
              onClick={() => { setCategoryFilter("All"); setStatusFilter("All"); }}
              className="mt-3 text-sm text-primary hover:underline font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="mt-12 bg-slate-50 border border-slate-200 rounded-xl p-7">
          <h3 className="font-bold text-foreground mb-2">More in development</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Early concepts and unverified work remain internal until they have an approved public record and appropriate evidence.
          </p>
        </div>
      </div>
    </div>
  );
}
