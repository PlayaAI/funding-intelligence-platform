import { Link } from "wouter";
import { useState, type ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSetGrantTopThree } from "@/hooks/useGrants";
import { toast } from "@/hooks/use-toast";
import type { Grant } from "@/data/grants";
import { deriveGrantDataQualityFlags } from "@/lib/grantDataQuality";
import { GrantDataQualityBadges } from "@/components/dashboard/GrantDataQualityBadges";
import {
  AlertTriangle,
  Star,
  ArrowRight,
  CheckCircle2,
  Eye,
  PauseCircle,
  HelpCircle,
  XCircle,
  StarOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DecisionLabel =
  | "Apply now"
  | "Prepare first"
  | "Monitor"
  | "Needs Alex decision"
  | "Skip / ineligible";

interface GrantReviewSignal {
  decision: DecisionLabel;
  warnings: string[];
  /** If non-null, this overrides the derived decision label entirely */
  overrideReason?: string;
}

// ─── Decision derivation ──────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (Number.isNaN(diff)) return Infinity;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string) {
  if (!dateStr) return "Deadline unknown";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Derives a recommended decision label and warning text for a Top 3 grant
 * entirely from existing mapped fields — no new DB fields required.
 */
function deriveSignal(g: Grant): GrantReviewSignal {
  const warnings: string[] = [];
  const days = daysUntil(g.deadline);

  if (days <= 0 && g.deadline) warnings.push("Past deadline — check if a new round is open.");
  if (days > 0 && days <= 14) warnings.push(`Deadline in ${days} days — urgent action needed.`);
  if (!g.deadline) warnings.push("Deadline unknown or unverified — confirm before committing effort.");
  if (g.fitScore > 0 && g.fitScore < 50) warnings.push("Low fit score — review eligibility carefully.");
  if (!g.fitScore) warnings.push("No fit score recorded — match quality unverified.");

  let decision: DecisionLabel = "Monitor";

  if (["Declined", "Archived"].includes(g.status)) {
    decision = "Skip / ineligible";
  } else if (g.fitScore >= 70 && days > 14 && days !== Infinity) {
    decision = "Apply now";
  } else if (g.fitScore >= 50 && days > 0) {
    decision = "Prepare first";
  } else if (!g.deadline || days === Infinity) {
    decision = "Monitor";
  } else if (days <= 0) {
    decision = "Monitor";
  } else {
    decision = "Needs Alex decision";
  }

  return { decision, warnings };
}

// ─── Curated overrides (derived from known context, per issue request) ─────────

const CURATED_OVERRIDES: Record<string, { decision: DecisionLabel; reason: string }> = {
  // Key by funder name substring (lowercase) — matched case-insensitively
  mozilla: {
    decision: "Needs Alex decision",
    reason:
      "Not active priority unless Alex confirms eligible U.S. university-led applicant path.",
  },
  ngi: {
    decision: "Monitor",
    reason:
      "Monitor only until live Commons route and applicant fit are confirmed. Do not treat as apply-now.",
  },
  sff: {
    decision: "Apply now",
    reason:
      "Verify current round award size separately from fund-level annual deployment.",
  },
};

function getCuratedOverride(g: Grant) {
  const funder = (g.funderName ?? "").toLowerCase();
  const title = (g.title ?? "").toLowerCase();
  for (const [key, override] of Object.entries(CURATED_OVERRIDES)) {
    if (funder.includes(key) || title.includes(key)) return override;
  }
  return null;
}

// ─── Label appearance ─────────────────────────────────────────────────────────

const DECISION_STYLES: Record<DecisionLabel, string> = {
  "Apply now": "bg-green-100 text-green-800 border-green-200",
  "Prepare first": "bg-blue-100 text-blue-800 border-blue-200",
  "Monitor": "bg-amber-100 text-amber-800 border-amber-200",
  "Needs Alex decision": "bg-violet-100 text-violet-800 border-violet-200",
  "Skip / ineligible": "bg-slate-100 text-slate-600 border-slate-200",
};

const DECISION_ICONS: Record<DecisionLabel, ComponentType<LucideProps>> = {
  "Apply now": CheckCircle2,
  "Prepare first": Star,
  "Monitor": Eye,
  "Needs Alex decision": HelpCircle,
  "Skip / ineligible": XCircle,
};

// ─── Single grant row ─────────────────────────────────────────────────────────

interface Top3GrantReviewRowProps {
  grant: Grant;
}

function Top3GrantReviewRow({ grant: g }: Top3GrantReviewRowProps) {
  const { mutate: setTopThree, isPending } = useSetGrantTopThree();
  const [confirming, setConfirming] = useState(false);

  const days = daysUntil(g.deadline);
  const signal = deriveSignal(g);
  const curated = getCuratedOverride(g);

  const finalDecision = curated?.decision ?? signal.decision;
  const finalReason = curated?.reason ?? null;
  const warnings = signal.warnings;

  const DecisionIcon = DECISION_ICONS[finalDecision];

  function handleRemoveTop3() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setTopThree(
      { id: g.id, isTopThree: false },
      {
        onSuccess: () => {
          toast({ title: "Removed from Top 3", description: `"${g.title}" is no longer a Top 3 priority.` });
          setConfirming(false);
        },
        onError: (err) => {
          toast({ title: "Error", description: String(err), variant: "destructive" });
          setConfirming(false);
        },
      },
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 p-3 pb-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-slate-900 leading-snug truncate">{g.title}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {g.funderName}
            {g.deadline && (
              <span className="ml-2">
                ·{" "}
                <span className={days <= 0 ? "text-red-600 font-medium" : days <= 14 ? "text-red-500 font-medium" : days <= 30 ? "text-amber-600" : "text-slate-500"}>
                  {days <= 0 ? `Past deadline (${formatDate(g.deadline)})` : `${formatDate(g.deadline)} · ${days}d left`}
                </span>
              </span>
            )}
            {!g.deadline && <span className="ml-2 text-slate-400">· No deadline</span>}
          </div>
        </div>

        {/* Decision badge */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={`text-[11px] px-2 py-0.5 flex items-center gap-1 ${DECISION_STYLES[finalDecision]}`}
          >
            <DecisionIcon size={11} />
            {finalDecision}
          </Badge>
          {g.fitScore > 0 && (
            <span className="text-[11px] text-slate-400 font-medium">Fit {g.fitScore}%</span>
          )}
        </div>
      </div>

      {/* Reason / curated note */}
      {(finalReason || warnings.length > 0) && (
        <div className="px-3 pb-2 space-y-1">
          {finalReason && (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <span>{finalReason}</span>
            </div>
          )}
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0 text-slate-400" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Data quality flag badges */}
      {(() => {
        const dqFlags = deriveGrantDataQualityFlags({
          deadline: g.deadline || null,
          amount_min: g.amountMin,
          amount_max: g.amountMax,
          eligibility: g.eligibility || null,
          notes: g.notes || null,
          application_url: g.applicationUrl || null,
        });
        return dqFlags.length > 0 ? (
          <div className="px-3 pb-2">
            <GrantDataQualityBadges flags={dqFlags} maxVisible={3} />
          </div>
        ) : null;
      })()}

      {/* Action row */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t border-slate-100 mt-1">
        <Link href={`/dashboard/grants/${g.id}`}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
            <ArrowRight size={11} />
            Open grant
          </Button>
        </Link>

        {confirming ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={handleRemoveTop3}
              disabled={isPending}
            >
              Confirm remove
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-500 gap-1.5 hover:text-slate-900"
            onClick={handleRemoveTop3}
            disabled={isPending}
          >
            <StarOff size={11} />
            Remove from Top 3
          </Button>
        )}

        {finalDecision !== "Monitor" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-amber-600 gap-1.5 hover:bg-amber-50"
            onClick={() => {
              // Mark as Monitor by showing a toast instructing to update status in grant detail
              // (no direct status update from this panel per scope rules — use existing grant detail page)
              toast({
                title: "Open the grant to update status",
                description: `Navigate to "${g.title}" and set the status to monitor.`,
              });
            }}
          >
            <PauseCircle size={11} />
            Mark Monitor
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface Top3ReviewPanelProps {
  grants: Grant[];
}

export function Top3ReviewPanel({ grants }: Top3ReviewPanelProps) {
  const top3 = grants.filter((g) => g.isTop3);

  if (top3.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900">
            <AlertTriangle size={14} className="text-amber-500" />
            Top 3 Review — Action Needed
          </CardTitle>
          <Link href="/dashboard/grants">
            <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-amber-700 hover:text-amber-900">
              Manage grants <ArrowRight size={12} />
            </Button>
          </Link>
        </div>
        <p className="text-xs text-amber-700 mt-0.5">
          Review recommended decisions before committing effort. Remove stale entries to keep Top 3 accurate.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {top3.map((g) => (
          <Top3GrantReviewRow key={g.id} grant={g} />
        ))}
      </CardContent>
    </Card>
  );
}
