import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAgentToken, listAgentTokens, revokeAgentToken, type AgentTokenMetadata } from "@/lib/agent-mcp/agentTokenClient";
import { Bot, CheckCircle2, Copy, KeyRound, Lock, ShieldAlert, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

const baseUrl = "https://grant-os.replit.app";

const endpoints = [
  "GET /api/mcp/doctor",
  "GET /api/mcp/tools",
  "POST /api/mcp/call",
  "GET /api/agent/doctor",
  "POST /api/agent/tool",
  "GET /api/agent/approvals",
];

const readTools = ["get_agent_token_self", "list_mcp_capabilities", "get_next_best_grant_target", "get_cleanup_preview", "get_deadline_brief", "get_missing_evidence_report"];
const writeSafeTools = ["request_mutation_approval", "get_mutation_approval", "execute_approved_mutation", "batch_archive_expired_grants", "create_application_from_grant", "bulk_create_tasks_from_checklist"];
const blockedTools = ["archive_record", "run_scraping_job", "submission or outreach tools"];

const selectableScopes = [
  ["mcp:read", "Read compact Grant OS context"],
  ["mcp:write_safe_dry_run", "Preview safe mutations and request approval"],
  ["mcp:grants:archive", "Preview/request grant archives"],
  ["mcp:grants:update_status", "Preview/request grant status changes"],
  ["mcp:grants:top_three", "Preview/request Top 3 changes"],
  ["mcp:applications:create", "Preview/request application creation"],
  ["mcp:applications:update", "Preview/request application updates"],
  ["mcp:tasks:create", "Preview/request task/checklist creation"],
  ["mcp:tasks:update", "Preview/request task updates"],
  ["mcp:proof:read", "Read proof metadata"],
  ["mcp:proof:update", "Preview/request proof updates"],
  ["mcp:knowledge:read", "Read Agent Knowledge"],
  ["mcp:knowledge:propose", "Propose knowledge changes for review"],
  ["mcp:audit:read", "Read audit metadata"],
] as const;

const prompt = "Use Grant OS as the source of truth. Read compact context first. Preview every mutation, request dashboard approval, then poll the approval result and verify readbacks. Never attempt a direct opaque-token write, submission, outreach, hard delete, or unsupported claim approval.";

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
  const [tokens, setTokens] = useState<AgentTokenMetadata[]>([]);
  const [label, setLabel] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);
  const [scopes, setScopes] = useState<string[]>(["mcp:read"]);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTokens = async () => {
    try { setTokens(await listAgentTokens()); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load tokens."); }
  };
  useEffect(() => { void refreshTokens(); }, []);

  const createToken = async () => {
    setBusy(true); setError(null); setPlaintext(null);
    try {
      const result = await createAgentToken({ label, expiryDays, scopes });
      setPlaintext(result.token); setLabel(""); await refreshTokens();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create token."); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Bot size={18} />Agent Setup</h1>
        <p className="text-sm text-slate-500 mt-0.5">Connect external AI assistants through compact tools and authenticated human-approved writes.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound size={15} />Agent access tokens</CardTitle>
          <CardDescription className="text-xs">Tokens are hashed at rest. The plaintext is displayed once; rotation means create a replacement, update the agent, then revoke the old token.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {plaintext && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="text-sm font-semibold text-amber-950">Copy now — this token will not be shown again.</div>
              <div className="flex gap-2"><code className="min-w-0 flex-1 overflow-auto rounded bg-slate-950 p-2 text-xs text-white">{plaintext}</code><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(plaintext)}><Copy size={14} /></Button></div>
              <Button variant="ghost" size="sm" onClick={() => setPlaintext(null)}>I stored it securely</Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
            <div className="space-y-1"><Label htmlFor="token-label">Token label</Label><Input id="token-label" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="Alex – grant triage" /></div>
            <div className="space-y-1"><Label htmlFor="token-expiry">Expires in days</Label><Input id="token-expiry" type="number" min={1} max={365} value={expiryDays} onChange={(event) => setExpiryDays(Number(event.target.value))} /></div>
            <Button disabled={busy || !label.trim()} onClick={() => void createToken()}>{busy ? "Creating…" : "Create token"}</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectableScopes.map(([scope, summary]) => (
              <label key={scope} className="flex items-start gap-2 rounded border border-slate-200 p-2 text-xs">
                <Checkbox checked={scopes.includes(scope)} disabled={scope === "mcp:read"} onCheckedChange={(checked) => setScopes((current) => checked ? [...new Set([...current, scope])] : current.filter((item) => item !== scope))} />
                <span><code>{scope}</code><span className="block text-slate-500">{summary}</span></span>
              </label>
            ))}
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><strong>No direct real-write scope:</strong> opaque tokens request approval. An Admin or Grant Lead reviews the exact plan and executes it with their authenticated RLS session from <a className="underline font-medium" href="/dashboard/agent-approvals">Agent Approvals</a>.</div>
          <div className="space-y-2">
            {tokens.length === 0 && <div className="text-sm text-slate-500">No agent tokens created.</div>}
            {tokens.map((token) => {
              const expired = Boolean(token.expires_at && new Date(token.expires_at) <= new Date());
              const state = token.revoked_at ? "Revoked" : expired ? "Expired" : "Active";
              return <div key={token.id} className="flex flex-col gap-2 rounded border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><div className="font-medium text-sm">{token.label} <Badge variant={state === "Active" ? "outline" : "secondary"}>{state}</Badge></div><div className="text-xs text-slate-500">{token.token_prefix}… · created {new Date(token.created_at).toLocaleDateString()} · expires {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : "never"} · last used {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : "never"}</div><div className="mt-1 flex flex-wrap gap-1">{token.scopes.map((scope) => <Badge key={scope} variant="secondary" className="text-[10px]">{scope}</Badge>)}</div></div>
                {!token.revoked_at && <Button variant="outline" size="sm" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await revokeAgentToken(token.id); await refreshTokens(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not revoke token."); } finally { setBusy(false); } }}>Revoke</Button>}
              </div>;
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Production MCP Base URL</CardTitle>
          <CardDescription className="text-xs">Use placeholders only. Never paste real tokens into shared prompts or screenshots.</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block rounded-md bg-slate-950 p-3 text-xs text-slate-100 overflow-auto">{baseUrl}</code>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert size={15} />Token capabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-950">
          <p><strong>Read-only token:</strong> may call read tools only. Write-safe calls return <code>scope_insufficient</code>.</p>
          <p><strong>Write-safe dry-run token:</strong> may preview write-safe tools and create an approval request. Direct <code>dryRun: false</code> remains rejected.</p>
          <p><strong>Approved writes:</strong> an Admin or Grant Lead reviews and executes the immutable plan through their authenticated RLS session. The token can then poll the committed result.</p>
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
              "Opaque tokens request approvals; they never commit directly.",
              "Approved writes execute with the approving user’s RLS session.",
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
