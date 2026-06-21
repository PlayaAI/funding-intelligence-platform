import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useKnowledgeProposals, useApproveKnowledgeProposal, useRejectKnowledgeProposal } from "@/hooks/useAgentKnowledge";
import { usePermissions } from "@/hooks/usePermissions";
import { AgentKnowledgeProposalFormDialog } from "./AgentKnowledgeProposalFormDialog";

export function AgentKnowledgeProposalsTab() {
  const { data: proposals, isLoading } = useKnowledgeProposals();
  const approveMutation = useApproveKnowledgeProposal();
  const rejectMutation = useRejectKnowledgeProposal();
  const { isAdmin } = usePermissions();

  const [formOpen, setFormOpen] = useState(false);

  const pendingProposals = proposals?.filter(p => p.status === "pending_review") || [];
  const handledProposals = proposals?.filter(p => p.status === "approved" || p.status === "rejected") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            Proposed Updates
          </h2>
          <p className="text-xs text-slate-500">
            Instructions from users or observations from Hermes awaiting admin approval.
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <PlusCircle size={14} className="mr-1.5" />
          Propose Instruction
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-500">Loading proposals...</div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pending Review ({pendingProposals.length})</h3>
            {pendingProposals.length === 0 ? (
              <Card className="border-slate-200 bg-slate-50 border-dashed">
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-slate-500">No pending proposals.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingProposals.map(p => (
                  <Card key={p.id} className={p.risk_level === 'high' ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30'}>
                    <CardHeader className="pb-2 flex flex-row items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            {{
                              always_rule: "Always do this",
                              never_rule: "Never do this",
                              do_not_use_rule: "Mark as do-not-use",
                              add: "Add new knowledge",
                              edit: "Edit existing knowledge",
                              archive: "Archive existing knowledge",
                              conflict_alert: "Conflict alert"
                            }[p.proposal_type] || p.proposal_type.replace(/_/g, ' ')}
                          </Badge>
                          {p.risk_level === 'high' && <Badge variant="destructive" className="text-[10px]">High Risk</Badge>}
                        </div>
                        <CardTitle className="text-sm">{p.title}</CardTitle>
                        <CardDescription className="text-xs mt-1">Source: {p.source_type?.replace(/_/g, ' ') || 'Unknown'}</CardDescription>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-white hover:bg-red-50 hover:text-red-600 border-slate-200" onClick={() => {
                            const notes = prompt("Rejection reason (optional):");
                            if (notes !== null) {
                              rejectMutation.mutate({ id: p.id, reviewerNotes: notes });
                            }
                          }} disabled={rejectMutation.isPending || approveMutation.isPending}>
                            <XCircle size={14} className="mr-1" /> Reject
                          </Button>
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                            if (confirm("Approve this instruction? It will become active knowledge for Hermes immediately.")) {
                              approveMutation.mutate(p.id);
                            }
                          }} disabled={approveMutation.isPending || rejectMutation.isPending}>
                            <CheckCircle size={14} className="mr-1" /> Approve
                          </Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm bg-white p-3 rounded-md border border-slate-100 whitespace-pre-wrap">
                        {p.proposed_content}
                      </div>
                      {p.rationale && (
                        <div className="text-xs text-slate-600 bg-white/50 p-2 rounded italic border border-slate-100">
                          <span className="font-semibold not-italic">Rationale:</span> {p.rationale}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span>Proposed {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {handledProposals.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recently Handled</h3>
              <div className="space-y-2">
                {handledProposals.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs p-3 rounded-md border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                      {p.status === 'approved' ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : (
                        <XCircle size={14} className="text-red-500" />
                      )}
                      <span className="font-medium text-slate-700">{p.title}</span>
                      <span className="text-slate-400 hidden sm:inline truncate max-w-[200px]">{p.proposed_content}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px] font-normal capitalize">
                        {p.status}
                      </Badge>
                      <span className="text-slate-500 w-24 text-right">
                        {p.reviewed_at ? formatDistanceToNow(new Date(p.reviewed_at), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {formOpen && (
        <AgentKnowledgeProposalFormDialog 
          open={formOpen} 
          onOpenChange={setFormOpen} 
        />
      )}
    </div>
  );
}
