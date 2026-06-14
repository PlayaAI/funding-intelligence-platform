import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, CheckCircle2, Lock, ShieldAlert, Terminal } from "lucide-react";

const baseUrl = "https://grant-os.replit.app";

const endpoints = [
  "GET /api/mcp/doctor",
  "GET /api/mcp/tools",
  "POST /api/mcp/call",
  "GET /api/agent/doctor",
  "POST /api/agent/tool",
];

const readTools = ["list_grants", "search_grants", "get_grant", "get_dashboard_summary", "get_deadline_report", "generate_application_readiness_report"];
const writeSafeTools = ["create_task", "create_application_from_grant", "generate_application_checklist", "save_agent_match"];
const blockedTools = ["archive_record", "run_scraping_job", "submission or outreach tools"];

const prompt = "Use Grant OS as the source of truth. Read grants, projects, deadlines, tasks, proof items, documents, and reports. Rank opportunities by fit, urgency, deadline, eligibility, funding relevance, effort, and evidence readiness. Use your own AI judgment. Do not mutate data unless I approve. Use dry-run first.";

const curlCommands = [
  {
    title: "Unauthenticated doctor, expected JSON 401",
    command: `curl -i ${baseUrl}/api/mcp/doctor`,
  },
  {
    title: "Authenticated doctor",
    command: `curl -i ${baseUrl}/api/mcp/doctor \\
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>"`,
  },
  {
    title: "List tools",
    command: `curl -s ${baseUrl}/api/mcp/tools \\
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>"`,
  },
  {
    title: "Call search_grants",
    command: `curl -s ${baseUrl}/api/mcp/call \\
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"search_grants","arguments":{"query":"AI","limit":5}}'`,
  },
  {
    title: "Dry-run create_task",
    command: `curl -s ${baseUrl}/api/mcp/call \\
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"create_task","arguments":{"title":"Review best grant matches this week","dryRun":true}}'`,
  },
];

export default function DashboardAgentSettingsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Bot size={18} />Agent Setup</h1>
        <p className="text-sm text-slate-500 mt-0.5">Connect external AI assistants to Grant OS through authenticated, dry-run-first tools.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Production MCP Base URL</CardTitle>
          <CardDescription className="text-xs">Use placeholders only. Never paste real tokens into shared prompts or screenshots.</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block rounded-md bg-slate-950 p-3 text-xs text-slate-100 overflow-auto">{baseUrl}</code>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Terminal size={15} />Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {endpoints.map((endpoint) => <code key={endpoint} className="block rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">{endpoint}</code>)}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Lock size={15} />Safety Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            {[
              "Read tools are allowed.",
              "Write-safe tools default to dry-run.",
              "Real writes require explicit human approval.",
              "Dangerous tools are blocked.",
              "Never use service-role keys.",
              "Never print or store tokens.",
              "Never submit applications or send outreach without approval.",
            ].map((item) => <div key={item} className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 text-emerald-600" /><span>{item}</span></div>)}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Example Operating Prompt For Alex</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{prompt}</div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Sample curl Commands</CardTitle>
          <CardDescription className="text-xs">Replace placeholders locally. Do not expose actual tokens in the UI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {curlCommands.map((item) => (
            <div key={item.title} className="space-y-1.5">
              <div className="text-xs font-medium text-slate-700">{item.title}</div>
              <pre className="rounded-md bg-slate-950 p-3 text-xs text-slate-100 overflow-auto">{item.command}</pre>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <ToolCard title="Read Tools" tools={readTools} tone="read" />
        <ToolCard title="Write-Safe Dry-Run Tools" tools={writeSafeTools} tone="write" />
        <ToolCard title="Blocked Or Approval-Required" tools={blockedTools} tone="blocked" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert size={15} />How Alex Should Use This Daily</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {[
            "What grants should we focus on this week?",
            "What deadlines are urgent?",
            "What is the best match today?",
            "What evidence is missing?",
            "Create a dry-run task plan.",
          ].map((item) => <div key={item} className="rounded-md border border-slate-200 px-3 py-2">{item}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}

function ToolCard({ title, tools, tone }: { title: string; tools: string[]; tone: "read" | "write" | "blocked" }) {
  const variant = tone === "blocked" ? "destructive" : tone === "write" ? "secondary" : "outline";
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {tools.map((tool) => <Badge key={tool} variant={variant}>{tool}</Badge>)}
      </CardContent>
    </Card>
  );
}
