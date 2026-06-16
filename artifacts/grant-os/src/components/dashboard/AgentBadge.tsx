import { Badge } from "@/components/ui/badge";
import type { AgentNoteType, AgentReportType, AgentSource } from "@/types/database";

const SOURCE_LABELS: Record<AgentSource, string> = {
  human: "Human",
  openclaw: "OpenClaw",
  codex: "Codex",
  import: "Import",
  external_agent: "External Agent",
};

export function AgentSourceBadge({ source }: { source: AgentSource }) {
  const tone = source === "human" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700 border-blue-200";
  return <Badge variant="outline" className={`text-[11px] ${tone}`}>{SOURCE_LABELS[source] ?? source}</Badge>;
}

export function AgentTypeBadge({ type }: { type: AgentNoteType | AgentReportType }) {
  return <Badge variant="secondary" className="text-[11px]">{type.replace(/_/g, " ")}</Badge>;
}

/**
 * Distinguishes how a grant match was generated.
 * - "rules_engine" → System match (slate)
 * - anything else  → Agent match · {source} (blue)
 */
export function MatchGeneratedByBadge({ generatedBy }: { generatedBy: string }) {
  const isAgent = generatedBy !== "rules_engine";
  const tone = isAgent
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-slate-100 text-slate-600 border-slate-200";
  const label = isAgent ? `Agent match · ${generatedBy}` : "System match";
  return (
    <Badge variant="outline" className={`text-[11px] ${tone}`}>
      {label}
    </Badge>
  );
}
