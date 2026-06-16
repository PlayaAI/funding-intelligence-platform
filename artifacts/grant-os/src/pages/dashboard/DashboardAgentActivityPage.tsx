import { useMemo, useState } from "react";
import { Bot, Clock, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentActivity } from "@/hooks/useAgentActivity";
import { AgentSourceBadge } from "@/components/dashboard/AgentBadge";
import type {
  AgentActivityActionType,
  AgentActivityStatus,
  AgentSource,
  Json,
} from "@/types/database";

// ──────────────────────────────────────────────────────────────
// Security: redact sensitive metadata fields before any display.
// Matches keys containing: token, key, secret, auth, password,
// bearer, session, or credential (case-insensitive).
// ──────────────────────────────────────────────────────────────
const SENSITIVE_PATTERNS = [
  /token/i,
  /\bkey\b/i,
  /secret/i,
  /\bauth\b/i,
  /password/i,
  /bearer/i,
  /session/i,
  /credential/i,
];

function isSensitiveKey(k: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(k));
}

function redactMetadata(metadata: Json | null): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(
    metadata as Record<string, unknown>
  )) {
    out[k] = isSensitiveKey(k) ? "[REDACTED]" : v;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_CLASSES: Record<AgentActivityStatus, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const ACTION_LABELS: Record<AgentActivityActionType, string> = {
  import_completed: "Import",
  note_created: "Note created",
  report_generated: "Report generated",
  status_updated: "Status updated",
  task_created: "Task created",
  data_reviewed: "Data reviewed",
  export_created: "Export",
  manual_entry: "Manual entry",
};

// ──────────────────────────────────────────────────────────────
// Page component
// ──────────────────────────────────────────────────────────────
export default function DashboardAgentActivityPage() {
  const { data: logs = [], isLoading, isError, error } = useAgentActivity(200);

  const [filterStatus, setFilterStatus] = useState<"all" | AgentActivityStatus>(
    "all"
  );
  const [filterSource, setFilterSource] = useState<"all" | AgentSource>("all");
  const [filterAction, setFilterAction] = useState<
    "all" | AgentActivityActionType
  >("all");

  const hasActiveFilters =
    filterStatus !== "all" || filterSource !== "all" || filterAction !== "all";

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filterStatus !== "all" && log.status !== filterStatus) return false;
      if (filterSource !== "all" && log.actor_source !== filterSource)
        return false;
      if (filterAction !== "all" && log.action_type !== filterAction)
        return false;
      return true;
    });
  }, [logs, filterStatus, filterSource, filterAction]);

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterSource("all");
    setFilterAction("all");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Bot size={18} />
          Agent Activity
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Recent human and agent actions recorded in Grant OS. Sensitive metadata
          fields are redacted before display.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filterStatus}
          onValueChange={(v) =>
            setFilterStatus(v as "all" | AgentActivityStatus)
          }
        >
          <SelectTrigger className="h-8 text-xs w-36" id="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterSource}
          onValueChange={(v) => setFilterSource(v as "all" | AgentSource)}
        >
          <SelectTrigger className="h-8 text-xs w-40" id="filter-source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="human">Human</SelectItem>
            <SelectItem value="openclaw">OpenClaw</SelectItem>
            <SelectItem value="codex">Codex</SelectItem>
            <SelectItem value="import">Import</SelectItem>
            <SelectItem value="external_agent">External Agent</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterAction}
          onValueChange={(v) =>
            setFilterAction(v as "all" | AgentActivityActionType)
          }
        >
          <SelectTrigger className="h-8 text-xs w-44" id="filter-action">
            <SelectValue placeholder="Action type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="note_created">Note created</SelectItem>
            <SelectItem value="report_generated">Report generated</SelectItem>
            <SelectItem value="import_completed">Import</SelectItem>
            <SelectItem value="task_created">Task created</SelectItem>
            <SelectItem value="export_created">Export</SelectItem>
            <SelectItem value="status_updated">Status updated</SelectItem>
            <SelectItem value="data_reviewed">Data reviewed</SelectItem>
            <SelectItem value="manual_entry">Manual entry</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            type="button"
            className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800 underline"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}

        {!isLoading && (
          <span className="h-8 flex items-center text-xs text-slate-400 ml-auto">
            {filtered.length} of {logs.length}{" "}
            {logs.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Loading activity…
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-sm text-red-600">
          Could not load activity:{" "}
          {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {/* Empty — no data at all */}
      {!isLoading && logs.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <Bot size={28} className="mx-auto text-slate-300 mb-3" />
            <div className="text-sm font-medium text-slate-700">
              No agent activity recorded yet
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Actions like note creation, exports, imports, and agent tool calls
              will appear here once they are recorded.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty — filters exclude everything */}
      {!isLoading && logs.length > 0 && filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-400">
            No activity matches the current filters.
          </CardContent>
        </Card>
      )}

      {/* Activity list */}
      <div className="space-y-3">
        {filtered.map((log) => {
          const redacted = redactMetadata(log.metadata);
          const hasMetadata =
            redacted && Object.keys(redacted).length > 0;

          return (
            <Card key={log.id} className="border-slate-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Left: title / description / links / timestamp */}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-slate-800">
                      {log.title}
                    </div>
                    {log.description && (
                      <p className="text-xs text-slate-500 mt-1">
                        {log.description}
                      </p>
                    )}

                    {/* Related entity links */}
                    {(log.related_grant_id ||
                      log.related_application_id) && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {log.related_grant_id && (
                          <Link
                            href={`/dashboard/grants/${log.related_grant_id}`}
                          >
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                              <ExternalLink size={10} />
                              View grant
                            </span>
                          </Link>
                        )}
                        {log.related_application_id && (
                          <Link
                            href={`/dashboard/applications/${log.related_application_id}`}
                          >
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                              <ExternalLink size={10} />
                              View application
                            </span>
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                      <Clock size={10} />
                      <span
                        title={new Date(log.created_at).toLocaleString()}
                      >
                        {relativeTime(log.created_at)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>
                        {new Date(log.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Right: badges */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <AgentSourceBadge source={log.actor_source} />
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${STATUS_CLASSES[log.status]}`}
                    >
                      {log.status}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {ACTION_LABELS[log.action_type] ??
                        log.action_type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                {/* Expandable metadata (sensitive fields redacted) */}
                {hasMetadata && (
                  <details className="mt-3 rounded border border-slate-200 bg-slate-50">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-500">
                      Metadata details (sensitive fields redacted)
                    </summary>
                    <pre className="px-3 pb-3 pt-1 text-[11px] text-slate-600 overflow-auto max-h-40 whitespace-pre-wrap">
                      {JSON.stringify(redacted, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
