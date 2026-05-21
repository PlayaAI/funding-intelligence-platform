import { Bot, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgentActivity } from "@/hooks/useAgentActivity";
import { AgentSourceBadge } from "@/components/dashboard/AgentBadge";

export default function DashboardAgentActivityPage() {
  const { data: logs = [], isLoading, isError, error } = useAgentActivity(100);
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Bot size={18} />Agent Activity</h1>
        <p className="text-sm text-slate-500 mt-0.5">Recent human and external agent actions recorded in Grant OS.</p>
      </div>
      {isLoading && <div className="flex justify-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" />Loading activity...</div>}
      {isError && <div className="text-sm text-red-600">Could not load activity: {error instanceof Error ? error.message : String(error)}</div>}
      {!isLoading && logs.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-slate-400">No activity recorded yet.</CardContent></Card>}
      <div className="space-y-3">
        {logs.map((log) => (
          <Card key={log.id} className="border-slate-200"><CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="font-medium text-sm text-slate-800">{log.title}</div>{log.description && <p className="text-sm text-slate-500 mt-1">{log.description}</p>}<div className="text-[11px] text-slate-400 mt-2">{new Date(log.created_at).toLocaleString()}</div></div>
              <div className="flex items-center gap-1.5 flex-shrink-0"><AgentSourceBadge source={log.actor_source} /><Badge variant="outline" className="text-[11px]">{log.action_type.replace(/_/g, " ")}</Badge></div>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
