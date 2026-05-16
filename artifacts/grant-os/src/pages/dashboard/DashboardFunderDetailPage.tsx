import { useMemo, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useMappedFunder,
  useUpdateFunder,
  useArchiveFunder,
  useDeleteFunder,
} from "@/hooks/useFunders";
import { useMappedGrants } from "@/hooks/useGrants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import FunderFormDialog, { type FunderFormValues } from "@/components/dashboard/FunderFormDialog";
import { funderFormValuesToInsert } from "@/lib/funderFormUtils";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Plus,
  Building2,
  Mail,
  User,
  Hash,
  FileBarChart2,
  Pencil,
  Archive,
  Trash2,
  Loader2,
} from "lucide-react";

function fmt(n: number) {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

export default function DashboardFunderDetailPage() {
  const [, params] = useRoute("/dashboard/funders/:id");
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { funder, funderRow, isLoading, isError, error } = useMappedFunder(params?.id);
  const { grants } = useMappedGrants();
  const updateFunder = useUpdateFunder();
  const archiveFunder = useArchiveFunder();
  const deleteFunder = useDeleteFunder();

  const relatedGrants = useMemo(() => {
    if (!funder) return [];
    return grants.filter((g) => funder.relatedGrantIds.includes(g.id));
  }, [funder, grants]);

  const handleAI = (action: string) =>
    toast({ title: action, description: "AI workflow will be connected in a later phase." });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading funder…
        </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-600 text-sm">
        Could not load funder: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (!funder || !funderRow) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Funder not found.</p>
        <Link href="/dashboard/funders">
          <Button variant="ghost" className="mt-4 gap-2">
            <ArrowLeft size={14} />
            Back to funders
          </Button>
        </Link>
      </div>
    );
  }

  const handleEdit = async (values: FunderFormValues) => {
    try {
      await updateFunder.mutateAsync({
        id: funder.id,
        updates: funderFormValuesToInsert(values),
      });
      toast({ title: "Funder updated", description: values.name });
      setEditOpen(false);
    } catch (e) {
      toast({
        title: "Failed to update funder",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      throw e;
    }
  };

  const handleArchive = async () => {
    try {
      await archiveFunder.mutateAsync(funder.id);
      toast({ title: "Funder archived", description: funder.name });
      setConfirmArchive(false);
      navigate("/dashboard/funders");
    } catch (e) {
      toast({
        title: "Failed to archive funder",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFunder.mutateAsync(funder.id);
      toast({ title: "Funder deleted", description: funder.name });
      setConfirmDelete(false);
      navigate("/dashboard/funders");
    } catch (e) {
      toast({
        title: "Failed to delete funder",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <Link href="/dashboard/funders">
        <Button variant="ghost" size="sm" className="gap-2 text-xs h-8">
          <ArrowLeft size={14} />
          Funder Intelligence
        </Button>
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <Building2 size={22} className="text-slate-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{funder.name}</h1>
              <div className="text-sm text-slate-500">{funder.location}</div>
              {funder.ein && (
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                  <Hash size={10} />
                  EIN: <span className="font-mono">{funder.ein}</span>
                </div>
              )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full border ${
              funder.openApplications
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            {funder.openApplications ? "Open applications" : "By invitation only"}
          </span>
          <span className="text-xs text-slate-500">{funder.relationshipStatus}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleAI("Summarize Funder")}>
          <Sparkles size={12} />
          Summarize Funder
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleAI("Suggest Project Angle")}>
          <Sparkles size={12} />
          Best Project Angle
        </Button>
        {funder.website && (
          <a href={funder.website} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <ExternalLink size={12} />
              Website
            </Button>
          </a>
        )}
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
          <Pencil size={12} />
          Edit
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setConfirmArchive(true)}>
          <Archive size={12} />
          Archive
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={12} />
          Delete
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="contact" className="text-xs">Contact & 990</TabsTrigger>
          <TabsTrigger value="grants" className="text-xs">Grants ({relatedGrants.length})</TabsTrigger>
          <TabsTrigger value="grantees" className="text-xs">Past Grantees</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Financial Profile</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {funder.totalAssets && (
                  <div>
                    <span className="text-slate-500 text-xs">Total Assets</span>
                    <div className="font-medium mt-0.5">{funder.totalAssets}</div>
                  </div>
                )}
                {funder.annualGiving && (
                  <div>
                    <span className="text-slate-500 text-xs">Annual Giving</span>
                    <div className="font-medium mt-0.5">{funder.annualGiving}</div>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 text-xs">Median Grant</span>
                  <div className="font-medium mt-0.5">{fmt(funder.medianGrantAmount)}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Peer Connections</span>
                  <div className="font-medium mt-0.5">{funder.peerConnections} organizations</div>
                </div>
                {funder.ein && (
                  <div>
                    <span className="text-slate-500 text-xs">EIN</span>
                    <div className="font-mono font-medium mt-0.5 text-sm">{funder.ein}</div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Giving Areas</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {funder.givingCategories.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="mt-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User size={13} className="text-slate-400" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funder.contactName ? (
                <>
                  <div>
                    <div className="text-xs text-slate-500">Program Officer / Contact</div>
                    <div className="font-medium text-slate-800 mt-0.5">{funder.contactName}</div>
                    {funder.contactTitle && (
                      <div className="text-xs text-slate-400">{funder.contactTitle}</div>
                    )}
                  </div>
                  {funder.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-400 flex-shrink-0" />
                      <a href={`mailto:${funder.contactEmail}`} className="text-sm text-primary hover:underline">
                        {funder.contactEmail}
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-400">No contact recorded yet.</div>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1" onClick={() => setEditOpen(true)}>
                Edit Contact
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileBarChart2 size={13} className="text-slate-400" />
                990 / Financial Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funder.ein ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Hash size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 text-xs">EIN:</span>
                    <span className="font-mono font-medium text-slate-700">{funder.ein}</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs text-slate-400">
                    Full 990 data will be pulled from ProPublica Nonprofit Explorer in a later phase.
                  </div>
                  <a
                    href={`https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(funder.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <ExternalLink size={11} />
                      View on ProPublica
                    </Button>
                  </a>
                </>
              ) : (
                <div className="text-sm text-slate-400">No EIN recorded. Add an EIN to unlock 990 lookups.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grants" className="mt-4 space-y-3">
          {relatedGrants.map((g) => (
            <Link href={`/dashboard/grants/${g.id}`} key={g.id}>
              <Card className="border-slate-200 hover:border-primary/40 cursor-pointer transition-colors">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-slate-800">{g.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {g.deadline
                          ? new Date(g.deadline).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </div>
                    </div>
                    <GrantStatusBadge status={g.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {relatedGrants.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No grants linked to this funder.</div>
          )}
          <Link href="/dashboard/grants">
            <Button size="sm" variant="outline" className="gap-2 text-xs">
              <Plus size={12} />
              View all grants
            </Button>
          </Link>
        </TabsContent>

        <TabsContent value="grantees" className="mt-4">
          {funder.pastGrantees && funder.pastGrantees.length > 0 ? (
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Known Past Grantees</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {funder.pastGrantees.map((g) => (
                    <li key={g} className="text-sm text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                      {g}
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="gap-2 text-xs mt-4" onClick={() => handleAI("Analyze Peer Patterns")}>
                  <Sparkles size={12} />
                  Analyze patterns
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-10 text-slate-400 text-sm">
                No past grantees recorded. Add peer org funding records to build this view.
              </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              {funder.notes ? (
                <p className="text-sm text-slate-700">{funder.notes}</p>
              ) : (
                <p className="text-sm text-slate-400">No notes yet.</p>
              )}
              <Button size="sm" variant="outline" className="gap-2 text-xs mt-4" onClick={() => setEditOpen(true)}>
                Edit Notes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FunderFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        defaultValues={funderRow}
        title="Edit funder"
        submitLabel="Save changes"
        loading={updateFunder.isPending}
      />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this funder?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{funder.name}&quot; will be archived and hidden from the funders list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this funder?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{funder.name}&quot; will be removed from the database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
