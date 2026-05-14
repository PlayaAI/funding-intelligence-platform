import { MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { Workshop } from "@/data/workshops";
import { cn } from "@/lib/utils";

interface WorkshopCardProps {
  workshop: Workshop;
  className?: string;
}

export default function WorkshopCard({ workshop, className }: WorkshopCardProps) {
  return (
    <div
      className={cn("bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-200", className)}
      data-testid={`workshop-card-${workshop.id}`}
    >
      <div className="h-1 bg-gradient-to-r from-primary/60 to-primary/20" />
      <div className="p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-foreground text-lg leading-snug mb-3">{workshop.title}</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary border border-border rounded-full px-2.5 py-1">
              <Calendar className="w-3 h-3" />
              {workshop.date}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary border border-border rounded-full px-2.5 py-1">
              <MapPin className="w-3 h-3" />
              {workshop.location}
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{workshop.summary}</p>

        {workshop.outputs.length > 0 && (
          <div className="bg-secondary/50 rounded-lg p-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Outputs</p>
            <ul className="space-y-2">
              {workshop.outputs.map((output) => (
                <li key={output} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{output}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {workshop.projectNames.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
            <span className="text-xs font-medium text-muted-foreground">Projects:</span>
            {workshop.projectNames.map((name) => (
              <span key={name} className="text-xs border border-primary/20 bg-primary/5 rounded-full px-2 py-0.5 text-primary font-medium">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
