import { MoreHorizontal, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { PROFILES_QUERY_KEY, useProfiles } from "@/hooks/useProfiles";
import { supabase } from "@/lib/supabase";

type InviteRole = "Admin" | "Viewer";

export default function DashboardTeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profilesQuery = useProfiles();
  const profiles = profilesQuery.data ?? [];
  const collaboratorsCount = 0;
  const isAdmin = user?.role === "Admin";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("Viewer");
  const [sendingInvite, setSendingInvite] = useState(false);

  const placeholder = (title: string) =>
    toast({ title, description: "Team invite workflow will be connected in a later phase." });

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = inviteName.trim();
    const trimmedEmail = inviteEmail.trim().toLowerCase();

    if (!isAdmin) {
      toast({ title: "Only admins can invite teammates.", variant: "destructive" });
      return;
    }
    if (!trimmedName) {
      toast({ title: "Name is required.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Enter a valid email address.", variant: "destructive" });
      return;
    }

    setSendingInvite(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Sign in again before inviting a teammate.");

      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          role: inviteRole,
          projectAccess: "all",
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof result?.error?.message === "string"
            ? result.error.message
            : "Failed to invite teammate.";
        throw new Error(message);
      }

      await queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
      setInviteName("");
      setInviteEmail("");
      setInviteRole("Viewer");
      setInviteOpen(false);
      toast({ title: "Invite sent", description: `${trimmedEmail} has been added to the team list.` });
    } catch (err) {
      toast({
        title: "Invite failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSendingInvite(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage workspace access and collaborator visibility.</p>
        </div>
        {isAdmin ? (
          <Button size="sm" className="gap-2 text-xs" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} />
            Add Teammate
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-semibold text-slate-500">Core Users</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{profiles.length}</div>
              </div>
              <Users size={22} className="text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-semibold text-slate-500">Collaborators</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{collaboratorsCount}</div>
              </div>
              <ShieldCheck size={22} className="text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Core Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Project access</TableHead>
                <TableHead>Security / MFA</TableHead>
                <TableHead className="w-10">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900">{profile.full_name || profile.email}</div>
                    <div className="text-xs text-slate-500">{profile.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{profile.role}</Badge></TableCell>
                  <TableCell className="text-slate-600">All projects</TableCell>
                  <TableCell><Badge variant="outline">MFA status pending</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => placeholder("Team actions")}>
                      <MoreHorizontal size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {profilesQuery.isLoading && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">Loading team...</TableCell></TableRow>
              )}
              {!profilesQuery.isLoading && profiles.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">No profiles visible for this role.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add teammate</DialogTitle>
            <DialogDescription>Invite a core user with access to all projects.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="teammate-name" className="text-xs">Name</Label>
                <Input
                  id="teammate-name"
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="teammate-email" className="text-xs">Email</Label>
                <Input
                  id="teammate-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project access</Label>
                <Input value="All projects" readOnly className="h-9 bg-slate-50" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={sendingInvite}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendingInvite}>
                {sendingInvite ? "Sending..." : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
