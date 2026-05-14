import { useState } from "react";
import { projects } from "@/data/projects";
import ProjectCard from "@/components/public/ProjectCard";
import PageHeader from "@/components/public/PageHeader";

const allCategories = ["All", ...Array.from(new Set(projects.map((p) => p.category)))];
const allStatuses = ["All", ...Array.from(new Set(projects.map((p) => p.status)))];

export default function ProjectsPage() {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = projects.filter((p) => {
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
            Additional projects — including Democracy 2.0, Decommodified Data Set, and Tech for Human Flourishing — are in early planning or have been explored in workshop settings. This portfolio represents active and documented work.
          </p>
        </div>
      </div>
    </div>
  );
}
