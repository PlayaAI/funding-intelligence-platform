import { useState } from "react";
import { Link } from "wouter";
import { applications } from "@/data/applications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Plus, AlertCircle, CheckCircle2, Clock, FileArchive, LayoutList, LayoutGrid } from "lucide-react";

const APP_STATUSES = ["Draft", "Writing", "Internal Review", "Ready to Submit", "Submitted", "Won", "Rejected"];

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Writing: "bg-blue-50 text-blue-700 border-blue-200",
  "Internal Review": "bg-amber-50 text-amber-700 border-amber-200",
  "Ready to Submit": "bg-teal-50 text-teal-700 border-teal-200",
  Submitted: "bg-violet-50 text-violet-700 border-violet-200",
  Won: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default function DashboardApplicationsPage() {
  const [view, setView] = useState<"table" | "board">("table");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Applications</h1>
          <p className="text-slate-500 text-sm mt-0.5">{applications.length} application workspaces</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setView("table")}
              className={`p-1.5 rounded text-slate-500 transition-colors ${view === "table" ? "bg-slate-100 text-slate-800" : "hover:bg-slate-50"}`}
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setView("board")}
              className={`p-1.5 rounded text-slate-500 transition-colors ${view === "board" ? "bg-slate-100 text-slate-800" : "hover:bg-slate-50"}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          <Button
            size="sm"
            className="gap-2 text-xs"
            onClick={() => toast({ title: "Create application", description: "Application creation coming in next phase." })}
          >
            <Plus size={14} />
            New application
          </Button>
        </div>
      </div>

      {view === "table" ? (
        <div className="space-y-3">
          {applications.map((a) => {
            const days = daysUntil(a.deadline);
            const isBlocked = a.requiredDocs.some((d) => d.status === "Missing");
            const completedDocs = a.requiredDocs.filter((d) => d.status === "Ready").length;
            const completedQs = a.questions.filter((q) => ["Draft Ready", "Reviewed"].includes(q.status)).length;
            return (
              <Link href={`/dashboard/applications/${a.id}`} key={a.id}>
                <Card className="border-slate-200 hover:border-primary/40 cursor-pointer transition-all hover:shadow-sm">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileArchive size={16} className="text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-sm line-clamp-1">{a.grantTitle}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{a.projectName} · {a.owner}</div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={11} />
                              {completedQs}/{a.questions.length} Q
                            </span>
                            <span className="flex items-center gap-1">
                              <FileArchive size={11} />
                              {completedDocs}/{a.requiredDocs.length} docs
                            </span>
                            {isBlocked && (
                              <span className="flex items-center gap-1 text-red-500 font-medium">
                                <AlertCircle size={11} />
                                Missing docs
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[a.status]}`}>
                          {a.status}
                        </span>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={11} />
                          {a.status === "Submitted" && a.submittedDate
                            ? `Submitted ${formatDate(a.submittedDate)}`
                            : days <= 0
                            ? "Past deadline"
                            : `${formatDate(a.deadline)} (${days}d)`}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {APP_STATUSES.map((col) => {
              const colApps = applications.filter((a) => a.status === col);
              return (
                <div key={col} className="w-60 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[col]}`}>
                      {col}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
                      {colApps.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {colApps.map((a) => (
                      <Link href={`/dashboard/applications/${a.id}`} key={a.id}>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 hover:border-primary/40 cursor-pointer transition-colors">
                          <div className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug mb-1">
                            {a.grantTitle}
                          </div>
                          <div className="text-[11px] text-slate-400">{a.projectName}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Due {formatDate(a.deadline)}
                          </div>
                        </div>
                      </Link>
                    ))}
                    {colApps.length === 0 && (
                      <div className="text-xs text-slate-300 text-center py-6 border-2 border-dashed border-slate-100 rounded-lg">
                        None
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
