import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  value: number;
  className?: string;
}

function scoreColor(v: number) {
  if (v >= 80) return "bg-green-500";
  if (v >= 60) return "bg-amber-400";
  return "bg-red-400";
}

export default function ScoreBar({ label, value, className }: ScoreBarProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", scoreColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
