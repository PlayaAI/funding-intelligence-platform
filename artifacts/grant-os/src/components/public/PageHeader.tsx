import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  serif?: boolean;
}

export default function PageHeader({ label, title, subtitle, children, className, serif = false }: PageHeaderProps) {
  return (
    <div className={cn("py-14 sm:py-20 border-b border-border bg-gradient-to-b from-slate-50 to-background", className)}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {label && (
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-4 h-px bg-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">{label}</p>
          </div>
        )}
        <h1 className={cn(
          "text-3xl sm:text-5xl font-bold text-foreground leading-tight tracking-tight max-w-3xl",
          serif && "font-serif"
        )}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>
        )}
        {children && <div className="mt-7">{children}</div>}
      </div>
    </div>
  );
}
