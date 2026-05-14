import { cn } from "@/lib/utils";
import { Project } from "@/data/projects";

type Variant = Project["statusVariant"] | "workshop" | "metric" | "document" | "app_demo" | "testimonial";

const variantStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  live: "bg-blue-50 text-blue-700 border-blue-200",
  prototype: "bg-amber-50 text-amber-700 border-amber-200",
  published: "bg-violet-50 text-violet-700 border-violet-200",
  workshop: "bg-orange-50 text-orange-700 border-orange-200",
  app_demo: "bg-blue-50 text-blue-700 border-blue-200",
  document: "bg-slate-50 text-slate-700 border-slate-200",
  metric: "bg-emerald-50 text-emerald-700 border-emerald-200",
  testimonial: "bg-rose-50 text-rose-700 border-rose-200",
};

interface StatusBadgeProps {
  label: string;
  variant?: Variant;
  className?: string;
}

export default function StatusBadge({ label, variant, className }: StatusBadgeProps) {
  const style = variant ? variantStyles[variant] : "bg-secondary text-secondary-foreground border-secondary";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
