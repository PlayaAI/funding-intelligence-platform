/**
 * GrantDataQualityBadges.tsx
 *
 * Compact, reusable UI for displaying grant data-quality warning flags.
 *
 * Usage:
 *   <GrantDataQualityBadges flags={flags} />                         // just badges
 *   <GrantDataQualityCard flags={flags} />                           // full card for grant detail
 */
import { AlertTriangle, AlertCircle, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type DataQualityFlag, getDataQualityNextCheck } from "@/lib/grantDataQuality";

// ─── Severity appearance ──────────────────────────────────────────────────────

const SEVERITY_BADGE_CLASS: Record<DataQualityFlag["severity"], string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  warn: "bg-amber-100 text-amber-800 border-amber-200",
  info: "bg-slate-100 text-slate-600 border-slate-200",
};

const SEVERITY_ICON: Record<DataQualityFlag["severity"], typeof AlertTriangle> = {
  critical: ShieldAlert,
  warn: AlertTriangle,
  info: Info,
};

// ─── Compact badge strip ──────────────────────────────────────────────────────

interface GrantDataQualityBadgesProps {
  flags: DataQualityFlag[];
  /** Max badges to show before collapsing with "+N more". Default 4. */
  maxVisible?: number;
}

export function GrantDataQualityBadges({ flags, maxVisible = 4 }: GrantDataQualityBadgesProps) {
  if (flags.length === 0) return null;

  const visible = flags.slice(0, maxVisible);
  const hidden = flags.length - visible.length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((flag) => {
          const Icon = SEVERITY_ICON[flag.severity];
          return (
            <Tooltip key={flag.key}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 cursor-default select-none ${SEVERITY_BADGE_CLASS[flag.severity]}`}
                >
                  <Icon size={9} />
                  {flag.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                {flag.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {hidden > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 cursor-default select-none bg-slate-50 text-slate-500 border-slate-200"
              >
                +{hidden} more
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs space-y-1">
              {flags.slice(maxVisible).map((f) => (
                <div key={f.key} className="leading-snug">
                  <span className="font-medium">{f.label}:</span> {f.description}
                </div>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Full detail card ─────────────────────────────────────────────────────────

interface GrantDataQualityCardProps {
  flags: DataQualityFlag[];
}

export function GrantDataQualityCard({ flags }: GrantDataQualityCardProps) {
  const nextCheck = getDataQualityNextCheck(flags);
  const hasCritical = flags.some((f) => f.severity === "critical");
  const hasWarn = flags.some((f) => f.severity === "warn");

  const cardClass = hasCritical
    ? "border-red-200 bg-red-50/30"
    : hasWarn
    ? "border-amber-200 bg-amber-50/30"
    : "border-slate-200";

  const titleClass = hasCritical
    ? "text-red-900"
    : hasWarn
    ? "text-amber-900"
    : "text-slate-800";

  if (flags.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-green-800">
            <AlertCircle size={14} className="text-green-500" />
            Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-green-700">No data quality flags detected for this grant.</p>
          <p className="text-[11px] text-slate-500 mt-2">
            Data quality flags are advisory. Verify official source pages before applying.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClass}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm flex items-center gap-2 ${titleClass}`}>
          <AlertTriangle size={14} className={hasCritical ? "text-red-500" : "text-amber-500"} />
          Data Quality ({flags.length} flag{flags.length === 1 ? "" : "s"})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {flags.map((flag) => {
            const Icon = SEVERITY_ICON[flag.severity];
            return (
              <div
                key={flag.key}
                className={`flex items-start gap-2 text-xs rounded px-2 py-1.5 border ${SEVERITY_BADGE_CLASS[flag.severity]}`}
                style={{ width: "100%" }}
              >
                <Icon size={12} className="mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">{flag.label}</span>
                  <span className="ml-1 text-inherit opacity-80">— {flag.description}</span>
                </div>
              </div>
            );
          })}
        </div>

        {nextCheck && (
          <div className="text-xs text-slate-600 border-t border-slate-200 pt-2">
            <span className="font-medium">Recommended next check: </span>
            {nextCheck}
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          Data quality flags are advisory. Verify official source pages before applying.
        </p>
      </CardContent>
    </Card>
  );
}
