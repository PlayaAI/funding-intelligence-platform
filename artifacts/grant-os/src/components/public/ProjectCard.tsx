import { Link } from "wouter";
import { ArrowRight, FileText } from "lucide-react";
import { Project } from "@/data/projects";
import StatusBadge from "./StatusBadge";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  className?: string;
}

export default function ProjectCard({ project, className }: ProjectCardProps) {
  const isConnectApp = project.slug === "connect-app";
  return (
    <div
      className={cn(
        "group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 flex flex-col",
        className
      )}
      data-testid={`project-card-${project.slug}`}
    >
      <div className={cn("h-1 w-full", isConnectApp ? "bg-primary" : "bg-border")} />

      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge label={project.status} variant={project.statusVariant} />
            <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5 bg-secondary/50">
              {project.category}
            </span>
          </div>
          {isConnectApp && (
            <span className="text-xs font-semibold text-primary border border-primary/20 bg-primary/5 rounded-full px-2.5 py-0.5 shrink-0">
              Flagship
            </span>
          )}
        </div>

        <h3 className="font-bold text-foreground text-lg mb-2 leading-snug">{project.name}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">{project.summary}</p>

        {project.grantRelevance && (
          <div className="mt-4 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
            <p className="text-xs text-primary/80 leading-relaxed">
              <span className="font-semibold text-primary">Grant relevance:</span>{" "}
              {project.grantRelevance}
            </p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center">
              <FileText className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {project.proofCount} proof item{project.proofCount !== 1 ? "s" : ""}
            </span>
          </div>

          {isConnectApp ? (
            <Link
              href="/projects/connect-app"
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              data-testid="project-card-case-study-link"
            >
              View case study
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground/50 italic">Detail coming</span>
          )}
        </div>
      </div>
    </div>
  );
}
