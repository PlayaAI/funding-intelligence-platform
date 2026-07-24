import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { AlertTriangle, CheckCircle2, Clock3, Copy, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  approveMutationApproval,
  expireMutationApproval,
  getMutationApproval,
  listMutationApprovals,
  rejectMutationApproval,
} from "@/lib/agent-mcp/agentMutationApprovalClient";
import type {
  AgentMutationApprovalEventRow,
  AgentMutationApprovalRow,
  AgentMutationApprovalStatus,
} from "@/types/database";

const statusTone: Record<AgentMutationApprovalStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  executing: "secondary",
  executed: "outline",
  rejected: "destructive",
  expired: "secondary",
  failed: "destructive",
};

function compactJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default function DashboardAgentApprovalsPage() {
  const [, params] = useRoute("/dashboard/agent-approvals/:id");
  const [, setLocation] = useLocation();
  const [approvals, setApprovals] = useState<AgentMutationApprovalRow[]>([]);
  const [selected, setSelected] = useState<AgentMutationApprovalRow | null>(null);
  const [events, setEvents] = useState<AgentMutationApprovalEventRow[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [filter, setFilter] = useState<AgentMutationApprovalStatus | "all">("pending");
  const [rejectReason, setRejectReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approvalId = params?.id;

  const refreshList = async () => {
    const result = await listMutationApprovals(filter === "all" ? undefined : filter);
    setApprovals(result.approvals);
    setCanApprove(result.canApprove);
  };

  const refreshDetail = async (id: string) => {
    const result = await getMutationApproval(id);
    setSelected(result.approval);
    setEvents(result.events);
    setCanApprove(result.canApprove);
  };

  useEffect(() => {
    setError(null);
    void refreshList().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load approvals."));
  }, [filter]);

  useEffect(() => {
    if (!approvalId) {
      setSelected(null);
      setEvents([]);
      return;
    }
    setError(null);
    void refreshDetail(approvalId).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load approval."));
  }, [approvalId]);

  const counts = useMemo(() => ({
    pending: approvals.filter((approval) => approval.status === "pending").length,
    executing: approvals.filter((approval) => approval.status === "executing").length,
    failed: approvals.filter((approval) => approval.status === "failed").length,
  }), [approvals]);

  const runAction = async (action: "approve" | "reject" | "expire") => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "approve") await approveMutationApproval(selected.id);
      if (action === "reject") await rejectMutationApproval(selected.id, rejectReason);
      if (action === "expire") await expireMutationApproval(selected.id);
      setConfirmOpen(false);
      setRejectReason("");
      await Promise.all([refreshList(), refreshDetail(selected.id)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approval action failed.");
    } finally {
      setBusy(false);
    }
  };

  const auditExport = selected ? {
    approval: selected,
    events,
  } : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={19} />
            Agent Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review MCP dry-run plans. Approved mutations execute with your authenticated Supabase session and remain subject to RLS.
          </p>
        </div>
        {selected && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void navigator.clipboard.writeText(compactJson(auditExport))}
          >
            <Copy size={14} className="mr-1.5" />
            Copy audit details
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Pending in view" value={counts.pending} icon={<Clock3 size={16} />} />
        <SummaryCard label="Executing in view" value={counts.executing} icon={<ShieldCheck size={16} />} />
        <SummaryCard label="Failed in view" value={counts.failed} icon={<AlertTriangle size={16} />} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["pending", "executing", "executed", "rejected", "expired", "failed", "all"] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filter === status ? "default" : "outline"}
            onClick={() => setFilter(status)}
          >
            {status}
          </Button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Approval queue</CardTitle>
            <CardDescription className="text-xs">Select a request to inspect the exact plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvals.length === 0 && (
              <div className="rounded border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                No {filter === "all" ? "" : filter} approvals.
              </div>
            )}
            {approvals.map((approval) => (
              <Link key={approval.id} href={`/dashboard/agent-approvals/${approval.id}`}>
                <div className={`cursor-pointer rounded border p-3 transition-colors ${approval.id === approvalId ? "border-primary bg-primary/5" : "border-slate-200 hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{approval.requested_tool}</div>
                      <div className="truncate text-xs text-slate-500">{approval.requested_by_agent_label || "Unnamed agent"}</div>
                    </div>
                    <Badge variant={statusTone[approval.status]}>{approval.status}</Badge>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {new Date(approval.created_at).toLocaleString()} · {approval.affected_record_ids.length} affected IDs
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {!selected ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="flex min-h-64 items-center justify-center text-sm text-slate-500">
              Select an approval to inspect before/after details.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{selected.requested_tool}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Requested by {selected.requested_by_agent_label || "Unnamed agent"} · expires {new Date(selected.expires_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge variant={statusTone[selected.status]}>{selected.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected.risk_warnings.length > 0 && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold text-amber-950">Risk warnings</div>
                    <ul className="mt-1 list-disc pl-4 text-xs text-amber-900">
                      {selected.risk_warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  </div>
                )}
                <DetailBlock label="Affected record IDs" value={selected.affected_record_ids.length ? selected.affected_record_ids.join("\n") : "New records will receive IDs after execution."} />
                <DetailBlock label="Request arguments" value={compactJson(selected.request_arguments)} code />
                <DetailBlock label="Approved plan" value={compactJson(selected.planned_mutation)} code />
                <DetailBlock label="Payload hash" value={selected.payload_hash} code />

                {selected.status === "pending" && canApprove && (
                  <div className="space-y-3 rounded border border-slate-200 p-3">
                    <div className="text-sm font-semibold">Operator decision</div>
                    <p className="text-xs text-slate-500">
                      Approval reruns validation and compares the payload hash before committing with your user session.
                    </p>
                    <Textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Optional rejection reason"
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={busy} onClick={() => setConfirmOpen(true)}>
                        <CheckCircle2 size={14} className="mr-1.5" />
                        Approve & execute
                      </Button>
                      <Button variant="destructive" disabled={busy} onClick={() => void runAction("reject")}>
                        <XCircle size={14} className="mr-1.5" />
                        Reject
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={() => void runAction("expire")}>
                        Expire
                      </Button>
                    </div>
                  </div>
                )}

                {selected.result_payload && (
                  <DetailBlock label="Execution result/readback" value={compactJson(selected.result_payload)} code />
                )}
                {selected.error_code && (
                  <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    <strong>{selected.error_code}:</strong> {selected.error_message}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Audit timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {events.length === 0 && <div className="text-sm text-slate-500">No audit events available.</div>}
                {events.map((event) => (
                  <div key={event.id} className="rounded border border-slate-200 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{event.event_type}</span>
                      <span className="text-slate-500">{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-slate-500">
                      {event.actor_type} · {event.write_disposition} · mutation {event.mutation_performed ? "performed" : "not performed"}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve and execute this mutation?</AlertDialogTitle>
            <AlertDialogDescription>
              Grant OS will rerun the dry-run, verify the payload hash and current records, claim the request once, then execute with your authenticated Supabase session. This cannot submit applications or send outreach.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void runAction("approve"); }}>
              {busy ? "Executing…" : "Approve & execute"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
        <div className="text-slate-400">{icon}</div>
      </CardContent>
    </Card>
  );
}

function DetailBlock({ label, value, code = false }: { label: string; value: string; code?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-700">{label}</div>
      {code ? (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950 p-3 text-xs text-slate-100">{value}</pre>
      ) : (
        <div className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{value}</div>
      )}
    </div>
  );
}
