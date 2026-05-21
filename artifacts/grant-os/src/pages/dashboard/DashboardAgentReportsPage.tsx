import { useState } from "react";
import { FileText, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { useAgentReports, useCreateAgentReport } from "@/hooks/useAgentReports";
import { useCreateAgentActivity } from "@/hooks/useAgentActivity";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import AgentReportFormDialog, { type AgentReportFormValues } from "@/components/dashboard/AgentReportFormDialog";
import { AgentSourceBadge, AgentTypeBadge } from "@/components/dashboard/AgentBadge";

export default function DashboardAgentReportsPage() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { user } = useAuth();
  const { canCreateTable } = usePermissions();
  const { data: reports = [], isLoading, isError, error } = useAgentReports();
  const createReport = useCreateAgentReport();
  const createActivity = useCreateAgentActivity();

  const handleSubmit = async (values: AgentReportFormValues) => {
    try {
      await createReport.mutateAsync({ ...values, created_by: user?.id ?? null });
      await createActivity.mutateAsync({
        actor_source: values.source,
        action_type: "report_generated",
        title: `Report saved: ${values.title}`,
        description: values.content.slice(0, 180),
        related_project_id: values.related_project_id,
        related_grant_id: values.related_grant_id,
        related_application_id: values.related_application_id,
        created_by: user?.id ?? null,
      });
      toast({ title: "Agent report saved", description: values.title });
      setOpen(false);
    } catch (e) {
      toast({ title: "Failed to save report", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText size={18} />Agent Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Readiness reports and reviews generated outside Grant OS and stored here.</p>
        </div>
        {canCreateTable("agent_reports") && <Button size="sm" className="gap-2 text-xs" onClick={() => setOpen(true)}><Plus size={13} />Add report</Button>}
      </div>
      {isLoading && <div className="flex justify-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" />Loading reports...</div>}
      {isError && <div className="text-sm text-red-600">Could not load reports: {error instanceof Error ? error.message : String(error)}</div>}
      {!isLoading && reports.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-slate-400">No reports yet.</CardContent></Card>}
      <div className="space-y-3">
        {reports.map((report) => (
          <Collapsible key={report.id} open={expanded === report.id} onOpenChange={(isOpen) => setExpanded(isOpen ? report.id : null)}>
            <Card className="border-slate-200">
              <CollapsibleTrigger asChild>
                <button className="w-full text-left">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><CardTitle className="text-sm">{report.title}</CardTitle><div className="text-[11px] text-slate-400 mt-1">{new Date(report.created_at).toLocaleString()}</div></div>
                      <div className="flex items-center gap-1.5 flex-shrink-0"><AgentSourceBadge source={report.source} /><AgentTypeBadge type={report.report_type} /></div>
                    </div>
                  </CardHeader>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent><CardContent className="pt-0"><p className="text-sm text-slate-600 whitespace-pre-wrap">{report.content}</p>{report.structured_data && <pre className="mt-3 max-h-56 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(report.structured_data, null, 2)}</pre>}</CardContent></CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
      <AgentReportFormDialog open={open} onOpenChange={setOpen} onSubmit={handleSubmit} loading={createReport.isPending} />
    </div>
  );
}
