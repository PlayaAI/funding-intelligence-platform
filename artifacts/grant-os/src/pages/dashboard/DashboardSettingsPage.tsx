import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { updateOwnProfile } from "@/lib/profilesService";
import { Bot, Building2, Link2, Lock, Save, UserCircle } from "lucide-react";

export default function DashboardSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [savingAccount, setSavingAccount] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  const placeholder = (title: string) =>
    toast({ title, description: "This setting is a placeholder for a later phase." });

  async function handleAccountSave() {
    if (!user) return;
    setSavingAccount(true);
    try {
      await updateOwnProfile({
        userId: user.id,
        fullName: name.trim() || null,
      });
      await refreshUser();
      toast({
        title: "Account saved",
        description: "Name saved. Timezone remains workspace default because profiles has no timezone field.",
      });
    } catch (err) {
      toast({
        title: "Failed to save account",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleOpenPasswordDialog() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      const providers = data.user?.identities?.map((identity) => identity.provider).filter(Boolean) ?? [];
      const googleOnly = providers.length > 0 && providers.every((provider) => provider === "google");
      if (googleOnly) {
        toast({
          title: "Password changes are only available for email/password accounts.",
          description: "Google accounts should manage password through Google.",
          variant: "destructive",
        });
        return;
      }

      setPasswordDialogOpen(true);
    } catch (err) {
      toast({
        title: "Unable to check account provider",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordDialogOpen(false);
      toast({ title: "Password updated." });
    } catch (err) {
      toast({
        title: "Failed to update password",
        description: err instanceof Error ? err.message : "Supabase rejected the password update.",
        variant: "destructive",
      });
    } finally {
      setUpdatingPassword(false);
    }
  }

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
                <Input value={name} onChange={(event) => setName(event.target.value)} className="h-9" />
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
                <p className="text-xs text-slate-500">Timezone persistence needs a profiles timezone column.</p>
              </div>
              <div className="md:col-span-2">
                <Button size="sm" className="gap-2 text-xs" onClick={handleAccountSave} disabled={!user || savingAccount}>
                  <Save size={12} />
                  {savingAccount ? "Saving..." : "Save changes"}
                </Button>
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
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Password changes are available for email/password accounts. MFA is not implemented yet.</div>
              <Button size="sm" variant="outline" className="text-xs" onClick={handleOpenPasswordDialog}>Change password</Button>
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
                OpenClaw, Codex, or another operator can analyze exported Grant OS JSON outside the app, including documents with extracted text, then paste notes, reports, selected task suggestions, or document notes into Agent Import. No API keys are stored here.
              </div>
              <Link href="/dashboard/settings/agents">
                <Button size="sm" variant="outline" className="gap-2 text-xs">
                  <Bot size={12} />
                  Open Agent/MCP setup
                </Button>
              </Link>
              <pre className="rounded-md bg-slate-950 p-3 text-xs text-slate-100 overflow-auto">{`{
  "type": "document_note",
  "source": "openclaw",
  "document_id": "uuid",
  "title": "Document Review Notes",
  "content": "This guideline requires a 500-word impact statement.",
  "structured_data": {
    "requirements": ["500-word impact statement"]
  }
}`}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Set a new password for this email/password account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="h-9"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={updatingPassword}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatingPassword}>
                {updatingPassword ? "Updating..." : "Update password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
