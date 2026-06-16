import { MoreHorizontal, ShieldCheck, UserPlus, Users, CheckCircle2, XCircle, Ban, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { PROFILES_QUERY_KEY, useProfiles } from "@/hooks/useProfiles";
import { supabase } from "@/lib/supabase";
import type { ProfileRow } from "@/types/database";

type InviteRole = "Admin" | "Viewer" | "Grant Lead" | "Contributor";

export default function DashboardTeamPage() {
  const { user, hasSession } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "Admin";
  
  // Use admin fetcher if admin, otherwise normal profiles
  const adminUsersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      
      const res = await fetch("/api/admin/users", {
        headers: {
          authorization: `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to fetch users");
      return data.users as ProfileRow[];
    },
    enabled: isAdmin && hasSession,
  });

  const normalProfilesQuery = useProfiles();
  const isLoading = isAdmin ? adminUsersQuery.isLoading : normalProfilesQuery.isLoading;
  const profiles = isAdmin ? (adminUsersQuery.data ?? []) : (normalProfilesQuery.data ?? []);
  
  const approvedProfiles = profiles.filter(p => p.access_status === "approved" || !p.access_status);
  const pendingProfiles = profiles.filter(p => p.access_status === "pending");
  const rejectedProfiles = profiles.filter(p => p.access_status === "rejected");
  const disabledProfiles = profiles.filter(p => p.access_status === "disabled");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("Viewer");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [activeTab, setActiveTab] = useState("approved");

  async function handleAdminAction(userId: string, action: string, role?: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      
      const payload: any = { userId };
      if (role) payload.role = role;
      
      const res = await fetch(`/api/admin/users/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Failed to ${action} user`);
      
      toast({ title: "Success", description: data.message || `User ${action} successful` });
      adminUsersQuery.refetch();
    } catch (err) {
      toast({ 
        title: "Action failed", 
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  }

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = inviteName.trim();
    const trimmedEmail = inviteEmail.trim().toLowerCase();

    if (!isAdmin) {
      toast({ title: "Only admins can invite teammates.", variant: "destructive" });
      return;
    }
    if (!trimmedName || !trimmedEmail) {
      toast({ title: "Name and email are required.", variant: "destructive" });
      return;
    }

    setSendingInvite(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in again before inviting a teammate.");

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
        throw new Error(result?.error?.message || "Failed to invite teammate.");
      }

      await adminUsersQuery.refetch();
      setInviteName("");
      setInviteEmail("");
      setInviteRole("Viewer");
      setInviteOpen(false);
      setActiveTab("approved");
      toast({ title: "Invite sent", description: `${trimmedEmail} has been added to the team.` });
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

  const renderTable = (items: ProfileRow[], showActions: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name / Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          {showActions && isAdmin && <TableHead className="w-10">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((profile) => (
          <TableRow key={profile.id}>
            <TableCell>
              <div className="font-medium text-slate-900">{profile.full_name || "Unnamed"}</div>
              <div className="text-xs text-slate-500">{profile.email}</div>
            </TableCell>
            <TableCell><Badge variant="secondary">{profile.role}</Badge></TableCell>
            <TableCell>
              <Badge variant={
                profile.access_status === "approved" ? "default" :
                profile.access_status === "pending" ? "secondary" :
                profile.access_status === "rejected" ? "destructive" :
                "outline"
              }>
                {profile.access_status || "approved"}
              </Badge>
            </TableCell>
            {showActions && isAdmin && (
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {profile.access_status === "pending" && (
                      <>
                        <DropdownMenuItem onClick={() => handleAdminAction(profile.id, "approve")}>
                          <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                          Approve Access
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAdminAction(profile.id, "reject")}>
                          <XCircle className="mr-2 h-4 w-4 text-red-600" />
                          Reject Request
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    
                    {(profile.access_status === "approved" || !profile.access_status) && profile.id !== user?.id && (
                      <DropdownMenuItem onClick={() => handleAdminAction(profile.id, "disable")}>
                        <Ban className="mr-2 h-4 w-4 text-orange-600" />
                        Disable Account
                      </DropdownMenuItem>
                    )}
                    
                    {(profile.access_status === "disabled" || profile.access_status === "rejected") && (
                      <DropdownMenuItem onClick={() => handleAdminAction(profile.id, "enable")}>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                        Enable Account
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-slate-500">Change Role</DropdownMenuLabel>
                    {["Admin", "Grant Lead", "Contributor", "Viewer"].map(r => (
                      <DropdownMenuItem 
                        key={r} 
                        disabled={profile.role === r || profile.id === user?.id}
                        onClick={() => handleAdminAction(profile.id, "update-role", r)}
                      >
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Make {r}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            )}
          </TableRow>
        ))}
        {isLoading && (
          <TableRow><TableCell colSpan={isAdmin ? 4 : 3} className="py-8 text-center text-sm text-slate-500">Loading...</TableCell></TableRow>
        )}
        {!isLoading && items.length === 0 && (
          <TableRow><TableCell colSpan={isAdmin ? 4 : 3} className="py-8 text-center text-sm text-slate-500">No users found.</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage workspace access and collaborator visibility.</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-2 text-xs" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} />
            Invite Teammate
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-4">
            <div className="text-xs uppercase font-semibold text-slate-500">Approved</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{approvedProfiles.length}</div>
          </CardContent>
        </Card>
        {isAdmin && (
          <>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-4">
                <div className="text-xs uppercase font-semibold text-amber-600">Pending Requests</div>
                <div className="text-2xl font-bold text-amber-700 mt-1">{pendingProfiles.length}</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-4">
                <div className="text-xs uppercase font-semibold text-red-600">Rejected</div>
                <div className="text-2xl font-bold text-red-700 mt-1">{rejectedProfiles.length}</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-4">
                <div className="text-xs uppercase font-semibold text-slate-500">Disabled</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{disabledProfiles.length}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card className="border-slate-200 shadow-sm">
        {isAdmin ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-0 border-b border-slate-100">
              <TabsList className="bg-transparent h-12 w-full justify-start rounded-none border-b-0 p-0">
                <TabsTrigger 
                  value="approved" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-900 rounded-none px-4 h-12"
                >
                  Approved
                </TabsTrigger>
                <TabsTrigger 
                  value="pending" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-900 rounded-none px-4 h-12"
                >
                  Pending {pendingProfiles.length > 0 && <Badge variant="secondary" className="ml-2">{pendingProfiles.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger 
                  value="rejected" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-900 rounded-none px-4 h-12"
                >
                  Rejected
                </TabsTrigger>
                <TabsTrigger 
                  value="disabled" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-900 rounded-none px-4 h-12"
                >
                  Disabled
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="p-0">
              <TabsContent value="approved" className="m-0 border-t-0">
                {renderTable(approvedProfiles, true)}
              </TabsContent>
              <TabsContent value="pending" className="m-0 border-t-0">
                {renderTable(pendingProfiles, true)}
              </TabsContent>
              <TabsContent value="rejected" className="m-0 border-t-0">
                {renderTable(rejectedProfiles, true)}
              </TabsContent>
              <TabsContent value="disabled" className="m-0 border-t-0">
                {renderTable(disabledProfiles, true)}
              </TabsContent>
            </CardContent>
          </Tabs>
        ) : (
          <>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(approvedProfiles, false)}
            </CardContent>
          </>
        )}
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite teammate</DialogTitle>
            <DialogDescription>Invite a user and immediately grant them approved access.</DialogDescription>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Grant Lead">Grant Lead</SelectItem>
                  <SelectItem value="Contributor">Contributor</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
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
