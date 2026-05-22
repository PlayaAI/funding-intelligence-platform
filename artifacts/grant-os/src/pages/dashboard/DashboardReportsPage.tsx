import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useReportsData, type ApplicationWorkloadRecord, type FunderIntelRecord, type GrantPipelineRecord, type ProjectReadinessRecord } from "@/hooks/useReportsData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { exportCsv, exportJson } from "@/lib/reports/reportExports";
import {
  deadlineWindowForDays,
  decisionBadgeClass,
  decisionLabelText,
  formatCurrency,
  type DeadlineWindow,
} from "@/lib/reports/reportUtils";
import { AlertCircle, BarChart2, CalendarClock, CheckSquare, Database, Download, FileText, FolderKanban, Landmark, Loader2, Search } from "lucide-react";

type DecisionFilter = "all" | "apply_now" | "prepare_next" | "monitor" | "needs_review" | "skip" | "track_next_cycle" | "not_generated";

const deadlineFilters: Array<{ value: DeadlineWindow; label: string }> = [
  { value: "all", label: "All deadlines" },
  { value: "today", label: "Due today" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "rolling", label: "Rolling" },
  { value: "past", label: "Past" },
  { value: "unknown", label: "Unknown" },
];

function StatCard({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: "slate" | "green" | "blue" | "amber" | "red" | "violet" }) {
  const tones = {
    slate: "border-slate-200 text-slate-900",
    green: "border-green-200 bg-green-50/30 text-green-700",
    blue: "border-blue-200 bg-blue-50/30 text-blue-700",
    amber: "border-amber-200 bg-amber-50/30 text-amber-700",
    red: "border-red-200 bg-red-50/30 text-red-700",
    violet: "border-violet-200 bg-violet-50/30 text-violet-700",
  };
  return (
    <Card className={tones[tone]}>
      <CardContent className="pt-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, description, children }: { icon: typeof BarChart2; title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon size={15} className="text-slate-500" />
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${className ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>{children}</span>;
}

function Select({ value, onChange, children, className = "" }: { value: string; onChange: (value: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 ${className}`}>
      {children}
    </select>
  );
}

function grantCsvRows(rows: GrantPipelineRecord[]) {
  return rows.map((record) => ({
    title: record.grant.title,
    funder: record.grant.funder_name ?? "",
    project: record.project?.name ?? "",
    status: record.grant.status,
    deadline: record.deadlineLabel,
    amount: record.amount,
    decision_label: record.match?.decision_label ?? "",
    match_score: record.match?.match_score ?? "",
    top_risk: record.topRisk,
    recommended_action: record.recommendedAction,
  }));
}

function projectCsvRows(rows: ProjectReadinessRecord[]) {
  return rows.map((record) => ({
    project: record.project.name,
    readiness_score: record.readinessScore,
    readiness_level: record.readinessLevel,
    proof_items: record.proofCount,
    documents: record.documentCount,
    applications: record.applicationCount,
    open_tasks: record.openTasks,
    completed_tasks: record.completedTasks,
    matches: record.matchCount,
    missing_materials: record.missingMaterials.join("; "),
  }));
}

function funderCsvRows(rows: FunderIntelRecord[]) {
  return rows.map((record) => ({
    funder: record.funder.name,
    type: record.funder.relationship_status ?? "",
    location: record.funder.location ?? "",
    ein: record.funder.ein ?? "",
    website: record.funder.website ?? "",
    median_grant_amount: record.funder.median_grant_amount ?? "",
    total_giving: record.funder.annual_giving ?? "",
    assets: record.funder.assets ?? "",
    invite_only: /invite|invitation/i.test(`${record.funder.openness_to_new_grantees ?? ""} ${record.funder.notes ?? ""}`),
    linked_grants: record.linkedGrantCount,
  }));
}

function applicationCsvRows(rows: ApplicationWorkloadRecord[]) {
  return rows.map((record) => ({
    application: record.application.title,
    grant: record.grant?.title ?? "",
    project: record.project?.name ?? "",
    status: record.application.status,
    deadline: record.deadlineLabel,
    open_tasks: record.openTasks,
    completed_tasks: record.completedTasks,
    required_documents: record.requiredDocuments,
  }));
}

export default function DashboardReportsPage() {
  const reports = useReportsData();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineWindow>("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredPipeline = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.pipelineRecords.filter((record) => {
      const decision = record.match?.decision_label ?? "not_generated";
      const status = record.grant.status;
      const matchesSearch = !q || [record.grant.title, record.grant.funder_name, record.project?.name, record.topRisk].some((value) => (value ?? "").toLowerCase().includes(q));
      const matchesProject = projectFilter === "all" || record.project?.id === projectFilter || record.grant.related_project_id === projectFilter;
      const matchesDecision = decisionFilter === "all" || decision === decisionFilter;
      const window = deadlineWindowForDays(record.daysLeft, record.deadlineWindow);
      const matchesDeadline = deadlineFilter === "all" || window === deadlineFilter || (deadlineFilter === "60" && record.daysLeft !== null && record.daysLeft >= 0 && record.daysLeft <= 60);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesProject && matchesDecision && matchesDeadline && matchesStatus;
    });
  }, [reports.pipelineRecords, search, projectFilter, decisionFilter, deadlineFilter, statusFilter]);

  const deadlineGroups = useMemo(() => {
    const active = reports.pipelineRecords.filter((record) => !["Awarded", "Declined", "Archived"].includes(record.grant.status));
    return [
      { label: "Due today", rows: active.filter((record) => record.daysLeft === 0) },
      { label: "Due in 7 days", rows: active.filter((record) => record.daysLeft !== null && record.daysLeft > 0 && record.daysLeft <= 7) },
      { label: "Due in 14 days", rows: active.filter((record) => record.daysLeft !== null && record.daysLeft > 7 && record.daysLeft <= 14) },
      { label: "Due in 30 days", rows: active.filter((record) => record.daysLeft !== null && record.daysLeft > 14 && record.daysLeft <= 30) },
      { label: "Due in 60 days", rows: active.filter((record) => record.daysLeft !== null && record.daysLeft > 30 && record.daysLeft <= 60) },
      { label: "Rolling", rows: active.filter((record) => record.deadlineWindow === "rolling") },
      { label: "Past deadline / track next cycle", rows: active.filter((record) => record.deadlineWindow === "past") },
      { label: "Deadline unknown", rows: active.filter((record) => record.deadlineWindow === "unknown") },
    ];
  }, [reports.pipelineRecords]);

  const exportFullJson = () => {
    exportJson("grant-os-full-reports.json", {
      generated_at: new Date().toISOString(),
      report_type: "grant_os_full_reports",
      summary_metrics: reports.metrics,
      records: {
        grant_pipeline: grantCsvRows(reports.pipelineRecords),
        project_readiness: projectCsvRows(reports.projectRecords),
        funder_intelligence: funderCsvRows(reports.funderRecords),
        application_workload: applicationCsvRows(reports.applicationRecords),
      },
    });
  };

  if (reports.isLoading) {
    return <div className="p-6 max-w-7xl mx-auto flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading reports…</div>;
  }

  if (reports.isError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2">
          <AlertCircle size={16} className="mt-0.5" />
          <div>
            <p className="font-semibold">Reports failed to load</p>
            <p className="text-xs mt-1">{reports.error instanceof Error ? reports.error.message : "Unknown error"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm mt-0.5">Grant intelligence reports built from real Supabase data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportCsv("grant-pipeline.csv", grantCsvRows(filteredPipeline))}><Download size={13} /> Grant Pipeline CSV</Button>
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportCsv("upcoming-deadlines.csv", grantCsvRows(reports.pipelineRecords.filter((record) => record.daysLeft !== null || ["rolling", "past", "unknown"].includes(record.deadlineWindow))))}><Download size={13} /> Deadlines CSV</Button>
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={exportFullJson}><Download size={13} /> Full JSON</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard label="Projects" value={reports.metrics.projects} />
        <StatCard label="Grants" value={reports.metrics.grants} tone="blue" />
        <StatCard label="Funders" value={reports.metrics.funders} />
        <StatCard label="Documents" value={reports.metrics.documents} />
        <StatCard label="Matches" value={reports.metrics.matches} tone="violet" />
        <StatCard label="Due 30 Days" value={reports.metrics.dueSoonGrants} tone="amber" />
        <StatCard label="Missing Elig." value={reports.metrics.missingEligibility} tone="red" />
        <StatCard label="Open Tasks" value={reports.metrics.openTasks} tone="green" />
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <SectionHeader icon={BarChart2} title="Grant Pipeline Report" description="Prioritized opportunities with match data when available and deadline/status fallback otherwise.">
            {reports.metrics.matches === 0 && <Badge>Generate matches for deeper prioritization.</Badge>}
          </SectionHeader>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <StatCard label="Active/Open" value={reports.metrics.activeGrants} />
            <StatCard label="Rolling" value={reports.metrics.rollingGrants} />
            <StatCard label="Due Soon" value={reports.metrics.dueSoonGrants} tone="amber" />
            <StatCard label="Past Deadline" value={reports.metrics.pastDeadlineGrants} tone="red" />
            <StatCard label="High Value" value={reports.metrics.highValueGrants} tone="green" />
            <StatCard label="Missing Elig." value={reports.metrics.missingEligibility} tone="red" />
            <StatCard label="Needs Review" value={reports.metrics.needsReview} tone="violet" />
            <StatCard label="Total" value={reports.metrics.grants} />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search grants…" className="h-8 pl-8 text-xs w-56" />
            </div>
            <Select value={projectFilter} onChange={setProjectFilter}>
              <option value="all">All projects</option>
              {reports.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
            <Select value={decisionFilter} onChange={(value) => setDecisionFilter(value as DecisionFilter)}>
              <option value="all">All decisions</option>
              <option value="apply_now">Apply Now</option>
              <option value="prepare_next">Prepare Next</option>
              <option value="monitor">Monitor</option>
              <option value="needs_review">Needs Review</option>
              <option value="skip">Skip</option>
              <option value="track_next_cycle">Track Next Cycle</option>
              <option value="not_generated">Not generated</option>
            </Select>
            <Select value={deadlineFilter} onChange={(value) => setDeadlineFilter(value as DeadlineWindow)}>
              {deadlineFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </Select>
            <Select value={statusFilter} onChange={setStatusFilter}>
              <option value="all">All statuses</option>
              {Array.from(new Set(reports.grants.map((grant) => grant.status))).map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">{["Grant", "Funder", "Project", "Deadline", "Amount", "Decision", "Score", "Top risk", ""].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {filteredPipeline.slice(0, 50).map((record) => (
                  <tr key={record.grant.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 min-w-64 font-medium text-slate-800 line-clamp-1">{record.grant.title}</td>
                    <td className="py-2 pr-3 text-slate-600">{record.grant.funder_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{record.project?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{record.deadlineLabel}</td>
                    <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{record.amount}</td>
                    <td className="py-2 pr-3"><Badge className={decisionBadgeClass(record.match?.decision_label)}>{decisionLabelText(record.match?.decision_label)}</Badge></td>
                    <td className="py-2 pr-3 text-slate-700">{record.match?.match_score ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-500 min-w-72 line-clamp-1">{record.topRisk}</td>
                    <td className="py-2 pr-0 text-right"><Link href={`/dashboard/grants/${record.grant.id}`} className="text-xs text-primary font-medium">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPipeline.length === 0 && <div className="text-center py-8 text-sm text-slate-400">No grants match the current filters.</div>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <SectionHeader icon={CalendarClock} title="Upcoming Deadlines Report" description="Deadline windows with clear urgency language; works even before matching is generated.">
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportCsv("upcoming-deadlines.csv", grantCsvRows(reports.pipelineRecords))}><Download size={13} /> Export CSV</Button>
          </SectionHeader>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deadlineGroups.map((group) => (
            <div key={group.label} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-700">{group.label}</h3>
                <Badge>{group.rows.length}</Badge>
              </div>
              <div className="space-y-2">
                {group.rows.slice(0, 6).map((record) => (
                  <Link key={record.grant.id} href={`/dashboard/grants/${record.grant.id}`}>
                    <div className="rounded-md hover:bg-slate-50 p-2">
                      <div className="text-xs font-medium text-slate-800 line-clamp-1">{record.grant.title}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{record.grant.funder_name ?? "—"} · {record.amount} · {record.match ? `Score ${record.match.match_score}` : "No match yet"}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{record.recommendedAction}</div>
                    </div>
                  </Link>
                ))}
                {group.rows.length === 0 && <p className="text-xs text-slate-400 py-2">No grants in this window.</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <SectionHeader icon={FolderKanban} title="Project Readiness Report" description="Completeness, proof, documents, applications, tasks, and best available matches.">
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportCsv("project-readiness.csv", projectCsvRows(reports.projectRecords))}><Download size={13} /> Export CSV</Button>
          </SectionHeader>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reports.projectRecords.map((record) => (
            <div key={record.project.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/dashboard/projects/${record.project.slug}`} className="font-semibold text-sm text-slate-800 hover:text-primary">{record.project.name}</Link>
                  <div className="text-xs text-slate-500 mt-0.5">{record.project.category ?? "—"}</div>
                </div>
                <Badge className={record.readinessScore >= 75 ? "bg-green-50 text-green-700 border-green-200" : record.readinessScore >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"}>{record.readinessScore}% · {record.readinessLevel}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded p-2"><div className="text-lg font-bold">{record.proofCount}</div><div className="text-[10px] text-slate-500">Proof</div></div>
                <div className="bg-slate-50 rounded p-2"><div className="text-lg font-bold">{record.documentCount}</div><div className="text-[10px] text-slate-500">Docs</div></div>
                <div className="bg-slate-50 rounded p-2"><div className="text-lg font-bold">{record.applicationCount}</div><div className="text-[10px] text-slate-500">Apps</div></div>
              </div>
              <div className="text-xs text-slate-600">Tasks: {record.openTasks} open / {record.completedTasks} complete · Matches: {record.matchCount}</div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Missing materials</div>
                <p className="text-xs text-slate-600 line-clamp-2">{record.missingMaterials.join(", ") || "No obvious gaps from available data."}</p>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Upcoming linked deadlines</div>
                <p className="text-xs text-slate-600 line-clamp-2">{record.upcomingDeadlines.map((deadline) => `${deadline.grant.title} (${deadline.deadlineLabel})`).join("; ") || "No upcoming linked deadlines."}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <SectionHeader icon={Landmark} title="Funder Intelligence Report" description="Funder coverage, available opportunities, giving indicators, and direct funder links.">
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportCsv("funder-intelligence.csv", funderCsvRows(reports.funderRecords))}><Download size={13} /> Export CSV</Button>
          </SectionHeader>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <StatCard label="Total" value={reports.metrics.funders} />
            <StatCard label="With EIN" value={reports.metrics.fundersWithEin} />
            <StatCard label="With Website" value={reports.metrics.fundersWithWebsite} />
            <StatCard label="Invite-only" value={reports.metrics.inviteOnlyFunders} tone="amber" />
            <StatCard label="Available Grants" value={reports.metrics.fundersWithAvailableGrants} tone="blue" />
            <StatCard label="Missing Website" value={reports.metrics.fundersMissingWebsite} tone="red" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">{["Funder", "Location", "EIN", "Website", "Median", "Giving/Assets", "Invite", "Grants", ""].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {reports.funderRecords.slice(0, 50).map((record) => (
                  <tr key={record.funder.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 min-w-56 font-medium text-slate-800 line-clamp-1">{record.funder.name}</td>
                    <td className="py-2 pr-3 text-slate-600">{record.funder.location ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{record.funder.ein ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{record.funder.website ? "Yes" : "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{formatCurrency(record.funder.median_grant_amount)}</td>
                    <td className="py-2 pr-3 text-slate-600">{formatCurrency(record.funder.annual_giving ?? record.funder.assets)}</td>
                    <td className="py-2 pr-3 text-slate-600">{/invite|invitation/i.test(`${record.funder.openness_to_new_grantees ?? ""} ${record.funder.notes ?? ""}`) ? "Yes" : "—"}</td>
                    <td className="py-2 pr-3 text-slate-700">{record.linkedGrantCount}</td>
                    <td className="py-2 pr-0 text-right"><Link href={`/dashboard/funders/${record.funder.id}`} className="text-xs text-primary font-medium">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <SectionHeader icon={CheckSquare} title="Application Workload Report" description="Applications, task load, upcoming deadlines, and required document signals.">
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportCsv("application-workload.csv", applicationCsvRows(reports.applicationRecords))}><Download size={13} /> Export CSV</Button>
          </SectionHeader>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <StatCard label="Applications" value={reports.metrics.applications} />
            <StatCard label="Active" value={reports.metrics.activeApplications} tone="blue" />
            <StatCard label="Submitted" value={reports.metrics.submittedApplications} tone="green" />
            <StatCard label="Open Tasks" value={reports.metrics.openTasks} />
            <StatCard label="Overdue Tasks" value={reports.metrics.overdueTasks} tone="red" />
            <StatCard label="High Priority" value={reports.metrics.highPriorityTasks} tone="amber" />
          </div>
          {reports.applicationRecords.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b">{["Application", "Grant", "Project", "Status", "Deadline", "Tasks", "Req. docs", ""].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {reports.applicationRecords.slice(0, 40).map((record) => (
                    <tr key={record.application.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 min-w-56 font-medium text-slate-800 line-clamp-1">{record.application.title}</td>
                      <td className="py-2 pr-3 text-slate-600 line-clamp-1">{record.grant?.title ?? "—"}</td>
                      <td className="py-2 pr-3 text-slate-600">{record.project?.name ?? "—"}</td>
                      <td className="py-2 pr-3"><Badge>{record.application.status}</Badge></td>
                      <td className="py-2 pr-3 text-slate-600">{record.deadlineLabel}</td>
                      <td className="py-2 pr-3 text-slate-600">{record.openTasks} open / {record.completedTasks} done</td>
                      <td className="py-2 pr-3 text-slate-600">{record.requiredDocuments}</td>
                      <td className="py-2 pr-0 text-right"><Link href={`/dashboard/applications/${record.application.id}`} className="text-xs text-primary font-medium">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-lg p-8 text-center">
              <FileText size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">No applications yet</p>
              <p className="text-xs text-slate-500 mt-1">Create applications from high-priority grants once the team selects opportunities to pursue.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <SectionHeader icon={Database} title="Data Quality / Import Health Report" description="Database-derived checks for imported Instrumentl data. Local import-data reports are intentionally unavailable in the browser." />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <StatCard label="Projects" value={reports.metrics.projects} />
            <StatCard label="Grants" value={reports.metrics.grants} />
            <StatCard label="Funders" value={reports.metrics.funders} />
            <StatCard label="Documents" value={reports.metrics.documents} />
            <StatCard label="Matches" value={reports.metrics.matches} />
            <StatCard label="No Deadline" value={reports.metrics.grantsMissingDeadline} tone="amber" />
            <StatCard label="No Amount" value={reports.metrics.grantsMissingAmount} tone="amber" />
            <StatCard label="No Funder" value={reports.metrics.grantsMissingFunder} tone="red" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="font-medium text-slate-800 mb-2">Grant data gaps</div>
              <p className="text-xs text-slate-600">Missing eligibility: {reports.metrics.missingEligibility}</p>
              <p className="text-xs text-slate-600">Missing deadline: {reports.metrics.grantsMissingDeadline}</p>
              <p className="text-xs text-slate-600">Duplicate-risk title/funder pairs: {reports.metrics.duplicateRiskGrants}</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="font-medium text-slate-800 mb-2">Funder data gaps</div>
              <p className="text-xs text-slate-600">Missing website: {reports.metrics.fundersMissingWebsite}</p>
              <p className="text-xs text-slate-600">Missing EIN: {reports.metrics.fundersMissingEin}</p>
              <p className="text-xs text-slate-600">With available opportunities: {reports.metrics.fundersWithAvailableGrants}</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="font-medium text-slate-800 mb-2">Document health</div>
              <p className="text-xs text-slate-600">Unsupported extraction: {reports.metrics.documentsUnsupported}</p>
              <p className="text-xs text-slate-600">Unlinked documents: {reports.metrics.documentsUnlinked}</p>
              <p className="text-xs text-slate-500 mt-2">Import summary files are local-only and not read by the frontend.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
