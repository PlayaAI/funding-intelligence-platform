import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { grants } from "@/data/grants";
import { useApplications } from "@/hooks/useApplications";
import { useTasks } from "@/hooks/useTasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import { toast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CalendarClock,
  CheckSquare,
  FileText,
  Star,
  Sparkles,
  ArrowRight,
  Trophy,
  Clock,
  Plus,
  Search,
  Target,
  Activity,
  Network,
  BarChart2,
  Shield,
} from "lucide-react";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const RECENT_ACTIVITY = [
  { id: "ra1", type: "submission", text: "Application submitted for Burning Man Project — Arts & Community Innovation", date: "2026-03-29", href: "/dashboard/applications/a3" },
  { id: "ra2", type: "task", text: "Task completed: Draft executive summary for Wellspring application", date: "2026-05-10", href: "/dashboard/tasks" },
  { id: "ra3", type: "grant", text: "New grant added: Mozilla Foundation — Humane Technology Initiative", date: "2026-05-08", href: "/dashboard/grants/g2" },
  { id: "ra4", type: "note", text: "Funder notes updated: Wellspring Foundation — Sarah Chen confirmed interest", date: "2026-05-07", href: "/dashboard/funders/f4" },
  { id: "ra5", type: "proof", text: "Proof item added: Connect App Field Sessions — Burning Man 2024", date: "2026-05-05", href: "/dashboard/proof-items" },
  { id: "ra6", type: "grant", text: "Grant status updated: MIT Solve — Indigenous Communities Fellowship → Applying", date: "2026-05-03", href: "/dashboard/grants/g1" },
];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  submission: <Trophy size={12} className="text-green-500" />,
  task: <CheckSquare size={12} className="text-blue-500" />,
  grant: <Target size={12} className="text-primary" />,
  note: <FileText size={12} className="text-amber-500" />,
  proof: <Shield size={12} className="text-violet-500" />,
};

