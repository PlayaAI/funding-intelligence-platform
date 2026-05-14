import { FileText, Presentation, BarChart3, Monitor, MessageSquare } from "lucide-react";
import { ProofItem, ProofItemType, proofTypeLabels } from "@/data/proofItems";
import { cn } from "@/lib/utils";

const typeIcons: Record<ProofItemType, React.ReactNode> = {
  workshop: <Presentation className="w-4 h-4" />,
  app_demo: <Monitor className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  metric: <BarChart3 className="w-4 h-4" />,
  testimonial: <MessageSquare className="w-4 h-4" />,
};

const typeColors: Record<ProofItemType, string> = {
  workshop: "bg-violet-50 text-violet-600 border-violet-200",
  app_demo: "bg-blue-50 text-blue-600 border-blue-200",
  document: "bg-slate-100 text-slate-600 border-slate-200",
  metric: "bg-emerald-50 text-emerald-600 border-emerald-200",
  testimonial: "bg-amber-50 text-amber-600 border-amber-200",
};

const typeLabelColors: Record<ProofItemType, string> = {
  workshop: "text-violet-700 bg-violet-50 border-violet-200",
  app_demo: "text-blue-700 bg-blue-50 border-blue-200",
  document: "text-slate-600 bg-slate-100 border-slate-200",
  metric: "text-emerald-700 bg-emerald-50 border-emerald-200",
  testimonial: "text-amber-700 bg-amber-50 border-amber-200",
};

interface ProofItemCardProps {
  item: ProofItem;
  className?: string;
}

export default function ProofItemCard({ item, className }: ProofItemCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/30 hover:shadow-md transition-all duration-200 overflow-hidden",
        className
      )}
      data-testid={`proof-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0", typeColors[item.type])}>
            {typeIcons[item.type]}
          </div>
          <span className={cn("text-xs font-semibold border rounded-full px-2.5 py-0.5", typeLabelColors[item.type])}>
            {proofTypeLabels[item.type]}
          </span>
        </div>
        {item.date && (
          <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{item.date}</span>
        )}
      </div>

      <h3 className="font-semibold text-foreground text-sm leading-snug">{item.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{item.description}</p>

      <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-2 border-t border-border">
        {item.projectName && (
          <span className="text-xs text-primary border border-primary/20 bg-primary/5 rounded-full px-2 py-0.5 font-medium">
            {item.projectName}
          </span>
        )}
        {item.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-xs text-muted-foreground/80 bg-secondary rounded-full px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
