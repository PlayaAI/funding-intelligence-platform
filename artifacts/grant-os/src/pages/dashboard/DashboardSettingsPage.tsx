import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Building2, Users, Zap, Link2, Save, UserCircle } from "lucide-react";

export default function DashboardSettingsPage() {
  const { user } = useAuth();

  const handleSave = () => toast({ title: "Settings saved", description: "Settings editing will be connected in a later phase." });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your organization and platform settings.</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList className="h-9">
          <TabsTrigger value="account" className="text-xs">Account</TabsTrigger>
          <TabsTrigger value="org" className="text-xs">Organization</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">AI Settings</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCircle size={15} />
                Your account
              </CardTitle>
              <CardDescription className="text-xs">
                Signed in with Supabase Auth. Role changes are managed in Supabase for now.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Name</Label>
                <p className="text-sm text-slate-900">{user?.name ?? "—"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Email</Label>
                <p className="text-sm text-slate-900">{user?.email ?? "—"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Role</Label>
                <Badge variant="secondary" className="text-xs">{user?.role ?? "—"}</Badge>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-2">
                <p className="font-medium text-slate-800">Managing roles</p>
                <p>
                  Admins can update roles in Supabase → Table Editor → <code className="font-mono bg-slate-100 px-1 rounded">profiles</code>,
                  or run SQL: <code className="font-mono bg-slate-100 px-1 rounded">update profiles set role = &apos;Grant Lead&apos; where email = &apos;…&apos;;</code>
                </p>
                <p>New users: Supabase → Authentication → Users → Add user. A profile row is created automatically.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="org" className="mt-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 size={15} />
                Organization Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Organization Name</Label>
                <Input defaultValue="Playa AI" className="text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mission Statement</Label>
                <Input defaultValue="Building technology for human connection and community flourishing." className="text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Website</Label>
                <Input defaultValue="https://playa.ai" className="text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">EIN / Tax Status</Label>
                <Input placeholder="EIN or fiscal sponsor info" className="text-sm h-9" />
                <p className="text-xs text-slate-400">Required for grant applications requiring 501(c)(3) status.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fiscal Sponsor</Label>
                <Input placeholder="e.g. Fractured Atlas" className="text-sm h-9" />
              </div>
              <Button size="sm" className="gap-2 text-xs" onClick={handleSave}>
                <Save size={12} />
                Save changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={15} />
                Team Members
              </CardTitle>
              <CardDescription className="text-xs">Manage who has access to Grant OS.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                Team management UI is not built yet. Create users in Supabase Authentication and set roles on the{" "}
                <code className="font-mono bg-slate-100 px-1 rounded">profiles</code> table.
                Allowed roles: Admin, Grant Lead, Contributor, Viewer.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles size={15} />
                AI Configuration
              </CardTitle>
              <CardDescription className="text-xs">Configure how AI assists your grant work.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                AI workflows will be connected in a later phase. The settings below represent the planned configuration.
              </div>
              {[
                {
                  label: "Summarize Grant",
                  desc: "Auto-generate structured summaries of grant opportunities.",
                },
                {
                  label: "Analyze Fit",
                  desc: "Score grants against project profiles with reasoning.",
                },
                {
                  label: "Draft Application Answers",
                  desc: "AI drafts application responses using your proof and project data.",
                },
                {
                  label: "Suggest Proof Items",
                  desc: "Recommend the most relevant proof items for each application.",
                },
              ].map((setting) => (
                <div key={setting.label} className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{setting.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{setting.desc}</div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs flex-shrink-0">Planned</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 size={15} />
                Integrations
              </CardTitle>
              <CardDescription className="text-xs">Connect external tools and services.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  name: "Google Docs / Drive",
                  desc: "Link application workspaces to Google Docs and Drive folders.",
                  status: "Manual links only",
                },
                {
                  name: "Instrumentl",
                  desc: "Import grant opportunities and funder data.",
                  status: "Planned",
                },
                {
                  name: "Candid / Foundation Directory",
                  desc: "Access funder profiles and 990 data.",
                  status: "Planned",
                },
                {
                  name: "Notion",
                  desc: "Sync project documentation and team notes.",
                  status: "Planned",
                },
              ].map((integration) => (
                <div key={integration.name} className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Zap size={13} className="text-slate-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-800">{integration.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{integration.desc}</div>
                    </div>
                  </div>
                  <Badge
                    className={`text-xs flex-shrink-0 ${
                      integration.status === "Manual links only"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {integration.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