export default function DashboardHomePage() {
  const { user } = useAuth();
  const { data: applications = [] } = useApplications();
  const { data: allTasks = [] } = useTasks();

  const top3 = grants.filter((g) => g.isTop3);
  const upcoming = grants
    .filter((g) => !["Awarded", "Declined", "Archived"].includes(g.status))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);
  const activeApps = applications.filter((a) => !["Submitted", "Awarded", "Declined", "Archived"].includes(a.status));
  const dueTasks = allTasks
    .filter((t) => t.status !== "Complete")
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    })
    .slice(0, 5);
  const needsReview = grants.filter((g) => g.status === "Researching");

  const handleAI = () => {
    toast({ title: "AI workflow coming soon", description: "AI workflow will be connected in a later phase." });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good morning{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Here's what needs your attention this week.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleAI}>
          <Sparkles size={13} />
          Weekly readiness report
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Star size={15} className="text-amber-600" />
              </div>
              <span className="text-xs text-slate-500 font-medium">Top 3 Grants</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{top3.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">active priorities</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText size={15} className="text-blue-600" />
              </div>
              <span className="text-xs text-slate-500 font-medium">Applications</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{activeApps.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">in progress</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <CalendarClock size={15} className="text-violet-600" />
              </div>
              <span className="text-xs text-slate-500 font-medium">Upcoming Deadlines</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {grants.filter((g) => daysUntil(g.deadline) <= 30 && daysUntil(g.deadline) > 0 && !["Awarded", "Declined", "Archived", "Submitted"].includes(g.status)).length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">within 30 days</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckSquare size={15} className="text-green-600" />
              </div>
              <span className="text-xs text-slate-500 font-medium">Open Tasks</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {allTasks.filter((t) => t.status !== "Complete").length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">need action</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/grants">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Plus size={12} />
              Add Grant
            </Button>
          </Link>
          <Link href="/dashboard/applications">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <FileText size={12} />
              View Applications
            </Button>
          </Link>
          <Link href="/dashboard/tasks">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <CheckSquare size={12} />
              View Tasks
            </Button>
          </Link>
          <Link href="/dashboard/matches">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Target size={12} />
              Grant Matches
            </Button>
          </Link>
          <Link href="/dashboard/proof-items">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Shield size={12} />
              Proof Items
            </Button>
          </Link>
          <Link href="/dashboard/peers">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Network size={12} />
              Peer Intel
            </Button>
          </Link>
          <Link href="/dashboard/reports">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <BarChart2 size={12} />
              Reports
            </Button>
          </Link>
          <Link href="/dashboard/tracker">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Search size={12} />
              Grant Tracker
            </Button>
          </Link>
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleAI}>
            <Sparkles size={12} />
            Weekly AI Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Star size={14} className="text-amber-500" />
                  Top 3 Focus Grants
                </CardTitle>
                <Link href="/dashboard/grants">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">View all <ArrowRight size={12} /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {top3.map((g) => {
                const days = daysUntil(g.deadline);
                return (
                  <Link href={`/dashboard/grants/${g.id}`} key={g.id}>
                    <div className="flex items-start justify-between p-3 rounded-lg border border-slate-100 hover:border-primary/30 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-slate-800 truncate">{g.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{g.funderName} · {formatDate(g.deadline)}</div>
                        {g.notes && <div className="text-xs text-slate-500 mt-1 line-clamp-1">{g.notes}</div>}
                      </div>
                      <div className="ml-3 flex-shrink-0 text-right space-y-1">
                        <GrantStatusBadge status={g.status} />
                        <div className={`text-xs font-medium ${days <= 14 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-slate-500"}`}>
                          {days <= 0 ? "Past deadline" : `${days}d left`}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText size={14} className="text-blue-500" />
                  Active Applications
                </CardTitle>
                <Link href="/dashboard/applications">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">View all <ArrowRight size={12} /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {activeApps.length > 0 ? activeApps.map((a) => {
                return (
                  <Link href={`/dashboard/applications/${a.id}`} key={a.id}>
                    <div className="flex items-start justify-between p-3 rounded-lg border border-slate-100 hover:border-primary/30 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-slate-800 truncate">{a.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{a.owner_name ?? "Unassigned"}</div>
                      </div>
                      <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          a.status === "Drafting" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          a.status === "Internal Review" ? "bg-violet-50 text-violet-700 border-violet-200" :
                          "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>{a.status}</span>
                      </div>
                    </div>
                  </Link>
                );
              }) : (
                <div className="text-center py-6 text-slate-400 text-sm">No active applications.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock size={14} className="text-slate-500" />
                  Upcoming Deadlines
                </CardTitle>
                <Link href="/dashboard/grants">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">View all <ArrowRight size={12} /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {upcoming.map((g) => {
                  const days = daysUntil(g.deadline);
                  return (
                    <Link href={`/dashboard/grants/${g.id}`} key={g.id}>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-800 truncate">{g.title}</div>
                          <div className="text-xs text-slate-400">{g.funderName}</div>
                        </div>
                        <div className="ml-3 text-right flex-shrink-0">
                          <div className="text-xs font-medium text-slate-700">{formatDate(g.deadline)}</div>
                          <div className={`text-xs ${days <= 14 ? "text-red-600 font-semibold" : days <= 30 ? "text-amber-600 font-medium" : "text-slate-400"}`}>
                            {days <= 0 ? "Overdue" : `${days} days`}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity size={14} className="text-slate-500" />
                  Recent Activity
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {RECENT_ACTIVITY.map((item) => (
                <Link href={item.href} key={item.id}>
                  <div className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-slate-200 transition-colors">
                      {ACTIVITY_ICONS[item.type] ?? <Activity size={11} className="text-slate-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-700 leading-snug line-clamp-1">{item.text}</div>
                    </div>
                    <div className="text-[11px] text-slate-400 flex-shrink-0 mt-0.5">{timeAgo(item.date)}</div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckSquare size={14} className="text-slate-500" />
                  Tasks Due This Week
                </CardTitle>
                <Link href="/dashboard/tasks">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">All <ArrowRight size={12} /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {dueTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2 py-1.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    t.priority === "High" || t.priority === "Urgent" ? "bg-red-400" : t.priority === "Medium" ? "bg-amber-400" : "bg-slate-300"
                  }`} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700 leading-snug">{t.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.due_date ? `Due ${formatDate(t.due_date)}` : "No due date"}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {needsReview.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                  <AlertCircle size={14} className="text-amber-500" />
                  Needs Review
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {needsReview.map((g) => (
                  <Link href={`/dashboard/grants/${g.id}`} key={g.id}>
                    <div className="text-xs font-medium text-amber-800 hover:text-amber-900 cursor-pointer py-1">{g.title}</div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}



          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy size={14} className="text-green-500" />
                Submitted
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {applications.filter((a) => a.status === "Submitted").map((a) => (
                <Link href={`/dashboard/applications/${a.id}`} key={a.id}>
                  <div className="text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer py-1 leading-snug">{a.title}</div>
                </Link>
              ))}
              <div className="text-[11px] text-slate-400">Awaiting decision</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
