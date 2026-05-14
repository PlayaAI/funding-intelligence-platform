import { grants } from "@/data/grants";
import { tasks } from "@/data/tasks";
import { applications } from "@/data/applications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { BarChart2, Download, Sparkles, TrendingUp, Clock, Trophy, FileText } from "lucide-react";

export default function DashboardReportsPage() {
  const awarded = grants.filter((g) => g.status === "Awarded").length;
  const submitted = grants.filter((g) => g.status === "Submitted").length;
  const declined = grants.filter((g) => g.status === "Declined").length;
  const applying = grants.filter((g) => g.status === "Applying").length;
  const totalGrants = grants.length;
  const completedTasks = tasks.filter((t) => t.status === "Complete").length;
  const totalTasks = tasks.length;

  const statusGroups = [
    { label: "Planned", count: grants.filter((g) => g.status === "Planned").length, color: "bg-slate-300" },
    { label: "Researching", count: grants.filter((g) => g.status === "Researching").length, color: "bg-blue-400" },
    { label: "Applying", count: applying, color: "bg-violet-500" },
    { label: "Submitted", count: submitted, color: "bg-amber-400" },
    { label: "Awarded", count: awarded, color: "bg-green-500" },
    { label: "Declined", count: declined, color: "bg-red-400" },
    { label: "Archived", count: grants.filter((g) => g.status === "Archived").length, color: "bg-gray-300" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm mt-0.5">Grant activity overview and readiness reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() =>
            toast({ title: "Export report", description: "Report export coming in next phase." })
          }>
            <Download size={13} />
            Export
          </Button>
          <Button size="sm" className="gap-2 text-xs" onClick={() =>
            toast({ title: "Weekly readiness report", description: "AI workflow will be connected in a later phase." })
          }>
            <Sparkles size={13} />
            Weekly Readiness Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">Total Grants</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{totalGrants}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={14} className="text-green-500" />
              <span className="text-xs text-green-600">Awarded</span>
            </div>
            <div className="text-3xl font-bold text-green-700">{awarded}</div>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/30">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-violet-500" />
              <span className="text-xs text-violet-600">Applying</span>
            </div>
            <div className="text-3xl font-bold text-violet-700">{applying}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">Tasks Done</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{completedTasks}/{totalTasks}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 size={14} />
            Grant Pipeline by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statusGroups.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-600 text-right flex-shrink-0">{s.label}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full rounded-lg transition-all ${s.color}`}
                    style={{ width: totalGrants > 0 ? `${(s.count / totalGrants) * 100}%` : "0%" }}
                  />
                </div>
                <div className="w-8 text-xs font-semibold text-slate-700 flex-shrink-0">{s.count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Applications Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {applications.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <div className="text-xs font-medium text-slate-700 line-clamp-1">{a.grantTitle}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${
                    a.status === "Submitted" ? "bg-violet-50 text-violet-700 border-violet-200" :
                    a.status === "Writing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    "bg-slate-100 text-slate-600 border-slate-200"
                  }`}>{a.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">AI Weekly Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              Generate an AI-powered weekly readiness summary covering grant priorities, deadlines, blocked applications, and recommended actions.
            </p>
            <Button size="sm" className="gap-2 text-xs w-full" onClick={() =>
              toast({ title: "Weekly readiness report", description: "AI workflow will be connected in a later phase." })
            }>
              <Sparkles size={12} />
              Generate Weekly Report
            </Button>
            <p className="text-[11px] text-slate-400 text-center mt-2">AI workflow will be connected in a later phase.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
