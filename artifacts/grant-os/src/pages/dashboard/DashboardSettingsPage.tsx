import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Bot, Building2, Link2, Lock, Save, UserCircle } from "lucide-react";

export default function DashboardSettingsPage() {
  const { user } = useAuth();

  const placeholder = (title: string) =>
    toast({ title, description: "This setting is a placeholder for a later phase." });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account, organization profile, and workspace preferences.</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="account" className="text-xs">Account</TabsTrigger>
          <TabsTrigger value="organization" className="text-xs">Organization Profile</TabsTrigger>
          <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs">Integrations</TabsTrigger>
          <TabsTrigger value="agents" className="text-xs">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><UserCircle size={15} />Your account</CardTitle>
              <CardDescription className="text-xs">Signed in through Supabase Auth.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Name</Label>
                <Input value={user?.name ?? ""} readOnly className="h-9 bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Email</Label>
                <Input value={user?.email ?? ""} readOnly className="h-9 bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Role</Label>
                <div><Badge variant="secondary">{user?.role ?? "-"}</Badge></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Timezone</Label>
                <Input value="Workspace default" readOnly className="h-9 bg-slate-50" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Building2 size={15} />Organization Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Organization Name</Label>
                  <Input defaultValue="Playa AI" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Website</Label>
                  <Input defaultValue="https://playa.ai" className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mission Statement</Label>
                <Input defaultValue="Building technology for human connection and community flourishing." className="h-9" />
              </div>
              <Button size="sm" className="gap-2 text-xs" onClick={() => placeholder("Organization saved")}>
                <Save size={12} />
                Save changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Lock size={15} />Security</CardTitle>
              <CardDescription className="text-xs">Password and MFA controls stay with Supabase Auth for now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Change password and MFA management are placeholders in V0.7.2.</div>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => placeholder("Change password")}>Change password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Link2 size={15} />Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["Instrumentl imports", "Google Drive links", "Calendar sharing", "Accounting integrations"].map((item) => (
                <div key={item} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                  <span className="text-sm text-slate-800">{item}</span>
                  <Badge variant="outline">Placeholder</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Bot size={15} />Agent-ready mode</CardTitle>
              <CardDescription className="text-xs">Grant OS stores external agent outputs without connecting native AI providers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                OpenClaw, Codex, or another operator can generate JSON outside the app, then paste it into Agent Import. Grant OS will store notes, reports, selected task suggestions, exports, and activity logs. No API keys are stored here.
              </div>
              <pre className="rounded-md bg-slate-950 p-3 text-xs text-slate-100 overflow-auto">{`{
  "type": "agent_report",
  "source": "codex",
  "report_type": "weekly_readiness",
  "title": "Weekly Grant Readiness Report",
  "content": "Top priorities this week...",
  "related_project_id": "uuid",
  "structured_data": {}
}`}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
