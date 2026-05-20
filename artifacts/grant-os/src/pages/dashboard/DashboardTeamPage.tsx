import { MoreHorizontal, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useProfiles } from "@/hooks/useProfiles";

export default function DashboardTeamPage() {
  const profilesQuery = useProfiles();
  const profiles = profilesQuery.data ?? [];
  const collaboratorsCount = 0;

  const placeholder = (title: string) =>
    toast({ title, description: "Team invite workflow will be connected in a later phase." });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage workspace access and collaborator visibility.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2 text-xs">
              <UserPlus size={14} />
              Add Teammate
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => placeholder("Invite Core User")}>Invite Core User</DropdownMenuItem>
            <DropdownMenuItem onClick={() => placeholder("Add Collaborator")}>Add Collaborator</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    </div>
  );
}
